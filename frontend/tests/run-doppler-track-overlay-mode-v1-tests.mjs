import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {clearReflectivityOverlaysForDoppler} from "../src/reflectivity-overlay-mode-v1.js";

const entityIds=[
  "hybrid-trail-ST002",
  "hybrid-threat-cone-ST002",
  "hybrid-threat-boundary-ST002",
  "hybrid-threat-centreline-ST002",
  "hybrid-threat-marker-ST002-90"
];
const trackSource={show:true,entities:{
  values:entityIds.map(id=>({id,show:true})),
  removeAll(){this.values=[];}
}};
const labels={
  visible:true,markers:[{name:"ST002"}],
  setVisible(value){this.visible=value;},
  setMarkers(value){this.markers=value;}
};
const alerts={frames:0,setFrame(){this.frames++;}};
const inferredVolume={show:true};
let volumePrimitives=3,chosenTrack="ST002",coneChecked=true,renders=0;
const clear=()=>clearReflectivityOverlaysForDoppler({
  trackSource,trackLabels:labels,severeAlerts:alerts,
  clearTrackVolumes:()=>{volumePrimitives=0;},
  inferredVolume,resetSelection:()=>{chosenTrack="";coneChecked=false;},
  requestRender:()=>renders++
});
clear();
assert.equal(trackSource.show,false);
assert.deepEqual(trackSource.entities.values,[],
  "Switching to Doppler must REMOVE selected cone, boundary, centreline, markers and trails");
assert.equal(labels.visible,false);
assert.deepEqual(labels.markers,[],
  "Both DOM storm identifiers and labels are removed from their own layer");
assert.equal(volumePrimitives,0,"Cesium 3-D track primitives are independently removed");
assert.equal(inferredVolume.show,false,"frame-wide reflectivity inference is hidden");
assert.equal(chosenTrack,"","previous storm is deselected");
assert.equal(coneChecked,false,"selected 90-minute motion cone cannot survive");
assert.equal(alerts.frames,1);
assert.equal(renders,1);
// Repeated switch/refresh must be idempotent, including when already paused.
clear();
assert.equal(renders,2);
assert.deepEqual(trackSource.entities.values,[]);

const runtime=readFileSync(new URL("../src/live3d-operational-v9.js",import.meta.url),"utf8");
assert.match(runtime,/function clearReflectivityForDoppler\(\)[\s\S]*?clearReflectivityOverlaysForDoppler\(\{/);
assert.match(runtime,/if \(selectedLoopSelection\(\) !== DOPPLER_AVAILABLE_LOOP_VALUE\)\s*supplementalDopplerDisplay\.setEnabled\(false\);/, "Leaving wind mode must synchronously retire all extra-site Doppler layers");
assert.match(runtime,/if \(selectedLoopSelection\(\) === DOPPLER_AVAILABLE_LOOP_VALUE\)\s*clearReflectivityForDoppler\(\);\s*renderDopplerOverlay\(\)/,
  "Changing the selector must remove old radar overlays BEFORE the async Doppler load");
assert.match(runtime,/showSupplementalRadarSites\(null\);\s*supplementalDopplerDisplay\.setEnabled\(true\);\s*\/\/ All reflectivity-only objects[\s\S]*?clearReflectivityForDoppler\(\);/,
  "Actual Doppler loop must enforce complete cleanup even on direct programmatic load");
assert.match(runtime,/function renderHybridTracks\(index\) \{\s*\/\/ Source-mode check[\s\S]*?clearReflectivityForDoppler\(\);\s*return;/,
  "Queued old radar work must not redraw selected cone after entering Doppler");
assert.match(runtime,/supplementalDopplerDisplay\.setEnabled\(false\);\s*windPlaybackFrames=\[\];\s*hybridSource\.show=true;\s*\$\("showTrackLabels"\)\.disabled=false;/,
  "Returning to measured reflectivity restores label controls");
assert.match(runtime,/renderHybridTracks\(liveMeasuredIndex\);/,
  "Returning to reflectivity re-creates measured geometry at the source-time-resolved frame");
assert(runtime.includes("const liveMeasuredIndex=hybridCombinedSchedule.length"),
  "Combined Doppler must retain its preexisting positional playback schedule");
console.log("PASS Doppler mode removes selected ST cone/trails/labels and independent 3-D primitives; radar mode can re-render.");