import assert from "node:assert/strict";
import {createRadarRequestPressureGuard} from "../src/radar-request-pressure-v1.js";

let clock=1000,started=[],release=[];
const guard=createRadarRequestPressureGuard({
  maxConcurrent:2,maxPending:8,
  now:()=>clock,negativeTtlMs:5000,deniedCooldownMs:2000,
  serviceCooldownMs:1500
});
const request=url=>guard.run(url,()=>new Promise(resolve=>{
  started.push(url);release.push(()=>resolve({url,width:256,height:256}));
}));
const jobs=[request("tile-a"),request("tile-b"),request("tile-c"),request("tile-d")];
await Promise.resolve();await Promise.resolve();
assert.deepEqual(started,["tile-a","tile-b"],"only two relay requests can be in flight");
assert.equal(guard.snapshot().queued,2);
release.shift()();release.shift()();
await Promise.resolve();await Promise.resolve();await Promise.resolve();
assert.deepEqual(started,["tile-a","tile-b","tile-c","tile-d"]);
release.shift()();release.shift()();
assert.deepEqual((await Promise.all(jobs)).map(x=>x.url),
  ["tile-a","tile-b","tile-c","tile-d"]);
assert.equal(guard.snapshot().peakActive,2);
let invalidCalls=0;
const bad=()=>{
  invalidCalls++;
  const error=Error("Image request failed: HTTP 400");error.status=400;
  return Promise.reject(error);
};
await assert.rejects(guard.run("missing-time-01",bad),/HTTP 400/);
await assert.rejects(guard.run("missing-time-01",bad),/known unavailable tile/);
assert.equal(invalidCalls,1,"known-unavailable time is never reprobed immediately");
clock+=5100;
await assert.rejects(guard.run("missing-time-01",bad),/HTTP 400/);
assert.equal(invalidCalls,2,"new TTL allows legitimate radar availability rechecks");
let temporaryCalls=0;
const transient=()=>{
  temporaryCalls++;
  const error=Error("Image request failed: HTTP 503");error.status=503;
  return Promise.reject(error);
};
await assert.rejects(guard.run("site-24-temporary",transient),/HTTP 503/);
const unaffectedRegion=await guard.run("site-75-same-genuine-time",
  ()=>Promise.resolve({width:256,height:256}));
assert.equal(unaffectedRegion.width,256,
  "A single 503 in Bowen cannot block valid Mount Isa tiles");
assert.equal(temporaryCalls,1);

let deniedCalls=0;
const denied=()=>{
  deniedCalls++;
  const error=Error("Image request failed: HTTP 403");error.status=403;
  return Promise.reject(error);
};
const noProgress=guard.run("refused-1",denied);
await assert.rejects(noProgress,/HTTP 403/);
const independent=await guard.run("different-region-tile",
  ()=>Promise.resolve({width:256,height:256}));
assert.equal(independent.width,256,
  "One 403 on an individual radar tile must not block another radar");
await assert.rejects(guard.run("refused-2",denied),/HTTP 403/);
await assert.rejects(guard.run("refused-3",denied),/HTTP 403/);
await assert.rejects(guard.run("different-source-time",denied),/relay cooldown/);
assert.equal(deniedCalls,3,"Three refusals trigger finite circuit to prevent source hammering");
clock+=2100;
const recovered=await guard.run("after-cooldown",()=>Promise.resolve({width:256,height:256}));
assert.equal(recovered.width,256);
const join=createRadarRequestPressureGuard({maxConcurrent:1});
let resolveJoin;
let joinStarts=0;
const j1=join.run("same-source-tile",()=>{joinStarts++;return new Promise(r=>resolveJoin=r);});
const j2=join.run("same-source-tile",()=>{throw Error("duplicate loader must not run");});
assert.equal(j1,j2);
await Promise.resolve();await Promise.resolve();
assert.equal(joinStarts,1);
resolveJoin({width:256,height:256});
await Promise.all([j1,j2]);
assert.equal(join.snapshot().joined,1);
console.log("PASS bounded WMTS concurrency, cache sharing, 400 expiry, single-tile 403 isolation and repeated-refusal cooldown.");
