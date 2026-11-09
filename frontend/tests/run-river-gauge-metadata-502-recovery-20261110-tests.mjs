import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {BOM_RIVER_TIDE_GAUGE_QUERY_URL} from
  "../src/context-layers/river-gauges-v1.js";
import {relayVerifiedRiverGaugeMetadata} from
  "../../relay/river-gauge-metadata-recovery-v1.js";
import {loadRiverGaugeOperationalSnapshot} from
  "../src/context-layers/river-gauge-observations-v1.js";

const locations=Array.from({length:600},(_,i)=>({
  type:"Feature",geometry:{type:"Point",coordinates:[145,-28]},
  properties:{bom_stn_num:544019+i,awrc_stateid:"423202C",
    name:"Verified QLD site "+i,lat:-28,long:145,state:"QLD",
    location_types:"water level gauge;",
    forecast_site_classification:"Quantitative",
    agency:"BoM"}
}));
const source={type:"FeatureCollection",features:locations};
const store=new Map();
const cache={
  async match(key){return store.get(key.url)?.clone()??null;},
  async put(key,response){store.set(key.url,response.clone());}
};
const headers=origin=>new Headers({"Access-Control-Allow-Origin":origin});
const errorResponse=(message,status,origin)=>
  new Response(message,{status,headers:headers(origin)});
let clock=Date.now(),calls=0,mode="ok";
const origin="https://blakesmith-intel.github.io";
const url="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/river-gauge-metadata";
const opts={sourceUrl:BOM_RIVER_TIDE_GAUGE_QUERY_URL,
  corsHeaders:headers,errorResponse,getCache:()=>cache,now:()=>clock,
  fetchImpl:async (requested,init)=>{
    calls++;
    assert.equal(requested,BOM_RIVER_TIDE_GAUGE_QUERY_URL,
      "No replacement or speculative source allowed");
    assert.equal(init.method,"GET");
    if(mode==="error")throw Error("source refused");
    if(mode==="bad")return new Response(JSON.stringify({
      type:"FeatureCollection",features:[]}),{status:200});
    if(mode==="http502")return new Response("Bad Gateway",{status:502});
    return new Response(JSON.stringify(source),{status:200});
  }};
const request=new Request(url,{headers:{Origin:origin}});
const first=await relayVerifiedRiverGaugeMetadata(request,origin,opts);
assert.equal(first.status,200);
assert.equal(first.headers.get("X-StormTracker-Metadata-Fallback"),"0");
assert.equal(first.headers.get("Access-Control-Allow-Origin"),origin);
assert.equal((await first.json()).features.length,600);
const firstCount=calls;

mode="error";
clock+=60*1000;
const fresh=await relayVerifiedRiverGaugeMetadata(request,origin,opts);
assert.equal(fresh.status,200);
assert.equal(calls,firstCount,"Valid fresh catalogue skips repeating BoM source");
assert.equal(fresh.headers.get("X-StormTracker-Metadata-Fallback"),"0");

clock+=7*60*60*1000;
const recovered=await relayVerifiedRiverGaugeMetadata(request,origin,opts);
assert.equal(recovered.status,200,"Previously verified catalogue survives source 502");
assert.equal(recovered.headers.get("X-StormTracker-Metadata-Fallback"),"1");
assert.equal((await recovered.json()).features.length,600);
assert.equal(calls,firstCount+1,"After freshness window a real upstream attempt occurs");

mode="bad";
clock+=60*1000;
const invalid=await relayVerifiedRiverGaugeMetadata(request,origin,opts);
assert.equal(invalid.headers.get("X-StormTracker-Metadata-Fallback"),"1",
  "A partial/empty BoM source must not replace verified locations");
mode="http502";
const upstream502=await relayVerifiedRiverGaugeMetadata(request,origin,opts);
assert.equal(upstream502.status,200);
assert.equal(upstream502.headers.get("X-StormTracker-Metadata-Fallback"),"1");

