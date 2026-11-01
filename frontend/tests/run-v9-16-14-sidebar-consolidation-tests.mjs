import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const read=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");
const html=read("../live3d-operational-v9.html");
const runtime=read("../src/live3d-operational-v9.js");
const css=read("../src/operational-dashboard-v9-1.css");
const native=read("../src/native-doppler-image-v1.js");

// Only ONE user-facing physical-radar selection: internal Doppler ID follows it.
assert.match(html,/<select id="radarSite"[^>]*>/);
assert.match(html,/<input type="hidden" id="dopplerOverlayRadar" value="66">/);
assert.doesNotMatch(html,/<select id="dopplerOverlayRadar"/);
assert.doesNotMatch(html,/for="dopplerOverlayRadar"/);
assert.doesNotMatch(html,/<option value="SEQ">/);
assert.match(runtime,/function configureRadarSite\(\)[\s\S]*?\$\("dopplerOverlayRadar"\)\.value=ids\[0\]\?\?""/);
assert.match(runtime,/configureRadarSite\(\); resetView\(\); saveOperatorRadarView\(\);\s*clearDopplerOverlay\(\);/,
  "primary radar change must reset previous wind layers and frames");
assert.doesNotMatch(runtime,/\$\("dopplerOverlayRadar"\)\.addEventListener\("change"/);
assert.match(runtime,/function isDopplerSourceActive\(\) \{ return Boolean\(\$\("dopplerOverlayRadar"\)\?\.value\); \}/,
  "source-unavailable sites must not load Doppler");

// Remove redundant status and unsupported mode jargon while keeping
// live radar timestamps, track control and the genuine wind-velocity legend.
assert.doesNotMatch(html,/id="operationalDoppler"/);
assert.doesNotMatch(runtime,/\$\("operationalDoppler"\)/);
assert.doesNotMatch(html,/id="trackVolumeModeLabel"/);
assert.doesNotMatch(html,/Track-specific 3-D · always on/);
assert.match(html,/id="openDetailsButton"/);
assert.match(html,/id="showTrackLabels"/);
assert.match(html,/id="trackDisplayFilter"/);
assert.match(html,/id="showTrackThreatCone"/);
assert.match(html,/id="dopplerVelocityLegend"/);
assert.doesNotMatch(html,/id="radarClockGroup"|id="radarPlaybackTime"/);
assert.match(html,/id="windClockGroup" hidden/);
assert.doesNotMatch(runtime,/radarClockGroup|radarPlaybackTime/);
assert.match(runtime,/\$\("windClockGroup"\)\.hidden=!windOnly/);
assert.doesNotMatch(html,/id="dopplerOpacity"/);
assert.match(html,/id="volumeOpacity"/);
assert.match(html,/id="radarOpacity"/);

// Full native range: real south-edge swatches remain opaque; embedded caption
// is removed using palette matching rather than an entire-row crop.
assert.match(native,/NATIVE_DOPPLER_ANNOTATION_START_ROW = 480/);
assert.doesNotMatch(native,/NATIVE_DOPPLER_STRICT_PALETTE_START_ROW/,
  "No row-specific Doppler colour restriction anywhere in the 128 km panel");
assert.doesNotMatch(native,/NATIVE_DOPPLER_ANNOTATION_FADE_START_ROW/);
assert.doesNotMatch(native,/if\(maskAnnotationRows && isNativeDopplerDisplayAnnotationRow\(row\)\)continue/);
assert.doesNotMatch(native,/row >= NATIVE_DOPPLER_STRICT_PALETTE_START_ROW/);
assert.match(native,/data\[to \+ 3\] = alpha;/);
assert.match(runtime,/native-doppler-image-v1\.js\?v=9\.16\.14-hard-footer/);

// Permanent place-name stacking contract stays in the same tested release.
assert.match(css,/--stormtracker-geo-label-z:2000;/);
assert.match(css,/\.qld-place-foreground\s*\{[^}]*z-index:var\(--stormtracker-geo-label-z\)/);
console.log("PASS Doppler controls, native full-range pixel screening and foreground labels.");
