import assert from "node:assert/strict";
import {fetchWmtsPreflightTile} from "../src/bom-wmts-loop-v2.js";

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
const {fetchReadableImage,networkPressureDiagnostics}=await import("../src/radar-source.js?qa-universal-guard");
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
console.log("PASS_GLOBAL_RADAR_WMTS_GUARD_AND_PREFLIGHT_RECOVERY",JSON.stringify({
 previewRoute:globalThis.location.pathname,peak,requests:actualRequests,
 verifiedTileBlobs:networkPressureDiagnostics().verifiedTileBlobs
}));
