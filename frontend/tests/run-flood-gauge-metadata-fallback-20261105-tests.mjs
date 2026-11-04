import assert from "node:assert/strict";
import {loadRiverGaugeOperationalSnapshot} from "../src/context-layers/river-gauge-observations-v1.js";
import {reconcileFloodEvents} from "../src/context-layers/river-flood-events-v1.js";

// Keep the same ORIGINAL BoM station-location relay, IDs and source fields.
// Only the reference-metadata lifetime and its mistaken 15s abort are fixed.
const source={
 type:"FeatureCollection",features:[{
  type:"Feature",id:"bom:544019",
  geometry:{type:"Point",coordinates:[145.683333,-28.1]},
  properties:{bom_stn_num:"544019",awrc_stateid:"423202C",
   name:"Cunnamulla Weir",lat:-28.1,long:145.683333,
   state:"QLD",location_types:"water level gauge;",
   forecast_site_classification:"Qualitative",
   basin:"Warrego",agency:"BoM"}
 }]
};
const now=Date.UTC(2026,10,5,0,0);
let metadataRequests=0,heightRequests=0,recordedTimeouts=[];
const nativeSetTimeout=globalThis.setTimeout;
globalThis.setTimeout=(cb,ms,...args)=>{
  if(ms===60000||ms===15000)recordedTimeouts.push(ms);
  return nativeSetTimeout(cb,ms,...args);
};
const fetchImpl=async (url,{signal}={})=>{
 const target=String(url);
 if(target.endsWith("/river-gauge-metadata")){
   metadataRequests++;
   // The source isn't absent: it just isn't ready immediately while the
   // radar-heavy browser is also fetching genuine imagery.
   await new Promise(resolve=>nativeSetTimeout(resolve,25));
   assert.equal(signal?.aborted,false,"Never abort a valid slow metadata read after 15s");
   return {ok:true,json:async()=>source};
 }
 if(target.includes("/river-height-bulletins")){
   heightRequests++;
   return {ok:true,json:async()=>({
    partial:false,failed:[],products:[{product:"IDQ60294",
     observations:[{stationId:"544019",stationName:"Cunnamulla Weir",
       heightMetres:6.69,observedText:"10:00 am Thu 05/11/2026",
       floodClass:"minor",tendency:"steady",sourceProduct:"IDQ60294"}]}]
   })};
 }
 throw Error("Unapproved flood source requested: "+target);
};
try{
 const first=await loadRiverGaugeOperationalSnapshot({fetchImpl});
 const second=await loadRiverGaugeOperationalSnapshot({fetchImpl,force:true});
 assert.equal(metadataRequests,1,"BoM reference metadata loads once, not every ten-minute height update");
 assert.equal(heightRequests,2,"Every refresh retrieves live river-height bulletins");
 assert.ok(recordedTimeouts.includes(60000),"Verified metadata is allowed a bounded 60-second retrieval window");
 assert.ok(recordedTimeouts.includes(15000),"BoM height refresh timeout is unchanged");
 assert.equal(first.matchedCount,1);
 assert.equal(second.matchedCount,1);
 const matched=second.payload.features[0];
 assert.equal(matched.id,"bom:544019");
 assert.equal(matched.properties.location_types,"water level gauge;",
   "Original BoM metadata and tidal screening fields must be retained unchanged");
 assert.equal(matched.properties.STORMTRACKER_HEIGHT_METRES,6.69);
 assert.equal(matched.properties.STORMTRACKER_FLOOD_CLASS,"minor");
 const markers=reconcileFloodEvents(second.payload.features,{}, {},now);
 assert.equal(markers.features.length,1,"A real BoM minor-stage reading still creates a flood marker");
 assert.equal(markers.features[0].properties.STORMTRACKER_DISPLAY_STATE,"minor");

 // No fake all-clear when the *single original* location source refuses.
 await assert.rejects(loadRiverGaugeOperationalSnapshot({
   fetchImpl:async url=>{
     if(String(url).endsWith("/river-gauge-metadata"))
       throw Error("BoM metadata relay unavailable");
     return {ok:true,json:async()=>({products:[]})};
   }
 }),/BoM metadata relay unavailable/);
 console.log("PASS original source-only BoM metadata request, 60s self-abort correction, one station fetch/session, live 10m height update, exact flood-stage classification");
}finally{globalThis.setTimeout=nativeSetTimeout;}
