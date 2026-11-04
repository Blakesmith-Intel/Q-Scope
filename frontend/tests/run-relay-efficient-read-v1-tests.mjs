import assert from "node:assert/strict";
import worker from "../../relay/worker.js";
import {createRelayEfficiency,SAFE_TEXT_PRODUCT_ROUTES} from
  "../../relay/relay-efficiency-v1.js";

// Same-handler in-flight deduplication is transparent, not a second source,
// a new polling interval, or a general-purpose stale response cache.
let n=0;
let release;
const pending=new Promise(resolve=>{release=resolve;});
const efficient=createRelayEfficiency();
const target=new Request("https://relay.invalid/river-height-bulletins",{
  headers:{Origin:"https://blakesmith-intel.github.io"}
});
async function response(){
  n++;
  await pending;
  return new Response(JSON.stringify({marker:"original"}),{headers:{
    "Cache-Control":"public,max-age=60","Content-Type":"application/json"
  }});
}
const first=efficient.identicalRead(target,response);
const second=efficient.identicalRead(target,response);
await Promise.resolve(); // ensure first retrieve started
release();
const [a,b]=await Promise.all([first,second]);
assert.equal(n,1,"Simultaneous identical product requests should use one execution");
assert.equal((await a.json()).marker,"original");
assert.equal((await b.json()).marker,"original");
assert.equal(b.headers.get("X-StormTracker-Relay-Cache"),"COALESCED");
assert.equal(b.headers.get("Cache-Control"),"public,max-age=60",
  "Approved product TTL must stay identical");
assert.equal(efficient.stats.coalesced,1);
assert.equal(SAFE_TEXT_PRODUCT_ROUTES.has("/wmts"),false,
  "Radar tile transport stays untouched");
assert.equal(SAFE_TEXT_PRODUCT_ROUTES.has("/radar-frame"),false);
assert.equal(SAFE_TEXT_PRODUCT_ROUTES.has("/ftp-live-frame"),false);
assert.equal(efficient.stats.historyHits,0);
for(const url of [
  "https://relay.invalid/river-height-bulletins?force=1",
  "https://relay.invalid/river-height-bulletins?force=1"
]){
  await efficient.identicalRead(new Request(url),async()=>new Response("manual"));
}
assert.equal(efficient.stats.coalesced,1);
assert.equal(efficient.stats.source,1,
  "Forced/manual requests must bypass single-flight as approved");
let rasterCalls=0;
const rasterReq=new Request("https://relay.invalid/wmts?time=2026-11-05T01:00:00Z");
await Promise.all([1,2].map(()=>efficient.identicalRead(rasterReq,
  async()=>{rasterCalls++;return new Response("image");})));
assert.equal(rasterCalls,2,"Radar imagery is never coalesced");

// Real Worker route with a synthetic Cloudflare Cache API. Do not change
// official station/product URL, exact-ID verification, or source classification.
const originalFetch=globalThis.fetch;
const originalCaches=globalThis.caches;
const store=new Map();
const putCalls=[];
globalThis.caches={default:{
  match:async key=>store.get(key.url)?.clone()??undefined,
  put:async(key,value)=>{putCalls.push(key.url);store.set(key.url,value.clone());}
}};
const clock=new Date(Date.now()+10*3600000);
const pad=n=>String(n).padStart(2,"0");
const stamped=pad(clock.getUTCDate())+"/"+pad(clock.getUTCMonth()+1)+"/"+
  clock.getUTCFullYear()+" "+pad(clock.getUTCHours())+":"+pad(clock.getUTCMinutes());
const html='<html>Station Number: 540384 <table id="tableStyle1">'+
  '<tr><th>Date/Time</th><th>Water Level (m)</th></tr>'+
  '<tr><td>'+stamped+'</td><td>0.91</td></tr></table></html>';
let upstream=0,fail=false;
globalThis.fetch=async url=>{
  assert.equal(String(url),
    "https://www.bom.gov.au/fwo/IDQ65388/IDQ65388.540384.tbl.shtml");
  upstream++;
  if(fail)return new Response("service refused",{status:503});
  return new Response(html,{status:200});
};
const pages="https://blakesmith-intel.github.io";
const uri="https://relay.invalid/river-recent-history?product=IDQ65388&station=540384";
try{
  const first=await worker.fetch(new Request(uri,{headers:{Origin:pages}}),{});
  assert.equal(first.status,200);
  assert.equal(first.headers.get("X-StormTracker-Relay-Cache"),"MISS");
  assert.equal(first.headers.get("Cache-Control"),"public, max-age=60");
  assert.equal(first.headers.get("Access-Control-Allow-Origin"),pages);
  assert.equal((await first.json()).samples.length,1);
  assert.equal(upstream,1);
  assert.equal(putCalls.length,1);
  const repeated=await worker.fetch(new Request(uri,{headers:{Origin:pages}}),{});
  assert.equal(repeated.status,200);
  assert.equal(repeated.headers.get("X-StormTracker-Relay-Cache"),"HIT");
  assert.equal(repeated.headers.get("Access-Control-Allow-Origin"),pages);
  assert.equal(repeated.headers.get("Cache-Control"),"public, max-age=60");
  assert.ok(Number.isFinite(Number(
    repeated.headers.get("X-StormTracker-Observation-Age-Sec"))));
  assert.equal((await repeated.json()).samples.length,1);
  assert.equal(upstream,1,"Validated history must be shared between operators");
  // Different origin-identity may never reuse an origin-specific CORS response.
  const anonymous=await worker.fetch(new Request(uri),{});
  assert.equal(anonymous.status,200);
  assert.equal(anonymous.headers.get("X-StormTracker-Relay-Cache"),"MISS");
  assert.equal(anonymous.headers.get("Access-Control-Allow-Origin"),null);
  assert.equal(upstream,2);
  const forced=await worker.fetch(new Request(uri+"&force=1",{headers:{Origin:pages}}),{});
  assert.equal(forced.status,200);
  assert.equal(forced.headers.get("X-StormTracker-Relay-Cache"),null);
  assert.equal(upstream,3,"Force must bypass verified parsed cache");
  const invalid=await worker.fetch(new Request(uri.replace("540384","540384x")),{});
  assert.equal(invalid.status,400);
  assert.equal(upstream,3,"Invalid ID may not touch cache or upstream");
  // An upstream failure is never cached as no observations or a valid 0 m.
  store.clear();
  fail=true;
  const error=await worker.fetch(new Request(uri,{headers:{Origin:pages}}),{});
  assert.equal(error.status,503);
  assert.equal(error.headers.get("X-StormTracker-Relay-Cache"),"UNCACHED");
  assert.equal(error.headers.get("Cache-Control"),"no-store");
  assert.equal(store.size,0,"Transient 503 must not enter shared verified cache");
  fail=false;
  const recovered=await worker.fetch(new Request(uri,{headers:{Origin:pages}}),{});
  assert.equal(recovered.status,200);
  assert.equal(recovered.headers.get("X-StormTracker-Relay-Cache"),"MISS");
  assert.equal((await recovered.json()).samples[0].height,0.91);
}finally{
  globalThis.fetch=originalFetch;
  if(originalCaches===undefined)delete globalThis.caches;
  else globalThis.caches=originalCaches;
}
console.log("PASS relay efficiency: text single-flight, original product requests, short verified shared station history, strict bypass, CORS isolation, source errors never cached, original radar imagery");
