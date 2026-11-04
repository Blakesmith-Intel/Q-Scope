import assert from "node:assert/strict";
import {loadRiverGaugeOperationalSnapshot} from "../src/context-layers/river-gauge-observations-v1.js";
import {reconcileFloodEvents} from "../src/context-layers/river-flood-events-v1.js";

const now=Date.UTC(2026,10,4,10,30);
const original={type:"FeatureCollection",features:[{
  type:"Feature",id:"bom:544019",
  geometry:{type:"Point",coordinates:[145.683,-28.100]},
  properties:{bom_stn_num:544019,awrc_stateid:"423202C",name:"Cunnamulla Weir",
    lat:-28.100,long:145.683,state:"QLD",location_types:"water level gauge;",
    forecast_site_classification:"Qualitative"}
}]};
const bulletin={partial:false,failed:[],products:[{
 product:"IDQ60294",observations:[{
 stationId:"544019",stationName:"Warrego River at Cunnamulla Weir",
 observedText:"8:00 am Wed 04/11/26",heightMetres:6.69,
 floodClass:"minor",tendency:"steady",sourceProduct:"IDQ60294"
 }]}]};
const saved=new Map();
const storage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)};
let relayReads=0,directReads=0,bulletinReads=0;
let blockDirect=false,blockRelay=true;
const fetchImpl=async (url)=>{
  const s=String(url);
  if(s.includes("/river-height-bulletins")){bulletinReads++;return {ok:true,json:async()=>bulletin};}
  if(s.includes("/river-gauge-metadata")){
    relayReads++;
    if(blockRelay)throw Error("BoM metadata relay timed out");
    return {ok:true,json:async()=>original};
  }
  if(s.includes("National_Flood_Gauge_Network/FeatureServer/5/query")){
    directReads++;
    if(blockDirect)throw Error("BoM official direct GIS temporarily inaccessible");
    return {ok:true,json:async()=>original};
  }
  throw Error("Unexpected gauge request "+s);
};
const read=()=>loadRiverGaugeOperationalSnapshot({fetchImpl,storage,now:()=>now});
const direct=await read();
assert.equal(direct.metadataSource,"direct-official-bom-arcgis");
assert.equal(direct.metadataFallback,true);
assert.equal(direct.matchedCount,1);
assert.equal(direct.payload.features[0].id,"bom:544019");
const selected=reconcileFloodEvents(direct.payload.features,{}, {},now);
assert.equal(selected.features.length,1,"A real official minor Cunnamulla height must remain a map signal");
assert.equal(selected.features[0].properties.STORMTRACKER_DISPLAY_STATE,"minor");
assert.equal(directReads,1);
assert.ok(saved.size>=1,"Persist exact original BoM coordinates, not inferred coordinates");

blockDirect=true;
const cached=await read();
assert.equal(cached.metadataSource,"cached-official-bom-arcgis");
assert.equal(cached.metadataCheckedAt,now);
assert.equal(cached.matchedCount,1);
assert.deepEqual(cached.payload.features[0].geometry,original.features[0].geometry);
assert.equal(bulletinReads,2,"Live BoM heights continue during GIS metadata loss");
assert.equal(directReads,2,"Never skip official direct source on outage");
assert.equal(relayReads,2,"Relay first, then direct, then verified cached metadata");

// Before this fix, StormTracker saved BoM-verified source station points
// alongside height cache records. Recover their COORDINATES only; a fabricated
// old high reading must never contaminate the current BoM bulletin.
const legacyPoint={...original.features[0],properties:{
 ...original.features[0].properties,STORMTRACKER_HEIGHT_METRES:99,
 STORMTRACKER_FLOOD_CLASS:"major",STORMTRACKER_RAPID_RISE:true
}};
const legacyPayload={"bom:544019":{observedAt:now-7*86400000,feature:legacyPoint}};
const legacyStorage={getItem:key=>key==="stormtracker.qld-latest-river-gauge.v1"?
 JSON.stringify(legacyPayload):null,setItem:()=>{}};
