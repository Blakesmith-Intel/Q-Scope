#!/usr/bin/env python3
"""Deliver a narrow radar automatic-refresh reliability overlay to sealed V10.

Run only AFTER build-current-site.sh and apply-ftp-aep-release-v10.py.
Use the tested maintenance-source snippets; preserve everything else in the
pinned, accepted science engine. Refuse unknown upstream source shapes.
"""
from pathlib import Path
from shutil import copyfile

site = Path("_site")
assert (site / "BUILD.txt").read_text().startswith("SEALED StormTracker V10.2.0")
app = site / "src/live3d-operational-v9.js"
source = Path("frontend/src/live3d-operational-v9.js").read_text(encoding="utf-8")
data = app.read_text(encoding="utf-8")

def replace_once(old, new):
    global data
    assert data.count(old) == 1, f"Radar refresh source contract changed: {old[:120]!r}"
    assert new in source, f"Radar refresh source implementation missing: {new[:120]!r}"
    data = data.replace(old, new, 1)

replace_once(
    "bom-wmts-loop-v2.js?v=9.18.6-bounded-published-history",
    "bom-wmts-loop-v2.js?v=20261101-region-independent-v10-2-39"
)
replace_once(
    "live-loop-refresh-v1.js?v=9.9.0-4",
    "live-loop-refresh-v1.js?v=20261101-radar-live-follow-v10-2-39"
)
old_refresh = '''const autoRefresh = createLiveLoopRefresh({
  refresh: () => document.hidden ? undefined : runSourceLoad(() => loadHybridSequence(true), true),
  onError: error => { $("autoRefreshNote").textContent = `Auto update retry: ${error.message}`; }
});'''
start = source.index("const radarAutoRefreshAudit = {")
end = source.index("// Opportunistically prepare the next two genuine source images", start)
new_refresh = source[start:end].rstrip()
replace_once(old_refresh, new_refresh)
replace_once(
    '''          ? discoverBoundedBomReflectivityHistory(now,5,region)
              .then(times=>times.slice(-1))''',
    '''          ? discoverBoundedBomReflectivityHistory(now,180,region)'''
)
replace_once(
    '''  if(resolvedSource.keepCurrent) {
    $("autoRefreshNote").textContent =''',
    '''  if(resolvedSource.keepCurrent) {
    if (automatic) recordRadarAutoRefreshAudit({
      failure: String(sourceResult.error?.message ?? "BoM imagery unavailable"),
      outcome: "source unavailable; retaining genuine imagery"
    });
    $("autoRefreshNote").textContent ='''
)
# Source discovery failures must be handed back to the refresh scheduler.
replace_once(
    '''    $("autoRefreshNote").textContent =
      "BoM new imagery currently unavailable · retaining last genuine displayed radar scan";
    return;''',
    '''    $("autoRefreshNote").textContent =
      "BoM new imagery currently unavailable · retaining last genuine displayed radar scan";
    // Keep rendered real imagery, but tell the scheduler this check failed:
    // it must retry without a manual reload, not report a successful poll.
    if (automatic) throw new Error(
      "BoM radar discovery unavailable: " +
      String(sourceResult.error?.message ?? sourceResult.error)
    );
    return;'''
)
replace_once(
    '''  const oldTime = hybridFrames[hybridFrameIndex]?.observedUtc;
  const resume = automatic ? playback.isPlaying() : true;''',
    '''  const oldTime = hybridFrames[hybridFrameIndex]?.observedUtc;
  // Operators parked on Latest must follow genuine newly accepted scans.
  // Preserve a deliberately scrubbed historical position instead.
  const wasFollowingLatest = automatic && !isCombined &&
    hybridFrames.length > 0 && hybridFrameIndex === hybridFrames.length - 1;
  const resume = automatic ? playback.isPlaying() : true;'''
)
replace_once(
    '''  hybridFrameIndex = automatic
    ? Math.max(0,hybridFrames.findIndex(frame=>frame.observedUtc===oldTime))
    : 0;''',
    '''  hybridFrameIndex = automatic
    ? (wasFollowingLatest
      ? hybridFrames.length - 1
      : Math.max(0,hybridFrames.findIndex(frame=>frame.observedUtc===oldTime)))
    : 0;'''
)
replace_once(
    '''      $("autoRefreshNote").title = error.message;
    }
    else setStatus(error.message, "error");
  } finally {''',
    '''      $("autoRefreshNote").title = error.message;
      // An automatic source failure is not a successful refresh. Scheduler
      // applies bounded retry without resetting the normal 5-minute cadence.
      throw error;
    }
    else setStatus(error.message, "error");
  } finally {'''
)
replace_once(
    '''document.addEventListener("visibilitychange", () => { if (!document.hidden) { autoRefresh.check(); independentDopplerRefresh.check(); } });''',
    '''function checkRadarOnForegroundReturn() {
  if (document.hidden) return;
  void autoRefresh.check();
  void independentDopplerRefresh.check();
}
// iOS Safari can restore a frozen tab with pageshow/focus but no reliable
// visibilitychange. The scheduler coalesces duplicate events.
document.addEventListener("visibilitychange", checkRadarOnForegroundReturn);
window.addEventListener("pageshow", checkRadarOnForegroundReturn);
window.addEventListener("focus", checkRadarOnForegroundReturn);'''
)

