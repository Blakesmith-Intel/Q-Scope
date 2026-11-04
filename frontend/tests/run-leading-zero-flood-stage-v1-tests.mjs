import assert from "node:assert/strict";
import {canonicalBomRiverStationNumber,riverGaugeId,riverGaugeSummary}
 from "../src/context-layers/river-gauges-v1.js";
import {joinRiverGaugeObservations} from "../src/context-layers/river-gauge-observations-v1.js";
import {stationFloodLevels,withStationFloodLevels,observedFloodClass}
 from "../src/context-layers/river-flood-thresholds-v1.js";
import {evaluateFloodSignal} from "../src/context-layers/river-flood-signals-v1.js";
import {retainConfirmedFloodStations,OFFICIAL_FLOOD_STORAGE_KEY}
 from "../src/context-layers/river-official-flood-persistence-v1.js";
import {createRiverGaugeLayer} from "../src/context-layers/river-gauge-layer-v1.js";

import {BOM_2026_CLASSIFICATIONS,BOM_2026_DATA_ONLY_STATIONS}
 from "../src/context-layers/river-flood-stages-2026-full-v1.js";

const allPublishedIds=[...Object.keys(BOM_2026_CLASSIFICATIONS),
 ...BOM_2026_DATA_ONLY_STATIONS];
for(const id of allPublishedIds){
 const stripped=String(Number(id.slice(4)));
 assert.equal(riverGaugeId({properties:{bom_stn_num:stripped}}),id,
  "Every 2026 published station, including its leading zero(s), must match the same BoM source ID");
}

const NOW=Date.UTC(2026,9,24,12,20);
const old=Date.UTC(2026,9,24,11,17);
assert.equal(canonicalBomRiverStationNumber("35295"),"035295");
assert.equal(canonicalBomRiverStationNumber("035295"),"035295");
assert.equal(canonicalBomRiverStationNumber("29001"),"029001");
assert.equal(canonicalBomRiverStationNumber("540097"),"540097");
assert.equal(canonicalBomRiverStationNumber("3529512"),"3529512");
assert.equal(canonicalBomRiverStationNumber("X123"),"X123");

const source={type:"Feature",geometry:{type:"Point",coordinates:[149.7,-23.3]},
 properties:{bom_stn_num:"35295",awrc_stateid:"130950A",
  name:"Bingeegang Weir HG (Mackenzie River)",state:"QLD",
  lat:-23.3,long:149.7,location_types:"water level gauge;"}};
assert.equal(riverGaugeId(source),"bom:035295");
assert.equal(riverGaugeSummary(source).bomStationNumber,"035295");
const gauges={type:"FeatureCollection",features:[source]};
const bulletin=(height,floodClass="",observedText="10:14 pm Sat")=>({
 partial:false,products:[{product:"IDQ60289",observations:[{
 stationId:"035295",stationName:"Bingeegang Weir HG",
 heightMetres:height,tendency:"falling",floodClass,observedText
 }]}]});
const joined=joinRiverGaugeObservations({gauges,bulletins:bulletin(7.35),nowMs:NOW});
assert.equal(joined.matchedCount,1,"BoM 035295 matches metadata 35295 by numeric station ID");
assert.equal(joined.payload.features[0].id,"bom:035295");
const enriched=withStationFloodLevels(joined.payload.features)[0];
assert.equal(enriched.properties.STORMTRACKER_IDENTITY_WARNING,undefined,
 "Stripped leading zero is NOT an identity conflict");
assert.equal(enriched.properties.STORMTRACKER_THRESHOLD_STATUS,"2026-station-native");
assert.deepEqual(stationFloodLevels(enriched),{minor:9.5,moderate:12.5,major:15.5});
assert.equal(observedFloodClass(7.35,stationFloodLevels(enriched)),null);

const confirmedRecord={observedAt:old,feature:{...enriched,
 properties:{...enriched.properties,STORMTRACKER_FLOOD_CLASS:"moderate",
 STORMTRACKER_OFFICIAL_OBSERVED_AT:old}}};
const previous={"bom:035295":confirmedRecord};
const retained=retainConfirmedFloodStations([enriched],previous,NOW);
assert.equal(Object.keys(retained.cache).length,0,
 "Newer measured BELOW-MINOR 7.35m MUST clear old moderate classification");
assert.equal(retained.features[0].properties.STORMTRACKER_LAST_CONFIRMED_FLOOD_CLASS,
 undefined);
assert.equal(evaluateFloodSignal(retained.features[0],{},NOW).show,false);

class MockCollection{values=[];suspendEvents(){}resumeEvents(){}
 removeAll(){this.values=[];}add(x){this.values.push(x);return x;}}
class MockSource{constructor(){this.entities=new MockCollection();this.show=true;}}
const CesiumRef={CustomDataSource:MockSource,
 Cartesian3:{fromDegrees:(...x)=>x},VerticalOrigin:{CENTER:0},
 HeightReference:{CLAMP_TO_GROUND:1}};
const viewer={dataSources:{add(){}},scene:{requestRender(){}}};
let step=0;
const fetchImpl=async url=>{
 const u=String(url);
 let body;
 if(u.includes("qld-bom-river-station-locations-v1.json"))body=gauges;
 else if(u.includes("river-height-bulletins"))body=bulletin(step===0?7.35:12.55,
   step===0?"":"moderate",step===0?"10:14 pm Sat":"10:16 pm Sat");
 else throw Error("Unexpected fetch "+u);
 return {ok:true,json:async()=>body};
};
const stored={[OFFICIAL_FLOOD_STORAGE_KEY]:JSON.stringify(previous)};
const layer=createRiverGaugeLayer({viewer,CesiumRef,now:()=>NOW,fetchImpl,
 storage:{getItem:k=>stored[k]??null,setItem:(k,v)=>{stored[k]=v;}}});
await layer.refresh();
assert.equal(layer.features.length,0,
 "Bingeegang at 7.35m must NOT display a yellow moderate marker");
assert.equal(layer.sourceFeatures[0].properties.STORMTRACKER_THRESHOLD_STATUS,
 "2026-station-native");
assert.equal(layer.sourceFeatures[0].properties.STORMTRACKER_IDENTITY_WARNING,
 undefined);
assert.equal(Object.keys(JSON.parse(stored[OFFICIAL_FLOOD_STORAGE_KEY])).length,0,
 "Persisted old moderate record removed after current below-minor height");
step=1;
await layer.refresh({force:true});
assert.equal(layer.features.length,1);
assert.equal(layer.features[0].id,"bom:035295");
assert.equal(layer.features[0].properties.STORMTRACKER_DISPLAY_STATE,"moderate",
 "Genuine 12.55m reading should still display as yellow moderate");
assert.equal(layer.severityDataSources[3].entities.values.length,1,
 "Moderate marker must be drawn in original severity tier");
console.log("PASS Bingeegang 035295: five-digit network ID reconciles to six-digit BoM stages, clears false last-confirmed moderate at 7.35m, and draws correct moderate at 12.55m without changing map UI.");
