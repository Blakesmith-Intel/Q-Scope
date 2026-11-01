import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {discoverBoundedBomReflectivityHistory,findLatestBomReflectivityTime,
 loadBomReflectivityMosaicAtTime,HIGH_RESOLUTION_FRAMES_ONLY}
 from "../frontend/src/bom-wmts-loop-v2.js";
import {measuredHiResRainWindow,isVerifiedHiResRadarFrame}
 from "../frontend/src/hires-radar-loop-policy-v1.js";
assert.equal(HIGH_RESOLUTION_FRAMES_ONLY,true);
const now=Date.parse("2026-10-19T11:30:00Z");
const time=n=>new Date(now-n*300000).toISOString().replace(".000Z","Z");
const published=Array.from({length:9},(_,i)=>time(8-i));
let tilesChecked=0;
const opts={publishedTimes:async()=>published,
 verifyNationalTile:async()=>{tilesChecked++;return true},
 ftpHistory:async()=>{throw Error("Forbidden legacy FTP data source called")}};
const times=await discoverBoundedBomReflectivityHistory(now,180,"SEQ",opts);
assert.deepEqual(times,published);
assert.equal(measuredHiResRainWindow(times,"30").plan.length,6);
assert.equal(measuredHiResRainWindow(times,"30").plan[0].observedUtc,published[3]);
assert.equal(tilesChecked,1);
await assert.rejects(
 discoverBoundedBomReflectivityHistory(now,180,"SEQ",{
  publishedTimes:async()=>{throw Error("BoM native metadata unavailable")},
  ftpHistory:async()=>{throw Error("ILLEGAL FTP fallback")}
 }),/BoM native metadata unavailable/);
await assert.rejects(
 findLatestBomReflectivityTime(now,"SEQ",{
  publishedTimes:async()=>[],ftpHistory:async()=>[time(0)]
 }),/no verified current observation timestamp/i);
const source=readFileSync("frontend/src/bom-wmts-loop-v2.js","utf8");
assert(!source.includes("loadFtpReflectivityMosaicAtTime("),
 "Live rain radar can NEVER load low-resolution FTP images");
assert(!source.includes("discoverFtpReflectivityHistory("),
 "Rain radar history can NEVER return legacy FTP timestamps");
// A transient retry still invokes only the exact same genuine WMTS
// high-resolution loader, never a legacy/low-resolution substitute.
assert(source.includes("loadVerified=loadVerifiedNationalMosaicAtTime"));
assert(source.includes("return await loadVerified(observedUtc,region)"));
assert(source.includes("return loadVerified(observedUtc,region)"));
assert(source.includes("retryableWmtsMosaicFailure(error)"));
const policy=readFileSync("frontend/src/hires-radar-loop-policy-v1.js","utf8");
assert(policy.includes('frame?.sourceId==="BOM-MOSAIC"'));
assert.equal(measuredHiResRainWindow(times,"30").plan.every(x=>x.kind==="observed"),true);
console.log("PASS hi-resolution BoM only; 30 minutes exactly six 5-minute observations; missing source fails closed");
