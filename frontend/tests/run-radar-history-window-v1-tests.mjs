import assert from "node:assert/strict";

import {
  ALL_AVAILABLE_LOOP_VALUE,
  MAX_TEMPORAL_INTERPOLATION_GAP_MINUTES,
  availableRadarLoopMinutes,
  buildRadarPlaybackPlan,
  continuousRadarHistoryTimes,
  normaliseRadarHistoryTimes,
  radarHistoryCadenceMinutes,
  radarHistorySpanMinutes,
  selectRadarHistoryPlan,
  selectRadarHistoryTimes
} from "../src/radar-history-window-v1.js";

const stamp = minute =>
  new Date(Date.UTC(2026, 9, 7, 5, minute))
    .toISOString()
    .replace(".000Z", "Z");

const fiveMinuteHistory =
  Array.from({ length: 9 }, (_, index) => stamp(10 + index * 5));

assert.equal(radarHistorySpanMinutes(fiveMinuteHistory), 40);
assert.equal(radarHistoryCadenceMinutes(fiveMinuteHistory), 5);
assert.deepEqual(availableRadarLoopMinutes(fiveMinuteHistory), [30]);
assert.equal(selectRadarHistoryTimes(fiveMinuteHistory, 30).length, 7);
assert.equal(selectRadarHistoryPlan(fiveMinuteHistory, 30).length, 7);

const tenMinuteCadence =
  Array.from({ length: 10 }, (_, index) => stamp(index * 10));

assert.equal(radarHistoryCadenceMinutes(tenMinuteCadence), 10);
const tenMinutePlan = buildRadarPlaybackPlan(tenMinuteCadence);
assert.equal(tenMinutePlan.filter(entry => entry.kind === "inferred").length, 9);
assert.equal(tenMinutePlan.length, 19);
assert.deepEqual(
  availableRadarLoopMinutes(tenMinuteCadence),
  [30, 60, 90]
);

const threeHourSparse =
  Array.from({ length: 19 }, (_, index) => stamp(index * 10));
const threeHourPlan =
  buildRadarPlaybackPlan(threeHourSparse);
assert.equal(threeHourPlan.length, 37);
assert.equal(threeHourPlan[0].observedUtc, stamp(0));
assert.equal(threeHourPlan.at(-1).observedUtc, stamp(180));
assert.ok(availableRadarLoopMinutes(threeHourSparse).includes(180));
assert.equal(
  selectRadarHistoryPlan(threeHourSparse, 180).length,
  37
);

const oneMissingScan = [
  stamp(0),
  stamp(5),
  stamp(15),
  stamp(20),
  stamp(25),
  stamp(30)
];
const oneMissingPlan = buildRadarPlaybackPlan(oneMissingScan);
assert.ok(
  oneMissingPlan.some(
    entry =>
      entry.kind === "inferred"
      && entry.observedUtc === stamp(10)
      && entry.beforeUtc === stamp(5)
      && entry.afterUtc === stamp(15)
  )
);

const gappy = [
  stamp(0), stamp(5), stamp(10),
  stamp(55), stamp(60), stamp(65), stamp(70), stamp(75), stamp(80)
];

assert.deepEqual(
  continuousRadarHistoryTimes(gappy),
  [stamp(55), stamp(60), stamp(65), stamp(70), stamp(75), stamp(80)]
);
assert.deepEqual(availableRadarLoopMinutes(gappy), []);

const maximumBridge = [
  stamp(0), stamp(MAX_TEMPORAL_INTERPOLATION_GAP_MINUTES),
  stamp(35), stamp(40), stamp(45)
];
assert.ok(
  buildRadarPlaybackPlan(maximumBridge)
    .some(entry => entry.kind === "inferred")
);

const tooLargeGap = [stamp(0), stamp(35), stamp(40), stamp(45)];
assert.deepEqual(
  continuousRadarHistoryTimes(tooLargeGap),
  [stamp(35), stamp(40), stamp(45)]
);
assert.deepEqual(availableRadarLoopMinutes(tooLargeGap), []);

assert.deepEqual(
  normaliseRadarHistoryTimes([
    stamp(10), "invalid", stamp(5), stamp(10)
  ]),
  [stamp(5), stamp(10)]
);

assert.deepEqual(
  selectRadarHistoryPlan(fiveMinuteHistory, ALL_AVAILABLE_LOOP_VALUE)
    .map(entry => entry.observedUtc),
  fiveMinuteHistory
);

console.log(
  "Radar-history checks passed: 3-hour-capable windows, bounded gap interpolation plans, cadence handling and large-gap rejection."
);
