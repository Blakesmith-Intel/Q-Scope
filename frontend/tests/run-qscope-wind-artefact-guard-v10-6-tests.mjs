import assert from "node:assert/strict";
import {
 describeWindPatch,screenResearchWindArtefacts,RESEARCH_WIND_QUALITY
} from "../src/qscope-wind-artefact-guard-v10-6.js";
import {assessConsecutiveDopplerWind} from "../src/doppler-persistence-v10-3.js";

const previousUtc="2026-11-10T14:00:00.000Z";
const currentUtc="2026-11-10T14:06:00.000Z";
const site={latitude:-25.501,longitude:153.003};
const point=(x,y,v,index)=>({
  latitude:site.latitude+y/111.32,
  longitude:site.longitude+x/(111.32*Math.cos(site.latitude*Math.PI/180)),
  velocity_kmh:v,pixel_index:index
});
const record=(utc,samples,other={})=>({
  radarId:"08",observedUtc:utc,
  timeBasis:"bom-history-filename-utc",
  geometryVerified:true,samples,...other
});
const originalAlert={
  id:"v10:doppler-persistent:08:synthetic",
  type:"wind",category:"strong_radial_signature",severity:"research",
  radar_id:"08",source_utc:currentUtc,prior_source_utc:previousUtc,
  longitude:site.longitude,latitude:site.latitude,velocity_kmh:70,
  caveat:"Radar radial velocity is NOT a measured surface gust"
};
const evaluate=(prev,current,alert=originalAlert)=>
  screenResearchWindArtefacts({
    alerts:[alert],previousRecords:[prev],currentRecords:[current]});
const speckles=[point(0,0,70,1),point(.5,.1,70,2),
  point(1,.15,70,3),point(1.2,.2,70,4)];
const p0=record(previousUtc,speckles),p1=record(currentUtc,speckles);
assert.equal(assessConsecutiveDopplerWind(p0,p1).alerts.length,1,
  "Reproduce actual legacy false positive: four close high pixels in two scans");
const suppressed=evaluate(p0,p1);
assert.equal(suppressed.alerts.length,0,
  "Genuine scan timestamps plus only four coloured pixels MUST NOT alert");
assert.equal(suppressed.rejected.length,1);
assert.equal(suppressed.rejected[0].reason,
  "scattered-or-insufficient-high-pixels");

// A streak of +/-70 palette-bound pixels with no surrounding radial flow
// is indistinguishable from clutter and must not be promoted to straight-line.
const high=[];
for(let y=0;y<4;y++)for(let x=0;x<5;x++)
 high.push(point(x*.32,y*.32,70,100+y*5+x));
assert.equal(evaluate(record(previousUtc,high),record(currentUtc,high))
  .alerts.length,0,"Pure palette saturation without wind gradient fails");
const moderate=[];
for(let i=0;i<16;i++)
 moderate.push(point((i%5)*.3+.08,(Math.floor(i/5))*.3+.27,
   44+i%4,200+i));
const clean=[...high,...moderate];
const accepted=evaluate(record(previousUtc,clean),record(currentUtc,clean));
assert.equal(accepted.alerts.length,1,
  "Dense same-sign multi-pixel wind field with neighbouring moderate velocities survives");
assert.equal(accepted.alerts[0].quality_screen,
 "two-coherent-source-radial-patches");
assert(accepted.alerts[0].quality_pixels_latest>=12);
assert(RESEARCH_WIND_QUALITY.minSupportingPixels>=8);
assert.match(accepted.alerts[0].caveat,/NOT a confirmed surface gust/);

const noNearbyContext=moderate.map((p,i)=>({...p,
 longitude:p.longitude+.23,latitude:p.latitude+.17,
 pixel_index:400+i}));
assert.equal(evaluate(record(previousUtc,[...high,...noNearbyContext]),
 record(currentUtc,[...high,...noNearbyContext])).alerts.length,0,
 "Unrelated lower-speed pixels across the map do not support noisy high patch");

// Distinct but disconnected source pixels are insufficient, even when there
// are >12 of them and they lie within the same broad five-kilometre area.
const scattered=Array.from({length:14},(_,i)=>point(
 (i%4)*1.15,(Math.floor(i/4))*1.1,-65,1000+i));
assert.equal(evaluate(record(previousUtc,[...scattered,...moderate]),
 record(currentUtc,[...scattered,...moderate]),{
 ...originalAlert,velocity_kmh:-65
 }).alerts.length,0,
 "Fragmented >=60 km/hr pixels cannot manufacture contiguous wind signature");

assert.equal(evaluate(record(previousUtc,speckles),
 record(currentUtc,clean)).alerts.length,0,
 "The PRIOR scan must also contain physically coherent Doppler evidence");
for(const corrupt of [
 {geometryVerified:false},
 {temporalInference:true},
 {velocityInterpolated:true},
 {timeBasis:"received-time"},
 {observedUtc:previousUtc},
 {radarId:"66"}
]){
 assert.equal(evaluate(record(previousUtc,clean),
  record(currentUtc,clean,corrupt)).alerts.length,0,
 "Untrusted, duplicated or cross-radar sources cannot pass");
}
const duplicate=record(currentUtc,clean);
assert.equal(screenResearchWindArtefacts({
 alerts:[originalAlert],previousRecords:[record(previousUtc,clean)],
 currentRecords:[duplicate,{...duplicate}] 
}).alerts.length,0,
 "Two ambiguous same-radar records are not interchangeable real scans");
const hook={category:"hook_shape_only",id:"hook:independent"};
const couplet={category:"tornadic_candidate",id:"couplet:independent"};
const kinds=screenResearchWindArtefacts({
 alerts:[originalAlert,hook,couplet],
 currentRecords:[p1],previousRecords:[p0]
});
assert.equal(kinds.alerts.length,2,
 "Hook and coupled hook review must not be changed by yellow-only artefact screening");
assert.deepEqual(kinds.alerts,[hook,couplet]);
assert.equal(kinds.rejected.length,1);
const duplicatePixels=Array.from({length:30},(_,i)=>({
 ...point(0,0,70,i),pixel_index:i
}));
assert.equal(describeWindPatch(record(currentUtc,
 [...duplicatePixels,...moderate]),originalAlert).ok,false,
 "Repeated geolocation cannot be counted as a real spatial patch");
console.log("PASS V10.6.8 Doppler artefact suppression: screenshot-type false positives rejected, real coherent patches preserved, hooks unchanged");
