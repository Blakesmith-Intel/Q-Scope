import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  RAIN_ONLY_LOOP_MINUTES, buildOperationalWindowChoices
} from "../src/operational-window-choices-v1.js";
import { DOPPLER_AVAILABLE_LOOP_VALUE } from "../src/doppler-available-window-v1.js";

assert.deepEqual(RAIN_ONLY_LOOP_MINUTES,[30]);
const choices=buildOperationalWindowChoices({
  combinedAvailable:true,rainHasFrames:true,rainAvailableMinutes:[30,60,90,120,180]
});
assert.equal(choices.length,2,"one independent Doppler option plus one BoM 30-minute rain loop");
assert.deepEqual(choices.map(x=>x.value),[DOPPLER_AVAILABLE_LOOP_VALUE,"30"]);
assert.deepEqual(choices.map(x=>x.label),[
  "Doppler — All available",
  "30 min — Rain radar (BoM published scans)"
]);
assert.ok(choices.every(x=>!x.disabled));
const sparse=buildOperationalWindowChoices({
  combinedAvailable:false,rainHasFrames:true,rainAvailableMinutes:[30]
});
assert.deepEqual(sparse.map(x=>x.disabled),[true,false]);
assert.deepEqual(buildOperationalWindowChoices().map(x=>x.disabled),[true,true]);

const runtime=readFileSync(fileURLToPath(new URL("../src/live3d-operational-v9.js",import.meta.url)),"utf8");
const markup=readFileSync(fileURLToPath(new URL("../live3d-operational-v9.html",import.meta.url)),"utf8");
assert.match(runtime,/buildOperationalWindowChoices\(\{/);
assert.match(runtime,/selector.replaceChildren\(\.\.\.options\)/);
assert.match(runtime,/const selected = choices.some\(choice => choice.value === previous && !choice.disabled\)/);
assert.match(runtime,/enabled.some\(choice => choice.value === "30"\)/);
assert.match(runtime,/\$\("loadHybridButton"\).disabled = !selectedWindow/);
assert.match(runtime,/function shouldDisplayDopplerForSelectedWindow\(\)/);
assert.match(runtime,/return isDopplerSourceActive\(\) && isCombinedDopplerWindowSelected\(\)/);
assert.match(runtime,/function driveWindFromCommonPlayback\(radarIndex\) \{\s*if \(!shouldDisplayDopplerForSelectedWindow\(\)/);
assert.match(runtime,/function renderDopplerOverlay\(\)[\s\S]*?if\(!shouldDisplayDopplerForSelectedWindow\(\)\)/);
assert.match(runtime,/if\(token!==dopplerOverlayRenderToken\|\|!shouldDisplayDopplerForSelectedWindow\(\)/);
assert.match(runtime,/renderDopplerOverlay\(\);\s*updateIndependentDopplerUi\(\);\s*updateLoopButtonLabel\(\)/);
assert.match(runtime,/independentDopplerRefresh = createLiveLoopRefresh\(/);
assert.match(runtime,/hybridCombinedSchedule = isCombined \? combinedSchedule : \[\]/);
assert.doesNotMatch(markup,/id="showDopplerOverlay"|id="dopplerPlayButton"/);
assert.match(markup,/id="radarOpacity"|id="dopplerOpacity"|id="volumeOpacity"/);
console.log("PASS BoM-only six-scan rain mode, no archive UI, and unmodified independent Doppler loop.");