replace_once(
    "loadBomReflectivityMosaicAtTime(entry.observedUtc, selectedRadarRegion())",
    "loadBomReflectivityMosaicAtTime(entry.observedUtc, selectedRadarRegion(), discoveredTimes)"
)
replace_once(
    """await loadBomReflectivityMosaicAtTime(
          observedUtc,
          region
        );""",
    """await loadBomReflectivityMosaicAtTime(
          observedUtc,
          region,
          candidates
        );"""
)
replace_once(
    '''  if (sequenceLoading || !model) return;
  if (!background) motionTransition.cancel();''',
    '''  if (sequenceLoading || !model) return false;
  if (!background) motionTransition.cancel();'''
)
replace_once(
    '''  try {
    await loader();
  } catch (error) {
    if (background) {''',
    '''  try {
    await loader();
    return true;
  } catch (error) {
    if (background) {
      recordRadarAutoRefreshAudit({
        failure: String(error?.message ?? error), outcome: "failed"
      });'''
)
replace_once(
    '''  $("hybridPlayButton").disabled = hybridFrames.length < 2;
  await showHybridFrame(hybridFrameIndex);
  if (resume) playback.play();''',
    '''  $("hybridPlayButton").disabled = hybridFrames.length < 2;
  await showHybridFrame(hybridFrameIndex);
  recordRadarAutoRefreshAudit({
    acceptedUtc: frames.at(-1).observedUtc,
    failure: frameFailures.detail || null,
    outcome: frameFailures.summary
      ? "updated; some genuine source frames unavailable"
      : automatic ? "updated" : "manual load complete"
  });
  if (resume) playback.play();'''
)

replace_once(
    '''    $("autoRefreshNote").textContent =
      dopplerGatedRefresh
        ? "Auto update: waiting for new matching radar + Doppler images."
        : "Auto update: waiting for a new radar image.";

    return;''',
    '''    $("autoRefreshNote").textContent =
      dopplerGatedRefresh
        ? "Auto update: waiting for new matching radar + Doppler images."
        : "Auto update: waiting for a new radar image.";
    recordRadarAutoRefreshAudit({ failure: null, outcome: "waiting for new published scan" });
    return;'''
)

app.write_text(data, encoding="utf-8")
copyfile("frontend/src/live-loop-refresh-v1.js", site / "src/live-loop-refresh-v1.js")

# Both the outer iframe and the inner ES-module need a new immutable URL key:
# returning iOS Safari tabs otherwise continue using the old running loader.
for relative, marker in (
    ("index.html", "live3d-operational-v9.html?v="),
    ("live3d-operational-v9.html", "src/live3d-operational-v9.js?v=")
):
    page = site / relative
    html = page.read_text(encoding="utf-8")
    assert html.count(marker) == 1, f"Cannot refresh production browser cache: {marker}"
    html = html.replace(marker, marker + "v10.2.39-radar-live-follow-", 1)
    page.write_text(html, encoding="utf-8")

# Preserve the existing V10.2.38 marker, and append a new independent
# frozen release identity after the V10.2.39 operational correction.
with (site / "BUILD.txt").open("a", encoding="utf-8") as build:
    build.write(
        "V10.2.38 VERIFIED RADAR HISTORY: source-published older replay scans, "
        "one capability snapshot during loading and preserved 5-minute polling 2026-11-01\n"
    )
    build.write(
        "V10.2.39 RADAR CROSS-SITE LIVE RECOVERY: regional tile rejection isolation, "
        "latest-frame following, bounded error retry, Safari foreground reconciliation 2026-11-01\n"
    )
assert "discoverBoundedBomReflectivityHistory(now,5,region)" not in data
assert "discoverBoundedBomReflectivityHistory(now,180,region)" in data
assert "recordRadarAutoRefreshAudit" in data
assert "LIVE_LOOP_BUSY_RETRY_MS" in (site / "src/live-loop-refresh-v1.js").read_text()
print("RADAR_CROSS_SITE_LIVE_V10_2_39_PACKAGED")
