import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  BOM_DAMAGING_GUST_KMH, BOM_DESTRUCTIVE_GUST_KMH,
  classifyObservedBoMGust, assessObservedBoMGust,
  assessV10RadarFrame
} from "../src/severe-storm-v10.js";
import {severeAlertAppearance} from "../src/severe-storm-alert-appearance-v10.js";

let count = 0;
function test(label, fn) { fn(); count++; console.log("PASS V10 " + label); }
function location(frame, x, y) {
  const g = frame.georef, R = 6378137;
  const mx = g.minX + (x + .5) / frame.width * (g.maxX-g.minX);
  const my = g.maxY - (y + .5) / frame.height * (g.maxY-g.minY);
  return {
    longitude: mx / R * 180 / Math.PI,
    latitude: (2 * Math.atan(Math.exp(my / R)) - Math.PI / 2) * 180 / Math.PI
  };
}
function fixture(utc = "2026-10-08T04:05:00Z", shape = "none") {
  const width=96, height=96;
  const frame={
    observedUtc:utc,width,height,
    georef:{projection:"EPSG:3857",minX:16900000,maxX:16940000,
      minY:-3400000,maxY:-3360000},
    categories:new Uint8Array(width*height),
    sourceMetadata:{}
  };
  const labels=new Uint16Array(width*height);
  for(let y=44;y<=52;y++)for(let x=44;x<=52;x++){
    labels[y*width+x]=1;
    frame.categories[y*width+x]=11;
  }
  if(shape==="arc"){
    for(let deg=70;deg<210;deg+=2){
      const a=deg*Math.PI/180;
      for(let rad=11;rad<=14;rad++){
        const x=Math.round(48+rad*Math.cos(a));
        const y=Math.round(48+rad*Math.sin(a));
        frame.categories[y*width+x]=4;
      }
    }
    for(let rad=3;rad<=12;rad++){
      const a=70*Math.PI/180;
      const x=Math.round(48+rad*Math.cos(a));
      const y=Math.round(48+rad*Math.sin(a));
      if(!labels[y*width+x])frame.categories[y*width+x]=4;
    }
  }
  return {
    frame,
    result:{
      tracks:[{track_id:"ST0042",history:[{
        observed_utc:utc,source_cells:[["BOM-MOSAIC",1]]
      }]}],
      segmentations:[{radar_id:"BOM-MOSAIC",labels,width,height}]
    }
  };
}
function radar(frame, values, { minutes=0, radarId="66" } = {}) {
  return {
    records:[{
      radarId,
      observedUtc:new Date(Date.parse(frame.observedUtc)+minutes*60000).toISOString(),
      timeBasis:"bom-history-filename-utc",
      geometryVerified:true,
      samples:values.map(([x,y,v])=>({...location(frame,x,y),velocity_kmh:v}))
    }]
  };
}
const radial=[
  [46,48,-60],[47,48,-65],[48,48,-60],[49,48,-62]
];
const couplet=[
  [45,48,-60],[46,48,-65],[48,48,60],[49,48,65]
];
test("BoM gust threshold classification exact boundaries",()=>{
  assert.equal(BOM_DAMAGING_GUST_KMH,90);
  assert.equal(BOM_DESTRUCTIVE_GUST_KMH,125);
  assert.equal(classifyObservedBoMGust(89),null);
  assert.equal(classifyObservedBoMGust(90),"damaging");
  assert.equal(classifyObservedBoMGust(124),"damaging");
  assert.equal(classifyObservedBoMGust(125),"destructive");
  assert.equal(classifyObservedBoMGust(-3),null);
  assert.equal(classifyObservedBoMGust(NaN),null);
});
test("measured gusts require station source, valid location and fresh timestamp",()=>{
  const observation={
    source:"BoM-AWS",station:"Test AWS",gust_kmh:125,
    latitude:-27.4,longitude:153.1,observed_utc:"2026-10-08T04:00:00Z"
  };
  const now="2026-10-08T04:10:00Z";
  assert.equal(assessObservedBoMGust(observation,now).classification,"destructive");
  assert.equal(assessObservedBoMGust({...observation,source:"Doppler"},now),null);
  assert.equal(assessObservedBoMGust(observation,"2026-10-08T04:16:00Z"),null);
  assert.equal(assessObservedBoMGust({...observation,longitude:NaN},now),null);
});
test("strong radial-wind candidate requires two different genuine Doppler scan times",()=>{
  const previous=fixture("2026-10-08T04:00:00Z");
  const {frame,result}=fixture();
  const single=assessV10RadarFrame({frame,result,dopplerState:radar(frame,radial)});
  assert.equal(single.alerts.length,0,"No first-scan wind candidate");
  const out=assessV10RadarFrame({
    frame,result,previousFrame:previous.frame,previousResult:previous.result,
    dopplerState:radar(frame,radial),
    previousDopplerState:radar(previous.frame,radial)
  });
  assert.equal(out.alerts.length,1);
  assert.equal(out.alerts[0].persistence_scans,2);
  assert.equal(out.alerts[0].category,"strong_radial_signature");
  assert.equal(out.alerts[0].type,"wind");
  assert.equal(out.alerts[0].velocity_kmh,-65);
  assert.equal(out.alerts[0].classification,undefined);
  assert.match(out.alerts[0].caveat,/NOT a surface gust/);
});
test("velocity couplet alone is not diagnosed as tornado",()=>{
  const {frame,result}=fixture();
  const out=assessV10RadarFrame({frame,result,dopplerState:radar(frame,couplet)});
  assert.equal(out.alerts.some(a=>a.category==="tornadic_candidate"),false);
});
test("two measured hook arcs plus colocated Doppler couplet become experimental tornado candidate",()=>{
  const prev=fixture("2026-10-08T04:00:00Z","arc");
  const now=fixture("2026-10-08T04:05:00Z","arc");
  const out=assessV10RadarFrame({
    frame:now.frame,result:now.result,
    previousFrame:prev.frame,previousResult:prev.result,
    dopplerState:radar(now.frame,couplet),
    previousDopplerState:radar(prev.frame,couplet)
  });
  assert.equal(out.alerts.some(a=>a.category==="tornadic_candidate"),true);
  assert.equal(out.alerts.find(a=>a.category==="tornadic_candidate").persistence_scans,2);
  const tornado=out.alerts.find(a=>a.category==="tornadic_candidate");
  assert.equal(tornado.type,"hook");
  assert.ok(tornado.radial_shear_kmh>=80);
  assert.match(tornado.caveat,/NOT a confirmed tornado/);
});
test("two arcs with no Doppler remain hook shape only",()=>{
  const prev=fixture("2026-10-08T04:00:00Z","arc");
  const now=fixture("2026-10-08T04:05:00Z","arc");
  const out=assessV10RadarFrame({
    frame:now.frame,result:now.result,
    previousFrame:prev.frame,previousResult:prev.result
  });
  assert.ok(out.alerts.some(a=>a.category==="hook_shape_only"));
  assert.equal(out.alerts.some(a=>a.category==="tornadic_candidate"),false);
});
test("single frame, expired hook and inferred image cannot claim tornado",()=>{
  const before=fixture("2026-10-08T03:45:00Z","arc");
  const now=fixture("2026-10-08T04:05:00Z","arc");
  const result1=assessV10RadarFrame({
    frame:now.frame,result:now.result,
    previousFrame:before.frame,previousResult:before.result,
    dopplerState:radar(now.frame,couplet)
  });
  assert.equal(result1.alerts.some(a=>a.category==="tornadic_candidate"),false);
  now.frame.sourceMetadata.temporalInference={beforeUtc:before.frame.observedUtc};
  const result2=assessV10RadarFrame({
    frame:now.frame,result:now.result,
    previousFrame:before.frame,previousResult:before.result,
    dopplerState:radar(now.frame,radial)
  });
  assert.equal(result2.alerts.length,0);
});
test("wrong radar, mismatched observation or palette-exceeding value rejected",()=>{
  const {frame,result}=fixture();
  for(const wind of [
    radar(frame,radial,{radarId:"23"}),
    radar(frame,radial,{minutes:9}),
    radar(frame,[[46,48,-105],[47,48,-105],[48,48,-105]])
  ]){
    const out=assessV10RadarFrame({frame,result,dopplerState:wind});
    assert.equal(out.alerts.length,0);
  }
});
test("research is preview-only and main production alerts remain disabled",()=>{
  const runtime=readFileSync(fileURLToPath(new URL("../src/live3d-operational-v9.js",import.meta.url)),"utf8");
  assert.match(runtime,/assessV10RadarFrame\(/);
  assert.match(runtime,/assessConsecutiveDopplerWind\(/);
  assert.match(runtime,/syncIndependentDopplerResearch\(/);
  assert.match(runtime,/previousDopplerState/);
  assert.match(runtime,/loadDopplerHistoriesAndPalettes\(/);
  assert.match(runtime,/isWindHookQaPreview/);
  assert.match(runtime,/severeStormAlertOverlay\.setEnabled\(false\)/);
  assert.match(runtime,/if \(!windHookResearchEnabled\)/);
});
test("same original Doppler scan cannot be counted twice against consecutive rain frames",()=>{
  const prev=fixture("2026-10-08T04:00:00Z");
  const now=fixture("2026-10-08T04:05:00Z");
  const shared=radar(now.frame,radial);
  const out=assessV10RadarFrame({frame:now.frame,result:now.result,
    previousFrame:prev.frame,previousResult:prev.result,
    dopplerState:shared,previousDopplerState:shared});
  assert.equal(out.alerts.filter(a=>a.type==="wind").length,0);
});
test("tornadic circulation does not appear with one Doppler scan despite two hooks",()=>{
  const prev=fixture("2026-10-08T04:00:00Z","arc");
  const now=fixture("2026-10-08T04:05:00Z","arc");
  const out=assessV10RadarFrame({frame:now.frame,result:now.result,
    previousFrame:prev.frame,previousResult:prev.result,
    dopplerState:radar(now.frame,couplet)});
  assert.equal(out.alerts.some(a=>a.category==="tornadic_candidate"),false);
  assert.equal(out.alerts.some(a=>a.category==="hook_shape_only"),true);
});
test("untrusted provenance or unverified native geometry is refused",()=>{
  const {frame,result}=fixture();
  const wind=radar(frame,radial);
  for(const bad of [
    {...wind.records[0],timeBasis:"bom-product-page-received-at"},
    {...wind.records[0],geometryVerified:false},
    {...wind.records[0],temporalInference:true},
    {...wind.records[0],velocityInterpolated:true}
  ]) assert.equal(assessV10RadarFrame({frame,result,dopplerState:{records:[bad]}}).alerts.length,0);
});
test("duplicate Doppler samples cannot manufacture high-wind cluster",()=>{
  const {frame,result}=fixture();
  const same=radar(frame,[[48,48,-65],[48,48,-65],[48,48,-65],[48,48,-65]]);
  assert.equal(assessV10RadarFrame({frame,result,dopplerState:same}).alerts.length,0);
});
test("research pin colours and icons are category specific and not official alerts",()=>{
  const expected=[
    ["strong_radial_signature","wind","v10-gust.svg"],
    ["hook_shape_only","hook","v10-hook.svg"],
    ["tornadic_candidate","tornado","v10-tornado.svg"]
  ];
  for(const [category,kind,icon] of expected){
    const style=severeAlertAppearance({category});
    assert.equal(style.kind,kind);
    assert.equal(style.icon,icon);
    assert.match(style.meaning,/not|no verified|unconfirmed/i);
  }
  const css=readFileSync(fileURLToPath(
    new URL("../src/wind-hook-research-v10.css",import.meta.url)),"utf8");
  assert.match(css,/#F6D94F/i);
  assert.match(css,/#FF963F/i);
  assert.match(css,/#D83045/i);
  const runtime=readFileSync(fileURLToPath(
    new URL("../src/live3d-operational-v9.js",import.meta.url)),"utf8");
  assert.match(runtime,/if \(isWindHookQaPreview\) \{/);
  assert.match(runtime,/qaStyle\.href = "\.\/src\/wind-hook-research-v10\.css/);
});
console.log(count+" V10 storm research contract tests passed.");
