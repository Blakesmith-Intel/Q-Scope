import assert from "node:assert/strict";
import {canonicaliseLegacyBoMStationCache,createRiverGaugeLayer}
 from "../src/context-layers/river-gauge-layer-v1.js";
import {FLOOD_SIGNAL_STORAGE_KEY,evaluateFloodSignal}
 from "../src/context-layers/river-flood-signals-v1.js";
import {withStationFloodLevels} from "../src/context-layers/river-flood-thresholds-v1.js";
import {reconcileFloodEvents} from "../src/context-layers/river-flood-events-v1.js";
import {OFFICIAL_FLOOD_STORAGE_KEY}
 from "../src/context-layers/river-official-flood-persistence-v1.js";

const NOW=Date.UTC(2026,9,24,12,20),PREVIOUS=NOW-40*60000;
const SOURCE_ID="035295",OLD_ID="bom:35295",CURRENT_ID="bom:035295";
const oldFeature={id:OLD_ID,type:"Feature",
 geometry:{type:"Point",coordinates:[149.7,-23.3]},
 properties:{bom_stn_num:"35295",state:"QLD",name:"Bingeegang Weir HG",
 STORMTRACKER_HEIGHT_METRES:4.5,STORMTRACKER_FLOOD_CLASS:"moderate"}};
const metadata={type:"FeatureCollection",features:[{
 type:"Feature",geometry:oldFeature.geometry,
 properties:{bom_stn_num:35295,awrc_stateid:"130950A",
 state:"QLD",name:"Bingeegang Weir HG",lat:-23.3,long:149.7,
 location_types:"water level gauge;"}
}]};
const items=canonicaliseLegacyBoMStationCache({
 "bom:35295":[{time:PREVIOUS,height:4.5}],
 "bom:035295":[{time:NOW-10*60000,height:7.35}],
 "awrc:130950A":[{time:PREVIOUS,height:2}]});
assert.deepEqual(items[CURRENT_ID].map(x=>x.height),[4.5,7.35],
 "Only same numerical BoM station histories are merged, without data loss");
assert(items["awrc:130950A"],"Do not rewrite AWRC station identities");
const malformed=canonicaliseLegacyBoMStationCache({
 [OLD_ID]:{observedAt:PREVIOUS,feature:{...oldFeature,properties:{
  bom_stn_num:"35296"}}}});
assert.equal(malformed[CURRENT_ID].feature.id,OLD_ID,
 "Never relabel embedded records with conflicting native station numbers");

class Collection{values=[];suspendEvents(){}resumeEvents(){}
 removeAll(){this.values=[];}add(x){this.values.push(x);return x;}}
class Source{constructor(){this.entities=new Collection();this.show=false;}}
const CesiumRef={CustomDataSource:Source,
 Cartesian3:{fromDegrees:(...values)=>values},
 VerticalOrigin:{CENTER:0},HeightReference:{CLAMP_TO_GROUND:1}};
const viewer={dataSources:{add(){}},scene:{requestRender(){}}};
const bulletin={partial:false,products:[{product:"IDQ60289",observations:[{
 stationId:SOURCE_ID,stationName:"Bingeegang Weir HG",
 heightMetres:7.35,tendency:"rising",floodClass:"",
 observedText:"10:10 pm Sat",sourceProduct:"IDQ60289"
}]}]};
const stored={
 [FLOOD_SIGNAL_STORAGE_KEY]:JSON.stringify({
  [OLD_ID]:[{time:PREVIOUS,height:4.5}]}),
 [OFFICIAL_FLOOD_STORAGE_KEY]:JSON.stringify({
  [OLD_ID]:{observedAt:PREVIOUS,feature:oldFeature}}),
 "stormtracker.qld-plot-crossings.v1":JSON.stringify({
  [OLD_ID]:{checkedAt:NOW,crossing:{type:"W",heightMetres:7.45,
   crossingName:"Bingeegang Weir published source",
   source:"Station height plot"}}})
};
const fetchImpl=async url=>{
 const s=String(url);
 const body=s.includes("qld-bom-river-station-locations-v1.json")?metadata:
  s.includes("river-height-bulletins")?bulletin:null;
 if(!body)throw Error("Unexpected fetch "+s);
 return {ok:true,json:async()=>body};
};
let firstUpdate=undefined,layer;
layer=createRiverGaugeLayer({viewer,CesiumRef,fetchImpl,now:()=>NOW,visible:true,
 storage:{getItem:key=>stored[key]??null,setItem:(key,v)=>stored[key]=v},
 onUpdate:()=>{if(firstUpdate===undefined)firstUpdate=layer.lastLoadedAt;}});
