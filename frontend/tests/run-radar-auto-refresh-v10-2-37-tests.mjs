import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { discoverBoundedBomReflectivityHistory } from "../src/bom-wmts-loop-v2.js";

const root = new URL("../../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");
const runtime = read("frontend/src/live3d-operational-v9.js");
const scheduler = read("frontend/src/live-loop-refresh-v1.js");
const packager = read("scripts/apply-radar-auto-refresh-v1.py");
const workflow = read(".github/workflows/pages.yml");

// Regression must inspect the *actual operational runtime*, not only an
// isolated unit-test scheduler that could be disconnected from production.
assert.match(runtime, /if \(document.hidden\) return undefined;/);
assert.match(runtime, /document\.addEventListener\("visibilitychange", checkRadarOnForegroundReturn\)/);
assert.match(runtime, /window\.addEventListener\("pageshow", checkRadarOnForegroundReturn\)/);
assert.match(runtime, /window\.addEventListener\("focus", checkRadarOnForegroundReturn\)/);
assert.match(runtime, /const wasFollowingLatest = automatic/);
assert.match(runtime, /\? hybridFrames\.length - 1/);
assert.match(runtime, /if \(automatic\) throw new Error/);
assert.match(runtime, /throw error;\s*}\s*else\s*\{\s*setStatus\(error\.message/);
assert.match(runtime, /manual site load failed; automatic retry queued/);
assert.match(runtime, /manualRadarRecoveryTimer=setTimeout/);
assert.match(scheduler, /LIVE_LOOP_SOURCE_RETRY_MS = 60000/);
assert.match(runtime, /runSourceLoad\(\(\) => loadHybridSequence\(true\), true\)\.then/);
assert.match(runtime, /if \(sequenceLoading \|\| !model\) return false;/);
assert.match(runtime, /if \(result === false\) recordRadarAutoRefreshAudit/);
assert.match(scheduler, /LIVE_LOOP_REFRESH_MS = 300000/);
assert.match(scheduler, /LIVE_LOOP_BUSY_RETRY_MS = 2000/);
assert.match(scheduler, /armPoll\(\);\s*void check\(\);/);
assert.match(runtime, /radarAutoRefreshAudit\.lastCheckUtc/);
assert.match(runtime, /radarAutoRefreshAudit\.newestAcceptedUtc/);
assert.match(runtime, /radarAutoRefreshAudit\.lastFailure/);
assert.match(runtime, /failure: frameFailures\.detail \|\| null/);
assert.match(runtime, /source unavailable; retaining genuine imagery/);

// Recent genuine timestamps, NOT the newest one alone. In particular,
 // recover 06:05 when 06:10 is the latest authentic published frame.
assert.match(runtime, /\? discoverBoundedBomReflectivityHistory\(now,180,region\)/);
assert.doesNotMatch(runtime, /discoverBoundedBomReflectivityHistory\(now,5,region\)/);
const iso = minute => "2026-10-30T20:" + String(minute).padStart(2, "0") + ":00Z";
const published = [0, 5, 10, 15, 20, 25].map(iso);
for (const site of ["66", "50", "08", "23"]) {
  const found = await discoverBoundedBomReflectivityHistory(
    Date.parse(iso(30)), 180, site, {
      publishedTimes: async () => published,
      verifyNationalTile: async () => true
    }
  );
  assert.deepEqual(found, published, "Recover actual recent radar observations at " + site);
  assert(found.includes(iso(5)) && found.includes(iso(10)),
    "Previously missed 06:05 and 06:10 scans are recoverable");
}
assert.match(runtime, /needsChronologicalRadarRebuild/);
assert.match(runtime, /loadBomReflectivityMosaicAtTime\(entry\.observedUtc, selectedRadarRegion\(\), discoveredTimes\)/);
assert.match(runtime, /observedUtc,\s*region,\s*candidates/);
assert.match(packager, /20261101-source-verified-recovery-v10-2-40/);
assert.match(runtime, /frame\?\.sourceMetadata\?\.region !== region/);
assert.match(packager, /copyfile\("frontend\/src\/radar-source\.js"/);
assert.match(packager, /copyfile\("frontend\/src\/radar-request-pressure-v1\.js"/);
assert.match(packager, /V10\.2\.39 RADAR CROSS-SITE LIVE RECOVERY/);
assert.match(runtime, /radarFrameCache\.has\(entry\.observedUtc\)/);
assert.match(runtime, /getRadarFrames\(region, cacheCutoff\)/);
assert.match(packager, /copyfile\("frontend\/src\/live-loop-refresh-v1\.js"/);
assert.match(workflow, /python scripts\/apply-radar-auto-refresh-v1\.py/);

const packagedEngine = new URL("_site/src/live3d-operational-v9.js", root);
if (existsSync(fileURLToPath(packagedEngine))) {
  const live = read("_site/src/live3d-operational-v9.js");
  const shippedScheduler = read("_site/src/live-loop-refresh-v1.js");
  const build = read("_site/BUILD.txt");
  assert.match(live, /recordRadarAutoRefreshAudit/);
  assert.match(live, /discoverBoundedBomReflectivityHistory\(now,180,region\)/);
  assert.doesNotMatch(live, /discoverBoundedBomReflectivityHistory\(now,5,region\)/);
  assert.match(shippedScheduler, /LIVE_LOOP_BUSY_RETRY_MS = 2000/);
  assert.match(build, /V10\.2\.38 VERIFIED RADAR HISTORY/);
  assert.match(build, /V10\.2\.39 RADAR CROSS-SITE LIVE RECOVERY/);
  assert.match(build, /V10\.2\.40 VERIFIED WMTS RESILIENCE/);
  assert.match(read("_site/src/radar-source.js"), /verifiedWmtsBlobs/);
  assert.match(read("_site/src/radar-request-pressure-v1.js"), /negativeTtlMs=45000/);
  assert.match(read("_site/index.html"), /v10\.2\.40-radar-wmts-resilience-/);
  assert.match(read("_site/live3d-operational-v9.html"), /v10\.2\.40-radar-wmts-resilience-/);
}
console.log("PASS radar auto refresh production contract, real published catch-up across sites, busy deferred retry, cadence, diagnostics and build overlay");
