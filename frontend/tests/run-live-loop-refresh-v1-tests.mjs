import assert from 'node:assert/strict';
import { buildSharedProductTimeline } from '../src/shared-product-timeline-v1.js';
import {
  radarHistoryTimeline,
  needsChronologicalRadarRebuild,
  automaticRefreshUsesDopplerGate,
  automaticRefreshEndUtc,
  hasNewMatchedProducts,
  createLiveLoopRefresh
} from '../src/live-loop-refresh-v1.js';
const time = n => new Date(Date.UTC(2026,9,4,0,n)).toISOString();
const times = (end,count=36) => Array.from({length:count},(_,i)=>time(end-(count-1-i)*5));
const sources = (end, shifts={}) => new Map(['66','50','08'].map(id=>[id,{frames:times(end+(shifts[id]??0),7).map(observedUtc=>({observedUtc,filename:`${observedUtc}.png`}))}]));
const previous = buildSharedProductTimeline(times(180),sources(180));
const radar = radarHistoryTimeline(times(180),previous);
assert.equal(radar.entries.length,36);
assert.equal(radar.entries[0].observedUtc,time(5));
assert.ok(radar.entries[0].pairings.every(pair=>!pair.matched&&!pair.candidate));
assert.ok(radar.entries.at(-1).pairings.every(pair=>pair.matched));
assert.equal(hasNewMatchedProducts(previous,previous),false);
assert.equal(hasNewMatchedProducts(previous,buildSharedProductTimeline(times(185),sources(180))),false);
assert.equal(hasNewMatchedProducts(previous,buildSharedProductTimeline(times(180),sources(185))),false);
assert.equal(hasNewMatchedProducts(previous,buildSharedProductTimeline(times(185),sources(185,{'50':-5}))),false);
assert.equal(hasNewMatchedProducts(previous,buildSharedProductTimeline(times(185),sources(185))),true);
const outage=sources(185);outage.delete('08');
assert.equal(hasNewMatchedProducts(previous,buildSharedProductTimeline(times(185),outage)),false);
assert.equal(hasNewMatchedProducts(null,buildSharedProductTimeline(times(185),new Map())),false);
assert.equal(radarHistoryTimeline(times(180),buildSharedProductTimeline(times(180),new Map())).entries.length,36);

// Automatic refresh must rebuild chronologically when browser-cached history
// introduces a real observation at/before the point already tracked through.
const processedTail = times(180, 6);
const expandedHistory = [
  time(145),
  time(150),
  ...processedTail,
  time(185)
];
assert.equal(
  needsChronologicalRadarRebuild(
    expandedHistory,
    time(180),
    processedTail
  ),
  true
);
assert.equal(
  needsChronologicalRadarRebuild(
    [...processedTail, time(185)],
    time(180),
    processedTail
  ),
  false
);
assert.equal(
  needsChronologicalRadarRebuild(
    expandedHistory,
    null,
    processedTail
  ),
  false
);
assert.equal(
  needsChronologicalRadarRebuild(
    [time(185)],
    time(180),
    processedTail
  ),
  false
);

// A radar-capable site must never wait for Doppler unless the user has
// explicitly selected the Doppler overlay.
assert.equal(
  automaticRefreshUsesDopplerGate(
    false,
    ["66"]
  ),
  false
);

assert.equal(
  automaticRefreshUsesDopplerGate(
    true,
    ["66"]
  ),
  true
);

assert.equal(
  automaticRefreshUsesDopplerGate(
    true,
    []
  ),
  false
);

assert.equal(
  automaticRefreshEndUtc({
    withDoppler: false,
    radarTimes: [
      time(175),
      time(180),
      time(185)
    ],
    sharedEndUtc:
      time(180)
  }),
  time(185)
);

assert.equal(
  automaticRefreshEndUtc({
    withDoppler: true,
    radarTimes: [
      time(175),
      time(180),
      time(185)
    ],
    sharedEndUtc:
      time(180)
  }),
  time(180)
);

