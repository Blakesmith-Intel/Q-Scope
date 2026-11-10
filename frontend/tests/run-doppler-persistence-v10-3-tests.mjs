import assert from "node:assert/strict";
import {assessConsecutiveDopplerWind} from "../src/doppler-persistence-v10-3.js";

const first="2026-10-17T02:00:00Z", next="2026-10-17T02:06:00Z";
function source(time,{radarId="66",velocity=-65,shift=0,extra=[],alter={}}={}){
  const samples=[0,1,2,3].map(i=>({
    longitude:153.100+i*.001+shift,latitude:-27.450+i*.0005,
    velocity_kmh:velocity
  })).concat(extra);
  return {radarId,observedUtc:time,timeBasis:"bom-history-filename-utc",
    geometryVerified:true,samples,...alter};
}
const older=source(first), newer=source(next,{shift:.002});
assert.equal(assessConsecutiveDopplerWind(older,newer).alerts.length,1);
const evidence=assessConsecutiveDopplerWind(older,newer).alerts[0];
assert.equal(evidence.category,"strong_radial_signature");
assert.equal(evidence.persistent,undefined);
assert.equal(evidence.persistence_scans,2);
assert.equal(evidence.source_utc,next);
assert.equal(evidence.prior_source_utc,first);
assert.match(evidence.caveat,/NOT a surface gust/);
for(const args of [
  [null,newer],
  [older,null],
  [newer,older],
  [older,source(first)],
  [older,source("2026-10-17T02:20:00Z")],
  [older,source(next,{radarId:"50"})],
  [older,source(next,{shift:2})],
  [older,source(next,{velocity:65})],
  [older,source(next,{velocity:-90})],
  [older,source(next,{alter:{geometryVerified:false}})],
  [older,source(next,{alter:{timeBasis:"received-time"}})],
  [older,source(next,{alter:{velocityInterpolated:true}})],
  [older,source(next,{alter:{temporalInference:true}})],
  [older,source(next,{extra:[{longitude:153.1,latitude:-27.45,
    velocity_kmh:45},{longitude:153.101,latitude:-27.4505,
    velocity_kmh:48}]})]
]){
  assert.equal(assessConsecutiveDopplerWind(...args).alerts.length,0,
    "Invalid, single-source or conflicting wind evidence must not alert");
}
const duplicated={...newer,samples:[newer.samples[0],newer.samples[0],
  newer.samples[0],newer.samples[0]]};
assert.equal(assessConsecutiveDopplerWind(older,duplicated).alerts.length,0,
  "Repeating one radar pixel cannot fabricate 3 independent samples");
const two={...newer,samples:newer.samples.slice(0,2)};
assert.equal(assessConsecutiveDopplerWind(older,two).alerts.length,0);
const conflicting=source(next,{extra:[
  {longitude:153.102,latitude:-27.451,velocity_kmh:44},
  {longitude:153.103,latitude:-27.451,velocity_kmh:46}
]});
assert.equal(assessConsecutiveDopplerWind(older,conflicting).alerts.length,0,
  "Opposing local velocity prevents straight-line candidate classification");
console.log("PASS consecutive native Doppler scans, source UTC, persistence, negative controls and no surface-gust claims.");
