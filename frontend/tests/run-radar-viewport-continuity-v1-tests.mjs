import assert from "node:assert/strict";
import {
 createRadarViewportSession,validateRadarViewportRecord,
 RADAR_VIEW_SESSION_KEY
} from "../src/radar-viewport-continuity-v1.js";
const sites={"66":{name:"Mt Stapylton"},"56":{name:"Longreach"}};
const camera={
 longitude:144.28226,latitude:-23.43979,targetHeight:5000,
 range:175000,heading:6.02,pitch:-0.4886921905584123
};
let t=Date.parse("2026-11-01T02:45:00Z");
const storage=new Map();
const backing={
 getItem:k=>storage.get(k)??null,
 setItem:(k,v)=>storage.set(k,v)
};
const tab=createRadarViewportSession({storage:backing,sites,now:()=>t});
assert.equal(tab.restore(),null,"fresh operator tab defaults are not persisted");
assert.equal(tab.save("56",camera),true);
const read=tab.restore();
assert.equal(read.radarSiteId,"56");
assert.deepEqual(read.camera,camera,
 "A genuine Longreach camera target, heading, pitch and zoom survive reload");
assert.notEqual(read.radarSiteId,"66",
 "No automatic radar update may silently restore Mt Stapylton");
const sameTabNewViewer=createRadarViewportSession({storage:backing,sites,now:()=>t});
assert.deepEqual(sameTabNewViewer.restore().camera,camera,
 "A refreshed Safari iframe in the SAME TAB restores the operator camera");
assert.equal(createRadarViewportSession({storage:null,sites,now:()=>t}).restore(),null);
assert.equal(createRadarViewportSession({storage:null,sites,now:()=>t}).save("56",camera),false);
assert.equal(validateRadarViewportRecord({
 radarSiteId:"56",camera:{...camera,latitude:999},savedAt:t
},sites,t),null,"Invalid map coordinates must not be applied");
assert.equal(validateRadarViewportRecord({
 radarSiteId:"unknown",camera,savedAt:t
},sites,t),null,"Unknown station must not be restored");
assert.equal(tab.save("66",camera),true);
assert.equal(tab.restore().radarSiteId,"66",
 "Only a later intentional radar selection may replace the stored site");
assert.equal(tab.save("56",camera),true);
storage.set(RADAR_VIEW_SESSION_KEY,"corrupted JSON");
assert.equal(tab.restore(),null,"Broken session data is nonfatal");
assert.equal(tab.save("56",camera),true);
t+=72*60*60*1000;
assert.equal(tab.restore().radarSiteId,"56",
 "A radar incident spanning multiple days must not silently reset to Mt Stapylton within the same tab");
console.log("PASS operator radar viewport remains at Longreach across same-tab Safari reload and validates saved coordinates.");
