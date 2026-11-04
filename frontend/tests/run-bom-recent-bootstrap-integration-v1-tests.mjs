import assert from "node:assert/strict";
import {createRiverGaugeLayer} from "../src/context-layers/river-gauge-layer-v1.js";
const now=Date.UTC(2026,9,8,8,30);
const gauge={id:"bom:540384",type:"Feature",geometry:{type:"Point",coordinates:[153.1,-27.6]},
 properties:{bom_stn_num:"540384",awrc_stateid:"QLD-384",state:"QLD",name:"Upper Example River",
 lat:-27.6,long:153.1,location_types:"water level gauge;",
 forecast_site_classification:"Qualitative"}};
let upstreamHistoryCalls=0;
const historyPoints=[
 {time:Date.UTC(2026,9,8,7,45),height:0.5},
 {time:Date.UTC(2026,9,8,8,15),height:2.25}
];
const fetchImpl=async url=>{
 const u=String(url);
 if(u.includes("qld-bom-river-station-locations-v1.json"))return {ok:true,json:async()=>({
   type:"FeatureCollection",features:[gauge]})};
 if(u.includes("/river-height-bulletins"))return {ok:true,json:async()=>({
   partial:false,products:[{product:"IDQ60285",observations:[{
    stationName:"Upper Example River",stationId:"540384",
    heightMetres:2.25,tendency:"rising",floodClass:"minor",
    observedText:"6:15 pm Thu 08/10/2026",
    recentDataHref:"/fwo/IDQ65388/IDQ65388.540384.plt.shtml"
   }]}]})};
 if(u.includes("/river-recent-history?")){
   upstreamHistoryCalls++;
   assert.match(u,/product=IDQ65388/);
   assert.match(u,/station=540384/);
   return {ok:true,json:async()=>({
    format:"StormTrackerBomRecentRiverHistoryV1",
    product:"IDQ65388",station:"540384",samples:historyPoints
   })};
 }
 throw Error("Unexpected URL "+u);
};
class Collection{
 constructor(){this.values=[];}
 suspendEvents(){}
 resumeEvents(){}
 removeAll(){this.values=[];}
 add(item){const entity={...item};this.values.push(entity);return entity;}
}
class Source{
 constructor(){this.entities=new Collection();this.show=true;}
}
const dataSources=[];
const viewer={dataSources:{add:s=>dataSources.push(s)},
 scene:{requestRender(){}}};
const CesiumRef={CustomDataSource:Source,
 Cartesian3:{fromDegrees:(...p)=>p},
 VerticalOrigin:{CENTER:0},HeightReference:{CLAMP_TO_GROUND:1}};
const values={};
const status=[];
const layer=createRiverGaugeLayer({
 viewer,CesiumRef,fetchImpl,now:()=>now,visible:true,
 storage:{getItem:key=>values[key]??null,setItem:(key,v)=>{values[key]=v;}},
 onStatus:x=>status.push(x)
});
await layer.refresh();
// An official minor gauge now appears before optional station history
// loads. Wait for the separate async measured-rate screen to UPGRADE it.
for(let i=0;i<60 &&
 layer.features[0]?.properties?.STORMTRACKER_RAPID_RISE!==true;i++){
 await new Promise(resolve=>setTimeout(resolve,15));
}
assert.equal(layer.features.length,1,
 "BoM history should surface measured rapid rise on first page load");
assert.equal(layer.features[0].properties.STORMTRACKER_DISPLAY_STATE,"minor");
assert.equal(layer.features[0].properties.STORMTRACKER_RAPID_RISE,true);
assert.ok(layer.features[0].properties.STORMTRACKER_RISE_RATE_M_PER_H>1.40);
assert.equal(layer.features[0].id,gauge.id);
assert.equal(upstreamHistoryCalls,1);
assert.equal(layer.recentHistoryRequestCount,1);
assert.ok(status.some(item=>item.historyLoaded===1));
assert.equal(dataSources.flatMap(source=>source.entities.values).length,1,
 "Exactly one flood marker is rendered across the severity strata");
await layer.refresh({force:true});
assert.equal(upstreamHistoryCalls,1,"Do not refetch recent station tables during routine bulletin refresh");
console.log("BoM historical cold-start integration passed: first real bulletin identifies candidate, bounded existing-relay request supplies 30-min evidence, map rapidly shows only qualifying signal without waiting 15-minute polls.");
