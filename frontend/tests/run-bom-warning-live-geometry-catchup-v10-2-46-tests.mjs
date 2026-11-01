import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 missingActiveBoMWarningGeometry,officialWarningRefreshInterval,
 WARNING_GEOMETRY_RECOVERY_MS,WARNING_GEOMETRY_RECOVERY_MAX
} from "../src/context-layers/bom-warning-operational-v1.js";

const normal=15*60*1000;
const pending=code=>({[code]:{status:"geometry-unavailable",
 issuedUtc:"2026-11-01T06:26:11Z"}});
const listed=code=>({[code]:{status:"listed-active",issuedUtc:null}});
const active=code=>({[code]:{status:"active",issuedUtc:"2026-11-01T06:26:11Z"}});
const warning=code=>({productCode:code,official:true,
 geometry:{type:"Polygon",coordinates:[[[152,-27],[153,-27],[153,-28],[152,-27]]]}});
assert.deepEqual(missingActiveBoMWarningGeometry(pending("IDQ21035")),["IDQ21035"]);
assert.deepEqual(missingActiveBoMWarningGeometry(listed("IDQ21033")),["IDQ21033"]);
assert.deepEqual(missingActiveBoMWarningGeometry(active("IDQ21035")),["IDQ21035"]);
assert.deepEqual(missingActiveBoMWarningGeometry(active("IDQ21035"),[warning("IDQ21035")]),[]);
assert.deepEqual(missingActiveBoMWarningGeometry({IDQ21033:{status:"cancelled"}}),[]);
assert.deepEqual(missingActiveBoMWarningGeometry({IDQ21035:{status:"no-active"}}),[]);
assert.equal(WARNING_GEOMETRY_RECOVERY_MS,120000);
assert.equal(WARNING_GEOMETRY_RECOVERY_MAX,9);
assert.equal(officialWarningRefreshInterval(),normal);
for(const code of ["IDQ21033","IDQ21035","IDQ21037","IDQ21038"]){
 for(let count=0;count<9;count++)
  assert.equal(officialWarningRefreshInterval({
   products:pending(code),recoveryPolls:count
  }),120000,"Active warning geometry should recover after 2 minutes");
 assert.equal(officialWarningRefreshInterval({
  products:pending(code),recoveryPolls:9
 }),normal,"Bounded retries must revert to approved regular 15-minute cadence");
}
assert.equal(officialWarningRefreshInterval({
 products:active("IDQ21033"),warnings:[warning("IDQ21033")],recoveryPolls:2
}),normal,"Verified active polygon returns to normal polling immediately");
assert.equal(officialWarningRefreshInterval({
 products:{IDQ21033:{status:"cancelled"}},recoveryPolls:2
}),normal,"A cancelled source must not trigger continued recovery checks");
assert.equal(officialWarningRefreshInterval({temporaryFailures:1}),120000);
assert.equal(officialWarningRefreshInterval({temporaryFailures:2}),120000);
assert.equal(officialWarningRefreshInterval({temporaryFailures:3}),normal);

const source=readFileSync(new URL("../src/context-layers/bom-warning-operational-v1.js",import.meta.url),"utf8");
assert(source.includes("lastAttemptAt<currentRefreshMs()"),
 "Actual automatic warning refresh must use the bounded adaptive interval");
assert(source.includes("now()-lastAttemptAt>=currentRefreshMs()"),
 "Actual one-minute browser wake-up timer must schedule recovery automatically");
assert(source.includes("recordRecoveryState();"),
 "Successful official polygon response must stop recovery or update issue identity");
assert(source.includes('INTERVAL_MS=15*60*1000'),
 "Do not modify the user-approved healthy warning refresh interval");
assert(source.includes('sourceStatus=data.status'),
 "Source verification and negative reporting must remain distinct");
assert(source.includes('isVerifiedActiveBomWarning(w,now())'),
 "Do not display source-unverified, stale or fabricated warning geometry");
console.log("PASS: missing IDQ21033/35 geometry gets bounded 2-min catch-up, normal 15-min feed unchanged, no cancelled/healthy false positives, no synthetic polygons.");
