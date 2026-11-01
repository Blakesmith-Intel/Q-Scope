import assert from "node:assert/strict";
import {
 createWmtsTimeFailureGuard,loadVerifiedNationalMosaicAtTime,
 discoverBoundedBomReflectivityHistory,findLatestBomReflectivityTime,
 WMTS_SOURCE_FRESHNESS_MS
} from "../src/bom-wmts-loop-v2.js";
import {createDopplerFrameFailureCooldown} from "../src/bom-doppler-intake-v3.js";

assert.equal(WMTS_SOURCE_FRESHNESS_MS,45*60000);
let current=Date.parse("2026-10-18T07:20:00Z");
const old=["2026-10-18T05:50:00Z","2026-10-18T05:55:00Z","2026-10-18T06:00:00Z"];
await assert.rejects(
  discoverBoundedBomReflectivityHistory(current,180,"66",{
    publishedTimes:async()=>old,
    ftpHistory:async()=>{throw Error("No verified current BoM reflectivity timestamp")}
  }),/no verified current observation timestamp/i,
  "Do not fan out hours-old timestamps merely because stale GetCapabilities lists them");
const currentSamples=["2026-10-18T06:45:00Z","2026-10-18T07:15:00Z"];
assert.deepEqual(await discoverBoundedBomReflectivityHistory(current,180,"19",{
  publishedTimes:async()=>[...old,...currentSamples],
  verifyNationalTile:async()=>true
}),currentSamples);
assert.equal(await findLatestBomReflectivityTime(current,"74",{
  publishedTimes:async()=>[...old,...currentSamples],
  verifyNationalTile:async()=>true
}),currentSamples.at(-1));

// A temporary gateway error cannot quarantine a genuine later timestamp.
const transientTimes=["2026-11-01T02:25:00Z","2026-11-01T02:30:00Z"];
const transientNow=Date.parse("2026-11-01T02:35:00Z");
let transientFail=true;
const transientOptions={
  publishedTimes:async()=>transientTimes,
  verifyNationalTile:async time=>{
    if(time===transientTimes[1] && transientFail){const error=Error("HTTP 503");error.status=503;throw error;}
    return true;
  }
};
assert.deepEqual(await discoverBoundedBomReflectivityHistory(transientNow,180,"23",transientOptions),[transientTimes[0]]);
transientFail=false;
assert.deepEqual(await discoverBoundedBomReflectivityHistory(transientNow,180,"23",transientOptions),transientTimes,
  "Transient HTTP 503 on Gladstone must be retried, not treated as withdrawn source time");

// Newest advertised BoM tiles may return HTTP 400 while being published.
// Source discovery must try the older REAL published timestamps instead
// of failing the entire radar after only the newest three attempts.
const nine=Array.from({length:9},(_,i)=>
  new Date(Date.parse("2026-11-01T02:00:00Z")+i*300000).toISOString().replace(".000Z","Z"));
const probed=[];
const recovered=await discoverBoundedBomReflectivityHistory(
  Date.parse("2026-11-01T02:42:00Z"),180,"24",{
    publishedTimes:async()=>nine,
    verifyNationalTile:async time=>{
      probed.push(time);
      if(time>nine[4]){const e=Error("Image request failed: HTTP 400");e.status=400;throw e;}
      return true;
    }
  });
assert.equal(recovered.at(-1),nine[4],"Return newest source-verified older scan");
assert.deepEqual(probed,[...nine.slice(5).reverse(),nine[4]],
  "Try all genuine source times, not newest three only");
const recoveringGuard=createWmtsTimeFailureGuard({
  now:()=>retryClock,ttlMs:45000
});
let retryClock=0;
recoveringGuard.reject(nine[8],"24");
assert.equal(recoveringGuard.isRejected(nine[8],"24"),true);
assert.equal(recoveringGuard.isRejected(nine[8],"75"),false);
retryClock=45001;
assert.equal(recoveringGuard.isRejected(nine[8],"24"),false,
  "Genuine source timestamp becomes eligible again after 45 seconds");

