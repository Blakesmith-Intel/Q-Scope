import {
  SUPPORTED_LOOP_MINUTES,
  normaliseLoopMinutes
} from "./operational-loop-v1.js";

export const ALL_AVAILABLE_LOOP_VALUE = "all";
export const RADAR_PLAYBACK_CADENCE_MINUTES = 5;
export const MAX_TEMPORAL_INTERPOLATION_GAP_MINUTES = 30;

export function normaliseRadarHistoryTimes(times = []) {
  const byEpoch = new Map();

  for (const value of times ?? []) {
    const epoch = Date.parse(value);
    if (!Number.isFinite(epoch) || byEpoch.has(epoch)) continue;
    byEpoch.set(epoch, String(value));
  }

  return [...byEpoch.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([, value]) => value);
}

export function radarHistorySpanMinutes(times) {
  const history = normaliseRadarHistoryTimes(times);
  if (history.length < 2) return 0;

  return (
    Date.parse(history.at(-1))
    - Date.parse(history[0])
  ) / 60000;
}

export function radarHistoryCadenceMinutes(times) {
  const history = normaliseRadarHistoryTimes(times);
  if (history.length < 2) return RADAR_PLAYBACK_CADENCE_MINUTES;

  const gaps = [];

  for (let index = 1; index < history.length; index++) {
    const gap = (
      Date.parse(history[index])
      - Date.parse(history[index - 1])
    ) / 60000;

    if (Number.isFinite(gap) && gap > 0) gaps.push(gap);
  }

  if (!gaps.length) return RADAR_PLAYBACK_CADENCE_MINUTES;

  // Missing scans lengthen a gap; they must not make the underlying radar
  // source look slower than it is.
  return Math.min(...gaps);
}

export function continuousRadarHistoryTimes(
  times = [],
  {
    maxInterpolationGapMinutes =
      MAX_TEMPORAL_INTERPOLATION_GAP_MINUTES
  } = {}
) {
  const history = normaliseRadarHistoryTimes(times);
  if (history.length < 2) return history;

  let startIndex = history.length - 1;

  for (let index = history.length - 1; index > 0; index--) {
    const gap = (
      Date.parse(history[index])
      - Date.parse(history[index - 1])
    ) / 60000;

    if (
      !Number.isFinite(gap)
      || gap <= 0
      || gap > maxInterpolationGapMinutes
    ) {
      break;
    }

    startIndex = index - 1;
  }

  return history.slice(startIndex);
}

function isoMinute(epoch) {
  return new Date(epoch)
    .toISOString()
    .replace(".000Z", "Z");
}

export function buildRadarPlaybackPlan(
  times = [],
  {
    cadenceMinutes = RADAR_PLAYBACK_CADENCE_MINUTES,
    maxInterpolationGapMinutes =
      MAX_TEMPORAL_INTERPOLATION_GAP_MINUTES
  } = {}
) {
  const observed = continuousRadarHistoryTimes(
    times,
    { maxInterpolationGapMinutes }
  );

  if (!observed.length) return [];

  const entries = [];
  const cadenceMs = cadenceMinutes * 60000;

  for (let index = 0; index < observed.length; index++) {
    const current = observed[index];

    entries.push({
      observedUtc: current,
      kind: "observed",
      beforeUtc: null,
      afterUtc: null,
      weight: 0
    });

    const next = observed[index + 1];
    if (!next) continue;

    const currentEpoch = Date.parse(current);
    const nextEpoch = Date.parse(next);
    const gapMinutes = (nextEpoch - currentEpoch) / 60000;

    if (
      !Number.isFinite(gapMinutes)
      || gapMinutes <= cadenceMinutes
      || gapMinutes > maxInterpolationGapMinutes
    ) {
      continue;
    }

    for (
      let targetEpoch = currentEpoch + cadenceMs;
      targetEpoch < nextEpoch;
      targetEpoch += cadenceMs
    ) {
      entries.push({
        observedUtc: isoMinute(targetEpoch),
        kind: "inferred",
        beforeUtc: current,
        afterUtc: next,
        weight:
          (targetEpoch - currentEpoch)
          / (nextEpoch - currentEpoch)
      });
    }
  }

  return entries.sort(
    (left, right) =>
      Date.parse(left.observedUtc)
      - Date.parse(right.observedUtc)
  );
}

export function availableRadarLoopMinutes(times) {
  const plan = buildRadarPlaybackPlan(times);
  if (plan.length < 2) return [];

  const spanMinutes =
    (
      Date.parse(plan.at(-1).observedUtc)
      - Date.parse(plan[0].observedUtc)
    ) / 60000;

  return SUPPORTED_LOOP_MINUTES.filter(
    minutes =>
      spanMinutes
      >= minutes
  );
}

export function selectRadarHistoryPlan(
  times,
  selection
) {
  const plan = buildRadarPlaybackPlan(times);
  if (!plan.length) return [];

  if (selection === ALL_AVAILABLE_LOOP_VALUE) {
    return plan;
  }

  const minutes = normaliseLoopMinutes(selection);
  const available = availableRadarLoopMinutes(times);

  if (!available.includes(minutes)) {
    throw new RangeError(
      `Radar history cannot currently supply a ${minutes}-minute playback window.`
    );
  }

  const latestEpoch =
    Date.parse(plan.at(-1).observedUtc);

  // Inclusive scan endpoints: 00:50 through 01:20 is 7 real scans, 30 min.
  const targetSpanMinutes = minutes;

  const cutoff =
    latestEpoch - targetSpanMinutes * 60000;

  return plan.filter(
    entry =>
      Date.parse(entry.observedUtc)
      >= cutoff
  );
}

// Compatibility helper for callers that need only genuine source timestamps.
export function selectRadarHistoryTimes(
  times,
  selection
) {
  return selectRadarHistoryPlan(times, selection)
    .filter(entry => entry.kind === "observed")
    .map(entry => entry.observedUtc);
}
