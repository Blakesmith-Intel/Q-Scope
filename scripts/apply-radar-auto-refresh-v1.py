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
    "bom-wmts-loop-v2.js?v=20261103-complete-original-403-mosaic-v1"
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
# Do not throw away otherwise verified real frames solely because the
# latest advertised BoM scan was denied. Only allow forward/non-regressing
# source windows, and keep bounded automatic recovery for the failed UTC.
replace_once(
    '''  if (!frames.length || (automatic && !isCombined && frames.at(-1).observedUtc !== availableEndUtc)) {
    throw new Error(newestFailure || "Newest matching images could not be loaded; keeping the current loop and retrying automatically.");
  }''',
    '''  if (!frames.length) {
    // No genuine observations survived: leave the previous loop untouched.
    // The scheduler retries without promoting an empty or synthetic frame.
    throw new Error(newestFailure ||
      "No verified BoM radar images could be loaded; keeping the current loop and retrying automatically.");
  }
  if(automatic && !isCombined && hybridFrames.length &&
     Date.parse(frames.at(-1).observedUtc) <
       Date.parse(hybridFrames.at(-1).observedUtc)){
    // Never replace a currently playing newer observation with an older
    // one if the source now refuses the latest tile.
    throw new Error(newestFailure ||
      "BoM source returned only older imagery; retaining newer verified loop.");
  }
  // A refused NEWEST scan must not discard other newly verified scans.
  // Commit the available real window and let the existing one-minute
  // source-recovery timer retry the missing UTC while playback continues.'''
)
# An advertised older UTC is only a candidate. Never reset the expensive
# worker/tracks/imagery for a refused WMTS history tile which never loaded.
# Copy this accepted-observation-only rebuild rule into the EXACT Pages bundle.
old_rebuild = '''  const rebuild =
    trackedThrough == null
    || needsHistoricalRebuild
    || frames.some(frame =>
      !radarResultCache.has(frame.observedUtc)
      && Date.parse(frame.observedUtc) <= Date.parse(trackedThrough));'''
rebuild_start=source.index("  // Discovery may advertise a missing older UTC")
rebuild_end=source.index("  if (rebuild) {",rebuild_start)
replace_once(old_rebuild,source[rebuild_start:rebuild_end].rstrip())

# Reuse verified on-screen genuine observations if IndexedDB races a refresh.
replace_once(
    "  const combinedHistory =\n    normaliseRadarHistoryTimes([\n      ...cachedFrames.map(\n        frame => frame.observedUtc\n      ),\n      ...discoveredTimes\n    ]);",
    "  // The live player holds original verified BoM observations even when\n  // IndexedDB returns late/partial history on a subsequent automatic poll.\n  // Retain the same site's already decoded genuine UTCs in the discovery\n  // window, but NEVER reuse temporally inferred/display-only observations.\n  const visibleGenuineFrames = automatic && loadedLoopSelection===selectedLoopSelection()\n    ? hybridFrames.filter(frame=>frame?.sourceMetadata?.region===region &&\n        !isTemporallyInferredRadarFrame(frame))\n    : [];\n  for(const frame of visibleGenuineFrames)\n    radarFrameCache.set(frame.observedUtc,frame);\n  const combinedHistory =\n    normaliseRadarHistoryTimes([\n      ...cachedFrames.map(\n        frame => frame.observedUtc\n      ),\n      ...visibleGenuineFrames.map(frame=>frame.observedUtc),\n      ...discoveredTimes\n    ]);"
)

# The active player can finish rendering an OLD array index after the
# six-frame source window has shifted. Resolve 2-D/3-D/slider by actual BoM
# UTC on the exact shipped Cesium runtime. Do not alter combined Doppler steps.
old_geometry='''    renderInferredVolume(frame);
    updateTrackDisplayControls(requestedIndex);
    applyHybridVolumeMode(requestedIndex);
    renderHybridTracks(requestedIndex);
    syncSevereStormAlerts(requestedIndex);'''
geometry_start=source.index("    // An automatic genuine-scan append/backfill")
geometry_end=source.index("    if(supplementalMeasurable){",geometry_start)
replace_once(old_geometry,source[geometry_start:geometry_end].rstrip())

old_cursor='''  hybridFrameIndex=requestedIndex;
  latestFrame=frame;'''
cursor_start=source.index("  const liveDisplayedIndex=hybridCombinedSchedule.length")
cursor_end=source.index("  // Supplemental image+volume reveal",cursor_start)
replace_once(old_cursor,source[cursor_start:cursor_end].rstrip())

