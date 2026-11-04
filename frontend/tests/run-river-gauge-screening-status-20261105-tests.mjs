import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {describeRiverGaugeRiseCoverage} from "../src/context-layers/river-gauge-layer-v1.js";

// The 15 displayed alerts and 53 state-wide incomplete history checks are
// independent counts. Never imply 53 additional flood alerts.
const status=describeRiverGaugeRiseCoverage({
  incomplete:53,affectedActiveSignals:2,activeSignals:15
});
assert.match(status,/53 eligible gauges statewide/);
assert.match(status,/2 of 15 flood signals affected/);
assert.match(status,/not extra flood alerts/);
assert.equal(describeRiverGaugeRiseCoverage({
  incomplete:0,affectedActiveSignals:0,activeSignals:15
}),"","No artificial warning when every eligible history is sufficient");
assert.match(describeRiverGaugeRiseCoverage({
  incomplete:1,affectedActiveSignals:1,activeSignals:1
}),/1 eligible gauge statewide/);
const code=readFileSync(new URL("../src/context-layers/river-gauge-layer-v1.js",
  import.meta.url),"utf8");
assert.match(code,/activeIds\.has\(gap\.id\)/,
  "Overlap must count actual map signal station IDs, not guess");
assert.match(code,/station table\$\{success===1\?"":"s"\} loaded this pass/,
  "Historical table successes must be explicitly labelled as this pass only");
assert.match(code,/stations with retained samples/,
  "Actual retained station samples must not be confused with this pass");
assert.match(code,/historyScreeningAlertsAffected/,
  "Operator diagnostics must distinguish overlapping alert gauges");
assert.match(code,/screening only; follow BoM warnings/,
  "Approved warning disclaimer must be maintained");
console.log("PASS flood-gauge alert/history status: independent statewide gaps, active-alert overlap, per-pass retrieval and unchanged warning disclaimer");
