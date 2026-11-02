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

# The release is assembled from the V10.2.0 pinned runtime, not from the
# edited frontend JavaScript wholesale. Explicitly carry the review-path
# parity fix into the DELIVERED application; otherwise even a perfect source
# fix never reaches the Pages preview and previous CI tests exercised root.
old_radar_runtime = '''const INCREMENTAL_VOLUME_PREVIEW =
  window.location.pathname.includes("/preview/incremental-3d/") ||
  (/\\/live3d-operational-v9\\.html$/.test(window.location.pathname) &&
    !window.location.pathname.includes("/preview/"));'''
start = source.index("// The isolated operator-acceptance preview MUST")
end = source.index("const MODEL_URL =", start)
replace_once(old_radar_runtime, source[start:end].rstrip())

replace_once(
    "bom-wmts-loop-v2.js?v=9.18.6-bounded-published-history",
    "bom-wmts-loop-v2.js?v=20261101-source-verified-incremental-v10-2-43"
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
    "  // This exact measured-frame window can be shifted in place when its retained\n  // observations are unchanged. Historical backfill, temporal-inference edits\n  // and selection changes retain the original chronological rebuild path.\n  const incrementalCommit = automatic && !isCombined && !needsHistoricalRebuild &&\n    loadedLoopSelection === loopSelection &&\n    planIncrementalRadarWindow(hybridFrames,displayFrames);\n  const oldTime = hybridFrames[hybridFrameIndex]?.observedUtc;\n  // Operators parked on Latest must follow genuine newly accepted scans.\n  // Preserve a deliberately scrubbed historical position instead.\n  const wasFollowingLatest = automatic && !isCombined &&\n    !playback.isPlaying() && hybridFrames.length > 0 &&\n    hybridFrameIndex === hybridFrames.length - 1;\n  const resume = automatic ? playback.isPlaying() : true;"
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
    else {
      setStatus(error.message, "error");
      recordRadarAutoRefreshAudit({
        failure:String(error?.message??error),
        outcome:"manual site load failed; automatic retry queued"
      });
      // A failure when switching sites must recover in the existing tab.
      // Allow BoM tile publication and 45-second negative caches to settle,
      // then request a scheduler-managed background recovery.
      if(manualRadarRecoveryTimer!==null)clearTimeout(manualRadarRecoveryTimer);
      manualRadarRecoveryTimer=setTimeout(()=>{
        manualRadarRecoveryTimer=null;
        if(!document.hidden)void autoRefresh.check();
      },50000);
    }
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
# Keep background cache warming from writing into the wrong primary radar
# if the user switches sites while an old source tile request is in flight.
replace_once(
    '''      const frame =
        await loadBomReflectivityMosaicAtTime(
          observedUtc,
          region,
          candidates
        );

      radarFrameCache.set(
        observedUtc,
        frame
      );''',
    '''      const frame =
        await loadBomReflectivityMosaicAtTime(
          observedUtc,
          region,
          candidates
        );

      // An old region's request may finish AFTER the user switches sites.
      // Its pixels must never enter the new primary's timestamp-keyed cache.
      if(selectedRadarRegion() !== region || sequenceLoading ||
          frame?.sourceMetadata?.region !== region) return;
      radarFrameCache.set(
        observedUtc,
        frame
      );'''
)
replace_once(
    '''async function runSourceLoad(loader, background = false) {''',
    '''let manualRadarRecoveryTimer=null;
async function runSourceLoad(loader, background = false) {'''
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
    // A partial but usable loop is not a completed source check. Keep the
    // genuine images on screen, but arrange a bounded follow-up for the
    // missing published UTCs without disturbing the five-minute poll.
    if(radarAutoRefreshAudit.lastOutcome ===
        "updated; some genuine source frames unavailable"){
      if(background)throw new Error(
        "Incomplete BoM radar history; retrying missing genuine observations: "+
        (radarAutoRefreshAudit.lastFailure||"source tile unavailable"));
      if(manualRadarRecoveryTimer!==null)clearTimeout(manualRadarRecoveryTimer);
      manualRadarRecoveryTimer=setTimeout(()=>{
        manualRadarRecoveryTimer=null;
        if(!document.hidden)void autoRefresh.check();
      },60000);
      $("autoRefreshNote").textContent =
        "BoM radar frames incomplete; retrying missing genuine observations automatically.";
    }else if(manualRadarRecoveryTimer!==null){
      clearTimeout(manualRadarRecoveryTimer);
      manualRadarRecoveryTimer=null;
    }
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
    "  $(\"hybridPlayButton\").disabled = hybridFrames.length < 2;\n  // Never cause a second render over the active player's own in-flight render.\n  // A paused Latest operator still sees the just-accepted newest observation.\n  if(!incrementalCommit || !playback.isPlaying())\n    await showHybridFrame(hybridFrameIndex);\n  radarLifecycle.sampleMemory({\n    region,latestUtc:frames.at(-1).observedUtc,\n    frameCount:hybridFrames.length,incremental:!!incrementalCommit\n  });\n  recordRadarAutoRefreshAudit({\n    acceptedUtc: frames.at(-1).observedUtc,\n    failure: frameFailures.detail || null,\n    outcome: frameFailures.summary\n      ? \"updated; some genuine source frames unavailable\"\n      : incrementalCommit\n        ? \"incremental: \" + incrementalCommit.appended + \" added, \" +\n          incrementalCommit.dropped + \" retired\"\n        : automatic ? \"updated by chronological rebuild\" : \"manual load complete\"\n  });\n  if(resume && !incrementalCommit)playback.play();"
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


# A source-data polling cycle must never make the map camera behave like a
# new page. Restore only a validated per-tab user selection and camera pose.
replace_once("import {createSupplementalDopplerDisplay, supportedSecondaryWindSites,","import {createRadarViewportSession} from \"./radar-viewport-continuity-v1.js?v=20261101-operator-camera-persist\";\nimport {createSupplementalDopplerDisplay, supportedSecondaryWindSites,")
replace_once("const DEFAULT_RADAR_SITE_ID = \"66\"; // Brisbane (Mt Stapylton)\npreviousPrimaryRadarId=DEFAULT_RADAR_SITE_ID;\n","const DEFAULT_RADAR_SITE_ID = \"66\"; // Brisbane (Mt Stapylton)\npreviousPrimaryRadarId=DEFAULT_RADAR_SITE_ID;\n// The default applies only to a genuinely NEW tab. Automatic BoM updates and\n// same-tab Safari page restorations must not force an operator back to 66.\nconst radarViewSession=createRadarViewportSession({\n  storage:(()=>{try{return window.sessionStorage;}catch{return null;}})(),\n  sites:BORDER_RADAR_SITES\n});\nconst recoveredRadarView=radarViewSession.restore();\nlet operatorCameraChosen=Boolean(recoveredRadarView);\nlet pendingViewportSave=null;\nfunction saveOperatorRadarView(){\n  if(pendingViewportSave!==null){\n    clearTimeout(pendingViewportSave);\n    pendingViewportSave=null;\n  }\n  if(!mapCamera)return;\n  radarViewSession.save($(\"radarSite\")?.value,mapCamera.getState());\n}\nfunction scheduleOperatorRadarViewSave(){\n  if(pendingViewportSave!==null)clearTimeout(pendingViewportSave);\n  pendingViewportSave=setTimeout(saveOperatorRadarView,250);\n}\nwindow.addEventListener(\"pagehide\",saveOperatorRadarView);\n")
replace_once("    onInteraction: () => cameraPerformance.pulse(),","    onInteraction: () => {\n      operatorCameraChosen=true;\n      cameraPerformance.pulse();\n      scheduleOperatorRadarViewSave();\n    },")
replace_once("$(\"radarSite\").value = DEFAULT_RADAR_SITE_ID;\nconfigureRadarSite();","$(\"radarSite\").value = recoveredRadarView?.radarSiteId ?? DEFAULT_RADAR_SITE_ID;\npreviousPrimaryRadarId=selectedRadarRegion();\nconfigureRadarSite();\nif(recoveredRadarView?.camera)\n  mapCamera.setView(recoveredRadarView.camera);")
replace_once("  resetView();\n\n  updateLoopButtonLabel();","  // Model/terrain startup is asynchronous. Do not overwrite a camera pose\n  // already chosen by an operator while those dependencies were loading.\n  if(!operatorCameraChosen)resetView();\n\n  updateLoopButtonLabel();")
replace_once("  previousPrimaryRadarId=nextPrimary;\n  configureRadarSite(); resetView(); clearDopplerOverlay();","  previousPrimaryRadarId=nextPrimary;\n  operatorCameraChosen=true;\n  configureRadarSite(); resetView(); saveOperatorRadarView();\n  clearDopplerOverlay();")
replace_once("    if(selector.value===id){\n      resetView();\n      scene.requestRender();\n      return;\n    }","    if(selector.value===id){\n      operatorCameraChosen=true;\n      resetView(); saveOperatorRadarView();\n      scene.requestRender();\n      return;\n    }")
replace_once("$(\"resetButton\").addEventListener(\n  \"click\",\n  () => {\n    resetView();\n  }\n);","$(\"resetButton\").addEventListener(\n  \"click\",\n  () => {\n    operatorCameraChosen=true;\n    resetView(); saveOperatorRadarView();\n  }\n);")


# V10.2.43 review-only radar append overlay: strictly bounded patch of the
# sealed production engine. Preserve every existing science and map function.
def inject_once(old,new):
    global data
    assert data.count(old)==1, f"Radar incremental package anchor changed: {old[:96]!r}"
    assert new in source, f"Radar incremental tested source missing: {new[:96]!r}"
    data=data.replace(old,new,1)

inject_once(
    'import { createContinuousPlayback } from "./continuous-playback-v1.js?v=9.16.10";',
    'import { createContinuousPlayback } from "./continuous-playback-v1.js?v=20261101-incremental-cursor-v1";\n'
    'import {planIncrementalRadarWindow} from "./radar-incremental-window-v1.js?v=20261101-verified-append-v1";\n'
    'import {installRadarLifecycleDiagnostics} from "./radar-lifecycle-diagnostics-v1.js?v=20261101-iframe-webgl-evidence-v1";'
)
# The pinned builder appends a legacy chain cache-buster to this import,
# so match only the stable named-import lines, not the URL's trailing suffix.
inject_once(
    '  reflectivityWindowForRegion\n',
    '  reflectivityWindowForRegion,\n  radarTileFailureSnapshot\n'
)
start=source.index("const radarIncrementalAudit = {")
end=source.index("const radarAutoRefreshAudit = {",start)
inject_once("const radarAutoRefreshAudit = {",source[start:end]+"const radarAutoRefreshAudit = {")
start=source.index("const scene = viewer.scene;")
end=source.index("// V9.20.0: limit surplus Cesium",start)
inject_once("const scene = viewer.scene;\n",source[start:end])
start=source.index("function buildTrackVolumeMap(")
end=source.index("async function loadHybridSequence(automatic = false)",start)
inject_once("async function loadHybridSequence(automatic = false)",
    source[start:end]+"async function loadHybridSequence(automatic = false)")
start=source.index("  // On an ordinary new scan the live player")
end=source.index("  hybridFrames = displayFrames;",start)
inject_once(
    '  $("hybridFrameSlider").disabled = true;\n  $("hybridPlayButton").disabled = true;\n  await playback.pause();\n  hybridFrames = displayFrames;',
    source[start:end]+"  hybridFrames = displayFrames;")
start=source.index("  if(incrementalCommit){\n    radarIncrementalAudit.appendUpdates++")
end=source.index("  hybridDopplerFrameStates = [];",start)
inject_once(
    "  hybridHistory = new Map();\n  hybridTrackVolumes = [];\n  hybridDopplerFrameStates = [];",
    source[start:end]+"  hybridDopplerFrameStates = [];")
start=source.index("  const previousByTrack = new Map();",source.index("async function loadHybridSequence("))
end=source.index("  hybridDopplerFrameStates = []; // Independent Doppler never borrows a radar frame timestamp.",start)
new_volume=source[start:end]
start=data.index("  const previousByTrack =\n    new Map();")
end=data.index("  hybridDopplerFrameStates = []; // Independent Doppler never borrows a radar frame timestamp.",start)
assert data.count("  const previousByTrack =\n    new Map();")==1
data=data[:start]+new_volume+data[end:]

app.write_text(data, encoding="utf-8")
copyfile("frontend/src/live-loop-refresh-v1.js", site / "src/live-loop-refresh-v1.js")
# The sealed production bundle historically used an older radar-source and
# pressure guard from the pinned build. Copy the tested bounded PNG blob cache
# and 45-second tile rejection policy into actual production, not QA only.
copyfile("frontend/src/radar-source.js", site / "src/radar-source.js")
copyfile("frontend/src/radar-request-pressure-v1.js", site / "src/radar-request-pressure-v1.js")
copyfile("frontend/src/radar-viewport-continuity-v1.js", site / "src/radar-viewport-continuity-v1.js")
copyfile("frontend/src/bom-wmts-loop-v2.js", site / "src/bom-wmts-loop-v2.js")
copyfile("frontend/src/continuous-playback-v1.js", site / "src/continuous-playback-v1.js")
copyfile("frontend/src/radar-incremental-window-v1.js", site / "src/radar-incremental-window-v1.js")
copyfile("frontend/src/radar-lifecycle-diagnostics-v1.js", site / "src/radar-lifecycle-diagnostics-v1.js")

# Both the outer iframe and the inner ES-module need a new immutable URL key:
# returning iOS Safari tabs otherwise continue using the old running loader.
for relative, marker in (
    ("index.html", "live3d-operational-v9.html?v="),
    ("live3d-operational-v9.html", "src/live3d-operational-v9.js?v=")
):
    page = site / relative
    html = page.read_text(encoding="utf-8")
    assert html.count(marker) == 1, f"Cannot refresh production browser cache: {marker}"
    html = html.replace(marker, marker + "v10.2.43-incremental-radar-v10.2.41-radar-camera-continuity-", 1)
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
    build.write(
        "V10.2.40 VERIFIED WMTS RESILIENCE: published scan recovery, bounded PNG "
        "tile cache, transient request isolation and cross-site cache safety 2026-11-01\n"
    )
    build.write(
        "V10.2.41 OPERATOR CAMERA CONTINUITY: preserve selected radar and camera "
        "during new frames, delayed app initialization and Safari tab reload 2026-11-01\n"
    )
assert "planIncrementalRadarWindow(hybridFrames,displayFrames)" in data
assert "if(resume && !incrementalCommit)playback.play();" in data
assert "radarTileFailureSnapshot" in data
assert (site / "src/radar-incremental-window-v1.js").exists()
assert (site / "src/radar-lifecycle-diagnostics-v1.js").exists()
with (site / "BUILD.txt").open("a", encoding="utf-8") as build:
    build.write("V10.2.43 CANDIDATE — INCREMENTAL RADAR APPEND / GYMPIE GLADSTONE DIAGNOSTICS (review only)\\n")
assert "discoverBoundedBomReflectivityHistory(now,5,region)" not in data
assert "discoverBoundedBomReflectivityHistory(now,180,region)" in data
assert "recordRadarAutoRefreshAudit" in data
assert "LIVE_LOOP_BUSY_RETRY_MS" in (site / "src/live-loop-refresh-v1.js").read_text()
assert "recoveredRadarView" in data
assert "radarViewportContinuityNoOp" not in data
assert (site / "src/radar-viewport-continuity-v1.js").exists()
assert "verifiedWmtsBlobs" in (site / "src/radar-source.js").read_text()
assert "negativeTtlMs=45000" in (site / "src/radar-request-pressure-v1.js").read_text()
assert "frame?.sourceMetadata?.region !== region" in data
assert "manual site load failed; automatic retry queued" in data
print("RADAR_OPERATOR_CAMERA_V10_2_41_PACKAGED")
