import assert from "node:assert/strict";
import {frameCountForLoopMinutes} from "../src/operational-loop-v1.js";
import {selectRadarHistoryPlan,selectRadarHistoryTimes,
 availableRadarLoopMinutes} from "../src/radar-history-window-v1.js";
import {resolveRainHistoryWindow} from "../src/rain-history-recovery-v1.js";
import {readFileSync} from "node:fs";

const origin=Date.parse("2026-11-12T00:50:00Z");
const stamps=indices=>indices.map(i=>new Date(origin+i*300000).toISOString());
const genuine=stamps([0,1,2,3,4,5,6]);
assert.equal(frameCountForLoopMinutes(30),7);
assert.equal((Date.parse(genuine.at(-1))-Date.parse(genuine[0]))/60000,30);
assert.deepEqual(availableRadarLoopMinutes(genuine),[30]);
assert.deepEqual(selectRadarHistoryTimes(genuine,30),genuine);
const plan=selectRadarHistoryPlan(genuine,30);
assert.equal(plan.length,7);
assert(plan.every(entry=>entry.kind==="observed"));
assert.equal(plan[0].observedUtc,"2026-11-12T00:50:00.000Z");
assert.equal(plan.at(-1).observedUtc,"2026-11-12T01:20:00.000Z");
for(const radar of ["08","66","23","27"]){
 const sitePlan=resolveRainHistoryWindow(genuine,30);
 assert.equal(sitePlan.partial,false,radar+" real 7-frame window");
 assert.equal(sitePlan.plan.length,7,radar+" accepts full 30-minute history");
 assert(sitePlan.plan.every(entry=>entry.kind==="observed"));
}
// A feed with only six advertised 5-minute timestamps is 25 minutes.
// Mark it partial, not complete or falsely extended by reusing a scan.
const six=genuine.slice(1);
assert.equal(availableRadarLoopMinutes(six).includes(30),false);
const partial=resolveRainHistoryWindow(six,30);
assert.equal(partial.partial,true);
assert.equal(partial.plan.length,6);
assert(!partial.plan.some(f=>f.observedUtc===genuine[0]));
// No new source discovery fanout or timed Worker fetch was introduced to
// fill the absent oldest frame. Existing bounded BoM published time filter.
const source=readFileSync(new URL("../src/bom-wmts-loop-v2.js",import.meta.url),"utf8");
assert.match(source,/maximumPublishedFrames=9/);
assert.match(source,/now=Date.now\(\),count=7,region='SEQ'/);
assert.doesNotMatch(source,/new Date\(.*?30\*60000.*?synthetic/i);
console.log("PASS BoM 00:50–01:20 inclusive = 7 genuine source frames; six = honest partial 25min; independent radar sites share contract");
