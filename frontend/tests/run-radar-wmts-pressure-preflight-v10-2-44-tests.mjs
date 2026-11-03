import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fetchWmtsPreflightTile,loadBomReflectivityMosaicAtTime,
  retryableWmtsMosaicFailure} from "../src/bom-wmts-loop-v2.js";

// One transient transport failure is NOT evidence that an authentic BoM
// observation is missing. Retest the SAME URL; never substitute a scan.
{
 let count=0,waits=[];
 const tile={width:256,height:256,data:new Uint8ClampedArray(256*256*4)};
 const result=await fetchWmtsPreflightTile("https://relay.example/wmts?time=real",
  async()=>{count++;if(count===1)throw Object.assign(new Error("HTTP 503"),{status:503});return tile;},
  {wait:async ms=>waits.push(ms),retryDelayMs:750});
 assert.equal(result,tile);assert.equal(count,2);
 assert.deepEqual(waits,[750]);
}
for(const status of [400,403,429]){
 let calls=0;
 await assert.rejects(()=>fetchWmtsPreflightTile("https://relay.example/wmts?time=real",
  async()=>{calls++;throw new Error("Image request failed: HTTP "+status);},
  {wait:async()=>{throw Error("MUST NOT RETRY REFUSED SOURCE")}}),
  /HTTP/);
 assert.equal(calls,1,"A terminal source status was retried: "+status);
}
// A malformed 503 does not invite unbounded retries.
{
 let count=0;
 await assert.rejects(()=>fetchWmtsPreflightTile("url",
  async()=>{count++;throw Error("HTTP 503");},{wait:async()=>{}}),/503/);
 assert.equal(count,2);
}

// A genuine source observation must not be lost to a one-off full-mosaic
// network failure, even if its preflight succeeds. Never retry BoM 400/403/429.
{
 const utc=new Date(Math.floor(Date.now()/300000)*300000-15*60000)
   .toISOString().replace(".000Z","Z");
 let calls=0,delays=[];
 const frame={observedUtc:utc,sourceMetadata:{region:"23"}};
 const actual=await loadBomReflectivityMosaicAtTime(utc,"23",[utc],{
  loadVerified:async(observed,region)=>{
   assert.equal(observed,utc);assert.equal(region,"23");
   calls++;
   if(calls===1)throw Object.assign(new Error("Image request failed: HTTP 503"),{status:503});
   return frame;
  },
  wait:async ms=>delays.push(ms),retryDelayMs:900
 });
 assert.equal(actual,frame);assert.equal(calls,2);assert.deepEqual(delays,[900]);
 for(const status of [400,403,429]){
  let attempt=0;
  await assert.rejects(()=>loadBomReflectivityMosaicAtTime(utc,"23",[utc],{
   loadVerified:async()=>{
    attempt++;throw Object.assign(new Error("Image request failed: HTTP "+status),{status});
   },
   wait:async()=>{throw Error("Retry prohibited for source rejection")}
  }),new RegExp("HTTP "+status));
  assert.equal(attempt,1);
 }
 assert.equal(retryableWmtsMosaicFailure(new Error("HTTP 503")),true);
 assert.equal(retryableWmtsMosaicFailure(new Error("HTTP 400")),false);
 assert.equal(retryableWmtsMosaicFailure(new Error("HTTP 429 relay cooldown")),false);
}

// Simulate a genuine browser URL for the OPERATOR QA preview. This path was
// previously omitted from the route whitelist and sent 9–16 tiles concurrently.
globalThis.window={};
globalThis.location={pathname:"/StormTracker/preview/radar-refresh-review/live3d-operational-v9.html"};
let simultaneous=0,peak=0,actualRequests=0;
globalThis.createImageBitmap=async()=>({width:256,height:256});
globalThis.OffscreenCanvas=class{
 constructor(width,height){this.width=width;this.height=height;}
 getContext(){const {width,height}=this;return {
  drawImage(){},
  getImageData:()=>({width,height,data:new Uint8ClampedArray(width*height*4)})
 };}
};
globalThis.fetch=async()=>{
 simultaneous++;peak=Math.max(peak,simultaneous);actualRequests++;
 await new Promise(resolve=>setTimeout(resolve,10));
 simultaneous--;
 return {ok:true,status:200,blob:async()=>new Blob(["real-source-bytes"],{type:"image/png"})};
};
// Import only AFTER installing our mock browser globals.
const {fetchReadableImage,networkPressureDiagnostics,officialWmtsFallbackUrl}
 =await import("../src/radar-source.js?qa-universal-guard");
const urls=Array.from({length:12},(_,i)=>
 "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/wmts?"+
 "SERVICE=WMTS&REQUEST=GetTile&TILECOL="+i+"&TILEROW=14&time=2026-11-01T04:45:00Z");