# The primary measured-frame cache must not retain visual-only
# inferred motion previews: exact original BoM PNGs alone may be recycled.
replace_once(
    '''      decodedSingleTile: true,
      beforeReveal:onBeforeReveal,''',
    '''      decodedSingleTile: true,
      // Cache only genuine measured BoM observations. The existing
      // display-only temporal/motion intermediates are never retained as
      // measured scans or silently promoted to the GPU source cache.
      cacheEligible: !frame?.sourceMetadata?.temporalInference,
      beforeReveal:onBeforeReveal,'''
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
    "  // This exact measured-frame window can be shifted in place when its retained\n  // observations are unchanged. Historical backfill, temporal-inference edits\n  // and selection changes retain the original chronological rebuild path.\n  const incrementalCommit = automatic && !isCombined && !rebuild &&\n    loadedLoopSelection === loopSelection &&\n    planIncrementalRadarWindow(hybridFrames,displayFrames);\n  const oldTime = hybridFrames[hybridFrameIndex]?.observedUtc;\n  // Operators parked on Latest must follow genuine newly accepted scans.\n  // Preserve a deliberately scrubbed historical position instead.\n  const wasFollowingLatest = automatic && !isCombined &&\n    !playback.isPlaying() && hybridFrames.length > 0 &&\n    hybridFrameIndex === hybridFrames.length - 1;\n  // If startup/site-switch failed completely, the next successful recovery\n  // with genuine frames must be able to restart the playback automatically.\n  const resume = automatic ? (playback.isPlaying() || hybridFrames.length === 0) : true;"
)
# Guard the existing playing loop from any partial automatic replacement.
# A failed update must not change 5/5 to 4/4 on a real operator screen.
replace_once(
    "  // This exact measured-frame window can be shifted in place when its retained",
    "  // Never replace a better genuine loop with a smaller partial one during\n  // automatic source recovery. Leave the player, camera, pixels, and 3-D\n  // untouched; the one-minute scheduler retries the missing original PNGs.\n  if(automatic && !isCombined && loadedLoopSelection===loopSelection &&\n     hybridFrames.length && displayFrames.length<hybridFrames.length){\n    const message=\"Partial BoM WMTS update (\"+displayFrames.length+\n      \"/\"+hybridFrames.length+\" authentic frames); retaining playing loop\";\n    recordRadarAutoRefreshAudit({\n      failure:message,outcome:\"source unavailable; retaining genuine imagery\"\n    });\n    throw new Error(message);\n  }\n  // This exact measured-frame window can be shifted in place when its retained"
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
# Match the review source's bounded per-site IndexedDB history loader in
# the delivered pinned application. The old getAll() read ALL statewide
# decoded image records on EVERY live check, including pruning.
replace_once(
    '"./storage.js?v=9.8.3"',
    '"./storage.js?v=20261103-bounded-site-indexeddb-v1"'
)
# The pinned release can express this call with different whitespace
# after the earlier overlays. Replace only the selected cache read inside
# the source-result Promise.all, not other radar or Doppler readers.
cache_read_start=data.index("  const [sourceResult, cachedFrames] = await Promise.all([")
cache_read_end=data.index("  const resolvedSource=",cache_read_start)
cache_call_start=data.index("getRadarFrames(",cache_read_start,cache_read_end)
cache_call_end=data.index(").catch",cache_call_start,cache_read_end)+1
old_cache_call=data[cache_call_start:cache_call_end]
assert "region" in old_cache_call and "cacheCutoff" in old_cache_call
assert "getRadarFrames(region, cacheCutoff, cacheFrameBudget)" in source
data=(data[:cache_call_start] +
      "getRadarFrames(region, cacheCutoff, cacheFrameBudget)" +
      data[cache_call_end:])
budget_start=source.index("  // Load only a small, site-specific verified archive slice")
budget_end=source.index("  // Startup metadata failure",budget_start)
inject_once_cache_anchor='''  const [sourceResult, cachedFrames] = await Promise.all(['''
assert data.count(inject_once_cache_anchor)==1
data=data.replace(inject_once_cache_anchor,
    source[budget_start:budget_end]+inject_once_cache_anchor,1)

# The delivered sealed runtime must use the exact bounded, disk-only
# history catch-up from the review source. Do not eagerly load the whole
# published 180-minute state into its decoded frame cache.
warm_start=source.index("async function warmRadarHistoryCache(")
warm_end=source.index("\nasync function ",warm_start+1)
warm_begin=data.index("async function warmRadarHistoryCache(")
warm_finish=data.index("\nasync function ",warm_begin+1)
assert "MAX_BACKGROUND_HISTORY_ATTEMPTS = 2" in source[warm_start:warm_end]
assert "radarFrameCache.set(" not in source[warm_start:warm_end]
data=data[:warm_begin]+source[warm_start:warm_end]+data[warm_finish:]

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
    "  $(\"hybridPlayButton\").disabled = hybridFrames.length < 2;\n  // Historical backfill has changed the COUNT, not the currently visible\n  // BoM pixels. Rebase that displayed UTC's slider label to the new length\n  // without waiting for a second Cesium draw or faking a rendered scan.\n  if(noninterruptingBackfill && latestFrame?.observedUtc===oldTime)\n    $(\"hybridFrameLabel\").textContent=`${hybridFrameIndex+1}/${hybridFrames.length}`;\n  // Never cause a second render over the active player's own in-flight render.\n  // A paused Latest operator still sees the just-accepted newest observation.\n  if((!incrementalCommit && !noninterruptingBackfill) || !playback.isPlaying())\n    await showHybridFrame(hybridFrameIndex);\n  radarLifecycle.sampleMemory({\n    region,latestUtc:frames.at(-1).observedUtc,\n    frameCount:hybridFrames.length,incremental:!!incrementalCommit\n  });\n  recordRadarAutoRefreshAudit({\n    acceptedUtc: frames.at(-1).observedUtc,\n    failure: frameFailures.detail || null,\n    outcome: frameFailures.summary\n      ? \"updated; some genuine source frames unavailable\"\n      : incrementalCommit\n        ? \"incremental: \" + incrementalCommit.appended + \" added, \" +\n          incrementalCommit.dropped + \" retired\"\n        : automatic ? \"updated by chronological rebuild\" : \"manual load complete\"\n  });\n  if(resume && !incrementalCommit && !noninterruptingBackfill)playback.play();"
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
start=source.index("  // Historical backfill can insert an older genuine observation")
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

# The exact Pages build starts from the sealed source: apply the same bounded
# browser render budget and opt into resilient player retries there too.
# Source WMTS pixels, 3-D geometry, Doppler, multi-radar UTC and camera stay unchanged.
inject_once(
    '      timeoutMs:playback.isPlaying() ? 1100 : 2200,\n      onBeforeReveal:commitMeasuredGeometry',
    '      // This source tile is already decoded. Slow Cesium/WebKit postRender\n'
    '      // boundaries need a finite render budget, not a 1.1-second refusal.\n'
    '      // Handover still requires the existing three render boundaries and\n'
    '      // atomically reveals the unchanged BoM pixels with matching 3-D.\n'
    '      timeoutMs:10000,\n      onBeforeReveal:commitMeasuredGeometry'
)
inject_once(
    '  delay: () => effectivePlaybackDelayMs(),\n  onPlayingChange:',
    '  delay: () => effectivePlaybackDelayMs(),\n  continueOnFailedCycle: true,\n  onPlayingChange:'
)

# The original-resolution Cesium surface still contains the identical
# reprojected pixels and lossless PNG. Encode asynchronously to prevent
# full-canvas synchronous PNG work from blocking active playback.
png_source_start=source.index("    // Compress the original-resolution lossless PNG off the main thread.")
png_source_end=source.index("\n  })();",png_source_start)
replace_once(
    '''    return Cesium.SingleTileImageryProvider.fromUrl(
      canvas.toDataURL("image/png"),{rectangle}
    );''',
    source[png_source_start:png_source_end].rstrip()
)

# The six measured scans reuse their OWN decoded/GPU-ready source raster
# layers, rather than re-uploading identical original BoM pixels every cycle.
# This affects only the primary radar imagery handover. The full timeline,
# scientific 3-D, source UTC and supplemental multi-radar handovers are intact.
inject_once(
    '''const radarImageryHandover = createRadarImageryHandover({
  imageryLayers: viewer.imageryLayers, scene,
  retireLayer:deferredImageryRetirement?.retire
});''',
    '''const radarImageryHandover = createRadarImageryHandover({
  imageryLayers: viewer.imageryLayers, scene,
  retireLayer:deferredImageryRetirement?.retire,
  // Six measured frames reuse their already rendered native-resolution GPU
  // images on desktop. Evicting after only three layers forced expensive
  // texture teardown and re-upload on EVERY six-frame playback cycle.
  // Mobile retains its established three-layer memory ceiling. Longer loops
  // remain bounded; the genuine source PNGs and UTCs are never modified.
  maxRetainedLayers:window.matchMedia?.("(max-width:700px)").matches?2:5
});'''
)
replace_once(
    "radar-imagery-handover-v1.js?v=9.18.5-deferred-retire",
    "radar-imagery-handover-v1.js?v=20261103-decoded-two-boundary-v1"
)
# Render safety: the accepted helper remains the same except that obsolete
# high-resolution radar GPU layers are no longer destroyed synchronously
# from Cesium's own postRender event.
replace_once(
    "imagery-layer-retirement-v1.js?v=9.18.5-gpu-lifetime",
    "imagery-layer-retirement-v1.js?v=20261103-postrender-cleanup-v1"
)

# Operator decision: rain radar plays only the currently published BoM
# 30-minute / six-observation loop. The existing independent Doppler loop,
# multi-site synchronisation and 3-D overlays are not modified.
old_options='operational-window-choices-v1.js?v=9.16-four-windows'
assert data.count(old_options)==1
new_options='operational-window-choices-v1.js?v=20261103-six-published-scans-only-v1'
data=data.replace(old_options,new_options,1)
# The optional archive warmer used to fetch two extra historical mosaics even
# after six genuine current frames had loaded. In this source-only mode that
# causes avoidable old-tile 403s, so do not schedule it for 30-minute rain.
warm_anchor='async function warmRadarHistoryCache(\\n  region,\\n  observedTimes\\n) {\\n'
assert data.count(warm_anchor)==1
data=data.replace(warm_anchor,warm_anchor+
    '  // No off-window historical downloads in normal BoM rain playback.\\n'+
    '  if (selectedLoopSelection() === "30") return;\\n',1)
assert 'six-published-scans-only-v1' in data
assert 'No off-window historical downloads' in data
app.write_text(data, encoding="utf-8")
copyfile("frontend/src/live-loop-refresh-v1.js", site / "src/live-loop-refresh-v1.js")
# The sealed production bundle historically used an older radar-source and
# pressure guard from the pinned build. Copy the tested bounded PNG blob cache
# and 45-second tile rejection policy into actual production, not QA only.
copyfile("frontend/src/radar-source.js", site / "src/radar-source.js")
copyfile("frontend/src/operational-window-choices-v1.js", site / "src/operational-window-choices-v1.js")
copyfile("frontend/src/storage.js", site / "src/storage.js")
copyfile("frontend/src/radar-request-pressure-v1.js", site / "src/radar-request-pressure-v1.js")
# Denial-aware bounded tile loading must be deployed, not only reviewed.
copyfile("frontend/src/radar-tile-retry-v1.js", site / "src/radar-tile-retry-v1.js")
copyfile("frontend/src/radar-viewport-continuity-v1.js", site / "src/radar-viewport-continuity-v1.js")
copyfile("frontend/src/bom-wmts-loop-v2.js", site / "src/bom-wmts-loop-v2.js")
copyfile("frontend/src/continuous-playback-v1.js", site / "src/continuous-playback-v1.js")
copyfile("frontend/src/radar-imagery-handover-v1.js", site / "src/radar-imagery-handover-v1.js")
copyfile("frontend/src/imagery-layer-retirement-v1.js", site / "src/imagery-layer-retirement-v1.js")
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
assert "if(resume && !incrementalCommit && !noninterruptingBackfill)playback.play();" in data
assert "const noninterruptingBackfill = automatic" in data
assert "radarTileFailureSnapshot" in data
assert (site / "src/radar-incremental-window-v1.js").exists()
assert 'maxRetainedLayers:window.matchMedia?.("(max-width:700px)").matches?2:5' in data
assert "20261103-postrender-cleanup-v1" in data
assert "Never synchronously destroy WebGL textures" in (site / "src/imagery-layer-retirement-v1.js").read_text()
assert "canvas.toBlob(blob=>blob" in data
assert "MAX_BACKGROUND_HISTORY_ATTEMPTS = 2" in data
assert "cacheFrameBudget=automatic?9" in data
assert "bounded-site-indexeddb" in data
assert "noninterruptingBackfill && latestFrame?.observedUtc===oldTime" in data
assert "maxRetainedLayers" in (site / "src/radar-imagery-handover-v1.js").read_text()
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
assert "officialWmtsFallbackUrl" in (site / "src/radar-source.js").read_text()
assert "20261103-bom-native-six-scans-no-cors-v1" in (site / "src/bom-wmts-loop-v2.js").read_text()
assert "Object.freeze([30])" in (site / "src/operational-window-choices-v1.js").read_text()
assert "refusedWmtsUrls" in (site / "src/radar-source.js").read_text()
assert "negativeTtlMs=45000" in (site / "src/radar-request-pressure-v1.js").read_text()
assert "A tile-specific 403 is not a global denial" in (site / "src/radar-tile-retry-v1.js").read_text()
assert "frame?.sourceMetadata?.region !== region" in data
assert "manual site load failed; automatic retry queued" in data
print("RADAR_OPERATOR_CAMERA_V10_2_41_PACKAGED")