const legacy=await loadRiverGaugeOperationalSnapshot({
 fetchImpl,now:()=>now,storage:legacyStorage
});
assert.equal(legacy.metadataSource,"cached-verified-bom-station-observations");
assert.equal(legacy.payload.features[0].properties.STORMTRACKER_HEIGHT_METRES,6.69);
assert.equal(legacy.payload.features[0].properties.STORMTRACKER_FLOOD_CLASS,"minor");
assert.equal(legacy.payload.features[0].properties.STORMTRACKER_RAPID_RISE,undefined);
assert.equal(reconcileFloodEvents(legacy.payload.features,{}, {},now).features.length,1);

// On an empty browser cache, both BoM location endpoints can time out.
// The independent Queensland Government BoM flood-network layer must then
// recover the same six-digit station ID, not infer it from a similar name.
let qldRequests=0;
const qldSource={type:"FeatureCollection",features:[{
  type:"Feature",geometry:{type:"Point",coordinates:[145.683,-28.100]},
  properties:{gaugeno:"544019",stn_name:"CUNNAMULLA WEIR",
    basin:"Warrego",agency:"BoM"}
}]};
const qldOnlyFetch=async url=>{
  const target=String(url);
  if(target.includes("/river-height-bulletins"))
    return {ok:true,json:async()=>bulletin};
  if(target.includes("FloodCheck/FloodGauges/MapServer/1/query")){
    qldRequests++;
    return {ok:true,json:async()=>qldSource};
  }
  throw Error("Both BoM location endpoints refused");
};
const independent=await loadRiverGaugeOperationalSnapshot({
  fetchImpl:qldOnlyFetch,now:()=>now,
  storage:{getItem:()=>null,setItem:()=>{}}
});
assert.equal(qldRequests,1);
assert.equal(independent.metadataSource,"qld-government-bom-flood-network");
assert.equal(independent.matchedCount,1);
assert.equal(independent.payload.features[0].id,"bom:544019");
assert.deepEqual(independent.payload.features[0].geometry,
  qldSource.features[0].geometry);
assert.equal(independent.payload.features[0].properties.STORMTRACKER_HEIGHT_METRES,6.69);
assert.equal(independent.payload.features[0].properties.STORMTRACKER_FLOOD_CLASS,"minor");
assert.equal(reconcileFloodEvents(independent.payload.features,{}, {},now).features.length,1);
assert.equal(independent.payload.features[0].properties.forecast_site_classification,
  "","No invented station classifications");

const noCache=await loadRiverGaugeOperationalSnapshot({
 fetchImpl,now:()=>now,storage:{getItem:()=>null,setItem:()=>{}}
}).then(()=>null,e=>e);
assert.match(String(noCache?.message),/no time-valid verified station-location cache/);

blockRelay=false;
const fresh=await read();
assert.equal(fresh.metadataSource,"metadata-relay");
assert.equal(fresh.metadataFallback,false);

// Zero same-station joins from a plausible-looking BoM feed is a verification
// failure, never silently erase a previously positive statewide flood map.
const mismatchBulletin={products:[{product:"IDQ60294",observations:
 Array.from({length:6},(_,i)=>({stationId:"0300"+i,observedText:"8:00 am Wed 04/11/26",heightMetres:2}))}]};
const fetchMismatch=async url=>({ok:true,json:async()=>String(url).includes("river-height-bulletins")?
  mismatchBulletin:original});
await assert.rejects(
 loadRiverGaugeOperationalSnapshot({fetchImpl:fetchMismatch,now:()=>now,storage}),
 /zero matching station IDs/
);
console.log("PASS original BoM point geometry and Cunnamulla minor stage survive metadata relay failure via official direct GIS or 30-day bounded verified cache; zero-match source fails visibly");
