import assert from "node:assert/strict";
import {
  createRiverGaugeLayer
} from "../src/context-layers/river-gauge-layer-v1.js";

let now=Date.UTC(2026,9,8,8,30);
let step=0;
let failFetch=false;
const features=[
  {id:"bom:040123",properties:{bom_stn_num:"040123",awrc_stateid:"QLD-1",name:"Upper river",state:"QLD",location_types:"water level gauge;",lat:-27.5,long:153.1},geometry:{type:"Point",coordinates:[153.1,-27.5]}},
  {id:"bom:040124",properties:{bom_stn_num:"040124",awrc_stateid:"QLD-2",name:"Coastal tide",state:"QLD",location_types:"water level gauge;tide gauge;",lat:-27.4,long:153.1},geometry:{type:"Point",coordinates:[153.1,-27.4]}},
  {id:"bom:040125",properties:{bom_stn_num:"040125",awrc_stateid:"QLD-3",name:"Moderate flood",state:"QLD",location_types:"water level gauge;",lat:-27.6,long:153.1},geometry:{type:"Point",coordinates:[153.1,-27.6]}}
];
const reportedTime=()=>step===0?"6:15 pm Thu 08/10/2026":"6:45 pm Thu 08/10/2026";
const latest=()=>[
  {stationName:"Upper river",stationId:"040123",heightMetres:step===0?1.0:2.2,
   tendency:"rising",floodClass:"minor",observedText:reportedTime()},
  {stationName:"Coastal tide",stationId:"040124",heightMetres:step===0?0.9:1.5,
   tendency:"rising",floodClass:"",observedText:reportedTime()},
  {stationName:"Moderate flood",stationId:"040125",heightMetres:4.0,
   tendency:"falling",floodClass:"moderate",observedText:reportedTime()}
];
const calls={requests:0,render:0,added:[],observed:[],status:[],stored:{}};
const storage={
  getItem:key=>calls.stored[key]??null,
  setItem:(key,value)=>{calls.stored[key]=value;}
};
class MockCollection{
  values=[];
  suspendEvents(){}
  resumeEvents(){}
  removeAll(){this.values=[];}
  add(value){const entity={...value};this.values.push(entity);return entity;}
}
class MockDataSource{
  constructor(id){this.name=id;this.entities=new MockCollection();this.show=false;}
}
const CesiumRef={
  CustomDataSource:MockDataSource,
  Cartesian3:{fromDegrees:(lon,lat,alt)=>[lon,lat,alt]},
  VerticalOrigin:{CENTER:1},
  HeightReference:{CLAMP_TO_GROUND:2}
};
const viewer={
  dataSources:{add:src=>{calls.added.push(src);}},
  scene:{requestRender:()=>{calls.render++;}}
};
const fetchImpl=async url=>{
  calls.requests++;
  if (failFetch) throw new Error("Simulated BoM relay outage");
  let response;
  if(String(url).includes("qld-bom-river-station-locations-v1.json"))response={type:"FeatureCollection",features};
  else if(String(url).includes("river-height-bulletins"))
    response={products:[{product:"IDQ60285",observations:latest()}],failed:[],partial:false};
  else throw Error("Unexpected relay URL: "+url);
  return {ok:true,async json(){return response;}};
};
const layer=createRiverGaugeLayer({
  viewer,CesiumRef,fetchImpl,storage,now:()=>now,
  onUpdate:items=>calls.observed.push(items),
  onStatus:item=>calls.status.push(item)
});
assert.equal(layer.dataSource.show,false,"Gauge layer still has a visibility toggle");
await layer.refresh();
assert.equal(layer.features.length,2,"The first bulletin must show both BoM minor and moderate flooding, without guessing rapid rise");
assert.deepEqual(layer.features.map(f=>f.id).sort(),["bom:040123","bom:040125"]);
assert.equal(layer.features.find(f=>f.id==="bom:040125").properties.STORMTRACKER_DISPLAY_STATE,"moderate");
assert.equal(layer.features.find(f=>f.id==="bom:040123").properties.STORMTRACKER_RAPID_RISE,false);
assert.equal(layer.historyStationCount,3,"Capture all water-level readings for later comparison");
assert.equal(calls.added.length,5,"Five flood drawing severity tiers");
assert.equal(layer.severityDataSources.flatMap(s=>s.entities.values).length,2);
assert.ok(layer.severityDataSources.flatMap(s=>s.entities.values)
 .some(e=>e.stormTrackerRiverGaugeId==="bom:040125"));
assert.equal(layer.severityDataSources[2].entities.values.length,1,"Minor tier");
assert.equal(layer.severityDataSources[3].entities.values.length,1,"Moderate above minor");
now+=30*60000;
step=1;
await layer.refresh({force:true});
assert.equal(layer.features.length,2,
  "Two observed height readings should reveal above-minor non-tidal rapid rise and continuing moderate flood");
const ids=layer.features.map(f=>f.id).sort();
assert.deepEqual(ids,["bom:040123","bom:040125"]);
const rise=layer.features.find(f=>f.id==="bom:040123");
assert.equal(rise.properties.STORMTRACKER_DISPLAY_STATE,"minor");
assert.equal(rise.properties.STORMTRACKER_RAPID_RISE,true);
assert.ok(rise.properties.STORMTRACKER_RISE_RATE_M_PER_H>0.3);
assert.ok(!layer.features.some(f=>f.id==="bom:040124"),"Ordinary tide rise is suppressed without a tidal baseline");
assert.ok(calls.stored["stormtracker.qld-flood-observations.v1"]);
layer.setVisible(true);
assert.ok(layer.severityDataSources.every(s=>s.show));
layer.setVisible(false);
assert.ok(layer.severityDataSources.every(s=>!s.show));
await layer.refresh({force:true}); // Finish the refresh initiated by the earlier visibility toggle.
assert.ok(calls.status.some(item=>item.count===2 && item.rapidRise===1 && item.moderate===1 && item.minor===1));
assert.ok(calls.observed.length>=2);
assert.ok(calls.requests>=4,"At least two gauge metadata and two bulletin calls; optional cold-start history probes may also occur");
now += 2*3600000;
failFetch=true;
await assert.rejects(layer.refresh({force:true}),/Simulated BoM relay outage/);
assert.equal(layer.features.length,2,
  "An upstream outage is not a below-minor reading: preserve last official minor and moderate");
assert.ok(layer.features.every(f=>f.properties.STORMTRACKER_OBSERVATION_STALE===true),
  "All retained official flood stations must show observation-stale metadata");
assert.ok(layer.features.every(f=>f.properties.STORMTRACKER_RAPID_RISE===false),
  "No stale station can retain a previous blue rapid-rise modifier");
assert.ok(calls.status.some(entry=>String(entry.message).includes("last confirmed flood stages retained")));
console.log("Flood layer integration passed: hidden/background observation storage, initial BoM minor/moderate markers, measured rise arrow on later bulletin, tidal suppression, popup IDs and toggle.");
