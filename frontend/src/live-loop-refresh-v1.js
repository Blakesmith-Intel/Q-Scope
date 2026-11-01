import { ACTIVE_DOPPLER_RADARS } from './shared-product-timeline-v1.js';

export const LIVE_LOOP_REFRESH_MS = 300000;

// Radar-only playback retains its older reflectivity frames. Doppler context is
// absent outside the genuine shared history, never borrowed from newer images.
export function radarHistoryTimeline(times, shared) {
  const byTime = new Map(shared.entries.map(entry => [entry.observedUtc, entry]));
  const entries = [...new Set(times)].filter(time => Number.isFinite(Date.parse(time)))
    .sort((a, b) => Date.parse(a) - Date.parse(b))
    .map(observedUtc => byTime.get(observedUtc) ?? {
      observedUtc,
      pairings: (shared.requestedRadarIds ?? ACTIVE_DOPPLER_RADARS).map(radarId => ({ radarId, matched: false, candidate: null }))
    });
  return { ...shared, entries, startUtc: entries[0]?.observedUtc ?? null,
    endUtc: entries.at(-1)?.observedUtc ?? null,
    spanMinutes: entries.length > 1
      ? (Date.parse(entries.at(-1).observedUtc) - Date.parse(entries[0].observedUtc)) / 60000 : 0 };
}

export function needsChronologicalRadarRebuild(
  times,
  trackedThrough,
  processedTimes = []
) {
  const trackedEpoch =
    Date.parse(trackedThrough);

  if (!Number.isFinite(trackedEpoch)) {
    return false;
  }

  const processedEpochs =
    new Set(
      [...processedTimes]
        .map(time => Date.parse(time))
        .filter(Number.isFinite)
    );

  return [...new Set(times ?? [])]
    .some(time => {
      const epoch =
        Date.parse(time);

      return (
        Number.isFinite(epoch)
        && epoch <= trackedEpoch
        && !processedEpochs.has(epoch)
      );
    });
}

export function automaticRefreshUsesDopplerGate(
  withDoppler,
  requestedRadarIds = []
) {
  return Boolean(
    withDoppler
    && requestedRadarIds.length
  );
}

export function automaticRefreshEndUtc({
  withDoppler,
  radarTimes = [],
  sharedEndUtc = null
}) {
  if (withDoppler) {
    return sharedEndUtc;
  }

  return [...radarTimes]
    .filter(
      time =>
        Number.isFinite(
          Date.parse(time)
        )
    )
    .sort(
      (a, b) =>
        Date.parse(a)
        - Date.parse(b)
    )
    .at(-1)
    ?? null;
}

// Within-tolerance reuse of yesterday's tail is not a newly published pair.
// Every previously available radar must advance independently.
export function hasNewMatchedProducts(previous, next) {
  if (!next?.endUtc || !next.radarIds.length) return false;
  if (previous && Date.parse(next.endUtc) <= Date.parse(previous.endUtc)) return false;
  const tail = next.entries.at(-1);
  const oldTail = previous?.entries.at(-1);
  const required = previous?.radarIds.length ? previous.radarIds : next.radarIds;
  return required.every(id => {
    const pair = tail?.pairings.find(item => item.radarId === id);
    const old = oldTail?.pairings.find(item => item.radarId === id);
    return next.radarIds.includes(id) && pair?.matched &&
      Number.isFinite(Date.parse(pair.candidate?.observedUtc)) &&
      (!old?.matched || Date.parse(pair.candidate.observedUtc) > Date.parse(old.candidate.observedUtc));
  });
}

export const LIVE_LOOP_BUSY_RETRY_MS = 2000;
export const LIVE_LOOP_SOURCE_RETRY_MS = 60000;

// Maintain the established five-minute polling cadence independently of
// request duration. A concurrent manual/site load is not a successful poll:
// retry it promptly without overlapping requests or fabricating observations.
export function createLiveLoopRefresh({
  refresh, onError, schedule = setTimeout, cancel = clearTimeout,
  interval = LIVE_LOOP_REFRESH_MS, busyRetryMs = LIVE_LOOP_BUSY_RETRY_MS,
  sourceRetryMs = LIVE_LOOP_SOURCE_RETRY_MS
}) {
  let timer = null, busyTimer = null, sourceTimer = null,
    active = false, pending = null;
  let missedWhileLoading = false;
  function armPoll() {
    if (!active || timer != null) return;
    timer = schedule(() => {
      timer = null;
      // Schedule the NEXT regular check before asynchronous work starts.
      // Slow loads and manual/foreground checks never reset this cadence.
      armPoll();
      void check();
    }, interval);
  }
  function armBusyRetry() {
    if (!active || busyTimer != null) return;
    busyTimer = schedule(() => {
      busyTimer = null;
      void check();
    }, busyRetryMs);
  }
  function armSourceRetry() {
    // A real failure is retried after a controlled one-minute cooldown,
    // while the independent regular five-minute poll remains armed.
    if (!active || sourceTimer != null) return;
    sourceTimer = schedule(() => {
      sourceTimer = null;
      void check();
    }, sourceRetryMs);
  }
  function check() {
    if (!active) return Promise.resolve();
    if (pending) {
      // A focus or timer event can occur during an existing load. Retain
      // exactly one follow-up instead of silently losing that cycle.
      missedWhileLoading = true;
      return pending;
    }
    if (busyTimer != null) {
      cancel(busyTimer);
      busyTimer = null;
    }
    if (sourceTimer != null) {
      cancel(sourceTimer);
      sourceTimer = null;
    }
    pending = Promise.resolve().then(refresh).then(result => {
      // false means the engine was occupied. A genuine source failure
      // throws and schedules bounded recovery without hammering WMTS.
      if (result === false) armBusyRetry();
    }).catch(error => {
      try { onError?.(error); }
      finally { armSourceRetry(); }
    }).finally(() => {
      pending = null;
      if (missedWhileLoading) {
        missedWhileLoading = false;
        armBusyRetry();
      }
    });
    return pending;
  }
  return {
    start() { if (!active) { active = true; armPoll(); } },
    stop() {
      active = false;
      missedWhileLoading = false;
      if (timer != null) cancel(timer);
      if (busyTimer != null) cancel(busyTimer);
      if (sourceTimer != null) cancel(sourceTimer);
      timer = busyTimer = sourceTimer = null;
    },
    check
  };
}