// A foreground/manual check never moves the five-minute cadence. Poll
// timers advance even if the preceding source request is still in flight.
let nextId = 0, inFlightRelease, calls = 0;
const scheduled = new Map(), errors = [];
const schedule = (callback, delay) => {
  const id = ++nextId;
  scheduled.set(id, { callback, delay });
  return id;
};
const cancel = id => scheduled.delete(id);
function trigger(delay) {
  const item = [...scheduled].find(([, task]) => task.delay === delay);
  assert(item, "Expected scheduled " + delay + "ms timer");
  scheduled.delete(item[0]);
  item[1].callback();
}
const scheduler = createLiveLoopRefresh({
  schedule, cancel,
  refresh: () => {
    calls++;
    return new Promise(resolve => { inFlightRelease = resolve; });
  },
  onError: error => errors.push(error)
});
scheduler.start();
scheduler.start();
assert.deepEqual([...scheduled.values()].map(task=>task.delay), [300000]);
const first = scheduler.check();
await Promise.resolve();
const second = scheduler.check();
await Promise.resolve();
assert.equal(calls, 1, "No overlapping source requests");
assert.equal(scheduled.size, 1, "Foreground check does not postpone poll");
trigger(300000);
await Promise.resolve();
assert.equal(calls, 1, "Scheduled poll coalesces with in-flight fetch");
assert.deepEqual([...scheduled.values()].map(task=>task.delay), [300000],
  "Next regular five-minute poll is armed before the previous one completes");
inFlightRelease();
await Promise.all([first,second]);
assert.deepEqual([...scheduled.values()].map(task=>task.delay).sort((a,b)=>a-b),
  [2000,300000], "A five-minute tick missed during loading receives a prompt retry");
trigger(2000);
await Promise.resolve(); await Promise.resolve();
assert.equal(calls, 2, "Catch-up poll starts after the in-flight load finishes");
scheduler.stop();
inFlightRelease();
await Promise.resolve();
assert.equal(scheduled.size, 0);
assert.deepEqual(errors, []);

// A manual load that occupies the radar engine must not silently discard a
// scheduled automatic check; false requests a local two-second busy retry.
let attempts = 0;
const busy = createLiveLoopRefresh({
  schedule, cancel,
  refresh: () => { attempts++; return attempts === 1 ? false : true; },
  onError: error => { throw error; }
});
busy.start();
await busy.check();
assert.equal(attempts, 1);
assert.deepEqual([...scheduled.values()].map(task=>task.delay).sort((a,b)=>a-b),
  [2000,300000]);
trigger(2000);
await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
assert.equal(attempts, 2, "Busy check was recovered without waiting five minutes");
assert.deepEqual([...scheduled.values()].map(task=>task.delay), [300000]);
busy.stop();
assert.equal(scheduled.size, 0);

let retries = 0;
const failing = createLiveLoopRefresh({
  schedule, cancel,
  refresh: () => {
    retries++;
    if(retries===1) throw Error("fixture temporary source failure");
    return true;
  },
  onError: error => errors.push(error.message)
});
failing.start();
await failing.check();
assert.equal(retries, 1);
assert.equal(errors.at(-1), "fixture temporary source failure");
assert.deepEqual([...scheduled.values()].map(task=>task.delay).sort((a,b)=>a-b),
  [60000,300000], "Real BoM failure gets a bounded 60s retry as well as original five-minute poll");
trigger(60000);
await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
assert.equal(retries, 2,"Next real source check retries automatically without a page reload");
assert.deepEqual([...scheduled.values()].map(task=>task.delay),[300000]);
failing.stop();
assert.equal(scheduled.size, 0);
console.log('Live loop checks passed: radar history, automatic cached-history rebuild detection, radar-only refresh independence from Doppler, fixed five-minute polling, foreground checks, busy retries, no overlaps and error recovery.');
