import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {
  operationalWindStorage,assessOperationalWindPair,OPERATIONAL_WIND_BUILD
} from "../src/qscope-operational-wind-bridge-v1.js";
import {screenResearchWindArtefacts} from
  "../src/qscope-wind-artefact-guard-v10-6.js";
const read=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");
assert.equal(OPERATIONAL_WIND_BUILD,"v10-6-8-main-isolated-addon");
// The preview and the operational dashboard run on the same Pages origin:
// a preview fixture must not be mistaken for a newly detected live warning.
const stored=new Map();
const original={
  getItem:key=>stored.get(key)??null,
  setItem:(key,value)=>stored.set(key,value),
  removeItem:key=>stored.delete(key)
};
const operational=operationalWindStorage(original);
operational.setItem("qscope:v10.5:research-radar-events","main-only");
assert.equal(original.getItem("qscope:v10.5:research-radar-events"),null);
assert.equal(operational.getItem("qscope:v10.5:research-radar-events"),"main-only");
original.setItem("qscope:v10.6:pause-on-new-research-event","true");
assert.equal(operational.getItem("qscope:v10.6:pause-on-new-research-event"),null);
operational.setItem("qscope:v10.6:pause-on-new-research-event","false");
assert.equal(original.getItem("qscope:v10.6:pause-on-new-research-event"),"true");
const base={
  radarId:"08",geometryVerified:true,
  timeBasis:"bom-history-filename-utc"
};
const frame=(time,offset=0)=>({
 ...base,observedUtc:time,
 samples:[0,1,2,3].map(i=>({
   longitude:153.1+i*.001+offset,
   latitude:-27.45+i*.0005,velocity_kmh:-65
 }))
});
const prior=frame("2026-11-10T13:00:00Z");
const current=frame("2026-11-10T13:06:00Z",.001);
const assessed=assessOperationalWindPair({
  mode:"doppler",currentRecords:[current],previousRecords:[prior]
});
assert.equal(assessed.alerts.length,1,
  "Main integration must use the tested original BoM detector");
assert.equal(screenResearchWindArtefacts({
  alerts:assessed.alerts,currentRecords:[current],previousRecords:[prior]
}).alerts.length,0,"Main MUST apply the accepted artefact gate BEFORE publishing events");
assert.equal(assessOperationalWindPair({mode:"doppler",
 currentRecords:[current],previousRecords:[]}),null);
assert.equal(assessOperationalWindPair({mode:"rain"}),null);
const script=read("../../scripts/apply-qscope-operational-wind-v10-6-8.py");
const build=read("../../scripts/build-current-site.sh");
const bridge=read("../src/qscope-operational-wind-bridge-v1.js");
const inbox=read("../src/qscope-reviewable-event-inbox-v10-6.js");
const placement=read("../src/qscope-research-event-dock-layout-v10-6-1.js");
for(const str of [
 "qscopeOperationalWindEvents.queueWindow(\"rain\"",
 "qscopeOperationalWindEvents.queueWindow(\"doppler\"",
 "ROOT_ADDITION",
 "screenResearchWindArtefacts",
 "assessOperationalWindPair",
 "qscopeWindNavigateToActualFrame",
 "severeStormAlertOverlay.setEnabled(false);"
])assert(script.includes(str),"Missing strict additive root integration: "+str);
assert(!script.includes("shutil.copytree"),"Never bulk-replace operational site");
assert(!script.includes("src/live3d-operational-v9.js\",\n"),
  "No entire runtime replacement allowed");
assert(script.includes('if site.as_posix()!="_site"'));
assert(script.includes("if target.exists():raise ValueError"),
  "Prevent overwriting existing pinned operational science modules");
assert(build.includes("python3 scripts/apply-qscope-operational-wind-v10-6-8.py"));
assert(build.indexOf("python3 scripts/apply-qscope-operational-wind-v10-6-8.py")>
       build.indexOf('review_next="_site/preview/wind-hook-v10-6"'),
 "Promote only after all preceding pinned science/preview checks");
assert(bridge.includes("screenResearchWindArtefacts"));
assert(bridge.includes("captureResearchSourceThumbnail"));
assert(bridge.includes("FRESH")==false,
 "Review policy must be imported from approved one-shot pause module");
assert(inbox.includes("root.hidden=pending.length===0"),
 "No-events state must not obstruct map controls");
assert(placement.includes("stormTrackerNorthCompass") &&
 placement.includes("#mapScaleBar") &&placement.includes("#nav"),
 "Accepted alert placement must reserve north compass, scales and toolbar");
assert(!/autoPromoteToBoMWarning|dispatchOfficialWarning/.test(bridge));
assert(build.includes("SECONDARY_WIND_PROVIDER_CACHE_SIZE=8")&&
 build.includes("OFFICIAL_FLOOD_STORAGE_KEY"),
 "All other accepted source checks remain in the final package");
console.log("PASS isolated V10.6.8 operational promotion, preview-storage separation, artefact gate, strict source build and existing radar/compass/flood guards");
