import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SUPPLEMENTAL_VOLUME_MAX_COLUMNS,SUPPLEMENTAL_VOLUME_MAX_GLYPHS}
  from "../src/supplemental-radar-volume-v1.js";
import {MINIMUM_VOLUME_DISPLAY_DBZ} from "../src/volume-display-threshold-v1.js";
import {MAX_DISPLAY_RADAR_SITES} from "../src/multi-radar-display-v9.js";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const app=read("../src/live3d-operational-v9.js");
const supplemental=read("../src/supplemental-radar-volume-v1.js");
const html=read("../live3d-operational-v9.html");
const guide=read("../../docs/NON_NEGOTIABLE_VISUAL_FIDELITY.md");

// Lock full native source-grid raster processing; geographic reprojection
// continues to produce the same-size source image, not a half-size preview.
const begin=app.indexOf("async function prepareRadarSurfaceProvider(frame)");
const end=app.indexOf("\nasync function renderSurface(",begin);
assert.ok(begin>0 && end>begin,"Original BoM image provider present");
const raster=app.slice(begin,end);
for(const invariant of [
 /canvas\.width=frame\.width/,
 /canvas\.height=frame\.height/,
 /context\.createImageData\(frame\.width,frame\.height\)/,
 /const rgba=image\.data, categories=frame\.categories/,
 /for\(let p=0,j=0;p<categories\.length;p\+\+,j\+=4\)/,
 /reprojectWebMercatorRgbaToGeographic\(frame,rgba\)/,
 /output\.data\.set\(projected\)/,
 /canvas\.toBlob\(blob=>blob/,
 /"image\/png"/,
 /SingleTileImageryProvider\.fromUrl\(pngUrl,\{rectangle\}\)/,
 /URL\.revokeObjectURL\(pngUrl\)/
])assert.match(raster,invariant,"Original BoM native-grid raster must remain intact");
assert.doesNotMatch(raster,/canvas\.(?:width|height)\s*=\s*(?:Math\.floor|Math\.ceil|Math\.round)\(/,
  "Never downsize the measured raster for performance");
assert.match(app,/useBrowserRecommendedResolution:\s*true/);
assert.doesNotMatch(app,/viewer\.resolutionScale\s*=\s*0\./);
assert.match(app,/const horizontalStride = INCREMENTAL_VOLUME_PREVIEW\s*\? stablePrimaryVolumeStride\(frame\)/,
  "Existing primary inferred glyph density must not be silently coarsened");
// Scientific model and genuine source intensities are kept separate.
assert.equal(MINIMUM_VOLUME_DISPLAY_DBZ,40);
assert.match(app,/const minimumDbzh =\s*volumeDisplayThresholdDbz\(\$\("minimumDbzh"\)\.value\)/);
assert.match(app,/representativeDbzForCategory\(/);
assert.match(app,/inferColumn\(/);
assert.match(app,/volumePercent=Number\(\$\("volumeOpacity"\)\.value\)/);
// Up to 3 additional radars must keep the current minimum 3-D quality budget.
assert.equal(MAX_DISPLAY_RADAR_SITES,4);
assert.ok(SUPPLEMENTAL_VOLUME_MAX_COLUMNS>=250);
assert.ok(SUPPLEMENTAL_VOLUME_MAX_GLYPHS>=1500);
assert.match(app,/onDisplay:\(site,frame,utc\)=>supplementalVolumeDisplay\?\.render\(site,frame,utc\)/);
assert.match(supplemental,/selectSupplementalVolumeSampleIndices\(categories,/);
assert.match(supplemental,/state\.delta\.upsert\(i,categories\[i\]/);
assert.match(supplemental,/const threshold=Math\.max\(40,Number\(settings\.minimumDbzh\)\|\|40\)/);
assert.match(app,/incrementalVolumeRenderer\.upsert\(pixelIndex,category,nextSpecs/);
assert.match(html,/id="volumeOpacity"/);
assert.match(guide,/Full-resolution authentic BoM radar imagery/);
assert.match(guide,/High-quality inferred 3-D representation/);
assert.match(guide,/Performance is an engineering constraint, not permission to sacrifice quality/);
console.log("PASS non-negotiable BoM original native raster, PNG/UTC, >=40 dBZ, stable full-quality inferred 3-D at all 4 radar sites.");