const tiles=await Promise.all(urls.map(fetchReadableImage));
assert.equal(tiles.length,12);
assert.equal(actualRequests,12);
assert(peak>0&&peak<=2,"Review page bypassed global two-tile WMTS limit, peak="+peak);
assert.equal(networkPressureDiagnostics().peakActive,2);
assert.equal(networkPressureDiagnostics().verifiedTileBlobs,12);
assert.equal(globalThis.__stormtrackerRelayPressureDiagnostics?.().peakActive,2);
const cached=await Promise.all(urls.map(fetchReadableImage));
assert.equal(cached.length,12);
assert.equal(actualRequests,12,"Genuine PNG cache missed same-source-timestamp URLs");
// Authentic-source failover: relay 403, native BoM 200 for exactly the
// same reflectivity layer, tile coordinates and original observed UTC.
const relayDenied="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/wmts?"+
 "SERVICE=WMTS&REQUEST=GetTile&LAYER=atm_surf_air_precip_reflectivity_dbz"+
 "&TILECOL=33&TILEROW=16&time=2026-11-03T06%3A20%3A00Z";
const officialUrl=officialWmtsFallbackUrl(relayDenied);
assert(officialUrl?.startsWith("https://api.bom.gov.au/apikey/v1/mapping/timeseries/wmts?"));
assert.equal(new URL(officialUrl).search,new URL(relayDenied).search,
  "Recovered tile must use IDENTICAL UTC, coordinates, layer and source request");
assert.equal(officialWmtsFallbackUrl("https://untrusted.invalid/wmts?time=2026"),null);
let relay403=0,native200=0;
globalThis.fetch=async target=>{
 const url=String(target);
 if(url===relayDenied){relay403++;return {ok:false,status:403};}
 if(url===officialUrl){
  native200++;
  return {ok:true,status:200,
   blob:async()=>new Blob(["original-boM-png"],{type:"image/png"})};
 }
 throw Error("Unexpected WMTS source URL "+url);
};
const restored=await fetchReadableImage(relayDenied);
assert.equal(restored.width,256);
assert.equal(relay403,1);
assert.equal(native200,1);
await fetchReadableImage(relayDenied);
assert.equal(relay403,1,"Verified original-source PNG remains cached by exact UTC URL");
assert.equal(native200,1,"Never refetch an already verified source tile");
const stillDenied=relayDenied.replace("TILECOL=33","TILECOL=34");
let nativeRefusals=0;
globalThis.fetch=async target=>{
 if(String(target)===stillDenied)return {ok:false,status:403};
 if(String(target)===officialWmtsFallbackUrl(stillDenied)){
  nativeRefusals++;return {ok:false,status:403};
 }
 throw Error("Unexpected source URL");
};
await assert.rejects(()=>fetchReadableImage(stillDenied),/HTTP 403/);
assert.equal(nativeRefusals,1,"At most one exact native fallback after relay refusal");
await assert.rejects(()=>fetchReadableImage(stillDenied),/source refusal cooldown/);
assert.equal(nativeRefusals,1,"The ordinary 403 cooldown prevents retry storms");
// A previously refused exact URL must bypass its old HTTP cache after cooldown,
// while preserving the source URL and accepting only actual decoded BoM PNGs.
const originalNow=Date.now,clock=Date.now();
let freshCacheMode=null,freshRequests=0;
try{
  Date.now=()=>clock+31000;
  globalThis.fetch=async(target,options={})=>{
    assert.equal(String(target),stillDenied);
    freshCacheMode=options.cache;freshRequests++;
    return {ok:true,status:200,
      blob:async()=>new Blob(["recovered-original-png"],{type:"image/png"})};
  };
  const repaired=await fetchReadableImage(stillDenied);
  assert.equal(repaired.width,256);
  assert.equal(freshRequests,1);
  assert.equal(freshCacheMode,"no-store","A browser-cached 403 cannot block original source recovery");
}finally{Date.now=originalNow;}
const relay=readFileSync(new URL("../../relay/worker.js",import.meta.url),"utf8")
  .split("async function relayWmts(")[1]?.split("async function fetchDopplerObservedUtc")[0];
assert(relay,"Original relay WMTS handler missing");
assert.match(relay,/cacheTtlByStatus:\s*\{"200-299":300,"300-599":0\}/,
  "Cloudflare must not cache refused/source-error BoM PNG responses");
assert.match(relay,/upstream\.ok\s*\?\s*"public, max-age=300"\s*:\s*"no-store"/,
  "Browser must not cache refused original-source BoM PNG responses");
console.log("PASS_BOM_403_NEGATIVE_CACHE_EXPIRES_AND_ORIGINAL_PNG_RECOVERS");
console.log("PASS_EXACT_BOM_403_NATIVE_ORIGINAL_SOURCE_RECOVERY",JSON.stringify({
 relay403,native200,sourceUtcUnchanged:true,refusalRetained:true
}));
console.log("PASS_GLOBAL_RADAR_WMTS_GUARD_AND_PREFLIGHT_RECOVERY",JSON.stringify({
 previewRoute:globalThis.location.pathname,peak,requests:actualRequests,
 verifiedTileBlobs:networkPressureDiagnostics().verifiedTileBlobs
}));
