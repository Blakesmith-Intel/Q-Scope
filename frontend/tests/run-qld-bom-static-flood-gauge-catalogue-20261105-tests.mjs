import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {loadRiverGaugeOperationalSnapshot} from "../src/context-layers/river-gauge-observations-v1.js";
import {reconcileFloodEvents} from "../src/context-layers/river-flood-events-v1.js";

// The real BoM published river-height station index, not made-up fixtures.
// Geography is published-only, source IDs exact and heights NEVER baked in.
const path=new URL("../data/qld-bom-river-station-locations-v1.json",import.meta.url);
const gauges=JSON.parse(readFileSync(path,"utf8"));
assert.equal(gauges.type,"FeatureCollection");
assert.equal(gauges.locationUseOnly,true);
assert.ok(gauges.features.length>=1700,"Queensland station catalogue cannot be an incomplete sample");
const cunnamulla=gauges.features.find(f=>f.id==="bom:544019");
assert.ok(cunnamulla,"BoM Cunnamulla Weir station exists");
assert.deepEqual(cunnamulla.geometry.coordinates,[145.683333,-28.1]);
assert.equal(cunnamulla.properties.STORMTRACKER_HEIGHT_METRES,undefined,
  "The location file cannot carry old heights");

// The live bulletin supplies the height and flood class, never the catalogue.
const now=Date.UTC(2026,10,5,0,0);
const bulletins={products:[{product:"IDQ60294",observations:[{
  stationId:"544019",stationName:"Cunnamulla Weir",observedText:"8:00 am Thu 05/11/2026",
  heightMetres:6.69,floodClass:"minor",tendency:"steady",sourceProduct:"IDQ60294"
}]}],partial:false,failed:[]};
const requested=[];
const result=await loadRiverGaugeOperationalSnapshot({
  fetchImpl:async (url)=>{
    const target=String(url);requested.push(target);
    if(target.includes("qld-bom-river-station-locations-v1.json"))
      return {ok:true,json:async()=>gauges};
    if(target.includes("river-height-bulletins"))
      return {ok:true,json:async()=>bulletins};
    throw Error("Unexpected upstream location-service request "+target);
  }
});
assert.equal(requested.length,2,"One local location asset and one live bulletin call");
assert.equal(result.totalGaugeLocations,gauges.features.length);
assert.equal(result.matchedCount,1);
assert.equal(result.payload.features[0].id,"bom:544019");
assert.equal(result.payload.features[0].properties.STORMTRACKER_HEIGHT_METRES,6.69);
const visible=reconcileFloodEvents(result.payload.features,{}, {},now);
assert.equal(visible.features.length,1,"BoM minor flood must produce a marker");
assert.equal(visible.features[0].properties.STORMTRACKER_DISPLAY_STATE,"minor");
console.log("PASS BoM static station catalogue (1,809 real coordinates) + live height matching, unchanged minor flood renderer, zero ArcGIS metadata requests.");
