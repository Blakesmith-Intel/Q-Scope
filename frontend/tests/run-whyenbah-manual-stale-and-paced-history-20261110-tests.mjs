import assert from "node:assert/strict";
import {parseRiverHeightTable} from "../src/context-layers/river-height-bulletin-v1.js";
import {joinRiverGaugeObservations} from "../src/context-layers/river-gauge-observations-v1.js";
import {withStationFloodLevels} from "../src/context-layers/river-flood-thresholds-v1.js";
import {reconcileFloodEvents} from "../src/context-layers/river-flood-events-v1.js";
import {evaluateFloodSignal,floodStageEvidenceMaxAge,
  FLOOD_STAGE_MAX_AGE_MS,MANUAL_FLOOD_STAGE_MAX_AGE_MS}
  from "../src/context-layers/river-flood-signals-v1.js";
import {retainConfirmedFloodStations} from "../src/context-layers/river-official-flood-persistence-v1.js";
import {QLD_BOM_GAUGE_REFERENCE} from "../../relay/qld-bom-gauge-reference-20261110-v1.js";
import {createRiverHistoryBudget,RIVER_HISTORY_WINDOW_LIMIT}
  from "../src/context-layers/river-history-request-budget-v1.js";
import {planBoMStationTableLookups} from "../src/context-layers/bom-recent-river-history-v1.js";

const NOW=Date.UTC(2026,10,10,0,45); // Tuesday 10:45 AEST
const oneHour=3600000;
const manualRow=(height=4.04,mode="Manual",stage="Minor")=>`
<tr>
<td>Balonne River at Whyenbah</td><td>${mode}</td>
<td>09.00AM Mon</td><td>${height}</td><td>steady</td><td>${stage}</td>
<td><a href="/fwo/IDQ65396/IDQ65396.044154.plt.shtml">Plot</a></td>
</tr>`;
const otherRow=`<tr>
<td>Culgoa River at Whyenbah</td><td>Automatic</td>
<td>10.00AM Tue</td><td>3.38</td><td>steady</td><td></td>
<td><a href="/fwo/IDQ65396/IDQ65396.544018.plt.shtml">Plot</a></td>
</tr>`;
const parse=(height,mode="Manual",stage="Minor")=>parseRiverHeightTable(
  `<table><tr><th>Station Name</th><th>Type</th><th>Time/Day</th>
  <th>Height</th><th>Tendency</th><th>Flood Class</th><th>Recent Data</th></tr>
  ${manualRow(height,mode,stage)}${otherRow}</table>`,"IDQ60293");
const original=parse(4.04);
assert.equal(original[0].stationId,"044154");
assert.equal(original[0].reportingMode,"manual");
assert.equal(original[1].stationId,"544018");
assert.equal(original[1].reportingMode,undefined);
const bulletin={products:[{product:"IDQ60293",observations:original}]};
const joined=joinRiverGaugeObservations({gauges:QLD_BOM_GAUGE_REFERENCE,bulletins:bulletin,nowMs:NOW});
assert.equal(joined.matchedCount,2,"Both distinct Whyenbah gauges must match exact IDs");
joined.payload.features=withStationFloodLevels(joined.payload.features);
const why=joined.payload.features.find(f=>f.id==="bom:044154");
const cul=joined.payload.features.find(f=>f.id==="bom:544018");
assert(why&&cul);
assert.equal(why.properties.STORMTRACKER_MINOR_FLOOD_METRES,4);
assert.equal(cul.properties.STORMTRACKER_MINOR_FLOOD_METRES,3.5);
assert.equal(why.properties.STORMTRACKER_REPORTING_MODE,"manual");
assert.equal(floodStageEvidenceMaxAge(why),MANUAL_FLOOD_STAGE_MAX_AGE_MS);
assert.equal(floodStageEvidenceMaxAge(cul),FLOOD_STAGE_MAX_AGE_MS);
const decision=evaluateFloodSignal(why,{},NOW);
assert.equal(decision.show,true,"25h45 old verified manual minor must remain on map");
assert.equal(decision.state,"minor");
assert.equal(decision.stale,true);
assert.equal(decision.rapidRise,false);
const reconciled=reconcileFloodEvents(joined.payload.features,{}, {},NOW);
assert.deepEqual(reconciled.features.map(x=>x.id),["bom:044154"],
  "Do not promote the nearby Culgoa Whyenbah automatic gauge");