clock+=15*24*60*60*1000;
const expired=await relayVerifiedRiverGaugeMetadata(request,origin,opts);
assert.equal(expired.status,502,"Expired catalogue must not hide prolonged outage");
const neverCached=await relayVerifiedRiverGaugeMetadata(request,origin,{
  ...opts,getCache:()=>null});
assert.equal(neverCached.status,502,"First load without source must show a real failure");

const head=await relayVerifiedRiverGaugeMetadata(new Request(url,{method:"HEAD"}),origin,{
  ...opts,now:()=>Date.now(),fetchImpl:async()=>new Response(
    JSON.stringify(source),{status:200})
});
assert.equal(head.status,200);
assert.equal(head.body,null,"HEAD returns no response body");

// Verify the browser keeps a source-verified catalogue across page reloads.
// Current BoM river-height bulletin retrieval remains compulsory every time.
const memory=new Map();
const priorStorage=globalThis.localStorage;
globalThis.localStorage={
  getItem:key=>memory.get(key)??null,
  setItem:(key,value)=>memory.set(key,value)
};
function bulletins(){
  return {products:[{product:"IDQ60294",observations:[{
    stationId:"544019",stationName:"Verified QLD site 0",
    heightMetres:6.69,observedText:"10:00 am Tue 10/11/2026",
    floodClass:"minor",sourceProduct:"IDQ60294"
  }]}],partial:false,failed:[]};
}
let heightCalls=0;
const online=async address=>{
  if(String(address).endsWith("/river-gauge-metadata"))
    return {ok:true,headers:new Headers({
      "X-StormTracker-Metadata-Checked-At":new Date(Date.now()-3600000).toISOString()
    }),json:async()=>source};
  heightCalls++;
  return {ok:true,json:async()=>bulletins()};
};
try{
  const baseline=await loadRiverGaugeOperationalSnapshot({fetchImpl:online});
  assert.equal(baseline.metadataFallback,false);
  assert.equal(baseline.matchedCount,1);

  const offline=async address=>{
    if(String(address).endsWith("/river-gauge-metadata"))
      return {ok:false,status:502};
    heightCalls++;
    return {ok:true,json:async()=>bulletins()};
  };
  const rescue=await loadRiverGaugeOperationalSnapshot({fetchImpl:offline});
  assert.equal(rescue.metadataFallback,true);
  assert.equal(rescue.metadataSource,"cached-verified-bom-browser");
  assert.equal(rescue.matchedCount,1);
  assert.equal(rescue.payload.features[0].properties.STORMTRACKER_FLOOD_CLASS,"minor");
  assert.equal(heightCalls,2,"Live height products still required for every snapshot");

  const bulletinFailure=async address=>{
    if(String(address).endsWith("/river-gauge-metadata"))
      return {ok:false,status:502};
    throw Error("Live BoM height source unavailable");
  };
  await assert.rejects(loadRiverGaugeOperationalSnapshot({
    fetchImpl:bulletinFailure
  }),/Live BoM height source unavailable/,
  "Cached coordinates must never fake a live observation or all clear");

  for(const [key,value] of memory){
    const cached=JSON.parse(value);
    cached.checkedAt=Date.now()-15*24*60*60*1000;
    memory.set(key,JSON.stringify(cached));
  }
  await assert.rejects(loadRiverGaugeOperationalSnapshot({
    fetchImpl:async address=>String(address).endsWith("/river-gauge-metadata")
      ?{ok:false,status:502}:{ok:true,json:async()=>bulletins()}
  }),/HTTP 502/,"Expired browser gauge catalogue must not be used");

  const workerSource=readFileSync(new URL("../../relay/worker.js",import.meta.url),"utf8");
  assert(workerSource.includes("relayVerifiedRiverGaugeMetadata(request,origin"));
  console.log("PASS BoM source-verified 502 recovery, expiry, invalid upstream, browser reload, live heights, CORS and HEAD");
}finally{
  if(priorStorage===undefined)delete globalThis.localStorage;
  else globalThis.localStorage=priorStorage;
}
