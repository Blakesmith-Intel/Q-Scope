import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const runtime=read("../src/live3d-operational-v9.js");
const html=read("../live3d-operational-v9.html");
const index=read("../index.html");
const delta=read("../src/incremental-volume-renderer-v1.js");
const secondary=read("../src/supplemental-radar-volume-v1.js");
const opacity=read("../src/volume-display-opacity-v1.js");
const packageScript=read("../../scripts/build-current-site.sh");
// Enable exact operator-accepted implementation on the production document,
// while preserving it on preview and not on the older diagnostic preview.
assert.match(runtime,/const OPERATOR_RADAR_REVIEW\s*=\s*window\.location\.pathname\.includes\("\/preview\/radar-refresh-review\/"\)/);
assert.match(runtime,/const INCREMENTAL_VOLUME_PREVIEW\s*=\s*window\.location\.pathname\.includes\("\/preview\/incremental-3d\/"\)\s*\|\|\s*OPERATOR_RADAR_REVIEW/);
assert.match(runtime,/!window\.location\.pathname\.includes\("\/preview\/"\)/);
assert.match(runtime,/const PUBLISHED_PRODUCTION_RUNTIME\s*=/);
assert.match(runtime,/const incrementalVolumeRenderer=INCREMENTAL_VOLUME_PREVIEW/);
assert.match(runtime,/incrementalVolumeRenderer\.upsert\(pixelIndex,category,nextSpecs/);
assert.match(runtime,/const showTrackVolumes = !INCREMENTAL_VOLUME_PREVIEW && useTrackSpecificVolume/);
assert.match(runtime,/const retainedVolume=INCREMENTAL_VOLUME_PREVIEW \? \{/);
assert.match(runtime,/measuredRadarProviderCache = INCREMENTAL_VOLUME_PREVIEW/);
assert.match(runtime,/scene\.globe\.tileCacheSize/);
assert.match(runtime,/maxCached:INCREMENTAL_VOLUME_PREVIEW[\s\S]*?matches\?12:18/);
const memoryModal=read("../src/responsive-memory-diagnostics-v1.js");
assert.doesNotMatch(runtime,/createResponsiveMemoryDiagnostics\(/,
  "Operational controls must not inject memory diagnostics into sidebar");
assert.match(runtime,/window\.__stormtrackerMemoryDiagnostics=/,
  "Research diagnostic capture remains explicitly on demand");
assert.match(memoryModal,/Memory diagnostics/);
assert.match(memoryModal,/stormtrackerMemoryDialog/);
assert.match(delta,/function upsert\(key,category,specs,create,patch\)/);
assert.match(secondary,/function pruneSites\(selectedIds=\[\]\)/);
assert.match(opacity,/export function updateVolumeDisplayPoint/);
// New users must not receive an old iframe or script due to static URLs.
assert.match(index,/v9\.20\.0-optimised-3d-prod/);
assert.match(html,/v9\.20\.0-optimised-3d-prod/);
assert.match(runtime,/minimumMeasuredReanchorKm:0\.15/);
assert.match(html,/id="showTrackLabels" type="checkbox"/);
assert.doesNotMatch(html,/id="showTrackLabels"[^>]*\bchecked\b/);
assert.match(runtime,/shouldPrepareSupplementalForPlayback\(supplementalAnchor\)/);
// Publishing is still pinned by the separate release pipeline, not by main.
assert.match(packageScript,/checked\/production-v10\.2\.0\/frontend/,
  "V10 root must use exact accepted source, never unpinned main");
assert.match(packageScript,/SEALED StormTracker V10\.2\.0 source/);
assert.doesNotMatch(packageScript,/^production="frontend"$/m,
  "Never deploy mutable main as the production source");
console.log("PASS V9.20.0 source gate, accepted 3-D delta, memory caps, BoM guards and fresh production entrypoint.");