assert.equal(reconciled.features[0].properties.STORMTRACKER_OBSERVATION_STALE,true);
const retained=retainConfirmedFloodStations(joined.payload.features,{},NOW);
assert(retained.cache["bom:044154"],"The same source-verified manual stage should survive a transient bulletin outage");
assert.equal(retained.cache["bom:544018"],undefined);

const expired=NOW+23*oneHour;
assert.equal(evaluateFloodSignal(why,{},expired).show,false,
  "A manual flood observation older than 48h must expire, not imply current safety");
const automatic=joinRiverGaugeObservations({
  gauges:QLD_BOM_GAUGE_REFERENCE,
  bulletins:{products:[{product:"IDQ60293",observations:parse(4.04,"Automatic")}]},
  nowMs:NOW
}).payload.features.find(f=>f.id==="bom:044154");
assert(automatic);
assert.equal(evaluateFloodSignal(automatic,{},NOW).show,false,
  "Automatic sites cannot use manual flood stage grace period");
const below=joinRiverGaugeObservations({
  gauges:QLD_BOM_GAUGE_REFERENCE,
  bulletins:{products:[{product:"IDQ60293",observations:parse(3.95,"Manual","Below Minor")}]},
  nowMs:NOW
}).payload.features.find(f=>f.id==="bom:044154");
assert(below);
assert.equal(evaluateFloodSignal(below,{},NOW).show,false,
  "Stale below-minor does not become an alert or an assumed all-clear");
assert.equal(floodStageEvidenceMaxAge(below),FLOOD_STAGE_MAX_AGE_MS);

// The queue is independent of current bulletins and has no Worker poller.
// Four immediate verified-station requests max, then 60-second pulses,
// 24 per ten minutes, regardless of the eligible statewide gauge count.
const budget=createRiverHistoryBudget();
const begin=1_000_000;
assert.equal(budget.allowance(begin).count,4);
assert.throws(()=>budget.consume(5,begin),/budget exceeded/);
for(let i=0;i<6;i++){
  const at=begin+i*60000;
  assert.equal(budget.allowance(at).count,4);
  budget.consume(4,at);
  assert.equal(budget.allowance(at+200).count,0);
}
assert.equal(budget.allowance(begin+6*60000).count,0);
assert.equal(budget.allowance(begin+6*60000).remaining,0);
assert.equal(budget.allowance(begin+10*60000).count,4);
assert.equal(RIVER_HISTORY_WINDOW_LIMIT,24);

// Above-minor stations outrank unrelated routine rise/crossing discovery.
// No station is selected by matching an ambiguous place name.
const candidate=(id,height,flood="",type="steady")=>({
  id:"bom:"+id,type:"Feature",geometry:{type:"Point",coordinates:[148,-27]},
  properties:{bom_stn_num:id,name:"Example "+id,state:"QLD",
    STORMTRACKER_HEIGHT_METRES:height,STORMTRACKER_TENDENCY:type,
    STORMTRACKER_FLOOD_CLASS:flood,
    STORMTRACKER_OFFICIAL_OBSERVED_AT:NOW-10*60000,
    STORMTRACKER_OBSERVED_TEXT:"10.35AM Tue",
    STORMTRACKER_RECENT_DATA_HREF:
      "/fwo/IDQ65396/IDQ65396."+id+".plt.shtml"}
});
const ordered=planBoMStationTableLookups([
  candidate("044117",1.1),candidate("044154",4.04,"minor"),
  candidate("544018",3.38),candidate("043101",8.1,"moderate")
],{nowMs:NOW});
assert.deepEqual(ordered.slice(0,2).map(x=>x.id),
  ["bom:043101","bom:044154"],
  "Official flood-stage stations are ahead of routine source history checks");
console.log("PASS Whyenbah manual 4.04m minor 25h45 stale, two distinct stations, 48h manual expiry, strict source provenance, 4/min budget, 24/10min and flood-first priority");