const guard=createWmtsTimeFailureGuard({now:()=>current,ttlMs:300000,maxEntries:2});
assert.equal(guard.isRejected(old[0]),false);
guard.reject(old[0]);
assert.equal(guard.isRejected(old[0]),true);
guard.reject(old[1]);guard.reject(old[2]);
assert.equal(guard.isRejected(old[0]),false,"Bound negative cache size");
assert.equal(guard.size(),2);
current+=300001;
assert.equal(guard.isRejected(old[2]),false,"Previously invalid time can be checked again");

// Source in user report returned 400 for entire SEQ tile matrix. FIRST tile
// must stop the remaining 11 before any request-pressure queue fills.
const originalFetch=globalThis.fetch;
const originalOffscreen=globalThis.OffscreenCanvas;
globalThis.OffscreenCanvas=class {
  constructor(width,height){this.width=width;this.height=height;}
  getContext(){return {};}
};
let requests=0, times=[];
try{
 globalThis.fetch=async url=>{
   requests++;
   times.push(String(url));
   return new Response("failed to validate requested value for dimension (time)",
     {status:400,headers:{"Content-Type":"text/plain"}});
 };
 const invalid="2026-10-18T07:25:00Z";
 await assert.rejects(loadVerifiedNationalMosaicAtTime(invalid,"66"),
   /time preflight failed.*HTTP 400/);
 assert.equal(requests,1,"Twelve-tile 400 storm becomes ONE verified failing request");
 // A tile rejection in Mt Stapylton cannot poison a valid timestamp
 // at Cairns (or any other region) on the same national WMTS clock.
 await assert.rejects(loadVerifiedNationalMosaicAtTime(invalid,"19"),/HTTP 400/);
 assert.equal(requests,2,"Different region must independently verify the same published UTC");
 await assert.rejects(loadVerifiedNationalMosaicAtTime(invalid,"66"),/cached source rejection/);
 assert.equal(requests,2,"Repeat bad tile at original site remains blocked");
 await assert.rejects(loadVerifiedNationalMosaicAtTime("2026-10-18T07:30:00Z","74"),/HTTP 400/);
 assert.equal(requests,3,"Different source time isn't permanently blocked");
 assert.ok(times[0].includes("TILEMATRIX=8"));
}finally{globalThis.fetch=originalFetch;globalThis.OffscreenCanvas=originalOffscreen;}

// Three independent 502s from radar 74 trigger a bounded per-product pause,
// but must NOT suppress valid observations from other radar sites.
let t=100000,count=0;
const productCooldown=createDopplerFrameFailureCooldown({
  now:()=>t,cooldownMs:75000
});
const url=(radar,frame)=>"https://example.invalid/radar-frame?product=IDR"+
 radar+"I&file=IDR"+radar+"I.T."+frame+".png";
const fail=async()=>{count++;const e=Error("HTTP 502");e.status=502;throw e;};
for(const frame of ["202610180553","202610180608","202610180613"])
  await assert.rejects(productCooldown.run(url(74,frame),fail),/502/);
assert.equal(count,3);
await assert.rejects(productCooldown.run(url(74,"202610180618"),fail),
  e=>e.sourceCooldown===true && e.status===502);
assert.equal(count,3,"Product-wide failure does not issue fourth 502");
const unaffected=await productCooldown.run(url(66,"202610180618"),
  async()=>{count++;return "verified new observation"});
assert.equal(unaffected,"verified new observation");
t+=75001;
assert.equal(await productCooldown.run(url(74,"202610180618"),
  async()=>{count++;return "source recovered"}),"source recovered");
assert.equal(count,5,"Source automatically rechecks after 75 seconds");
console.log("PASS stale GetCapabilities cutoff, WMTS per-region nonpoisoning, one-request preflight, and isolated IDR74 cooldown.");
