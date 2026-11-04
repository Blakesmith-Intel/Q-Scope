import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {formatFloodGaugeOperatorStatus} from
  "../src/context-layers/river-gauges-operational-v1.js";

// Approved snapshot: ordinary historical coverage shortfalls are informational.
// The counts are different populations; do not show full diagnostic text as an
// amber system failure, or invent any extra alerts.
const diagnostic="18 qualifying flood signals · 30–120 min rise check incomplete at 42 eligible gauges statewide (5 of 18 flood signals affected; not extra flood alerts) · history: 42 station tables loaded this pass (1089 stations with retained samples) · screening only; follow BoM warnings";
const result=formatFloodGaugeOperatorStatus({
  kind:"warning",message:diagnostic,count:18,
  screeningIncomplete:42,historyScreeningAlertsAffected:5,
  historyLoaded:42,historyRetainedStationSamples:1089
});
assert.equal(result.kind,"ok","Optional history gap must not produce an amber system error");
assert.equal(result.main,"Flood gauges · 18 signals · Monitoring active");
assert.equal(result.summary,
  "5 signals awaiting additional rise-rate history · View data coverage");
assert(result.details.some(x=>x.includes("42 eligible gauges")));
assert(result.details.some(x=>x.includes("5 of 18")));
assert(result.details.some(x=>x.includes("1089")));
assert(result.details.some(x=>x.includes("42.")));
assert(result.details.at(-1).includes(diagnostic),
  "Existing full source diagnostics must remain available behind disclosure");
assert(!result.main.includes("42")&&!result.main.includes("30–120"));

// No history gap: no extra warning or artificial 'awaiting' status.
const allComplete=formatFloodGaugeOperatorStatus({
  kind:"ok",message:"No history gaps",count:0,
  screeningIncomplete:0,historyScreeningAlertsAffected:0
});
assert.equal(allComplete.main,"Flood gauges · 0 signals · Monitoring active");
assert.equal(allComplete.summary,"View data coverage");
const one=formatFloodGaugeOperatorStatus({
  kind:"warning",count:1,screeningIncomplete:1,historyScreeningAlertsAffected:1,
  message:"history screening incomplete"
});
assert.equal(one.summary,"1 signal awaiting additional rise-rate history · View data coverage");
assert.equal(one.kind,"ok");

// Partial official products, fallback metadata, and critical stale readings
// MUST remain operator-visible warnings even when optional history is missing.
const partial=formatFloodGaugeOperatorStatus({
  kind:"warning",count:5,partial:true,
  failedProducts:[{product:"IDQ60285"}],screeningIncomplete:7,
  historyScreeningAlertsAffected:2,message:"full relay partial diagnostic"
});
assert.equal(partial.kind,"warning");
assert.match(partial.main,/BoM height feed partial \(1 bulletin product unavailable\)/);
const stale=formatFloodGaugeOperatorStatus({
  kind:"warning",count:5,staleOfficial:2,screeningIncomplete:7,
  historyScreeningAlertsAffected:2
});
assert.equal(stale.kind,"warning");
assert.match(stale.main,/2 last-confirmed flood stages with stale observations/);
const metadata=formatFloodGaugeOperatorStatus({
  kind:"warning",count:5,metadataFallback:true
});
assert.equal(metadata.kind,"warning");
assert.match(metadata.main,/station reference recovery in use/);

// Hard errors (including unavailable authoritative source) and operator
// hide/loading messages keep their existing clear status and no stale details.
for(const [kind,message] of [
  ["error","BoM metadata timed out locally after 60s"],
  ["loading","Checking BoM river gauges..."],
  ["normal","Flood-signal markers hidden · observations continue"]
]){
  const state=formatFloodGaugeOperatorStatus({kind,message,count:5});
  assert.equal(state.main,message);
  assert.equal(state.kind,kind);
  assert.deepEqual(state.details,[]);
}
const operational=readFileSync(new URL(
  "../src/context-layers/river-gauges-operational-v1.js",import.meta.url),"utf8");
assert(operational.includes("floodGaugeCoverageDetails"));
assert(operational.includes('document.createElement("details")'));
assert(operational.includes('coverage.hidden=!view.details.length'));
assert(operational.includes("summary.textContent=view.summary"));
assert(!operational.includes("coverage.open=false"),
  "Refreshing must preserve operator's expanded disclosure state");
const layer=readFileSync(new URL(
  "../src/context-layers/river-gauge-layer-v1.js",import.meta.url),"utf8");
assert(layer.includes("metadataFallback:Boolean(diagnostics?.metadataFallback)"));
assert(layer.includes("historyRetainedStationSamples:Object.keys(history).length"));
assert(layer.includes("STORMTRACKER_OBSERVATION_STALE"),
  "History-only status must retain live source-critical stale warnings");
console.log("PASS operator flood gauge status: routine history neutral, real BoM failures visible, disclosure accessible, no reset on refresh, no science changes");
