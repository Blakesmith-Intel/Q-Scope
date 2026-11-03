import assert from "node:assert/strict";
import {HIRES_RAIN_WINDOWS,availableMeasuredHiResLoopMinutes,measuredHiResRainWindow,
 isVerifiedHiResRadarFrame} from "../src/hires-radar-loop-policy-v1.js";
import {RAIN_ONLY_LOOP_MINUTES,buildOperationalWindowChoices}
 from "../src/operational-window-choices-v1.js";
const base=Date.parse("2026-10-19T11:45:00Z");
const series=Array.from({length:40},(_,i)=>new Date(base-(39-i)*300000)
 .toISOString().replace(".000Z","Z"));
const expected=new Map([["30",6],["60",12],["90",18],["120",24],["180",36]]);
assert.deepEqual(HIRES_RAIN_WINDOWS,[30,60,90,120,180]);
// Retain existing historical source-integrity calculations but stop exposing
// archive durations to operators: native rain playback is six scans only.
assert.deepEqual(RAIN_ONLY_LOOP_MINUTES,[30]);
for(const [selection,n] of expected){
 const result=measuredHiResRainWindow(series,selection);
 assert.equal(result.requiredFrames,n);
 assert.equal(result.plan.length,n,selection+" frame count");
 assert.equal(result.partial,false);
 assert.deepEqual(result.plan.map(x=>x.observedUtc),series.slice(-n));
 assert(result.plan.every(x=>x.kind==="observed"));
}
assert.deepEqual(availableMeasuredHiResLoopMinutes(series),[30,60,90,120,180]);
for(const [length,available] of [[4,[]],[6,[30]],[12,[30,60]],
 [17,[30,60]],[18,[30,60,90]],[24,[30,60,90,120]],
 [36,[30,60,90,120,180]]]){
 const times=series.slice(-length);
 assert.deepEqual(availableMeasuredHiResLoopMinutes(times),available);
 const choices=buildOperationalWindowChoices({
  rainAvailableMinutes:available,rainHasFrames:times.length>0
 });
 assert.deepEqual(choices.slice(1).filter(x=>!x.disabled).map(x=>Number(x.value)),
  [30],
  "Only the source-published standard 30-minute rain loop is operator-selectable");
}
const missing=series.filter((_,i)=>i!==series.length-14);
const gaps=availableMeasuredHiResLoopMinutes(missing);
assert.deepEqual(gaps,[30,60],"Gap invalidates 90/120/180 but does not invent the missing frame");
assert.equal(measuredHiResRainWindow(missing,"90").partial,true);
assert(measuredHiResRainWindow(missing,"90").plan.every(x=>x.kind==="observed"));
const frame={sourceId:"BOM-MOSAIC",width:768,height:768,
 categories:{length:768*768},georef:{projection:"EPSG:3857"},
 sourceMetadata:{tileMatrixSet:"GoogleMapsCompatible_BoM"},observedUtc:series.at(-1)};
assert(isVerifiedHiResRadarFrame(frame));
assert(!isVerifiedHiResRadarFrame({...frame,sourceId:"BOM-FTP-MOSAIC"}));
console.log("PASS_BOM_HIRES_BROWSER_ARCHIVE_30_60_90_120_180_COUNTS_6_12_18_24_36");
console.log("PASS_GAPPED_SOURCE_NOT_TEMPORALLY_FABRICATED_AND_ARCHIVE_UI_WITHDRAWN");
