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
// Three high pixels in a 5km tile are not necessarily one observed wind
// feature. Require actual source-pixel connectivity rather than tile count.
const disconnected=[-27.442,-27.425,-27.409].map(lat=>({
  longitude:153.1,latitude:lat,velocity_kmh:-65
}));
assert.equal(assessConsecutiveDopplerWind(
  {...older,samples:disconnected},
  {...newer,samples:disconnected}
).alerts.length,0,"Separated pixels in one 5 km tile cannot form a wind cluster");

// A missing 5/6-minute Doppler scan should not be silently counted as two
// consecutive observations, even if two older files exist.
assert.equal(assessConsecutiveDopplerWind(
  older,source("2026-10-17T02:10:00Z")
).alerts.length,0,"Ten-minute gap does not prove consecutive scans");

// Multiple source-pixel indices carrying the same location cannot make an
// artificial three-sample cluster. Repeated geographic coordinates are stale.
const duplicateCoords={...newer,samples:[0,1,2].map(i=>({
  longitude:153.1,latitude:-27.45,velocity_kmh:-66,pixel_index:i
}))};
assert.equal(assessConsecutiveDopplerWind(older,duplicateCoords).alerts.length,0);

// Distinct contiguous samples still produce a provisional yellow indicator.
// Its displayed magnitude remains radial velocity, never BoM's 90km/h gust.
assert.equal(assessConsecutiveDopplerWind(older,newer).alerts.length,1);
assert.equal(assessConsecutiveDopplerWind(older,newer).alerts[0].classification,undefined);

console.log("PASS consecutive native Doppler scans, source UTC, persistence, negative controls and no surface-gust claims.");
