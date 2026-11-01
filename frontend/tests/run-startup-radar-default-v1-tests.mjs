import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { QLD_RADAR_SITES, dopplerRadarsForRegion } from "../src/qld-radar-sites-v1.js";
import { reflectivityWindowForRegion } from "../src/bom-wmts-loop-v2.js";

const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const html = read("../live3d-operational-v9.html");
const runtime = read("../src/live3d-operational-v9.js");

// Match the actual initial DOM selection before runtime JS loads.
assert.match(html,
  /<select id="radarSite"[^>]*><option value="66" selected>Brisbane \(Mt Stapylton\)<\/option>/);
assert.doesNotMatch(html, /<option value="SEQ">/,
  "Retired SEQ multi-radar selector is no longer offered");
assert.doesNotMatch(html, /<option value="SEQ" selected>/);

// Runtime must use the same physical radar for the source, camera and metadata,
// and append the remaining radar sites without duplicating ID 66.
assert.match(runtime, /const DEFAULT_RADAR_SITE_ID = "66"/);
assert.match(runtime, /QLD_RADAR_SITES\[DEFAULT_RADAR_SITE_ID\]\.longitude/);
assert.match(runtime, /QLD_RADAR_SITES\[DEFAULT_RADAR_SITE_ID\]\.latitude/);
assert.match(runtime, /if \(site\.id !== DEFAULT_RADAR_SITE_ID\) \$\("radarSite"\)\.append\(option\)/);
assert.match(runtime, /\$\("radarSite"\)\.value = recoveredRadarView\?\.radarSiteId \?\? DEFAULT_RADAR_SITE_ID/);
assert.match(runtime, /previousPrimaryRadarId=selectedRadarRegion\(\)/);
assert.match(runtime, /if\(!operatorCameraChosen\)resetView\(\)/);
assert.match(runtime, /function selectedRadarRegion\(\) \{ return \$\("radarSite"\)\.value; \}/);
assert.match(runtime, /function resetView\(\) \{\s*const site = BORDER_RADAR_SITES\[selectedRadarRegion\(\)\]/);
assert.match(runtime, /if\(!operatorCameraChosen\)resetView\(\);\s*updateLoopButtonLabel\(\)/);

// ID 66 must have real geography and a single genuine Doppler source rather
// than the three-site regional mosaic previously selected at startup.
const stapylton = QLD_RADAR_SITES["66"];
assert.equal(stapylton.name, "Brisbane (Mt Stapylton)");
assert.ok(Math.abs(stapylton.longitude - 153.24) < 0.01);
assert.ok(Math.abs(stapylton.latitude + 27.718) < 0.01);
assert.deepEqual(dopplerRadarsForRegion("66"), ["66"]);
assert.notDeepEqual(reflectivityWindowForRegion("66"), reflectivityWindowForRegion("SEQ"));
assert.equal(QLD_RADAR_SITES["66"].analysisGeorefVerified, true);
assert.match(html,/type="hidden" id="dopplerOverlayRadar"/,
  "Primary radar selection must own Doppler behind the scenes");
assert.match(runtime,/\$\("dopplerOverlayRadar"\)\.value=ids\[0\]\?\?""/,
  "Internal Doppler source always follows the selected physical radar");
console.log("Startup radar contract passed: new tabs default to Mt Stapylton, same-tab operator view is retained.");