await layer.refresh();
assert.equal(firstUpdate,NOW,
 "Map/report callback must observe confirmed BoM load time, not Awaiting");
assert.equal(layer.lastLoadedAt,NOW);
assert.equal(layer.sourceFeatures[0].id,CURRENT_ID);
assert.equal(layer.sourceFeatures[0].properties.STORMTRACKER_IDENTITY_WARNING,
 undefined);
assert.equal(layer.sourceFeatures[0].properties.STORMTRACKER_CROSSING_LEVEL_METRES,
 undefined);
assert.equal(layer.features.length,1,
 "Synthetic verified rapid rise must preserve the original BLUE gauge marker");
assert.equal(layer.features[0].properties.STORMTRACKER_DISPLAY_STATE,"rapid-rise");
assert.equal(layer.features[0].properties.STORMTRACKER_RAPID_RISE,true);
assert.equal(layer.sourceFeatures[0].properties.STORMTRACKER_PLOT_CROSSING.crossingName,
 "Bingeegang Weir published source",
 "Previous station-specific BoM crossing/header cache must survive ID canonicalisation");
assert.equal(layer.features[0].properties.STORMTRACKER_CROSSING_NAME,undefined,
 "A weir-level is not a road/bridge crossing and must not be portrayed as one");
assert.equal(Object.keys(JSON.parse(stored[OFFICIAL_FLOOD_STORAGE_KEY])).length,0,
 "A below-minor current reading must clear previously cached false moderate");
// Official severity colour and independent blue rise modifier coexist.
// All samples are from the exact same gauge with a newer matching timestamp.
for(const [height,expected] of [[9.55,"minor"],[12.55,"moderate"],
 [15.55,"major"]]){
 const timestamp=NOW-10*60000;
 const feature=withStationFloodLevels([{
  id:CURRENT_ID,type:"Feature",geometry:oldFeature.geometry,
  properties:{bom_stn_num:"35295",name:"Bingeegang Weir HG",
    state:"QLD",lat:-23.3,long:149.7,
    location_types:"water level gauge;",
    STORMTRACKER_HEIGHT_METRES:height,
    STORMTRACKER_TENDENCY:"rising",
    STORMTRACKER_FLOOD_CLASS:expected,
    STORMTRACKER_OBSERVED_TEXT:"10:10 pm Sat"}
 }])[0];
 const archive={[CURRENT_ID]:[{time:PREVIOUS,height:4.5},
   {time:timestamp,height}]};
 const evaluated=evaluateFloodSignal(feature,archive,NOW);
 assert.equal(evaluated.state,expected,expected+" retains its own flood stage");
 assert.equal(evaluated.rapidRise,true,
   expected+" must retain its independent measured rapid-rise modifier");
 const selected=reconcileFloodEvents([feature],archive,{},NOW);
 assert.equal(selected.features.length,1);
 assert.equal(selected.features[0].properties.STORMTRACKER_DISPLAY_STATE,
   expected,"No blue-only replacement of official severity");
 assert.equal(selected.features[0].properties.STORMTRACKER_RAPID_RISE,true,
   expected+" marker must carry blue upward-arrow flag");
}
console.log("PASS canonical BoM history migration preserves BLUE rapid-rise and the arrow on minor, moderate and major; report shows loaded observations before redraw.");
