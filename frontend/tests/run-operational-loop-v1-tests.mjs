import assert from "node:assert/strict";

import {
  SUPPORTED_LOOP_MINUTES,
  frameCountForLoopMinutes,
  normaliseLoopMinutes,
  playbackDelayForSpeed
} from "../src/operational-loop-v1.js";

assert.deepEqual(
  SUPPORTED_LOOP_MINUTES,
  [30, 60, 90, 120, 150, 180]
);

assert.equal(normaliseLoopMinutes(30), 30);
assert.equal(normaliseLoopMinutes("180"), 180);
assert.equal(frameCountForLoopMinutes(30), 7);
assert.equal(frameCountForLoopMinutes(180), 37);
assert.equal(playbackDelayForSpeed(1), 450);
assert.equal(playbackDelayForSpeed(2), 225);
assert.equal(playbackDelayForSpeed(3), 150);
assert.throws(() => playbackDelayForSpeed(0.5), /Unsupported StormTracker playback speed/);

assert.throws(
  () => normaliseLoopMinutes(45),
  /Unsupported StormTracker loop window/
);

assert.throws(
  () => playbackDelayForSpeed(4),
  /Unsupported StormTracker playback speed/
);

console.log(
  "10 operational-loop contract tests passed."
);
