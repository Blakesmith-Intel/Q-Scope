import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {officialWarningBounds,officialWarningCameraTarget,
 officialWarningAtPoint,filterOfficialWarnings}
 from "../src/context-layers/bom-warning-operational-v1.js";
const a={productCode:"IDQ21033",geometry:{type:"Polygon",coordinates:[[
 [143.685337,-26.861857],[148.283967,-26.861857],
 [148.283967,-21.669245],[143.685337,-21.669245],[143.685337,-26.861857]
 ]]}};
const b={productCode:"IDQ21035",geometry:{type:"Polygon",coordinates:[[
 [152,-28],[153,-28],[153,-27],[152,-27],[152,-28]
 ]]}};
const bounds=officialWarningBounds(filterOfficialWarnings([a,b],"IDQ21033"));
const target=officialWarningCameraTarget(bounds,{width:430,height:750,fovy:Math.PI/3});
assert(target,"Source geometry must produce a camera controller state");
assert(Math.abs(target.longitude-(143.685337+148.283967)/2)<.000001);
assert(Math.abs(target.latitude-(-26.861857-21.669245)/2)<.000001);
assert(target.range>=20000&&target.range<=4900000);
assert.equal(target.heading,0);
assert(target.pitch< -1.5 && target.pitch> -1.58);
assert.equal(target.targetHeight,0);
const portrait=officialWarningCameraTarget(bounds,{width:430,height:750});
const landscape=officialWarningCameraTarget(bounds,{width:1000,height:430});
assert(portrait.range>landscape.range,"Narrow portrait viewport requires wider fit");
assert.equal(officialWarningCameraTarget(null),null);
assert.equal(officialWarningCameraTarget({west:5,east:4,south:3,north:2}),null);
const selected=filterOfficialWarnings([a,b],"IDQ21033");
assert.equal(officialWarningAtPoint(selected,146,-24),a);
assert.equal(officialWarningAtPoint(selected,152.5,-27.5),null);
assert.equal(officialWarningAtPoint(selected,NaN,-24),null);
assert.equal(officialWarningAtPoint([a,b],152.5,-27.5),b);
const root=new URL("../../",import.meta.url);
const js=readFileSync(new URL("frontend/src/context-layers/bom-warning-operational-v1.js",root),"utf8");
const build=readFileSync(new URL("scripts/build-current-site.sh",root),"utf8");
assert(!js.includes("viewer.camera.flyTo("),"Never bypass StormTracker guardian");
assert.match(js,/cameraController\.setView\(target\)/);
assert.match(build,/cameraController:mapCamera/);
assert.match(build,/20261102-idq-product-source-isolation-v1/,
 "Warning source must get a new verified browser cache identity");
assert.match(js,/window\.addEventListener\("pointerdown",down,\{capture:true,passive:true\}\)/);
assert.match(js,/window\.addEventListener\("pointerup",up,\{capture:true,passive:true\}\)/);
assert.match(js,/window\.removeEventListener\("pointerup",up,true\)/);
assert.match(js,/openGroups\(\);\s*\n\s*\}/);
assert.match(js,/pointerStart\.moved=true/);
assert.match(js,/stormTrackerRoadClosureId\|\|entity\?\.stormTrackerPowerOutageId/);
console.log("PASS warning Locate uses accepted stable camera state with real geographic bounds and mobile aspect; polygon tap opens same report with proper incident priority, drag rejection and capture cleanup");
