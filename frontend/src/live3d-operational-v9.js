import { QLD_RADAR_SITES } from "./qld-radar-sites-v1.js";
import { BORDER_RADAR_SITES, primaryRadarDopplerSites } from "./border-radar-sites-v1.js";
import {createSupplementalDopplerDisplay, supportedSecondaryWindSites,
  waitForSecondaryWindPreparation} from "./multi-doppler-display-v1.js?v=v10-wind-sites-20261017-sync-qa-v1";
import { createRadarSiteNameOverlay } from "./context-layers/radar-site-name-overlay-v1.js?v=nsw-border-radar-v1";
import {
  loadLatestBomReflectivityMosaic,
  findLatestBomReflectivityTime,
  discoverBomReflectivityHistory,
  discoverBoundedBomReflectivityHistory,
  loadBomReflectivityMosaicAtTime,
  reflectivityWindowForRegion
} from "./bom-wmts-loop-v2.js?v=20261101-source-verified-recovery-v10-2-40";

import {
  RadarWorkerClient
} from "./worker-client.js?v=core-v6-pixeltrack-prod-r1";
import { resolveSourceDiscovery }
  from "./radar-source-fallback-v1.js?v=9.18.7-real-cache-recovery";

import {
  SOURCE_PALETTES
} from "./palette.js?v=live3d-v1";

import {
  DEFAULT_OCCUPANCY_THRESHOLD,
  inferColumn,
  pixelCentreMercator,
  representativeDbzForCategory,
  webMercatorToDegrees
} from "./inferred-volume-v1.js?v=confidence-v1";

import {
  styleForInferredPoint
} from "./inferred-confidence-v1.js?v=confidence-v1";

import {
  buildMeasuredTrackVolume,
  highSupportTop40Trend,
  shouldDisplayMeasuredTrackPoint
} from "./measured-track-volume-v1.js?v=9.15.0-observed-core";

import {
  reprojectWebMercatorRgbaToGeographic
} from "./webmercator-raster-reproject-v1.js?v=mercator-fix-v1";

import {
  createStormTrackerCameraController
} from "./stormtracker-camera-v1.js?v=map-wheel-20261017-v1";

import {
  createStormTrackerTouchCameraGestures
} from "./touch-camera-gestures-v1.js?v=v9.18.2-gesture-boundaries";

import {
  loadDopplerDiagnostic,
  loadDopplerFrame,
  loadDopplerHistory
} from "./bom-doppler-intake-v3.js?v=operational-v9-7";

import {
  geolocatedHistoricalDopplerSamples,
  paletteFromLatestDopplerImage
} from "./bom-doppler-history-spatial-v1.js?v=operational-v9-7";

import { extractNativeDopplerPanel, reprojectNativeDopplerPanel } from "./native-doppler-image-v1.js?v=9.16.14-hard-footer";
import { resolveRainHistoryWindow } from "./rain-history-recovery-v1.js?v=9.16.1-history";

import {
  buildTrackDopplerContexts
} from "./track-doppler-context-v1.js?v=track-context-v1";

import {
  buildFootprintRestrictedTrackAssessment
} from "./track-assessment-v2.js?v=assessment-v2";

import {
  playbackDelayForSpeed
} from "./operational-loop-v1.js?v=operational-v9";

import {
  ALL_AVAILABLE_LOOP_VALUE,
  availableRadarLoopMinutes,
  continuousRadarHistoryTimes,
  buildRadarPlaybackPlan,
  normaliseRadarHistoryTimes,
  radarHistorySpanMinutes,
  selectRadarHistoryPlan
} from "./radar-history-window-v1.js?v=9.8.3";

import {
  interpolateRadarFrame,
  isTemporallyInferredRadarFrame
} from "./radar-temporal-interpolation-v1.js?v=9.8.3";

import {
  getRadarFrames,
  putRadarFrame,
  pruneRadarFrames
} from "./storage.js?v=9.8.3";

import { buildSharedProductTimeline, buildRadarPrimaryProductTimeline } from "./shared-product-timeline-v1.js?v=9.16-nearest-observation";
import {
  canMotionInterpolateRadar,createRadarMotionTransition,radarMotionStepsForSpeed
} from "./radar-motion-interpolation-v1.js?v=9.16.7-motion";
import { createRadarImageryHandover } from "./radar-imagery-handover-v1.js?v=9.18.5-deferred-retire";
import {MAX_DISPLAY_RADAR_SITES,chooseSupplementalRadarSites,
  fitSelectedRadarSites,createSupplementalRadarDisplay
} from "./multi-radar-display-v9.js?v=render-provider-cache-20261016-v1";
import {
  supplementalObservedAnchor,shouldPrepareSupplementalForPlayback
} from "./supplemental-observed-anchor-v1.js?v=v9-next-inferred-mosaic-no-clock-block-v2";
import { createBoundedFrameCache } from "./bounded-frame-cache-v1.js?v=9.16.9-perf";
import {createBoundedRenderProviderCache} from "./bounded-render-provider-cache-v1.js?v=volume-memory-qa-1";
import { createIncrementalVolumeRenderer } from "./incremental-volume-renderer-v1.js?v=delta-reuse-20261016-v2";
import {createVolumeCategoryProfileCache} from "./volume-category-profile-cache-v1.js?v=render-profile-cache-20261016-v1";
// Memory QA sampling remains available on demand through window.__stormtrackerMemoryDiagnostics in the research preview; no sidebar panel.
import {createHistoricalCycloneForecastQA} from "./historical-cyclone-forecast-map-v1.js?v=issued-fina-20261017-qa-v1";
import {createInternalCycloneLiveQA} from "./internal-cyclone-live-qa-v1.js?v=internal-original-gml-qa1";
import {createFriendlyMapTools} from "./friendly-map-tools-v1.js?v=single-interface-20261017-v1";
import {mountPersistentWeatherLegend} from "./persistent-weather-legend-v1.js?v=lga-ui-legend-20261017-v1";
import { createPlaybackPerformanceMeter } from "./playback-performance-meter-v1.js?v=9.16.9-perf";
import { isDopplerOnlyPlaybackStep, sourceAlignedPlaybackDelayMs } from "./combined-loop-playback-v1.js?v=9.16.10";
import { createStormTrackLabelOverlay } from "./storm-track-label-overlay-v1.js?v=9.15.1-pixeltrack-prod-r1";
import { stormTrackPresentation } from "./storm-track-presentation-v1.js?v=40dbz-v1";
import { setStormTrackTrailVisibility } from "./storm-track-trail-visibility-v1.js?v=9.18.8-track-visibility";
import { clearReflectivityOverlaysForDoppler } from "./reflectivity-overlay-mode-v1.js?v=20261013";
import { buildSevereStormFrameAlerts } from "./severe-storm-alerts-v1.js?v=9.16-preview";
import { createSevereStormAlertOverlay } from "./severe-storm-alert-overlay-v1.js?v=9.16-preview";
import { sourceFrameLoadDecision, summariseSkippedObservedFrames } from "./radar-frame-availability-v1.js?v=9.16-frame-health";
import { buildIndependentDopplerFrames, independentDopplerIndex, nearestIndependentDopplerFrameIndex, nextNativeDopplerIndex } from "./independent-doppler-loop-v1.js?v=9.16-common-controls";
import { DOPPLER_AVAILABLE_LOOP_VALUE, dopplerAvailableWindow, buildDopplerAvailableSchedule, buildDopplerOnlySchedule } from "./doppler-available-window-v1.js?v=9.16.11-doppler-only";
import { buildOperationalWindowChoices } from "./operational-window-choices-v1.js?v=9.16-four-windows";

import { formatProductTime, formatProductTimeRange } from "./product-time-display-v1.js?v=operational-v9-3";
import {
  radarHistoryTimeline,
  needsChronologicalRadarRebuild,
  automaticRefreshUsesDopplerGate,
  automaticRefreshEndUtc,
  hasNewMatchedProducts,
  createLiveLoopRefresh
} from "./live-loop-refresh-v1.js?v=20261101-radar-live-follow-v10-2-39";
import { createContinuousPlayback } from "./continuous-playback-v1.js?v=9.16.10";
import { buildTrackThreatCone } from "./track-threat-cone-v1.js?v=v9-cone-observed-tip-v3";
import {
  evaluateChronologicalTrackThreatCone,
  measuredTrackMotionAtObservation
} from "./adaptive-threat-cone-v1.js?v=v9-isa-sustained-steering-motion-confidence-v5";
import {
  BASEMAP_IDS,
  createStormTrackerBasemapManager
} from "./context-layers/basemap-manager-v1.js?v=global-satellite-blue-gap-20261016-v1";

import {
  createQueenslandTownLabelLayer
} from "./context-layers/qld-town-label-layer-v1.js?v=9.18.5-gazetteer-settle";

import {
  createQueenslandStateBorderLayer
} from "./context-layers/qld-state-border-v1.js?v=9.12.5";

import {
  syncFrameSlider
} from "./frame-slider-v1.js?v=9.9.0-2";

import {
  createStormTrackerTerrainManager
} from "./context-layers/terrain-manager-v1.js?v=9.9.0-4";

import {
  createCameraPerformanceGovernor
} from "./camera-performance-v1.js?v=9.9.0-5";

import {
  initialiseOperationalFloodRoadClosures
} from "./context-layers/flood-road-closures-operational-v1.js?v=sidebar-refresh-track-20261017-v1";

import {
  initialiseOperationalPowerOutages
} from "./context-layers/power-outages-operational-v1.js?v=council-customers-20261017-v1";

import {
  initialiseOperationalRiverGauges
} from "./context-layers/river-gauges-operational-v1.js?v=9.18.11-gauge-green-yellow-red-v2";

import {
  initialiseOperationalQfdTechnicalRescues
} from "./context-layers/qfd-technical-rescues-operational-v1.js?v=9.15.0-icons-onload";
import {initialiseOperationalSignificantRainfall} from
  "./context-layers/significant-rainfall-operational-v1.js?v=20261018-rain-v1";

import {
  addVolumeDisplayPoint,
  updateVolumeDisplayPoint,
  setVolumeDisplayOpacity
} from "./volume-display-opacity-v1.js?v=delta-reuse-20261016-v2";
import {
  volumeDisplayThresholdDbz,
  shouldRenderVolumePoint
} from "./volume-display-threshold-v1.js?v=9.15.1-intensity40";

import {
  reflectivityLegendBands, rgbForInferredDbz, displayedVolumeAltitude,
  volumeBlobDiameterPx, createBlobSpriteDataUrl
} from "./volumetric-visual-v2.js?v=unified-dbz-v2";

import {
  DEFAULT_DOPPLER_FADE_OUT_MS,
  dopplerOverlayFrameKey,
  createDopplerLayerTransition
} from "./doppler-layer-transition-v1.js?v=9.18.5-deferred-retire";
import {createDeferredImageryRetirement}
  from "./imagery-layer-retirement-v1.js?v=9.18.5-gpu-lifetime";
import {createSupplementalRadarVolumes}
  from "./supplemental-radar-volume-v1.js?v=secondary-coverage-fix-20261016-v1";

// V9.20.0 operator-accepted optimisation: use the exact same renderer,
// source-faithful data path and memory budget on the production runtime as
// the visually accepted incremental-3d browser preview. Older immutable
// recovery builds are unaffected. Keep the established flag name for the
// regression-tested downstream code and safeguards.
const INCREMENTAL_VOLUME_PREVIEW =
  window.location.pathname.includes("/preview/incremental-3d/") ||
  (/\/live3d-operational-v9\.html$/.test(window.location.pathname) &&
    !window.location.pathname.includes("/preview/"));
const MODEL_URL =
  "./3d-models/inferred_vertical_profile_model_v2.json";

const VALIDATION_URL =
  "./3d-models/leave_one_event_out_validation_v2.json";

const $ = id =>
  document.getElementById(id);

// Explicit clean-start policy. Optional operational overlays are opt-in,
// including on browsers that restore checkbox state after an earlier visit.
// 3-D terrain is a permanent base-map feature, not an optional incident layer.
const DEFAULT_OFF_LAYER_IDS = Object.freeze([
  "showFloodRoadClosures",
  "showPowerOutages",
  "showRiverGauges",
  "showQfdTechnicalRescues",
  "showTrackLabels",
  "showTrackThreatCone",
]);
for(const id of DEFAULT_OFF_LAYER_IDS){
  const checkbox=$(id);
  if(checkbox)checkbox.checked=false;
}

const viewer = new Cesium.Viewer(
  "cesiumContainer",
  {
    animation: false,
    timeline: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    baseLayerPicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    // Keep Cesium attribution outside the crossfaded render surface so its logo
    // and provider credits remain static while weather frames transition.
    creditContainer: $("cesiumCredits"),
    creditViewport: $("mapPanel"),
    terrainProvider:
      new Cesium.EllipsoidTerrainProvider(),
    baseLayer: false,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
    useBrowserRecommendedResolution: true
  }
);

const scene = viewer.scene;
// V9.20.0: limit surplus Cesium off-screen tile residency without discarding
// tiles needed for the currently visible official satellite imagery.
if(INCREMENTAL_VOLUME_PREVIEW){
  scene.globe.tileCacheSize=window.matchMedia?.("(max-width:700px)").matches?48:72;
}
// An independent map control remains reachable even when the sidebar is hidden.
const controlsSidebar=$("controlSidebar");
const sidebarToggle=$("sidebarToggle");
function setSidebarCollapsed(collapsed){
  $("app").classList.toggle("sidebar-collapsed",Boolean(collapsed));
  controlsSidebar.hidden=Boolean(collapsed);
  sidebarToggle.setAttribute("aria-expanded",String(!collapsed));
  sidebarToggle.textContent=collapsed?"Show controls":"Hide controls";
  sidebarToggle.title=collapsed?"Restore radar and layer controls":"Maximise weather map";
  requestAnimationFrame(()=>{viewer.resize();scene.requestRender();});
}
sidebarToggle.addEventListener("click",()=>setSidebarCollapsed(!controlsSidebar.hidden));
// QA-only usability controls; separate geodesic annotations cannot affect weather.
createFriendlyMapTools({viewer,Cesium});
// Cyclone QA mounts after the stateful map camera exists (below), so focus
// uses the same controller as regular StormTracker navigation.
const persistentWeatherLegend=mountPersistentWeatherLegend();

// Historical cyclone research is paused and remains available as a separate
// module for future test work. It no longer mounts a legacy panel inside the
// approved operator sidebar or creates dormant cyclone controls on page load.

// V9.19.0 production inherits the browser-approved QA guards. The release
// runs inside live3d-operational-v9.html at the GitHub Pages site root;
// the old immutable V9.18.0 build retains its own unaffected source files.
const PUBLISHED_PRODUCTION_RUNTIME =
  /\/live3d-operational-v9\.html$/.test(window.location.pathname) &&
  !window.location.pathname.includes("/preview/");
const BOUNDED_RADAR_RECOVERY_QA =
  PUBLISHED_PRODUCTION_RUNTIME || INCREMENTAL_VOLUME_PREVIEW ||
  window.location.pathname.includes("/preview/radar-history-fix/") ||
  window.location.pathname.includes("/preview/next-baseline/");
const LABEL_GPU_QA =
  BOUNDED_RADAR_RECOVERY_QA ||
  window.location.pathname.includes("/preview/label-gpu-guard/");
const deferredImageryRetirement=LABEL_GPU_QA
  ? createDeferredImageryRetirement({imageryLayers:viewer.imageryLayers,scene})
  : null;
const graphicsDiagnostics={webglLost:0,webglRestored:0,renderErrors:0};
if(LABEL_GPU_QA){
  scene.canvas.addEventListener("webglcontextlost",()=>{graphicsDiagnostics.webglLost++;});
  scene.canvas.addEventListener("webglcontextrestored",()=>{graphicsDiagnostics.webglRestored++;});
  scene.renderError?.addEventListener?.(()=>{graphicsDiagnostics.renderErrors++;});
  window.__stormtrackerGraphicsDiagnostics=()=>({
    ...graphicsDiagnostics,
    imageryLayers:viewer.imageryLayers.length,
    retirement:deferredImageryRetirement.snapshot()
  });
  window.addEventListener("pagehide",()=>deferredImageryRetirement.destroy(),{once:true});
}
const stormTrackLabelOverlay = createStormTrackLabelOverlay({
  scene,
  CesiumRef: Cesium,
  container: $("mapPanel")
});
// Cancels interim weather motion when camera, settings or source selection
// changes. No compositor opacity animation, and no observed-frame alteration.
let visualMotionGeneration=0;
const motionTransition={cancel(){visualMotionGeneration++;}};
const radarImageryHandover = createRadarImageryHandover({
  imageryLayers: viewer.imageryLayers, scene,
  retireLayer:deferredImageryRetirement?.retire
});
let additionalRadarSiteIds=[];
let previousPrimaryRadarId=null;
let supplementalVolumeDisplay=null;
const supplementalRadarDisplay=createSupplementalRadarDisplay({
  imageryLayers:viewer.imageryLayers,scene,
  loadFrame:loadBomReflectivityMosaicAtTime,
  prepareProvider:prepareRadarSurfaceProvider,
  createLayer:provider=>new Cesium.ImageryLayer(provider),
  getWindow:reflectivityWindowForRegion,
  retireLayer:deferredImageryRetirement?.retire,
  onDisplay:(site,frame,utc)=>supplementalVolumeDisplay?.render(site,frame,utc),
  onHide:site=>supplementalVolumeDisplay?.hide(site),
  // Two secondary sites × 6 source frames exceed the old 8-frame limit:
  // it fetched and reprojected the same genuine BoM tiles every loop.
  // Preserve the six-frame 30-min window for 2–3 sites on desktop but keep
  // mobile bounded; no unbounded previous-UTC history is retained.
  maxCached:INCREMENTAL_VOLUME_PREVIEW
    ?(window.matchMedia?.("(max-width:700px)").matches?12:18):18,
  maxProviderCached:INCREMENTAL_VOLUME_PREVIEW
    ?(window.matchMedia?.("(max-width:700px)").matches?6:12):8,
  // Keep routine loading/selection counts off the map panel footer.
  onStatus:()=>{}
});
// Keep every camera gesture and manual control immediate during a visual fade.
// Mere hover/pointer movement must not cancel a weather-frame fade.
// An actual drag begins with pointerdown, which still cancels instantly.
for (const event of ["pointerdown", "wheel", "keydown"]) {
  document.addEventListener(event, () => motionTransition.cancel(), { passive: true });
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    motionTransition.cancel();
    cameraPerformance.restore();
  }
});
window.addEventListener("resize", () => motionTransition.cancel());
window.addEventListener("pagehide", () => touchCameraGestures.destroy(), { once:true });

scene.fog.enabled = false;
scene.globe.enableLighting = false;
scene.globe.maximumScreenSpaceError = 4;

// During sustained coarse-pointer movement, temporarily request fewer
// terrain/imagery tiles. Restore full map detail after the gesture settles.
// This applies equally to Street and Satellite; source imagery is unchanged.
const coarsePointerNavigation =
  window.matchMedia?.("(pointer: coarse)")?.matches === true;
const cameraPerformance =
  createCameraPerformanceGovernor({
    globe: scene.globe,
    scene,
    interactionScreenSpaceError: coarsePointerNavigation ? 12 : 8,
    settleMs: coarsePointerNavigation ? 380 : 160
  });

const DEFAULT_RADAR_SITE_ID = "66"; // Brisbane (Mt Stapylton)
previousPrimaryRadarId=DEFAULT_RADAR_SITE_ID;

const CORE_HOME =
  Object.freeze({
    longitude:
      QLD_RADAR_SITES[DEFAULT_RADAR_SITE_ID].longitude,

    latitude:
      QLD_RADAR_SITES[DEFAULT_RADAR_SITE_ID].latitude,

    targetHeight:
      5000,

    range:
      175000,

    heading:
      Cesium.Math.toRadians(
        345
      ),

    pitch:
      Cesium.Math.toRadians(
        -28
      )
  });

// The legacy SEQ regional mosaic remains selectable and keeps its previous
// regional camera framing; only the initial/home radar is now Stapylton.
const REGIONAL_HOME = Object.freeze({
  ...CORE_HOME,
  longitude: 153.05,
  latitude: -27.25
});

let mapCamera = null;
let basemapManager = null;

const touchCameraGestures =
  createStormTrackerTouchCameraGestures({
    container: $("cesiumContainer"),
    getController: () => mapCamera,
    onGestureStart: () => {
      basemapManager?.setNavigationActive(true);
      queenslandTownLabels?.setNavigationActive(true);
    },
    onGestureEnd: () => {
      basemapManager?.setNavigationActive(false);
      queenslandTownLabels?.setNavigationActive(false);
    },
    onGesture: () => {
      motionTransition.cancel();
      cameraPerformance.pulse();
    }
  });

mapCamera =
  createStormTrackerCameraController({
    viewer,

    container:
      document.getElementById(
        "cesiumContainer"
      ),

    home:
      CORE_HOME,

    onInteraction: () => cameraPerformance.pulse(),
    onNavigationStart: () => {
      basemapManager?.setNavigationActive(true);
      queenslandTownLabels?.setNavigationActive(true);
    },
    onNavigationEnd: () => {
      basemapManager?.setNavigationActive(false);
      queenslandTownLabels?.setNavigationActive(false);
    }
  });

// The verified browser-source QA viewer must never call Cesium.camera.flyTo;
// StormTracker's stateful camera guardian would cancel it as stray movement.
if(window.location.pathname.includes("/preview/incremental-3d/") ||
   (/\/live3d-operational-v9\.html$/.test(window.location.pathname) &&
    !window.location.pathname.includes("/preview/"))) {
  createHistoricalCycloneForecastQA({Cesium,viewer,documentRef:document,
    cameraController:mapCamera});
  createInternalCycloneLiveQA({Cesium,viewer,documentRef:document,
    cameraController:mapCamera});
}

let queenslandTownLabels = null;
let queenslandStateBorder = null;
function syncBasemapReferenceLayer(basemapId) {
  if (!queenslandStateBorder) {
    queenslandStateBorder = createQueenslandStateBorderLayer({
      viewer,
      CesiumRef: Cesium,
      mode: basemapId,
      onStatus: ({ kind, message }) => {
        if (kind === "warning") console.warn(message);
      }
    });
    if (basemapId === BASEMAP_IDS.QLD_IMAGERY) {
      void queenslandStateBorder.start().catch(error => {
        console.warn("Queensland state boundary unavailable:", error);
      });
    }
  } else {
    queenslandStateBorder.setMode(basemapId);
  }
  if (queenslandTownLabels) {
    queenslandTownLabels.setMode(basemapId);
    return;
  }
  queenslandTownLabels = createQueenslandTownLabelLayer({
    viewer,
    CesiumRef: Cesium,
    container: document.getElementById("mapPanel"),
    mode: basemapId,
    deferLocalityDuringNavigation:LABEL_GPU_QA,
    onStatus: ({ kind, message }) => {
      if (kind === "warning") setBasemapStatus(message, "normal");
    }
  });
  void queenslandTownLabels.start().catch(error => {
    console.warn("Queensland town labels unavailable", error);
  });
}

// Read-only QA instrumentation is opt-in and does not alter live controls.
if (new URLSearchParams(window.location.search).has("qaTownLabels")) {
  window.__stormtrackerStateBorderDiagnostics = () => ({
    count: queenslandStateBorder?.count ?? 0,
    visible: queenslandStateBorder?.visible ?? false,
    mode: queenslandStateBorder?.mode ?? "unloaded"
  });
  window.__stormtrackerTownLabelDiagnostics = () => ({
    count: queenslandTownLabels?.count ?? 0,
    visible: queenslandTownLabels?.visibleLabels ?? [],
    labelMode: queenslandTownLabels?.mode ?? "unloaded",
    cameraHeight: queenslandTownLabels?.cameraHeight ?? null,
    cameraPitchDegrees: queenslandTownLabels?.cameraPitchDegrees ?? null,
    labelCalculations: queenslandTownLabels?.calculationCount ?? 0,
    controllerTarget: mapCamera?.getState?.() ?? null
  });
  // Development-only reproducible camera positions for mobile visual QA.
  window.__stormtrackerTownLabelTestCamera = (longitude, latitude, height, pitch) => {
    // The app corrects camera mutations that bypass its controller.
    // Move through that controller so the intended view stays on Birdsville
    // throughout delayed imagery/terrain refinement and the visual test.
    mapCamera.setView({
      longitude, latitude, targetHeight:0, range:height,
      heading:0, pitch:Cesium.Math.toRadians(pitch)
    });
    queenslandTownLabels?.draw(true);
    scene.requestRender();
  };
}

function setTerrainStatus(
  message,
  kind = "ok"
) {
  const status =
    $("terrainStatus");

  if (!status) return;

  status.textContent =
    message;

  status.dataset.kind =
    kind;
}

const terrainManager =
  createStormTrackerTerrainManager({
    Cesium,
    viewer,
    storage:
      window.localStorage,
    onStatus:
      setTerrainStatus
  });

// Controlled, browser-only A/B tests; NEVER active in the production root.
// Street-flat differs from Street-only by precisely one variable: terrain.
const FLAT_TERRAIN_PERFORMANCE_TEST =
  window.location.pathname.includes("/preview/street-flat/");
const STREET_ONLY_PERFORMANCE_TEST =
  FLAT_TERRAIN_PERFORMANCE_TEST ||
  window.location.pathname.includes("/preview/street-only/");

function setBasemapStatus(
  message,
  kind = "ok"
) {
  const status =
    $("basemapStatus");

  if (!status) return;

  status.textContent =
    message;

  status.dataset.kind =
    kind;
}

basemapManager =
  createStormTrackerBasemapManager({
    Cesium,
    viewer,
    suspendDetailDuringNavigation:true,
    // Preserve the visually accepted continuous Queensland satellite source
    // and coherent DEA NSW regional imagery on the production route, too.
    persistentSatelliteCoverage:
      PUBLISHED_PRODUCTION_RUNTIME ||
      window.location.pathname.includes("/preview/next-baseline/") ||
      INCREMENTAL_VOLUME_PREVIEW,
    forceStreetOnly:STREET_ONLY_PERFORMANCE_TEST,
    storage:
      window.localStorage,
    onStatus:
      setBasemapStatus
  });

if(STREET_ONLY_PERFORMANCE_TEST){
  // Remove the choice entirely for unambiguous comparison. The manager
  // independently guards programmatic switches and stored satellite prefs.
  const select=$("basemapSelect");
  for(const option of [...select.options]){
    if(option.value!==BASEMAP_IDS.STREET)option.remove();
  }
  select.value=BASEMAP_IDS.STREET;
  select.disabled=true;
  select.setAttribute("aria-label",
    "Street-only performance test; satellite imagery disabled");
}

try {
  const initialBasemap =
    basemapManager.initialise();

  $("basemapSelect").value =
    initialBasemap.id;

  syncBasemapReferenceLayer(
    initialBasemap.id
  );
} catch (error) {
  console.warn(
    "Stored basemap unavailable; falling back to Street.",
    error
  );

  try {
    const fallback =
      basemapManager.setBasemap(
        BASEMAP_IDS.STREET
      );

    $("basemapSelect").value =
      fallback.id;

    syncBasemapReferenceLayer(
      fallback.id
    );
  } catch (fallbackError) {
    console.warn(
      "Street basemap unavailable",
      fallbackError
    );

    setBasemapStatus(
      "Basemap unavailable · weather layers remain active",
      "error"
    );
  }
}

let model = null;
supplementalVolumeDisplay=createSupplementalRadarVolumes({
  Cesium,scene,getModel:()=>model,
  getSettings:()=>({
    blob:useBlobVolume(),
    occupancyThreshold:Number($("occupancyThreshold").value),
    minimumDbzh:volumeDisplayThresholdDbz($("minimumDbzh").value),
    pointSize:Number($("pointSize").value),
    verticalScale:Number($("verticalScale").value),
    volumePercent:Number($("volumeOpacity").value)
  }),
  inferColumn,representativeDbzForCategory,pixelCentreMercator,
  webMercatorToDegrees,styleForInferredPoint,displayedVolumeAltitude,
  colourForDbzh,addVolumeGlyph,updateVolumeGlyph,setVolumeDisplayOpacity,
  incremental:INCREMENTAL_VOLUME_PREVIEW
});
let validation = null;
let latestFrame = null;
let inferredCollection = null;
// Source-faithful persistent 3-D geometry now applies on the approved
// V9.20.0 production route and remains available in isolated QA.
const incrementalVolumeRenderer=INCREMENTAL_VOLUME_PREVIEW
  ?createIncrementalVolumeRenderer({scene}):null;
let stableVolumeFrameSet=null;
let stableVolumeStride=3;
function stablePrimaryVolumeStride(frame){
  if(!hybridFrames.length)return 3; // Stable even as latest-only scans arrive.
  if(stableVolumeFrameSet!==hybridFrames){
    let largest=0;
    for(const observed of hybridFrames){
      if(observed?.categories)largest=Math.max(largest,estimateCandidateColumns(observed));
    }
    stableVolumeStride=largest>40000?4:largest>15000?3:largest>6000?2:1;
    stableVolumeFrameSet=hybridFrames;
  }
  return stableVolumeStride;
}
const VOLUME_METRIC_IDS=[
  "renderedColumns","renderedPoints","adaptiveStride","maxInferredDbzh",
  "inferredTop40","inferredTop50","meanConfidence","highSupportPoints",
  "mediumSupportPoints","lowSupportPoints","highSupportTop40","highSupportTop50"
];
// A complete standard 60-minute loop has up to 13 genuine 5-minute scans.
// Preserve its already-built collections across repeated passes, but remain
// bounded for long loops and browser-only / mobile GPU memory.
const volumeGeometryCache=createBoundedFrameCache({
  limit:14,
  onEvict:entry=>{if(entry?.collection)scene.primitives.remove(entry.collection);}
});
function clearVolumeGeometryCache(){
  incrementalVolumeRenderer?.reset();
  stableVolumeFrameSet=null;
  volumeGeometryCache.clear();
  inferredCollection=null;
}
let surfaceLayer = null;

const hybridWorker =
  new RadarWorkerClient();

const hybridSource =
  new Cesium.CustomDataSource(
    "hybrid-2d-tracks"
  );

viewer.dataSources.add(
  hybridSource
);

initialiseOperationalFloodRoadClosures({
  viewer,mapCamera
});

initialiseOperationalPowerOutages({
  viewer,mapCamera
});

initialiseOperationalRiverGauges({
  viewer
});

initialiseOperationalQfdTechnicalRescues({
  viewer
});
initialiseOperationalSignificantRainfall({viewer});

let hybridFrames = [];
let hybridResults = [];
let hybridFrameIndex = 0;
let windPlaybackFrames = [];
function isNativeDopplerPlayback() {
  return loadedLoopSelection === DOPPLER_AVAILABLE_LOOP_VALUE &&
    windPlaybackFrames.length > 0;
}
let hybridHistory = new Map();
let sequenceLoading = false;
let sharedTimeline = null;
let preparedDopplerStates = [];
let publishedSharedTimeline = null;
let loadedLoopSelection = null;
let loadedWithDoppler = null;
let availableRadarHistoryTimes = [];
let lastSourceDiscoveryRegion = null;
let lastSourceDiscoveryAt = 0;
let lastSourceDiscoveryTimes = [];
let trackedThrough = null;
const radarFrameCache = new Map();
const radarResultCache = new Map();
const radarAutoRefreshAudit = {
  lastCheckUtc: null,
  newestAcceptedUtc: null,
  lastFailure: null,
  lastOutcome: "not checked"
};
function recordRadarAutoRefreshAudit({
  check = false, acceptedUtc = undefined,
  failure = undefined, outcome = undefined
} = {}) {
  if (check) radarAutoRefreshAudit.lastCheckUtc = new Date().toISOString();
  if (acceptedUtc !== undefined) radarAutoRefreshAudit.newestAcceptedUtc = acceptedUtc;
  if (failure !== undefined) radarAutoRefreshAudit.lastFailure = failure;
  if (outcome !== undefined) radarAutoRefreshAudit.lastOutcome = outcome;
  const note = $("autoRefreshNote");
  if (note) {
    note.title = [
      "Last automatic check: " + (radarAutoRefreshAudit.lastCheckUtc
        ? formatProductTime(radarAutoRefreshAudit.lastCheckUtc) : "not yet"),
      "Newest accepted radar observation: " + (radarAutoRefreshAudit.newestAcceptedUtc
        ? formatProductTime(radarAutoRefreshAudit.newestAcceptedUtc) : "none yet"),
      "Last failure: " + (radarAutoRefreshAudit.lastFailure || "none"),
      "Refresh state: " + radarAutoRefreshAudit.lastOutcome
    ].join("\n");
  }
}
window.__stormtrackerRadarAutoRefreshAudit = () => ({ ...radarAutoRefreshAudit });
const autoRefresh = createLiveLoopRefresh({
  refresh: () => {
    if (document.hidden) return undefined;
    recordRadarAutoRefreshAudit({ check: true, outcome: "checking" });
    return runSourceLoad(() => loadHybridSequence(true), true).then(result => {
      if (result === false) recordRadarAutoRefreshAudit({ outcome: "busy: retry pending" });
      return result;
    });
  },
  onError: error => {
    recordRadarAutoRefreshAudit({ failure: String(error?.message ?? error), outcome: "failed" });
    $("autoRefreshNote").textContent = `Auto update retry: ${error.message}`;
  }
});

// Opportunistically prepare the next two genuine source images while the
// current frame is visible. All preparation is display-only, never a new
// radar/Doppler measurement, and never blocks the playback clock.
let playbackPrewarmGeneration=0;
function prewarmUpcomingFrames(index){
  const generation=++playbackPrewarmGeneration;
  const region=selectedRadarRegion();
  window.setTimeout(async()=>{
    for(let offset=1;offset<=2;offset++){
      if(generation!==playbackPrewarmGeneration ||
         region!==selectedRadarRegion() || sequenceLoading) return;
      const windMode=isNativeDopplerPlayback();
      const length=windMode ? windPlaybackFrames.length : hybridFrames.length;
      if (!length) return;
      const next=(index+offset)%length;
      const frame=windMode ? windPlaybackFrames[next] : hybridFrames[next];
      if(!frame)continue;
      try {
        if (windMode) {
          // Prepare one upcoming real secondary Doppler observation in
          // parallel with the primary. Never gate the operator playback.
          const upcoming=offset===1
            ? supplementalDopplerDisplay.prewarm(frame.observedUtc)
            : Promise.resolve();
          await Promise.allSettled([prepareWindObservation(next),upcoming]);
        } else await prepareRadarSurfaceProvider(frame);
      } catch(error) {
        // Genuine source images can expire from BoM; this is best effort.
        console.warn("Playback prewarm skipped",frame.observedUtc,error);
      }
    }
  },0);
}
const playbackPerformanceMeter=createPlaybackPerformanceMeter({windowSize:24});
const playback = createContinuousPlayback({
  count: () => isNativeDopplerPlayback() ? windPlaybackFrames.length : hybridFrames.length,
  currentIndex: () => isNativeDopplerPlayback() ? independentDopplerIndexValue : hybridFrameIndex,
  showFrame: index => isNativeDopplerPlayback() ? showDopplerOnlyFrame(index) : showHybridFrame(index),
  delay: () => effectivePlaybackDelayMs(),
  onPlayingChange: playing => {
    $("hybridPlayButton").textContent = playing ? "Pause" : "Play";
    $("hybridPlayButton").setAttribute("aria-pressed", String(playing));
  },
  onError: error => { motionTransition.cancel(); setStatus(error.message, "error"); }
});

let hybridTrackVolumes = [];
let hybridTrackVolumeCollection = null;
let hybridTrackFootprintCollection = null;

let hybridDopplerFrameStates =
  [];

let dopplerHistories =
  new Map();

let dopplerPalettes =
  new Map();

let dopplerLatestRecords =
  new Map();

let dopplerFrameCache =
  new Map();

// Wind imagery has its own observed history, refresh and playback position.
let independentDopplerFrames = [];
let independentDopplerIndexValue = 0;
let independentDopplerRecord = null;
let independentDopplerSourceId = null;
let independentDopplerLoading = false;
let independentDopplerRequest = 0;
// Existing radar player is the sole user-facing clock; both source histories
// retain their own real observations and are never required to match.
let windCycleCursor = -1;
let windSourceFailCount = 0;
let windRenderPending = false;
let windLastRadarDriveKey = null;
let hybridCombinedSchedule = [];
let lastCombinedDopplerLatestUtc = null;
function isDopplerSourceActive() { return Boolean($("dopplerOverlayRadar")?.value); }
function hasNewDopplerWindow() {
  return selectedLoopSelection() === DOPPLER_AVAILABLE_LOOP_VALUE &&
    Date.parse(independentDopplerFrames.at(-1)?.observedUtc) >
    Date.parse(lastCombinedDopplerLatestUtc);
}
function chooseWindCursorForRadar(radarIndex) {
  const windFrames = independentDopplerFrames;
  if (!windFrames.length) return -1;
  const atTime = Date.parse(hybridFrames[radarIndex]?.observedUtc);
  const start = Date.parse(windFrames[0].observedUtc);
  const end = Date.parse(windFrames[windFrames.length - 1].observedUtc);
  if (Number.isFinite(atTime) && atTime >= start && atTime <= end) {
    return nearestIndependentDopplerFrameIndex(windFrames, hybridFrames[radarIndex].observedUtc);
  }
  const fraction = Math.max(0, Math.min(1, radarIndex / Math.max(1, hybridFrames.length - 1)));
  return Math.round(fraction * (windFrames.length - 1));
}
function driveWindFromCommonPlayback(radarIndex) {
  if (!shouldDisplayDopplerForSelectedWindow() || !independentDopplerFrames.length) return;
  const key=String(radarIndex)+":"+String(hybridFrames[radarIndex]?.observedUtc);
  if(!playback.isPlaying() && key===windLastRadarDriveKey && !hybridCombinedSchedule.length)return;
  windLastRadarDriveKey=key;
  if (playback.isPlaying() && windRenderPending && !hybridCombinedSchedule.length) return;
  const scheduled = hybridCombinedSchedule[radarIndex];
  const next = scheduled
    ? independentDopplerFrames.findIndex(frame => frame.observedUtc === scheduled.dopplerObservedUtc)
    : playback.isPlaying()
      ? nextNativeDopplerIndex(windCycleCursor, independentDopplerFrames.length)
      : chooseWindCursorForRadar(radarIndex);
  if (scheduled && next === independentDopplerIndexValue &&
      independentDopplerRecord?.observedUtc === scheduled.dopplerObservedUtc) return;
  if (next < 0) return;
  windCycleCursor = next;
  windRenderPending = true;
  void showIndependentDopplerFrame(next).catch(error => {
    windSourceFailCount++;
    const status = $("dopplerOverlayStatus");
    if (status) status.textContent="Wind frame unavailable · "+error.message;
  }).finally(() => {windRenderPending=false;});
}

const independentDopplerRefresh = createLiveLoopRefresh({
  refresh: () => document.hidden || !isDopplerSourceActive()
    ? undefined : refreshIndependentDopplerHistory(true),
  onError: error => {
    $("dopplerOverlayStatus").textContent = "Doppler refresh retry: " + error.message;
  }
});

const dopplerOverlayTransition =
  createDopplerLayerTransition({
    imageryLayers:
      viewer.imageryLayers,
    scene,
    retireLayer:deferredImageryRetirement?.retire,

    requestRender:
      () =>
        scene.requestRender()
  });

// Selected extra radar sites render their own genuine, source-timed wind
// imagery in Doppler-only mode. Never reuse the primary velocity pixels.
const supplementalDopplerDisplay=createSupplementalDopplerDisplay({
  sites:BORDER_RADAR_SITES,imageryLayers:viewer.imageryLayers,scene,
  createTransition:createDopplerLayerTransition,
  createLayer:provider=>new Cesium.ImageryLayer(provider),
  getPrimaryLayer:()=>dopplerOverlayTransition.currentLayer,
  getSurfaceLayer:()=>surfaceLayer,
  retireLayer:deferredImageryRetirement?.retire,
  loadSiteHistory:async id=>{
    const [history,latest]=await Promise.all([
      loadDopplerHistory(id),loadDopplerDiagnostic(id)
    ]);
    const palette=paletteFromLatestDopplerImage(canvasImageData(latest.canvas));
    return {frames:history.frames,palette};
  },
  loadSiteFrame:async (id,frame,palette)=>{
    const source=await loadDopplerFrame(id,frame);
    if(source.observedUtc && source.observedUtc!==frame.observedUtc)
      throw Error("Secondary Doppler UTC disagrees with published filename");
    const nativePanel=extractNativeDopplerPanel(canvasImageData(source.canvas),palette);
    if(!nativePanel.nativePixelCount)
      throw Error("No calibrated radial velocity pixels in this BoM scan");
    const record={nativePanel,observedUtc:frame.observedUtc,filename:frame.filename};
    const provider=await prepareNativeDopplerProvider(id,record);
    return {provider,observedUtc:frame.observedUtc,pixelCount:nativePanel.nativePixelCount};
  },
  onStatus:snapshot=>{
    const output=$("multiRadarDopplerStatus");
    if(!output)return;
    const count=snapshot.selected.length;
    const live=snapshot.sources.filter(s=>s.matched).length;
    output.textContent=!count
      ? "Select an additional Doppler-capable site to view simultaneous measured wind."
      : !snapshot.enabled
        ? count+" additional Doppler-capable site"+(count===1?"":"s")+" selected · available in Doppler playback"
        : "Measured Doppler "+live+"/"+count+" additional sites · "+
          snapshot.sources.map(s=>s.id+" "+
            (s.matched ? formatProductTime(s.observedUtc,{compact:true})+
              (s.offsetMinutes===null?"":` (${s.offsetMinutes>0?"+":""}${s.offsetMinutes}m)`)
              : (s.error??"loading"))).join(" · ");
  }
});
window.addEventListener("pagehide",()=>supplementalDopplerDisplay.destroy(),{once:true});

let dopplerOverlayRenderToken =
  0;

let selectedTrackDisplayId =
  "";

// Cone rendering is intentionally stateless: the source-time sequence of
// real observed track positions completely determines each frame's cone.
// A replayed frame cannot inherit geometry from a later displayed frame.

// Independent alert markers render above 3-D weather and storm-ID labels.
// Clicking a real candidate focuses its ST track without touching playback.
const severeStormAlertOverlay = createSevereStormAlertOverlay({
  scene, CesiumRef: Cesium, container: $("mapPanel"),
  onFocus: alert => {
    selectedTrackDisplayId = alert.track_id;
    if (hybridFrames.length) {
      updateTrackDisplayControls(hybridFrameIndex);
      applyHybridVolumeMode(hybridFrameIndex);
      renderHybridTracks(hybridFrameIndex);
    }
    mapCamera?.setView({
      longitude: alert.longitude,
      latitude: alert.latitude,
      targetHeight: 0,
      range: 85000,
      heading: 0,
      pitch: Cesium.Math.toRadians(-52)
    });
    scene.requestRender();
  }
});
// V9.16.0 production: unvalidated research alerts cannot appear.
severeStormAlertOverlay.setEnabled(false);

// Prevent an older asynchronous radar-image load from replacing a newer
// frame after rapid scrubbing/playback.
let hybridSceneRenderToken = 0;

function setStatus(message, kind = "normal") {
  $("status").textContent = message;

  $("status").dataset.kind = kind;
}

function selectedLoopSelection() {
  return $("loopDurationMinutes")?.value || "30";
}

function selectedLoopMinutes() {
  const selection = selectedLoopSelection();
  return selection === DOPPLER_AVAILABLE_LOOP_VALUE
    ? Math.max(0, (Date.parse(independentDopplerFrames.at(-1)?.observedUtc) -
        Date.parse(independentDopplerFrames[0]?.observedUtc))/60000 || 0)
    : Number(selection);
}

function availableHistorySummary(times = availableRadarHistoryTimes) {
  const history = normaliseRadarHistoryTimes(times);
  if (!history.length) return "Radar history unavailable";

  const plan = buildRadarPlaybackPlan(history);
  const inferred =
    plan.filter(entry => entry.kind === "inferred").length;
  const span =
    plan.length > 1
      ? Math.round(
          (
            Date.parse(plan.at(-1).observedUtc)
            - Date.parse(plan[0].observedUtc)
          ) / 60000
        )
      : 0;

  return (
    `Radar history available: ${span} min · ` +
    `${history.length} observed + ${inferred} inferred display frames · ` +
    formatProductTimeRange(
      plan[0]?.observedUtc,
      plan.at(-1)?.observedUtc
    )
  );
}

// Four user-facing windows. The existing combined Doppler schedule is unchanged.
function isCombinedDopplerWindowSelected() {
  return selectedLoopSelection() === DOPPLER_AVAILABLE_LOOP_VALUE;
}
function shouldDisplayDopplerForSelectedWindow() {
  // Always poll real Doppler source history for future combined-loop selection,
  // but never carry its images into any longer rain-only radar window.
  return isDopplerSourceActive() && isCombinedDopplerWindowSelected();
}

function updateRadarHistoryOptions(times, { preserveSelection = true } = {}) {
  availableRadarHistoryTimes = continuousRadarHistoryTimes(times);
  const selector = $("loopDurationMinutes");
  const previous = preserveSelection ? selector.value : "";
  const window = dopplerAvailableWindow(availableRadarHistoryTimes, independentDopplerFrames);
  const rainAvailable = availableRadarLoopMinutes(availableRadarHistoryTimes);
  // Native BoM rain playback starts at 30 minutes. Longer durations must be
  // backed by published source history or this browser's rolling archive.
  const choices = buildOperationalWindowChoices({
    combinedAvailable: isDopplerSourceActive() && independentDopplerFrames.length >= 2,
    rainAvailableMinutes: rainAvailable,
    rainHasFrames: availableRadarHistoryTimes.length > 0
  });
  const options = choices.map(choice => {
    const option = document.createElement("option");
    option.value = choice.value;
    option.textContent = choice.label;
    option.disabled = choice.disabled;
    return option;
  });
  selector.replaceChildren(...options);
  const enabled = choices.filter(choice => !choice.disabled);
  selector.disabled = sequenceLoading || !enabled.length;
  // Never silently switch a user's rain-only mode to combined Doppler just
  // because its requested duration is temporarily unavailable.
  const selected = choices.some(choice => choice.value === previous && !choice.disabled)
    ? previous
    : previous === DOPPLER_AVAILABLE_LOOP_VALUE && preserveSelection
      ? previous
      : enabled.some(choice => choice.value === "30")
        ? "30" : enabled[0]?.value ?? "";
  if (selected) selector.value = selected;
  else selector.selectedIndex = -1;
  updateLoopButtonLabel();
}

function effectivePlaybackDelayMs() {
  if(isNativeDopplerPlayback()) return playbackDelayForSpeed(selectedPlaybackSpeed());
  return sourceAlignedPlaybackDelayMs(
    playbackDelayForSpeed(selectedPlaybackSpeed()),
    hybridCombinedSchedule,
    hybridCombinedSchedule.length > 0 && isCombinedDopplerWindowSelected()
  );
}
function selectedPlaybackSpeed() {
  return Number(
    $("playbackSpeed")
      ?.value
    ?? 1
  );
}

function updateLoopButtonLabel() {
  const selection = selectedLoopSelection();
  const minutes = selectedLoopMinutes();
  const dopplerAvailable = selection === DOPPLER_AVAILABLE_LOOP_VALUE;

  const button = $("loadHybridButton");
  if (button) {
    button.textContent =
      window.matchMedia?.("(max-width:700px)").matches
        ? (dopplerAvailable ? "Load Doppler" : `Load ${minutes}m rain`)
        : (dopplerAvailable ? "Load Doppler — All available" :
            `Load ${minutes}-min rain radar`);
  }

  const loopWindow = $("operationalLoopWindow");
  if (loopWindow && !hybridFrames.length) {
    loopWindow.textContent = availableRadarHistoryTimes.length
      ? (dopplerAvailable ? `Doppler window · ${Math.round(minutes)} min` :
          `${minutes} min rain-only`)
      : "Checking history";
  }

  $("dopplerHistoryWarning").hidden = true;
}

function enforceDopplerWindow() {
  updateLoopButtonLabel(); // Doppler never changes reflectivity duration.
}

function sourceAgeText(
  observedUtc
) {
  const epoch =
    Date.parse(
      observedUtc
    );

  if (
    !Number.isFinite(
      epoch
    )
  ) {
    return "—";
  }

  const ageMinutes =
    (
      Date.now()
      - epoch
    )
    / 60000;

  if (
    ageMinutes < -2
  ) {
    return "clock anomaly";
  }

  if (
    ageMinutes < 1
  ) {
    return "<1 min";
  }

  return `${Math.round(ageMinutes)} min`;
}

function updateOperationalOverview(
  frame,
  mode =
    "sequence"
) {
  const sourceMode =
    $("operationalSourceMode");

  if (sourceMode) {
    sourceMode.textContent =
      mode === "latest"
        ? "Latest frame"
        : isTemporallyInferredRadarFrame(frame)
          ? "Radar loop · inferred gap frame"
          : "Radar tracking loop";
  }

  const age =
    $("operationalSourceAge");

  if (age) {
    age.textContent =
      frame
        ? sourceAgeText(
            frame.observedUtc
          )
        : "—";
  }

  const loaded =
    $("operationalFramesLoaded");

  if (loaded) {
    loaded.textContent =
      String(
        mode === "latest"
          ? (
              frame
                ? 1
                : 0
            )
          : hybridFrames.length
      );
  }

  const result =
    mode === "sequence"
      ? hybridResults[
          hybridFrameIndex
        ]
      : null;

  const active =
    $("operationalActiveTracks");

  if (active) {
    active.textContent =
      result
        ? String(
            result.active_track_ids
              ?.length
            ?? 0
          )
        : "—";
  }

  // Independent Doppler source status uses its own observation clock.
  const frameTime = $("operationalFrameTime");
  if (frameTime) {
    frameTime.textContent = frame?.observedUtc ? formatProductTime(frame.observedUtc, { compact: true }) : "—";
    frameTime.title = frame?.observedUtc ? formatProductTime(frame.observedUtc) : "";
    frameTime.dataset.observedUtc = frame?.observedUtc ?? "";
  }

}

function setAdvancedScienceVisible(visible) {
  const dialog = $("detailsDialog");
  if (visible && !dialog.open) dialog.showModal();
  if (!visible && dialog.open) dialog.close();
}

function selectDetailsTab(name) {
  for (const panel of document.querySelectorAll("[data-detail-panel]")) {
    panel.hidden = panel.dataset.detailPanel !== name;
  }
  for (const button of document.querySelectorAll("[data-detail-tab]")) {
    button.setAttribute("aria-selected", String(button.dataset.detailTab === name));
  }
}

function colourForDbzh(value) {
  const rgb=rgbForInferredDbz(value);
  return rgb
    ? Cesium.Color.fromBytes(rgb[0],rgb[1],rgb[2],255)
    : Cesium.Color.fromCssColorString("#6ab6ff");
}

// Cloud-like billboards are presentation only; the AURA-inferred profiles
// and original reflectivity frames remain unchanged.
let volumeBlobImage=null;
// The approved rounded-volume rendering is now the only operator mode.
function useBlobVolume(){ return true; }
function blobImage(){
  if(!volumeBlobImage)volumeBlobImage=createBlobSpriteDataUrl(document);
  return volumeBlobImage;
}
function addVolumeGlyph(collection,options,sourceAlpha,percent,sizeDbz,support=1) {
  if(useBlobVolume()){
    const diameter=volumeBlobDiameterPx($("pointSize").value,sizeDbz,support);
    const {pixelSize:unusedPixelSize,...spriteOptions}=options;
    return addVolumeDisplayPoint(collection,{
      ...spriteOptions,image:blobImage(),width:diameter,height:diameter
    },Math.min(1,sourceAlpha*.8),percent);
  }
  return addVolumeDisplayPoint(collection,options,sourceAlpha,percent);
}

// Mutate an existing billboard/point when source dBZ changes. Never add a
// second ghost cloud or set the active cloud's alpha to zero between scans.
function updateVolumeGlyph(glyph,options,sourceAlpha,percent,sizeDbz,support=1){
  if(useBlobVolume()){
    const diameter=volumeBlobDiameterPx($("pointSize").value,sizeDbz,support);
    const {pixelSize:unusedPixelSize,...spriteOptions}=options;
    return updateVolumeDisplayPoint(glyph,{
      ...spriteOptions,width:diameter,height:diameter
    },Math.min(1,sourceAlpha*.8),percent);
  }
  return updateVolumeDisplayPoint(glyph,options,sourceAlpha,percent);
}

function refreshReflectivityLegend(){
  const holder=$("reflectivityLegend");
  if(!holder)return;
  holder.replaceChildren(...reflectivityLegendBands().map(band=>{
    const span=document.createElement("span");
    const swatch=document.createElement("i");
    swatch.style.background=band.color;
    const label=document.createElement("small");
    label.textContent=band.dbzLabel.replace(" dBZ","");
    span.title=band.dbzLabel;
    span.append(swatch,label);
    return span;
  }));
}

function displayAltitude(altitude) {
  const exaggeration =
    Number(
      $("verticalScale").value
    );

  return altitude * exaggeration;
}

function selectedRadarRegion() { return $("radarSite").value; }
function selectedSourceRadars() { return primaryRadarDopplerSites(selectedRadarRegion()); }
function resetView() {
  const site = BORDER_RADAR_SITES[selectedRadarRegion()];
  if (site) mapCamera.setView({...CORE_HOME, longitude:site.longitude, latitude:site.latitude});
  else mapCamera.setView(REGIONAL_HOME);
}
function configureRadarSite() {
  const selected=selectedRadarRegion();
  const ids=selectedSourceRadars();
  // The single primary radar selector owns the wind-source site too.
  // Internal hidden input preserves existing verified loading/science paths
  // without an independently user-selectable Doppler radar.
  $("dopplerOverlayRadar").value=ids[0]??"";
  const site=BORDER_RADAR_SITES[selected];
  $("radarSite").title=selected==="SEQ"
    ? "Legacy south-east region (not exposed as an operational option)"
    : `${site?.name??"Radar"}: ${ids.length ? "Doppler available" : "reflectivity only"}`;
}
for (const site of Object.values(BORDER_RADAR_SITES).sort((a,b) => a.name.localeCompare(b.name))) {
  const option = document.createElement("option"); option.value = site.id;
  option.textContent = `${site.name}${site.state==="NSW" ? " (NSW)" : ""}${site.dopplerProduct && site.dopplerIntegrated!==false ? " · Doppler" : " · Rain only"}`;
  if (site.id !== DEFAULT_RADAR_SITE_ID) $("radarSite").append(option);
}
// Primary alone owns storm tracks and inferred 3-D science. Extra sites
// show source-timed reflectivity OR their own BoM native Doppler on wind mode.
$("radarSite").value = DEFAULT_RADAR_SITE_ID;
configureRadarSite();
function refreshAdditionalRadarChoices(){
  const primary=selectedRadarRegion();
  additionalRadarSiteIds=chooseSupplementalRadarSites(primary,
    additionalRadarSiteIds,BORDER_RADAR_SITES);
  for(const input of $("multiRadarChecklist").querySelectorAll("input[type=checkbox]")){
    const isPrimary=input.value===primary;
    input.checked=isPrimary || additionalRadarSiteIds.includes(input.value);
    input.disabled=isPrimary;
    input.parentElement.dataset.primary=String(isPrimary);
  }
  clearMultiRadarSelectionWarning();
  $("multiRadarCount").textContent=String(1+additionalRadarSiteIds.length);
  $("multiRadarSelectButton").title=
    (1+additionalRadarSiteIds.length)+" BoM radar sites selected";
  supplementalRadarDisplay.configure(primary,additionalRadarSiteIds);
  supplementalDopplerDisplay.configure(primary,additionalRadarSiteIds);
}
function supplementalAnchorForFrame(frame){
  return frame && frame.sourceMetadata?.region===selectedRadarRegion() &&
    !isNativeDopplerPlayback()
    ? supplementalObservedAnchor(frame,hybridFrames,15) : null;
}
function displaySupplementalHoldStatus(anchor){
  const note=$("supplementalHoldNote");
  const sites=supplementalRadarDisplay.visibleSites;
  const holding=Boolean(anchor?.held && sites.length);
  note.hidden=!holding;
  if(holding)note.textContent=
    "Additional radars: original BoM image held at "+
    formatProductTime(anchor.observedUtc,{compact:true})+
    " (+"+Math.round(anchor.ageMinutes)+" min display gap)";
}
function showSupplementalRadarSites(frame){
  // Temporal interpolation is PRIMARY display-only; secondary sites retain
  // their most recent authentic scan for at most 15 minutes, never relabelled
  // with the inferred timestamp. A new selection while paused also works.
  const anchor=supplementalAnchorForFrame(frame);
  if(!anchor){
    void supplementalRadarDisplay.show(null,{enabled:false});
    displaySupplementalHoldStatus(null);
    return;
  }
  void supplementalRadarDisplay.prepare(anchor.observedUtc).then(()=>{
    if(latestFrame===frame && !isNativeDopplerPlayback()){
      supplementalRadarDisplay.commit(anchor.observedUtc,{
        alpha:Number($("radarOpacity").value)/100
      });
      displaySupplementalHoldStatus(anchor);
    }
  }).catch(error=>console.warn("Extra radar staging unavailable",error));
}
function clearMultiRadarSelectionWarning(){
  const warning=$("multiRadarStatus");
  warning.hidden=true;
  warning.textContent="";
}
function setAdditionalRadarSelection(next){
  additionalRadarSiteIds=chooseSupplementalRadarSites(
    selectedRadarRegion(),next,BORDER_RADAR_SITES);
  refreshAdditionalRadarChoices();
  clearMultiRadarSelectionWarning();
  if(INCREMENTAL_VOLUME_PREVIEW)
    supplementalVolumeDisplay?.pruneSites(additionalRadarSiteIds);
  if(latestFrame)showSupplementalRadarSites(latestFrame);
  if(isNativeDopplerPlayback() && windPlaybackFrames.length)
    supplementalDopplerDisplay.showAt(
      windPlaybackFrames[independentDopplerIndexValue]?.observedUtc);

}
for(const site of Object.values(BORDER_RADAR_SITES).sort((a,b)=>
  a.name.localeCompare(b.name))){
  const label=document.createElement("label");
  const checkbox=document.createElement("input");
  checkbox.type="checkbox";checkbox.value=site.id;
  const name=document.createElement("span");name.textContent=site.name;
  label.append(checkbox,name);
  const type=document.createElement("small");
  type.textContent=site.dopplerProduct && site.dopplerIntegrated!==false
    ? site.id==="93" ? " · Doppler + rain (mapped from BoM site/range)" : " · Doppler + rain"
    : " · Rain only";
  label.append(type);
  $("multiRadarChecklist").append(label);
  checkbox.addEventListener("change",()=>{
    // New selections are valid even while the primary source history is
    // loading. They are displayed as soon as a genuine measured scan commits.
    if(checkbox.checked && additionalRadarSiteIds.length>=MAX_DISPLAY_RADAR_SITES-1){
      checkbox.checked=false;
      const warning=$("multiRadarStatus");
      warning.textContent="You can select a maximum of three additional radars. Deselect another site first.";
      warning.hidden=false;
      return;
    }
    setAdditionalRadarSelection(checkbox.checked
      ? [...additionalRadarSiteIds,site.id]
      : additionalRadarSiteIds.filter(id=>id!==site.id));
  });
}
refreshAdditionalRadarChoices();
// Persistent radar-site location names remain distinct from Queensland town
// labels and share the primary-radar select event with the existing dropdown.
// They do not add more simultaneous radar sites or bypass frame-science gates.
const radarSiteNames=createRadarSiteNameOverlay({
  scene,CesiumRef:Cesium,container:$("mapPanel"),sites:BORDER_RADAR_SITES,
  getPrimary:selectedRadarRegion,
  onSelect:id=>{
    const selector=$("radarSite");
    if(!Object.hasOwn(BORDER_RADAR_SITES,id))return;
    if(selector.value===id){
      resetView();
      scene.requestRender();
      return;
    }
    selector.value=id;
    selector.dispatchEvent(new Event("change",{bubbles:true}));
  }
});
// Opt-in, read-only browser diagnostics for verifying actual Cesium layers,
// native BoM timestamps, selector state, and latest observed source frame.
if(new URLSearchParams(window.location.search).has("qaMultiRadar")){
  window.__stormtrackerMultiRadarDiagnostics=()=>({
    primary:selectedRadarRegion(),
    secondary:[...additionalRadarSiteIds],
    visibleSupplemental:supplementalRadarDisplay.visibleSites,
    primaryUtc:latestFrame?.observedUtc??null,
    primaryRegion:latestFrame?.sourceMetadata?.region??null,
    primaryInferred:Boolean(latestFrame?.sourceMetadata?.temporalInference),
    dopplerOnly:isNativeDopplerPlayback(),
    frameCount:hybridFrames.length,
    sourceStatus:$("status")?.textContent??"",
    addedStatus:$("multiRadarStatus")?.textContent??"",
    radarLabelCount:radarSiteNames.siteCount,
    radarVisibleIds:radarSiteNames.visibleRadarIds,
    mapWidth:$("cesiumContainer")?.clientWidth??0,
    mapHeight:$("cesiumContainer")?.clientHeight??0,
    radarAlpha:radarImageryHandover.currentLayer?.alpha??null,
    extraAlpha:viewer.imageryLayers?.length??0,
    openPanel:!$("multiRadarPanel").hidden,
    cameraTarget:mapCamera?.getState?.()??null
  });
}
$("multiRadarSelectButton").addEventListener("click",()=>{
  const panel=$("multiRadarPanel");panel.hidden=!panel.hidden;
  if(panel.hidden)clearMultiRadarSelectionWarning();
  $("multiRadarSelectButton").setAttribute("aria-expanded",String(!panel.hidden));
});
$("closeMultiRadarPanel").addEventListener("click",()=>{
  $("multiRadarPanel").hidden=true;
  clearMultiRadarSelectionWarning();
  $("multiRadarSelectButton").setAttribute("aria-expanded","false");
  $("multiRadarSelectButton").focus();
});
$("clearMultiRadars").addEventListener("click",()=>setAdditionalRadarSelection([]));
$("fitMultiRadars").addEventListener("click",()=>{
  const bounds=fitSelectedRadarSites(
    selectedRadarRegion(),additionalRadarSiteIds,BORDER_RADAR_SITES);
  mapCamera.setView({...CORE_HOME,...bounds});
});

function displayRgb(category) {
  return (
    SOURCE_PALETTES
      .reflectivityRgb
      .find(
        item =>
          item.value === category
      )
      ?.rgb
    ?? null
  );
}

// Cache real BoM frame raster providers across repeated loops; previously the
// app decoded, reprojected, PNG-encoded and loaded each same frame on EVERY
// playback pass, with work repeated at every playback speed.
const measuredRadarProviderCache = INCREMENTAL_VOLUME_PREVIEW
  ?createBoundedRenderProviderCache({
    limit:window.matchMedia?.("(max-width:700px)").matches?3:6
  }):new WeakMap();
// On-demand render diagnostics; never mistake Chromium's shared GPU process for a
// tab-specific memory measurement. No periodic polling or retained snapshots.
if(INCREMENTAL_VOLUME_PREVIEW){
  window.__stormtrackerMemoryDiagnostics=()=>{
    const unique=new Set();
    let radarCategoryBytes=0;
    for(const frame of [...hybridFrames,...radarFrameCache.values()]){
      const buffer=frame?.categories?.buffer;
      if(buffer&&!unique.has(buffer)){
        unique.add(buffer);radarCategoryBytes+=buffer.byteLength;
      }
    }
    const mem=performance.memory;
    const heap=mem && Number.isFinite(mem.usedJSHeapSize)
      ?{usedMb:Math.round(mem.usedJSHeapSize/1048576),
         limitMb:Math.round(mem.jsHeapSizeLimit/1048576)}:null;
    return {
      source:"browser-estimate; GPU process is shared and cannot be measured per tab",
      jsHeap:heap,activeRadarFrames:hybridFrames.length,
      radarFrameCache:radarFrameCache.size,radarResultCache:radarResultCache.size,
      activeCategoryMb:Math.round(radarCategoryBytes/1048576),
      cachedProviderCount:measuredRadarProviderCache.size,
      livePrimaryGlyphs:inferredCollection?.length??0,
      secondaryGlyphs:supplementalVolumeDisplay?.glyphs??0,
      secondarySiteGlyphs:supplementalVolumeDisplay?.siteGlyphs??{},
      supplementalProviderCache:supplementalRadarDisplay?.providerCacheSize??0,
      supplementalSourceFrameCache:supplementalRadarDisplay?.sourceFrameCacheSize??0,
      supplementalCacheDiagnostics:supplementalRadarDisplay?.cacheDiagnostics??null,
      playbackTiming:playbackPerformanceMeter?.summary?.()??null,
      trackGlyphs:(hybridTrackVolumeCollection?.length??0)+
        (hybridTrackFootprintCollection?.length??0),
      cached3dFrames:volumeGeometryCache.size,
      imageryLayers:viewer.imageryLayers.length,
      deferredImageryRetirement:deferredImageryRetirement?.snapshot()??null,
      globeTileCacheLimit:scene.globe.tileCacheSize,
      canvasPixels:scene.canvas.width*scene.canvas.height,
      canvasPixelRatio:viewer.resolutionScale
    };
  };
  // Intentionally no Memory diagnostics panel in the operator sidebar.
  // Capture remains QA-only, manually callable without timers or layout.
}
const reflectivityRgbLookup = new Uint8Array(16*3);
for(const item of SOURCE_PALETTES.reflectivityRgb) {
  if(item.value>0 && item.value<16 && item.rgb) {
    reflectivityRgbLookup.set(item.rgb,item.value*3);
  }
}
async function prepareRadarSurfaceProvider(frame) {
  const prior=measuredRadarProviderCache.get(frame);
  if(prior)return prior;
  const job=(async()=>{
    const canvas=document.createElement("canvas");
    canvas.width=frame.width;
    canvas.height=frame.height;
    const context=canvas.getContext("2d");
    if(!context)throw new Error("Unable to create surface reflectivity canvas.");
    const image=context.createImageData(frame.width,frame.height);
    const rgba=image.data, categories=frame.categories;
    for(let p=0,j=0;p<categories.length;p++,j+=4) {
      const category=categories[p];
      if(category<=0||category>=16)continue;
      const rgb=category*3;
      rgba[j]=reflectivityRgbLookup[rgb];
      rgba[j+1]=reflectivityRgbLookup[rgb+1];
      rgba[j+2]=reflectivityRgbLookup[rgb+2];
      rgba[j+3]=255;
    }
    const projected=reprojectWebMercatorRgbaToGeographic(frame,rgba);
    const output=context.createImageData(frame.width,frame.height);
    output.data.set(projected);
    context.putImageData(output,0,0);
    const sw=webMercatorToDegrees(frame.georef.minX,frame.georef.minY);
    const ne=webMercatorToDegrees(frame.georef.maxX,frame.georef.maxY);
    const rectangle=Cesium.Rectangle.fromDegrees(
      sw.longitude,sw.latitude,ne.longitude,ne.latitude
    );
    return Cesium.SingleTileImageryProvider.fromUrl(
      canvas.toDataURL("image/png"),{rectangle}
    );
  })();
  // Motion previews are one-use frames. Measured and normal gap-fill frames
  // are stable and safe to cache for the current source loop.
  const transient=frame.sourceMetadata?.temporalInference?.method===
    "motion-compensated-category-warp";
  if(!transient)measuredRadarProviderCache.set(frame,job);
  try{return await job;}catch(error){
    if(!transient)measuredRadarProviderCache.delete(frame);
    throw error;
  }
}

async function renderSurface(frame,renderToken=null,{timeoutMs=2200,onBeforeReveal=null}={}) {
  const provider=await prepareRadarSurfaceProvider(frame);
  if (
    renderToken != null
    && renderToken !== hybridSceneRenderToken
  ) {
    return false;
  }

  // Retain the entire old radar surface until the replacement has actually
  // rendered and Cesium confirms its imagery tiles are available.
  const committed = await radarImageryHandover.replace(
    new Cesium.ImageryLayer(provider),
    {
      alpha: Number($("radarOpacity").value) / 100,
      timeoutMs,
      // prepareRadarSurfaceProvider only returns after source image decode.
      // Global terrain/basemap tile requests must not stall this handover.
      decodedSingleTile: true,
      beforeReveal:onBeforeReveal,
      isCurrent: () => renderToken == null ||
        renderToken === hybridSceneRenderToken
    }
  );
  if (!committed) return false;
  surfaceLayer = radarImageryHandover.currentLayer;
  // Rain reflectivity always stays above independent Doppler context.
  viewer.imageryLayers.raiseToTop(surfaceLayer);
  scene.requestRender();
  return true;
}

function estimateCandidateColumns(frame) {
  let count = 0;

  for (
    let i = 0;
    i < frame.categories.length;
    i++
  ) {
    if (
      representativeDbzForCategory(
        frame.categories[i]
      ) != null
    ) {
      count++;
    }
  }

  return count;
}

function renderInferredVolume(frame) {
  if (!model) {
    throw new Error(
      "Inferred vertical-profile model is not loaded."
    );
  }

  const signature=[
    selectedRadarRegion(),frame.observedUtc,
    $("occupancyThreshold").value,$("minimumDbzh").value,
    $("pointSize").value,$("volumeOpacity").value,
    $("verticalScale").value,useBlobVolume()?"blob":"point"
  ].join(":");
  if(!INCREMENTAL_VOLUME_PREVIEW && inferredCollection)inferredCollection.show=false;
  const previouslyBuilt=INCREMENTAL_VOLUME_PREVIEW?null:volumeGeometryCache.get(signature);
  if(previouslyBuilt){
    inferredCollection=previouslyBuilt.collection;
    inferredCollection.show=true;
    for(const [id,value] of Object.entries(previouslyBuilt.metrics))
      $(id).textContent=value;
    scene.requestRender();
    return;
  }
  if(!INCREMENTAL_VOLUME_PREVIEW){
    inferredCollection=scene.primitives.add(
      useBlobVolume()
        ? new Cesium.BillboardCollection()
        : new Cesium.PointPrimitiveCollection()
    );
  }

  const occupancyThreshold =
    Number(
      $("occupancyThreshold").value
    );

  const minimumDbzh =
    volumeDisplayThresholdDbz($("minimumDbzh").value);

  const pointSize =
    Number(
      $("pointSize").value
    );
  const volumePercent=Number($("volumeOpacity").value);

  const candidateColumns =
    estimateCandidateColumns(
      frame
    );

  // Display decimation only. The vertical-profile inference remains
  // unchanged. This prevents a large active-weather frame from trying
  // to create millions of Cesium point primitives.
  const horizontalStride = INCREMENTAL_VOLUME_PREVIEW
    ? stablePrimaryVolumeStride(frame)
    : candidateColumns > 40000
      ? 4
      : candidateColumns > 15000
        ? 3
        : candidateColumns > 6000
          ? 2
          : 1;
  if(INCREMENTAL_VOLUME_PREVIEW){
    const geo=frame.georef||{};
    // Only source footprint/geometry and inference settings reset the
    // persistent glyph collection. UTC does NOT: that is the whole point.
    const identity=[
      selectedRadarRegion(),frame.width,frame.height,
      geo.projection,geo.minX,geo.maxX,geo.minY,geo.maxY,
      horizontalStride,$("occupancyThreshold").value,
      $("minimumDbzh").value,$("pointSize").value,
      $("verticalScale").value,useBlobVolume()?"blob":"point"
    ].join(":");
    inferredCollection=incrementalVolumeRenderer.begin(
      identity,
      ()=>useBlobVolume()?new Cesium.BillboardCollection():new Cesium.PointPrimitiveCollection(),
      false // No double-buffer or fade; unchanged source cells must never blink.
    );
    inferredCollection.show=true;
  }

  let renderedPoints = 0;
  let renderedColumns = 0;

  let top40 = null;
  let top50 = null;

  let maxDbzh = null;
  let confidenceSum = 0;

  let highSupportPoints = 0;
  let mediumSupportPoints = 0;
  let lowSupportPoints = 0;

  let highSupportTop40 = null;
  let highSupportTop50 = null;

  // Each genuine BoM palette category has exactly one empirical profile.
  // Avoid recalculating its inferred vertical levels and confidence styles
  // for thousands of identical-intensity source pixels per playback frame.
  const profiles=INCREMENTAL_VOLUME_PREVIEW
    ?createVolumeCategoryProfileCache({
      model,occupancyThreshold,displayThresholdDbz:minimumDbzh,
      pointSize,representativeDbzForCategory,inferColumn,
      shouldRenderVolumePoint,styleForInferredPoint
    }):null;

  for (
    let row = 0;
    row < frame.height;
    row += horizontalStride
  ) {
    for (
      let column = 0;
      column < frame.width;
      column += horizontalStride
    ) {
      const pixelIndex =
        row * frame.width
        + column;

      const category =
        frame.categories[
          pixelIndex
        ];

      const cachedProfile=profiles?.get(category)??null;
      const inputDbzh = profiles
        ?cachedProfile?.inputDbzh
        :representativeDbzForCategory(category);

      if (inputDbzh == null) {
        continue;
      }

      const displayedInferred = profiles
        ?cachedProfile.points
        :inferColumn(model,inputDbzh,{
          occupancyThreshold,minimumOutputDbz:30
        }).filter(point=>shouldRenderVolumePoint(point.dbzh,minimumDbzh));
      if (!displayedInferred.length) {
        continue;
      }

      renderedColumns++;
      const sameGlyphs=INCREMENTAL_VOLUME_PREVIEW &&
        incrementalVolumeRenderer.unchanged(pixelIndex,category);
      const nextSpecs=INCREMENTAL_VOLUME_PREVIEW&&!sameGlyphs?[]:null;
      const mercator=(!INCREMENTAL_VOLUME_PREVIEW||!sameGlyphs)
        ?pixelCentreMercator(frame,column,row):null;
      const geographic=mercator
        ?webMercatorToDegrees(mercator.x,mercator.y):null;
      for (let level=0;level<displayedInferred.length;level++) {
        const point=displayedInferred[level];
        const supportStyle=profiles
          ?cachedProfile.styles[level]
          :styleForInferredPoint(point,{
            displayThresholdDbz:30,basePointSize:pointSize
          });

        if(!INCREMENTAL_VOLUME_PREVIEW||!sameGlyphs){
          const options={
            position:Cesium.Cartesian3.fromDegrees(
              geographic.longitude,geographic.latitude,
              displayedVolumeAltitude(
                point.altitude_m_amsl,inputDbzh,Number($("verticalScale").value))
            ),
            color:colourForDbzh(point.dbzh),
            pixelSize:supportStyle.pixelSize,
            disableDepthTestDistance:0
          };
          const support=Math.min(1.3,supportStyle.pixelSize/3);
          if(INCREMENTAL_VOLUME_PREVIEW){
            nextSpecs.push({options,alpha:supportStyle.alpha,dbz:point.dbzh,support});
          }else{
            addVolumeGlyph(inferredCollection,options,supportStyle.alpha,
              volumePercent,point.dbzh,support);
          }
        }
        renderedPoints++;
        confidenceSum +=
          point.confidence;

        if (
          supportStyle.band
          === "high"
        ) {
          highSupportPoints++;
        } else if (
          supportStyle.band
          === "medium"
        ) {
          mediumSupportPoints++;
        } else {
          lowSupportPoints++;
        }

        if (
          supportStyle.band
          === "high"
          && point.dbzh >= 40
          && (
            highSupportTop40 == null
            || point.altitude_m_amsl
              > highSupportTop40
          )
        ) {
          highSupportTop40 =
            point.altitude_m_amsl;
        }

        if (
          supportStyle.band
          === "high"
          && point.dbzh >= 50
          && (
            highSupportTop50 == null
            || point.altitude_m_amsl
              > highSupportTop50
          )
        ) {
          highSupportTop50 =
            point.altitude_m_amsl;
        }

        maxDbzh =
          maxDbzh == null
            ? point.dbzh
            : Math.max(
                maxDbzh,
                point.dbzh
              );

        if (
          point.dbzh >= 40
          && (
            top40 == null
            || point.altitude_m_amsl
              > top40
          )
        ) {
          top40 =
            point.altitude_m_amsl;
        }

        if (
          point.dbzh >= 50
          && (
            top50 == null
            || point.altitude_m_amsl
              > top50
          )
        ) {
          top50 =
            point.altitude_m_amsl;
        }
      }
      if(INCREMENTAL_VOLUME_PREVIEW){
        if(sameGlyphs) incrementalVolumeRenderer.touch(pixelIndex,category);
        else incrementalVolumeRenderer.upsert(pixelIndex,category,nextSpecs,
          spec=>addVolumeGlyph(inferredCollection,spec.options,spec.alpha,
            volumePercent,spec.dbz,spec.support),
          (glyph,spec)=>updateVolumeGlyph(glyph,spec.options,spec.alpha,
            volumePercent,spec.dbz,spec.support));
      }
    }
  }

  $("renderedColumns").textContent =
    renderedColumns.toLocaleString();

  $("renderedPoints").textContent =
    renderedPoints.toLocaleString();

  $("adaptiveStride").textContent =
    `${horizontalStride} px`;

  $("maxInferredDbzh").textContent =
    maxDbzh == null
      ? "none"
      : `${maxDbzh.toFixed(1)} dBZ`;

  $("inferredTop40").textContent =
    top40 == null
      ? "none"
      : `${(top40 / 1000).toFixed(1)} km`;

  $("inferredTop50").textContent =
    top50 == null
      ? "none"
      : `${(top50 / 1000).toFixed(1)} km`;

  $("meanConfidence").textContent =
    renderedPoints
      ? (
          confidenceSum
          / renderedPoints
        ).toFixed(2)
      : "—";

  $("highSupportPoints").textContent =
    highSupportPoints
      .toLocaleString();

  $("mediumSupportPoints").textContent =
    mediumSupportPoints
      .toLocaleString();

  $("lowSupportPoints").textContent =
    lowSupportPoints
      .toLocaleString();

  $("highSupportTop40").textContent =
    highSupportTop40 == null
      ? "none"
      : `${(
          highSupportTop40
          / 1000
        ).toFixed(1)} km`;

  $("highSupportTop50").textContent =
    highSupportTop50 == null
      ? "none"
      : `${(
          highSupportTop50
          / 1000
        ).toFixed(1)} km`;

  if(INCREMENTAL_VOLUME_PREVIEW){
    const delta=incrementalVolumeRenderer.end();
    // Non-scientific render diagnostics (never fed into storm tracks).
    $("renderedPoints").title=
      `Incremental 3-D: ${delta.changedColumns} changed sampled columns; `+
      `${delta.glyphChanges} glyph changes; `+
      (delta.animated?"local morph":"stable/instant")+
      "; original BoM reflectivity unchanged";
  }else{
    volumeGeometryCache.put(signature,{
      collection:inferredCollection,
      metrics:Object.fromEntries(VOLUME_METRIC_IDS.map(id=>[id,$(id).textContent]))
    });
  }
  scene.requestRender();
}


function sameObservedInstant(
  left,
  right
) {
  const leftTime =
    Date.parse(left);

  const rightTime =
    Date.parse(right);

  return (
    Number.isFinite(leftTime)
    && Number.isFinite(rightTime)
    && leftTime === rightTime
  );
}

function trackColour(trackId) {
  const number =
    Number(
      String(trackId).replace(/\D/g, "")
    ) || 1;

  return Cesium.Color.fromHsl(
    (number * 0.61803398875) % 1,
    0.78,
    0.58,
    1
  );
}

function selectedTrackId() {
  return selectedTrackDisplayId || null;
}

function trackObservationForFrame(track, index) {
  return track?.history?.find(item =>
    sameObservedInstant(
      item.observed_utc,
      hybridFrames[index]?.observedUtc
    )
  ) ?? null;
}

function hasTrackSpecificVolume(
  index
) {
  const volumeMap = hybridTrackVolumes[index];
  const wanted = selectedTrackId();
  return wanted
    ? Boolean(volumeMap?.has(wanted))
    : (volumeMap?.size ?? 0) > 0;
}

function updateTrackDisplayControls(index) {
  const select = $("trackDisplayFilter");
  const result = hybridResults[index];
  if (!select) return;

  if (!result) {
    select.innerHTML =
      '<option value="">Inferred display frame · no measured tracks</option>';
    select.disabled = true;
    const cone = $("showTrackThreatCone");
    if (cone) {
      // Preserve the user's cone preference through inferred display-only
      // gap-fill; it resumes on the next genuinely observed radar frame.
      cone.disabled = true;
    }
    const status = $("trackThreatConeStatus");
    if (status) {
      status.textContent =
        "Motion cone paused on inferred display frame; resumes at next measured observation.";
    }
    return;
  }

  select.disabled = false;

  const frameTracks = (result.tracks ?? [])
    .filter(track => trackObservationForFrame(track, index))
    .sort((a, b) => a.track_id.localeCompare(b.track_id));

  const options = [
    `<option value="">All tracks (${frameTracks.length})</option>`,
    ...frameTracks.map(track =>
      `<option value="${track.track_id}">${track.track_id} · ${track.observation_count} obs</option>`
    )
  ];

  if (selectedTrackDisplayId && !frameTracks.some(track => track.track_id === selectedTrackDisplayId)) {
    options.push(`<option value="${selectedTrackDisplayId}">${selectedTrackDisplayId} · not in this frame</option>`);
  }

  select.innerHTML = options.join("");
  select.value = selectedTrackDisplayId;

  const selectedTrack = selectedTrackDisplayId
    ? (result.tracks ?? []).find(track => track.track_id === selectedTrackDisplayId)
    : null;
  const observation = selectedTrack
    ? trackObservationForFrame(selectedTrack, index)
    : null;
  const cone = $("showTrackThreatCone");
  const status = $("trackThreatConeStatus");
  const measuredMotion = observation && selectedTrack
    ? measuredTrackMotionAtObservation(selectedTrack, observation) : null;
  const canProject = Boolean(
    selectedTrackDisplayId && observation && measuredMotion &&
    measuredMotion.speed_kmh > 0 && measuredMotion.speed_kmh <= 160
  );
  cone.disabled = !canProject;
  if (!selectedTrackDisplayId) cone.checked = false;
  if (status) {
    status.textContent = !selectedTrackDisplayId
      ? "Select one track to enable the +90-minute motion cone."
      : canProject
        ? `${selectedTrackDisplayId}: +90-minute constant-motion cone available.`
        : `${selectedTrackDisplayId}: motion cone unavailable in this frame.`;
  }
}

function resetTrackDisplaySelection() {
  selectedTrackDisplayId = "";
  if ($("trackDisplayFilter")) $("trackDisplayFilter").value = "";
  if ($("showTrackThreatCone")) {
    $("showTrackThreatCone").checked = false;
    $("showTrackThreatCone").disabled = true;
  }
}

function useTrackSpecificVolume(index) {
  // Measured-track volume is the permanent 3-D mode for observed frames.
  // A missing track, or temporal gap-fill frame, cannot invent a measured volume.
  return !isTemporallyInferredRadarFrame(hybridFrames[index])
    && hasTrackSpecificVolume(index);
}

function applyHybridVolumeMode(
  index
) {
  const wanted = selectedTrackId();
  const trackVolumesRequested = true; // Permanent operational mode; no toggle.
  const temporalInferred =
    isTemporallyInferredRadarFrame(
      hybridFrames[index]
    );
  const useTrackSpecific = useTrackSpecificVolume(index);

  if (inferredCollection) {
    // QA always presents the SAME frame-wide inference geometry on observed
    // and gap-fill frames. Previous observed-track / gap-fill alternation
    // switched whole clouds on and off every scan (video-proven flicker).
    inferredCollection.show=INCREMENTAL_VOLUME_PREVIEW ? true :
      temporalInferred
        ? true
        : wanted && trackVolumesRequested
          ? false
          : !useTrackSpecific;
  }

  const mode = $("hybridVolumeMode");
  if (mode) {
    mode.textContent = INCREMENTAL_VOLUME_PREVIEW
      ? "Stable frame-wide inferred 3-D · display only (QA)"
      : temporalInferred
      ? "Temporal gap-fill · frame-wide inferred"
      : useTrackSpecific
        ? (wanted ? `Selected ${wanted} · observed 2-D echo + inferred 3-D`
          : "Measured tracks · observed 2-D echo + inferred 3-D")
        : wanted && trackVolumesRequested
          ? `Selected ${wanted} · no track volume in frame`
          : trackVolumesRequested
            ? "Frame-wide fallback (no measured track)"
            : "Frame-wide inferred";
  }

  scene.requestRender();
  return useTrackSpecific;
}

function trackPointSize(
  supportBand
) {
  const base =
    Number(
      $("pointSize").value
    );

  const scale =
    supportBand === "high"
      ? 1.0
      : supportBand === "medium"
        ? 0.82
        : 0.62;

  return Math.max(
    1.0,
    base * scale
  );
}

function clearHybridTrackVolumeCollection() {
  if (
    hybridTrackVolumeCollection
  ) {
    scene.primitives.remove(
      hybridTrackVolumeCollection
    );
    hybridTrackVolumeCollection=null;
  }
  if(hybridTrackFootprintCollection){
    scene.primitives.remove(hybridTrackFootprintCollection);
    hybridTrackFootprintCollection=null;
  }
}

 // Own the ENTIRE reflectivity-only presentation: track ID markers, history
 // trails, +90-minute cones, Cesium track glyphs and selection controls.
 // Switching to Doppler clears rather than merely toggles visibility so a
 // paused frame or any later toggle cannot resurrect obsolete geometry.
 function clearReflectivityForDoppler() {
   clearReflectivityOverlaysForDoppler({
     trackSource: hybridSource,
     trackLabels: stormTrackLabelOverlay,
     severeAlerts: severeStormAlertOverlay,
     clearTrackVolumes: clearHybridTrackVolumeCollection,
     inferredVolume: inferredCollection,
     resetSelection: resetTrackDisplaySelection,
     requestRender: () => scene.requestRender()
   });
   $("trackDisplayFilter").disabled = true;
   $("showTrackLabels").disabled = true;
 }
 
function canvasImageData(
  canvas
) {
  return canvas
    .getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
    )
    .getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );
}

function dopplerDisplayColour(
  velocity
) {
  const value =
    Number(
      velocity
    );

  if (
    value < 0
  ) {
    const strength =
      Math.min(
        1,
        Math.abs(
          value
        ) / 70
      );

    return Cesium.Color
      .fromHsl(
        0.56,
        0.95,
        0.72
          - strength * 0.32,
        0.78
      );
  }

  const strength =
    Math.min(
      1,
      value / 70
    );

  return Cesium.Color
    .fromHsl(
      0.13
        - strength * 0.12,
      0.95,
      0.62
        - strength * 0.18,
      0.78
    );
}

function dopplerCrossfadeDurationMs() {
  const playbackDelay =
    playbackDelayForSpeed(
      selectedPlaybackSpeed()
    );

  return Math.max(
    100,
    Math.min(
      180,
      Math.round(
        playbackDelay * 0.45
      )
    )
  );
}

function clearDopplerOverlay({
  smooth = false
} = {}) {
  supplementalDopplerDisplay.setEnabled(false);
  dopplerOverlayRenderToken++;

  dopplerOverlayTransition.clear({
    durationMs:
      smooth
        ? Math.min(
            DEFAULT_DOPPLER_FADE_OUT_MS,
            dopplerCrossfadeDurationMs()
          )
        : 0
  });

  const count =
    $("dopplerOverlayCount");

  if (count) {
    count.textContent =
      "0";
  }
}

function dopplerCanvasForFrame(frame, samples) {
  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create Doppler overlay canvas.");
  const southWest = webMercatorToDegrees(frame.georef.minX, frame.georef.minY);
  const northEast = webMercatorToDegrees(frame.georef.maxX, frame.georef.maxY);
  const longitudeSpan = northEast.longitude - southWest.longitude;
  const latitudeSpan = northEast.latitude - southWest.latitude;
  let rendered = 0;
  for (const sample of samples) {
    if (!Number.isFinite(sample.longitude) || !Number.isFinite(sample.latitude)) continue;
    const x = (sample.longitude - southWest.longitude) / longitudeSpan * canvas.width;
    const y = (northEast.latitude - sample.latitude) / latitudeSpan * canvas.height;
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;
    const rgb = sample.palette_rgb;
    context.fillStyle = rgb
      ? `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`
      : dopplerDisplayColour(sample.velocity_kmh).toCssColorString();
    context.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    rendered++;
  }
  return {
    canvas,
    rectangle: Cesium.Rectangle.fromDegrees(
      southWest.longitude, southWest.latitude,
      northEast.longitude, northEast.latitude
    ),
    rendered
  };
}

async function decodeHistoricalDopplerFrame(
  radarId,
  frameDescriptor,
  palettes = dopplerPalettes
) {
  const key =
    `${radarId}:${frameDescriptor.filename}`;

  if (
    dopplerFrameCache
      .has(
        key
      )
  ) {
    return dopplerFrameCache
      .get(
        key
      );
  }

  const promise =
    (
      async () => {
        const source =
          await loadDopplerFrame(
            radarId,
            frameDescriptor
          );

        const palette =
          palettes
            .get(
              String(
                radarId
              )
            );

        if (!palette) {
          throw new Error(
            `No calibrated Doppler palette for radar ${radarId}.`
          );
        }

        const sourceImageData =
          canvasImageData(
            source.canvas
          );

        const decoded =
          geolocatedHistoricalDopplerSamples(
            radarId,
            sourceImageData,
            palette,
            {
              stride:
                1,

              includeZero:
                false
            }
          );

        const nativePanel = extractNativeDopplerPanel(sourceImageData, palette, {
          // The optional BoM map overlays are separate, but the scan footer
          // is still embedded in archived PNGs; clean DISPLAY copies only.
          maskAnnotationRows:true
        });

        return {
          radarId:
            String(
              radarId
            ),

          product:
            source.product,

          observedUtc:
            source.observedUtc
            ?? frameDescriptor.observedUtc,

          timeBasis:
            source.timeSource
            ?? "bom-history-filename-utc",

          filename:
            frameDescriptor.filename,

          validPixelCount:
            decoded.validPixelCount,

          nonZeroPixelCount:
            decoded.nonZeroPixelCount,

          samples:
            decoded.samples,

          displayPixelCount: nativePanel.nativePixelCount,
          nativePanel
        };
      }
    )();

  dopplerFrameCache.set(
    key,
    promise
  );

  try {
    return await promise;
  } catch (error) {
    dopplerFrameCache.delete(
      key
    );

    throw error;
  }
}

async function loadDopplerHistoriesAndPalettes() {
  const radarIds = selectedSourceRadars();

  const settled =
    await Promise.allSettled(
      radarIds.map(
        async radarId => {
          const [
            history,
            latest
          ] =
            await Promise.all([
              loadDopplerHistory(
                radarId
              ),

              loadDopplerDiagnostic(
                radarId
              )
            ]);

          const latestImageData =
            canvasImageData(
              latest.canvas
            );

          const palette =
            paletteFromLatestDopplerImage(
              latestImageData
            );

          const decodedLatest =
            geolocatedHistoricalDopplerSamples(
              radarId,
              latestImageData,
              palette,
              {
                stride:
                  1,

                includeZero:
                  false
              }
            );

          const nativePanel = extractNativeDopplerPanel(latestImageData, palette);

          return {
            radarId,

            history,

            palette,

            latestRecord: {
              radarId:
                String(
                  radarId
                ),

              product:
                latest.product,

              observedUtc:
                latest.observedUtc,

              timeBasis:
                latest.timeSource
                ?? "bom-product-page-received-at",

              filename:
                `${latest.product}.gif`,

              validPixelCount:
                decodedLatest.validPixelCount,

              nonZeroPixelCount:
                decodedLatest.nonZeroPixelCount,

              samples:
                decodedLatest.samples,

              displayPixelCount: nativePanel.nativePixelCount,
              nativePanel
            }
          };
        }
      )
    );

  const histories =
    new Map();

  const palettes =
    new Map();

  const latestRecords =
    new Map();

  for (
    const result
    of settled
  ) {
    if (
      result.status
      !== "fulfilled"
    ) {
      continue;
    }

    histories.set(
      result.value.radarId,
      result.value.history
    );

    palettes.set(
      result.value.radarId,
      result.value.palette
    );

    if (
      result.value.latestRecord
        ?.observedUtc
    ) {
      latestRecords.set(
        result.value.radarId,
        result.value.latestRecord
      );
    }
  }
  const errors = new Map(settled.flatMap((result, index) => result.status === "rejected"
    ? [[radarIds[index], result.reason?.message ?? "Doppler source unavailable"]] : []));
  return { histories, palettes, latestRecords, errors };
}

async function prepareDopplerState(entry, sources) {
  const pairings = entry.pairings.map(pair => ({ ...pair }));
  const loadResults =
    await Promise.allSettled(
      pairings.map(
        pairing => {
          if (
            !pairing.matched
            || !pairing.candidate
          ) {
            return Promise.resolve({
              radarId:
                pairing.radarId,

              observedUtc:
                pairing.candidate
                  ?.observedUtc
                ?? null,

              timeBasis:
                "bom-history-filename-utc",

              filename:
                pairing.candidate
                  ?.filename
                ?? null,

              samples:
                []
            });
          }

          if (
            pairing.candidate
              .source_kind
            === "latest"
          ) {
            const latestRecord =
              sources.latestRecords
                .get(
                  pairing.radarId
                );

            if (!latestRecord) {
              throw new Error(
                `Latest BOM Doppler unavailable for radar ${pairing.radarId}.`
              );
            }

            return Promise.resolve(
              latestRecord
            );
          }

          return decodeHistoricalDopplerFrame(
            pairing.radarId,
            pairing.candidate,
            sources.palettes
          );
        }
      )
    );

  const records =
    [];

  let sourceFailures =
    0;

  for (
    let index = 0;
    index < pairings.length;
    index++
  ) {
    const pairing =
      pairings[
        index
      ];

    const load =
      loadResults[
        index
      ];

    if (
      load.status
      === "fulfilled"
    ) {
      if (pairing.matched && (!Number.isFinite(Date.parse(load.value.observedUtc)) || Math.abs(Date.parse(load.value.observedUtc) - Date.parse(entry.observedUtc)) > 8 * 60000)) {
        pairing.matched = false;
        pairing.loadError = `Doppler ${pairing.radarId} returned an invalid/out-of-window source timestamp.`;
        // A successfully decoded but rejected response must not poison retries.
        dopplerFrameCache.delete(`${pairing.radarId}:${pairing.candidate?.filename}`);
        sourceFailures++;
      }
      records.push(load.value);
    } else {
      sourceFailures++;
      pairing.matched = false;
      pairing.loadError = load.reason?.message ?? "Doppler image unavailable";

      records.push({
        radarId:
          pairing.radarId,

        observedUtc:
          pairing.candidate
            ?.observedUtc
          ?? null,

        timeBasis:
          "bom-history-filename-utc",

        filename:
          pairing.candidate
            ?.filename
          ?? null,

        samples:
          []
      });
    }
  }

  return { reflectivityUtc: entry.observedUtc, pairings, records, sourceFailures };
}

async function buildDopplerSequence() {
  hybridDopplerFrameStates = hybridFrames.map((frame, frameIndex) => {
    const state = preparedDopplerStates[frameIndex];
    const result = hybridResults[frameIndex];
    return {
      ...state,
      frameIndex,
      context: buildTrackDopplerContexts({
        frame,
        segmentation: result?.segmentations?.[0],
        tracks: result?.tracks ?? [],
        dopplerRecords: state.records.filter(record => QLD_RADAR_SITES[record.radarId]?.analysisGeorefVerified),
        maxTimeDeltaMinutes: 8,
        minimumSamples: 3
      })
    };
  });
}

function dopplerStateForFrame(
  index
) {
  return (
    hybridDopplerFrameStates[
      index
    ]
    ?? null
  );
}

function syncSevereStormAlerts(index) {
  // Preserve the research implementation for isolated previews, but do not
  // calculate or display experimental classifications in production.
  return;
  const frame = hybridFrames[index];
  const result = hybridResults[index];
  const previousFrame = hybridFrames[index - 1] ?? null;
  const previousResult = hybridResults[index - 1] ?? null;
  const detection = buildSevereStormFrameAlerts({
    frame, result, previousFrame, previousResult,
    dopplerState: dopplerStateForFrame(index),
    enableExperimentalHook: false
  });
  severeStormAlertOverlay.setFrame({
    alerts: detection.alerts,
    observedFrame: Boolean(frame && result && !frame.sourceMetadata?.temporalInference),
    windSupported: detection.windSourceSupported,
    experimentalHook: false,
    displayedUtc: frame?.observedUtc ?? null,
    atNewestFrame: index === hybridFrames.length - 1
  });
}

function dopplerContextForTrack(
  index,
  trackId
) {
  return (
    dopplerStateForFrame(
      index
    )
      ?.context
      ?.contextByTrack
      ?.get(
        trackId
      )
    ?? null
  );
}

function selectedDopplerRecord(
  index
) {
  const radarId =
    $("dopplerOverlayRadar")
      ?.value
    ?? "66";

  const state =
    dopplerStateForFrame(
      index
    );

  if (!state) {
    return null;
  }

  const pairing =
    state.pairings
      .find(
        item =>
          item.radarId
          === radarId
      );

  if (
    !pairing
    || !pairing.matched
  ) {
    return null;
  }

  return (
    state.records
      .find(
        record =>
          record.radarId
          === radarId
          && Array.isArray(record.displaySamples)
      )
    ?? null
  );
}

function formatDopplerUtc(value) {
  return formatProductTime(value);
}

function renderDopplerVelocityLegend(
  radarId
) {
  const output =
    $("dopplerVelocityLegend");

  if (!output) {
    return;
  }

  const palette =
    dopplerPalettes
      .get(
        String(
          radarId
        )
      );

  if (
    !palette
    || !palette.swatches
      ?.length
  ) {
    output.innerHTML =
      '<span class="hybrid-muted">Doppler velocity palette unavailable.</span>';

    return;
  }

  output.innerHTML = '<div class="velocity-scale">' + palette.swatches.map(swatch => {
    const label = swatch.velocity_kmh > 0 ? `+${swatch.velocity_kmh}` : String(swatch.velocity_kmh);
    return `<span class="velocity-step" title="${label} km/h radial velocity"><i style="background:rgb(${swatch.rgb.join(',')})"></i><span>${label}</span></span>`;
  }).join("") + '</div><div class="velocity-directions"><span>Blue: toward radar</span><span>Yellow/red: away</span></div>';

}

// The original 512 × 512 BoM velocity panel supplies EVERY displayed RGB
// pixel. Only the native velocity mask is retained; map/footer decoration is
// excluded, and the original pixels are inverse-warped onto the map without
// synthesising velocities or painting 2 × 2 decoded point squares.
function independentDopplerCanvas(radarId, record) {
  if (record.nativeOverlay) return record.nativeOverlay;
  const projected = reprojectNativeDopplerPanel(radarId, record.nativePanel);
  const canvas = document.createElement("canvas");
  canvas.width = projected.width;
  canvas.height = projected.height;
  const context = canvas.getContext("2d");
  if (!context) throw Error("No 2-D canvas available for native BoM Doppler image");
  context.putImageData(
    new ImageData(projected.data, projected.width, projected.height),
    0, 0
  );
  record.nativeOverlay = {
    canvas,
    rendered: record.nativePanel.nativePixelCount,
    rectangle: Cesium.Rectangle.fromDegrees(
      projected.bounds.west, projected.bounds.south,
      projected.bounds.east, projected.bounds.north
    )
  };
  return record.nativeOverlay;
}

// Once decoded and projected, the same native BoM Doppler scan is reused
// across every playback cycle. Provider preparation never changes UI state.
function prepareNativeDopplerProvider(radarId,record) {
  if(record.nativeProvider) return record.nativeProvider;
  const raster=independentDopplerCanvas(radarId,record);
  const promise=Cesium.SingleTileImageryProvider.fromUrl(
    raster.canvas.toDataURL("image/png"),{rectangle:raster.rectangle}
  );
  record.nativeProvider=promise;
  return promise;
}
async function prepareWindObservation(index) {
  const radarId=$("dopplerOverlayRadar").value;
  const frame=independentDopplerFrames[index];
  if(!radarId || !frame)throw Error("No genuine Doppler observation for this shared step");
  const record=frame.source_kind==="latest"
    ? dopplerLatestRecords.get(radarId)
    : await decodeHistoricalDopplerFrame(radarId,frame);
  if(!record?.nativePanel?.data)throw Error("Native BoM Doppler image unavailable at "+frame.observedUtc);
  const provider=await prepareNativeDopplerProvider(radarId,record);
  return {radarId,index,frame,record,provider};
}
async function commitWindObservation(prepared,{updateUi=true,renderToken=null}={}) {
  // Never restore wind from a stale asynchronous render after rain-only
  // selection has already removed the combined Doppler layer.
  if (!shouldDisplayDopplerForSelectedWindow())
    throw Error("Combined Doppler display was disabled during wind preparation");
  if(!prepared || $("dopplerOverlayRadar").value!==prepared.radarId)
    throw Error("Doppler site changed while preparing wind scan");
  const {radarId,index,record,provider}=prepared;
  const key=dopplerOverlayFrameKey(radarId,record);
  if(dopplerOverlayTransition.currentKey!==key){
    // The new decoded native BoM image is staged behind the current scan
    // and allowed to render before the short display-only blend begins.
    const handover=await dopplerOverlayTransition.replacePrepared({
      layer:new Cesium.ImageryLayer(provider),key,
      alpha:1, // native standalone Doppler is always fully opaque
      durationMs:dopplerCrossfadeDurationMs(),
      onAdded:()=>{if(surfaceLayer)viewer.imageryLayers.raiseToTop(surfaceLayer);}
    });
    if(handover?.cancelled || handover?.ready===false) return false;
  }
  if((renderToken!=null && renderToken!==hybridSceneRenderToken) ||
     !shouldDisplayDopplerForSelectedWindow()) return false;
  dopplerOverlayRenderToken++; // Invalidate a superseded pending async overlay.
  independentDopplerRequest++; // Invalidate older wind-frame preparations.
  independentDopplerIndexValue=index;
  independentDopplerSourceId=radarId;
  independentDopplerRecord=record;
  windCycleCursor=index;
  windLastRadarDriveKey=null;
  if(updateUi) updateIndependentDopplerUi();
  $("dopplerOverlayCount").textContent=record.nativePanel.nativePixelCount.toLocaleString();
  $("dopplerOverlayStatus").textContent=radarId+" · "+
    formatDopplerUtc(record.observedUtc)+" · native BoM Doppler imagery";
  scene.requestRender();
  return true;
}
async function prepareWindForPlayback(index) {
  if(!shouldDisplayDopplerForSelectedWindow() || !hybridCombinedSchedule.length)
    return null;
  const scheduled=hybridCombinedSchedule[index];
  if(!scheduled?.dopplerObservedUtc)throw Error("Combined window has no measured Doppler at frame "+index);
  const next=independentDopplerFrames.findIndex(frame=>
    frame.observedUtc===scheduled.dopplerObservedUtc);
  if(next<0)throw Error("Combined wind scan is missing at "+scheduled.dopplerObservedUtc);
  return prepareWindObservation(next);
}

function renderDopplerOverlay() {
  const radarId=$("dopplerOverlayRadar").value;
  renderDopplerVelocityLegend(radarId);
  const token=++dopplerOverlayRenderToken;
  const status=$("dopplerOverlayStatus");
  if(!shouldDisplayDopplerForSelectedWindow()){
    dopplerOverlayTransition.clear();
    $("dopplerOverlayCount").textContent="0";
    if(status)status.textContent="hidden";
    return;
  }
  const record=independentDopplerSourceId===radarId?independentDopplerRecord:null;
  if(!record){
    dopplerOverlayTransition.clear();
    $("dopplerOverlayCount").textContent="0";
    if(status)status.textContent=radarId+" — independent Doppler observation loading";
    return;
  }
  const key=dopplerOverlayFrameKey(radarId,record);
  const opacity=1; // standalone Doppler is fixed at 100%
  if(key&&dopplerOverlayTransition.currentKey===key){
    dopplerOverlayTransition.setOpacity(opacity);
    if(status)status.textContent=radarId+" · "+formatDopplerUtc(record.observedUtc)+" · independent Doppler";
    return;
  }
  const raster=independentDopplerCanvas(radarId,record);
  $("dopplerOverlayCount").textContent=raster.rendered.toLocaleString();
  if(status)status.textContent=radarId+" · "+formatDopplerUtc(record.observedUtc)+" · native BoM Doppler imagery";
  prepareNativeDopplerProvider(radarId,record).then(provider=>{
    if(token!==dopplerOverlayRenderToken||!shouldDisplayDopplerForSelectedWindow()||
       independentDopplerSourceId!==radarId)return;
    dopplerOverlayTransition.replace({
      layer:new Cesium.ImageryLayer(provider),key,alpha:opacity,
      durationMs:0,
      onAdded:()=>{if(surfaceLayer)viewer.imageryLayers.raiseToTop(surfaceLayer);}
    });
  }).catch(error=>{
    if(token!==dopplerOverlayRenderToken)return;
    dopplerOverlayTransition.clear({durationMs:DEFAULT_DOPPLER_FADE_OUT_MS});
    if(status)status.textContent=radarId+" · wind imagery failed";
    console.warn("Independent Doppler imagery failed",error);
  });
}

function formatDualClock(utc) {
  return formatProductTime(utc,{compact:true}).split(" / ")[0];
}
function updateDualSourceTimes() {
  // The original green #status already displays the frame and AEST/UTC.
  // No additional white rain-radar clock may be reintroduced below it.
  // Keep only the separate Doppler time when an independent Doppler source
  // is the active product; this does not modify radar observation timing.
  const windUtc=shouldDisplayDopplerForSelectedWindow() ? independentDopplerRecord?.observedUtc : null;
  const wind=$("dopplerPlaybackTime"), gap=$("sourceTimeGap");
  const windOnly=isNativeDopplerPlayback();
  $("windClockGroup").hidden=!windOnly;
  if(wind){
    wind.textContent=!shouldDisplayDopplerForSelectedWindow() ? "Rain only" :
      windUtc ? formatDualClock(windUtc) : "Loading";
    wind.title=windUtc ? formatProductTime(windUtc) : "No measured Doppler frame displayed";
  }
  // No combined visual timeline remains: one clock belongs to the active
  // rain-only OR wind-only playback, never a misleading source-time delta.
  if(gap)gap.hidden=true;
}
function updateIndependentDopplerUi() {
  const active=shouldDisplayDopplerForSelectedWindow();
  const total=independentDopplerFrames.length;
  const item=independentDopplerFrames[independentDopplerIndexValue];
  const timestamp=item ? formatDopplerUtc(item.observedUtc) : "No source frames";
  updateDualSourceTimes();
  $("dopplerFrameTime").textContent=active&&independentDopplerRecord?formatDopplerUtc(independentDopplerRecord.observedUtc):"—";
  $("dopplerRadarsLoaded").textContent=active&&independentDopplerRecord?"1":"0";
  $("dopplerRadarsMatched").textContent="—";
  $("dopplerTracksMatched").textContent="—";
  $("dopplerFailures").textContent=String(windSourceFailCount);
  $("dopplerSourceRows").textContent=active&&item
    ? "Radar "+independentDopplerSourceId+" · "+timestamp+
      " · "+item.filename+" · independent original UTC" : "Wind source idle";
}

async function showIndependentDopplerFrame(nextIndex) {
  const generation=++independentDopplerRequest;
  if(!isDopplerSourceActive() || !independentDopplerFrames.length)return;
  const index=Math.max(0,Math.min(independentDopplerFrames.length-1,Number(nextIndex)));
  const prepared=await prepareWindObservation(index);
  if(generation!==independentDopplerRequest || !isDopplerSourceActive())return;
  return await commitWindObservation(prepared);
}

async function refreshIndependentDopplerHistory(automatic=false) {
  if(independentDopplerLoading||!isDopplerSourceActive())return;
  const radarId=$("dopplerOverlayRadar").value;
  const region=selectedRadarRegion();
  independentDopplerLoading=true;
  try {
    // The Doppler source is fetched independently, never from the radar loop.
    const sources=await loadDopplerHistoriesAndPalettes();
    if(region!==selectedRadarRegion()||radarId!==$("dopplerOverlayRadar").value)return;
    if(isNativeDopplerPlayback())void supplementalDopplerDisplay.refresh();
    dopplerHistories=sources.histories;
    dopplerPalettes=sources.palettes;
    dopplerLatestRecords=sources.latestRecords;
    // The BoM page composites 'locations', 'range' and other map layers.
    // Its latest GIF carries annotation ink; those pixels must NEVER enter
    // native wind animation. The timestamped .T.YYYYMMDDHHMM.png files are
    // the separate velocity-only image layer from BoM's radar loop.
    // Preserve the latest GIF for source clock/palette SCIENCE only.
    const frames=buildIndependentDopplerFrames(
      sources.histories.get(radarId),null);
    const previous=independentDopplerFrames;
    const previousIndex=independentDopplerIndexValue;
    const nextIndex=independentDopplerIndex(frames,previous,previousIndex);
    // The shared Play/Pause button belongs to the radar timeline.
    // Doppler refresh must never pause, stop or gate it.
    independentDopplerFrames=frames;
    independentDopplerIndexValue=nextIndex;
    if(availableRadarHistoryTimes.length)updateRadarHistoryOptions(availableRadarHistoryTimes);
    if(!frames.length){
      independentDopplerRecord=null;
      independentDopplerSourceId=null;
      clearDopplerOverlay();
      updateIndependentDopplerUi();
      throw Error("No actual Doppler observations published for "+radarId);
    }
    // If a newly published wind frame could not be combined on the last
    // attempt (e.g. transient missing radar tile), retry every five minutes
    // until that real timestamp is incorporated, without falsely claiming
    // the displayed shared loop has advanced.
    if(automatic && selectedLoopSelection()===DOPPLER_AVAILABLE_LOOP_VALUE &&
       isNativeDopplerPlayback()) {
      if(hasNewDopplerWindow() && !sequenceLoading)
        void runSourceLoad(()=>loadHybridSequence(true),true);
      // Metadata polling must not drive unrelated wind frames on-screen.
      return;
    }
    if(selectedLoopSelection()===DOPPLER_AVAILABLE_LOOP_VALUE &&
       isNativeDopplerPlayback()) return;
    if(automatic && selectedLoopSelection()===DOPPLER_AVAILABLE_LOOP_VALUE &&
       hasNewDopplerWindow() && hybridCombinedSchedule.length) {
      $("autoRefreshNote").textContent =
        "New Doppler source frame · synchronising radar and wind loop…";
      if(!sequenceLoading) {
        void runSourceLoad(()=>loadHybridSequence(true),true);
      }
      return;
    }
    if(automatic && selectedLoopSelection()===DOPPLER_AVAILABLE_LOOP_VALUE &&
       hybridCombinedSchedule.length) {
      // Same source timestamp: refresh metadata only. Never jump the wind
      // layer to newest and desynchronise an already playing shared cycle.
      return;
    }
    if (!shouldDisplayDopplerForSelectedWindow()) {
      // Keep genuine source history fresh in rain-only mode, but don't decode
      // or commit wind imagery until a combined window is explicitly selected.
      // This avoids unnecessary CPU work and a stale wind-layer resurrection.
      windCycleCursor=nextIndex;
      return;
    }
    // A single bad historical PNG cannot prevent the remainder from playing.
    let loaded=false;
    for(let offset=0;offset<frames.length;offset++){
      const candidate=(nextIndex-offset+frames.length)%frames.length;
      try { await showIndependentDopplerFrame(candidate); loaded=true; break; }
      catch(error){console.warn("Skipping unreadable wind scan",frames[candidate].observedUtc,error);}
    }
    if(!loaded)throw Error("No decoded Doppler image available in recent source history");
    windCycleCursor=independentDopplerIndexValue;
  }finally{
    independentDopplerLoading=false;
    updateIndependentDopplerUi();
    // A radar-site switch can invalidate an in-flight wind request.
    // Immediately fetch the newly selected source after it finishes.
    if(isDopplerSourceActive() &&
       (region!==selectedRadarRegion()||radarId!==$("dopplerOverlayRadar").value)) {
      void refreshIndependentDopplerHistory(false).catch(error=>{
        $("dopplerOverlayStatus").textContent=error.message;
      });
    }
  }
}

function updateDopplerUiForFrame(
  index
) {
  const state =
    dopplerStateForFrame(
      index
    );

  if (!state) {
    $("dopplerRadarsLoaded")
      .textContent =
        "0";

    $("dopplerRadarsMatched")
      .textContent =
        "0";

    $("dopplerTracksMatched")
      .textContent =
        "0";

    $("dopplerFailures")
      .textContent =
        "0";

    $("dopplerFrameTime")
      .textContent =
        "—";

    $("dopplerSourceRows")
      .innerHTML =
        '<div class="hybrid-muted">Wind source not available.</div>';

    renderDopplerOverlay();

    return;
  }

  const matched =
    state.pairings
      .filter(
        pairing =>
          pairing.matched
      )
      .length;

  const loaded =
    state.records
      .filter(
        record =>
          record.samples
            ?.length
      )
      .length;

  $("dopplerRadarsLoaded")
    .textContent =
      String(
        loaded
      );

  $("dopplerRadarsMatched")
    .textContent =
      String(
        matched
      );

  $("dopplerTracksMatched")
    .textContent =
      String(
        state.context
          ?.tracks_with_doppler
        ?? 0
      );

  $("dopplerFailures")
    .textContent =
      String(
        state.sourceFailures
      );

  $("dopplerFrameTime")
    .textContent =
      formatDopplerUtc(
        state.reflectivityUtc
      );

  $("dopplerSourceRows")
    .innerHTML =
      state.pairings
        .map(
          pairing => {
            const candidate =
              pairing.candidate;

            const delta =
              pairing.deltaMinutes;

            const matchText =
              pairing.matched
                ? "MATCH"
                : "NO MATCH";

            return (
              `<div class="track-volume-row">` +
                `<div>` +
                  `<strong>Radar ${pairing.radarId}</strong>` +
                  `<span>${formatDopplerUtc(candidate?.observedUtc)}</span>` +
                  `<span>${
                    delta == null
                      ? "delta —"
                      : `Δ${delta.toFixed(1)} min`
                  }</span>` +
                  `<span>${matchText}</span>` +
                `</div>` +
                `<div>` +
                  `<span>${
                    candidate?.source_kind === "latest"
                      ? "source: BOM current IDRnnnI.gif"
                      : "source: BOM timestamped history PNG"
                  }</span>` +
                  `<span>${candidate?.filename ?? "no historical candidate"}</span>` +
                `</div>` +
              `</div>`
            );
          }
        )
        .join("");

  renderDopplerOverlay();
}

function formatSignedKmh(
  value
) {
  if (
    value == null
  ) {
    return "—";
  }

  return `${
    value > 0
      ? "+"
      : ""
  }${Number(value).toFixed(0)} km/h`;
}

// Render the same source-measured polygon on both observed frames and
// intervening display-only interpolation. Holding is purely visual; the cone
// is NEVER advanced, re-timestamped or re-scored from an inferred image.
// The +90m cone and the selected storm label MUST share one 3-D anchor
// plane. Rendering the cone at 350m but the actual centroid label at 1200m
// made a correctly geolocated cone LOOK detached when the oblique camera
// projected the two heights to different screen pixels.
const STORM_TRACK_ANCHOR_ALTITUDE_METRES = 1200;
function renderIssuedThreatCone(track, projection, heldObservedUtc = null, currentObservation = null) {
  const cone = projection?.cone;
  if (!cone) return false;
  const colour = trackColour(track.track_id);
  const coneAltitude = displayAltitude(STORM_TRACK_ANCHOR_ALTITUDE_METRES);
  const coneColour = colour.withAlpha(heldObservedUtc ? 0.20 : 0.30);
  // Native Cesium +0m indicator uses EXACTLY the same world Cartesian as
  // the DOM storm dot. This makes camera-parallax / incorrect origin visibly
  // diagnosable and gives the forecast a true point of departure on the map.
  const coneOrigin = cone.samples?.[0]?.centre;
  if (!coneOrigin) return false;
  hybridSource.entities.add({
    id: `hybrid-threat-origin-${track.track_id}`,
    position:Cesium.Cartesian3.fromDegrees(
      coneOrigin.longitude,coneOrigin.latitude,coneAltitude
    ),
    point:{
      pixelSize:14,color:Cesium.Color.WHITE.withAlpha(0.06),
      outlineColor:colour,outlineWidth:3,
      disableDepthTestDistance:Number.POSITIVE_INFINITY
    },
    label:{
      text:"0m",font:"11px sans-serif",
      pixelOffset:new Cesium.Cartesian2(0,18),
      fillColor:Cesium.Color.WHITE,
      showBackground:true,
      backgroundColor:Cesium.Color.BLACK.withAlpha(0.72),
      disableDepthTestDistance:Number.POSITIVE_INFINITY
    }
  });
  hybridSource.entities.add({
    id: `hybrid-threat-cone-${track.track_id}`,
    polygon: {
      hierarchy: new Cesium.PolygonHierarchy(
        cone.polygon.map(point => Cesium.Cartesian3.fromDegrees(
          point.longitude, point.latitude, coneAltitude
        ))
      ),
      perPositionHeight: true,
      material: coneColour
    }
  });
   const boundary = [...cone.polygon, cone.polygon[0]];
  hybridSource.entities.add({
    id: `hybrid-threat-boundary-${track.track_id}`,
    polyline: {
      positions: boundary.map(point => Cesium.Cartesian3.fromDegrees(
        point.longitude, point.latitude, coneAltitude + 25
      )),
      width: heldObservedUtc ? 3 : 4,
      material: colour.withAlpha(1.0),
      depthFailMaterial: Cesium.Color.WHITE.withAlpha(0.85),
      clampToGround: false
    }
  });
   hybridSource.entities.add({
    id: `hybrid-threat-centreline-${track.track_id}`,
    polyline: {
      positions: cone.centreline.map(point => Cesium.Cartesian3.fromDegrees(
        point.longitude, point.latitude, coneAltitude + 35
      )),
      width: 3,
      material: new Cesium.PolylineDashMaterialProperty({
        color: colour.withAlpha(1.0),
        dashLength: 12
      }),
      depthFailMaterial: colour.withAlpha(0.95),
      clampToGround: false
    }
  });
   for (const sample of cone.samples.filter(item => item.minutes_ahead > 0)) {
    hybridSource.entities.add({
      id: `hybrid-threat-marker-${track.track_id}-${sample.minutes_ahead}`,
      position: Cesium.Cartesian3.fromDegrees(
        sample.centre.longitude,
        sample.centre.latitude,
        coneAltitude + 45
      ),
      point: {
        pixelSize: 8,
        color: colour,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: {
        text: `+${sample.minutes_ahead}m`,
        font: "12px sans-serif",
        pixelOffset: new Cesium.Cartesian2(0, -16),
        fillColor: Cesium.Color.WHITE,
        showBackground: true,
        backgroundColor: Cesium.Color.BLACK.withAlpha(0.72),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });
  }
   const status = $("trackThreatConeStatus");
  if (status) {
    const reason = {
      initial: "issued",
      "observed-outside": "repositioned: observed storm left earlier cone",
      "projected-track-outside": "repositioned: updated motion leaves earlier cone",
      "direction-change": "repositioned: storm changed direction",
      "steering-change": "reoriented: verified updated steering",
      "sustained-steering-change": "reoriented: sustained measured movement across multiple radar scans",
      "storm-advanced": "repositioned: measured storm advanced",
      "measured-position": "anchored to current measured storm position",
      "rolling-refresh": "repositioned: 30-min refresh",
      "timeline-rewound": "rebuilt for earlier observation"
    }[projection.reason] ?? "within issued envelope";
    const latestMotion = currentObservation && !heldObservedUtc
      ? measuredTrackMotionAtObservation(track, currentObservation) : null;
    status.textContent = heldObservedUtc
      ? `${track.track_id}: holding last measured +90m cone from ${formatProductTime(heldObservedUtc, {compact:true})} · inferred radar frame, no new storm motion calculated.`
      :
      `${track.track_id}: +90m motion cone · ${cone.speed_kmh.toFixed(0)} km/h · ` +
      `cone heading ${cone.heading_degrees.toFixed(0)}° · latest measured ${latestMotion?.heading_degrees?.toFixed(0) ?? "—"}° · ` +
      `±${cone.heading_half_angle_degrees.toFixed(0)}° spread · ${reason}. ` +
      `Reassessed on every measured scan; not a forecast probability.`;
  }
  return true;
}

// One shared deterministic rule for ordinary and held measured cones.
const THREAT_CONE_CONTROLLER_OPTIONS=Object.freeze({
  rolloverMinutes:30, turnThresholdDegrees:12, breachMarginKm:0.5,
  reissueOnObservedExit:true, observedExitMarginKm:0.5,
  // Keep the +0m origin on the ACTUAL measured storm rather than allowing
  // a former 500m reanchor deadband to accumulate visible 3-D parallax.
  followMeasuredPosition:true, minimumMeasuredReanchorKm:0.15
});
function precedingMeasuredThreatCone(index, trackId, maximumHoldMinutes = 15) {
  const at = Date.parse(hybridFrames[index]?.observedUtc);
  if (!Number.isFinite(at) || !trackId) return null;
  for (let earlier = index - 1; earlier >= 0; earlier--) {
    const sourceUtc = hybridFrames[earlier]?.observedUtc;
    const sourceEpoch = Date.parse(sourceUtc);
    if (!Number.isFinite(sourceEpoch) || sourceEpoch > at) continue;
    const ageMinutes = (at - sourceEpoch) / 60000;
    if (ageMinutes > maximumHoldMinutes) break;
    const result = hybridResults[earlier];
    if (!result) continue;
    const track = (result.tracks ?? []).find(item => item.track_id === trackId);
    if (!track) continue;
    const observation = trackObservationForFrame(track, earlier);
    if (!observation) continue;
    const projection = evaluateChronologicalTrackThreatCone(
      track, observation, buildTrackThreatCone,
      { horizonMinutes:90, directionChangeThresholdDegrees:12 },
      THREAT_CONE_CONTROLLER_OPTIONS
    );
    if (projection.cone) return {track, projection, sourceUtc};
  }
  return null;
}

function renderHybridTracks(index) {
  // Source-mode check, not merely loaded-mode check: a pending switch to
  // Doppler must never recreate old storm trails/cones after teardown.
  if (selectedLoopSelection() === DOPPLER_AVAILABLE_LOOP_VALUE ||
      isNativeDopplerPlayback()) {
    clearReflectivityForDoppler();
    return;
  }
  const stormTrackMarkers = [];
  hybridSource.entities.suspendEvents();
  clearHybridTrackVolumeCollection();
  const showTrackVolumes = !INCREMENTAL_VOLUME_PREVIEW && useTrackSpecificVolume(index);
  const volumePercent=Number($("volumeOpacity").value);
  if (showTrackVolumes) {
    hybridTrackVolumeCollection=scene.primitives.add(
      useBlobVolume()?new Cesium.BillboardCollection():new Cesium.PointPrimitiveCollection()
    );
    hybridTrackFootprintCollection=scene.primitives.add(new Cesium.PointPrimitiveCollection());
  }
  try {
    hybridSource.entities.removeAll();
    const result = hybridResults[index];
    const volumeMap = hybridTrackVolumes[index];
    if (!result) {
      $("hybridTrackCount").textContent = "0";
      $("hybridPersistentCount").textContent = "0";
      $("hybridRows").innerHTML =
        '<div class="hybrid-muted">Temporally inferred radar display frame. Track identity, Doppler analysis and scoring use observed frames only.</div>';
      if (selectedTrackId() && $("showTrackThreatCone")?.checked) {
        const held = precedingMeasuredThreatCone(index, selectedTrackId());
        if (held) renderIssuedThreatCone(held.track, held.projection, held.sourceUtc);
        else $("trackThreatConeStatus").textContent =
          "No recent measured motion cone available to hold at this inferred frame.";
      }
      scene.requestRender();
      return;
    }
    const active = new Set(result.active_track_ids ?? []);
    const rows = [];
    const frameTracks = (result.tracks ?? []).filter(track => trackObservationForFrame(track, index));
    const wanted = selectedTrackId();
    $("hybridTrackCount").textContent = String(frameTracks.length);

    for (const track of frameTracks) {
      if (wanted && track.track_id !== wanted) continue;
      const observation = trackObservationForFrame(track, index);
      const presentation = stormTrackPresentation(track, observation, hybridFrames[index]?.observedUtc, wanted === track.track_id);
      const volumeRecord = volumeMap?.get(track.track_id) ?? null;
      const volume = volumeRecord?.volume ?? null;
      const trend = volumeRecord?.trend ?? null;
      const colour = trackColour(track.track_id);
      const altitude = STORM_TRACK_ANCHOR_ALTITUDE_METRES;
      const position = Cesium.Cartesian3.fromDegrees(
        observation.centroid_longitude,
        observation.centroid_latitude,
        displayAltitude(altitude)
      );

      // Present track ID and centroid as one paired overlay above the 3-D
      // volume. The Labels checkbox controls the complete marker, not just
      // the text, and does not rebuild or change any measured/inferred data.
      if (presentation.show) stormTrackMarkers.push({
        position,
        text: `${track.track_id}  ≥${Number(observation.maximum_dbzh_lower_bound).toFixed(0)} dBZ`,
        colour: colour.toCssColorString(),
        size: active.has(track.track_id) ? 12 : 8,
        priority: presentation.priority
      });

      if (showTrackVolumes && volume && hybridTrackVolumeCollection) {
        const displayedMinimumDbz=volumeDisplayThresholdDbz($("minimumDbzh").value);
        for (const point of volume.points) {
          // The volume analysis retains the full inferred profile; only
          // the user-visible dots follow the same dBZ cutoff as frame-wide.
          if (!shouldDisplayMeasuredTrackPoint(point,displayedMinimumDbz)) continue;
          addVolumeGlyph(hybridTrackVolumeCollection,{
            position: Cesium.Cartesian3.fromDegrees(
              point.longitude,
              point.latitude,
              displayedVolumeAltitude(point.altitude_m_amsl,
                point.source_low_level_dbzh ?? point.dbzh,
                Number($("verticalScale").value))
            ),
            color: colourForDbzh(point.dbzh),
            pixelSize: trackPointSize(point.support_band),
            disableDepthTestDistance: 0
          },point.alpha,volumePercent,point.source_low_level_dbzh ?? point.dbzh,trackPointSize(point.support_band)/3);
        }

        // Critical visibility contract: track segmentation decides WHERE
        // the storm is drawn, not whether the measured 2-D core is downgraded
        // to an inferred colour at height. Project the published BoM
        // category/colour at the lower edge of each inferred track column.
        // This layer is a 2-D footprint projection, NOT a 3-D observation.
        for (const measured of volume.measured_reflectivity_footprint ?? []) {
          if (measured.representative_dbzh < displayedMinimumDbz) continue;
          const rgb=displayRgb(measured.source_category);
          if (!rgb) continue;
          addVolumeDisplayPoint(hybridTrackFootprintCollection,{
            position: Cesium.Cartesian3.fromDegrees(
              measured.longitude,
              measured.latitude,
              displayAltitude(measured.projection_altitude_m_amsl)
            ),
            color: Cesium.Color.fromBytes(rgb[0],rgb[1],rgb[2],255),
            pixelSize: Math.max(3,Number($("pointSize").value)+1),
            // This projected 2-D source intensity must not disappear
            // behind inferred vertical points or 3-D terrain.
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          },1,volumePercent);
        }
      }

      if (!hybridHistory.has(track.track_id)) hybridHistory.set(track.track_id, []);
      const history = hybridHistory.get(track.track_id);
      if (!history.some(item => item.frameIndex === index)) {
        history.push({
          frameIndex: index,
          longitude: observation.centroid_longitude,
          latitude: observation.centroid_latitude,
          altitude
        });
      }
      const trail = history
        .filter(item => item.frameIndex <= index)
        .sort((a, b) => a.frameIndex - b.frameIndex);
      // Labels default OFF. Do not allocate/submit hidden Cesium trail
      // polylines for every storm at every playback step.
      if (presentation.show && $("showTrackLabels")?.checked && trail.length >= 2) {
        hybridSource.entities.add({
          id: `hybrid-trail-${track.track_id}`,
          show: Boolean($("showTrackLabels")?.checked),
          polyline: {
            positions: trail.map(item => Cesium.Cartesian3.fromDegrees(
              item.longitude, item.latitude, displayAltitude(item.altitude)
            )),
            width: active.has(track.track_id) ? 3 : 1.5,
            material: colour.withAlpha(active.has(track.track_id) ? 0.9 : 0.35),
            depthFailMaterial: colour.withAlpha(active.has(track.track_id) ? 0.9 : 0.35),
            clampToGround: false
          }
        });
      }

      if (wanted === track.track_id && $("showTrackThreatCone")?.checked) {
        // Deterministic cone from actual observations through this exact scan.
        const projection = evaluateChronologicalTrackThreatCone(
          track, observation, buildTrackThreatCone,
          { horizonMinutes: 90, directionChangeThresholdDegrees: 12 },
          THREAT_CONE_CONTROLLER_OPTIONS
        );
        if (!projection.cone) {
          // Avoid leaving a stale earlier forecast-status message on screen
          // when the current genuinely observed centroid cannot support
          // credible storm steering. The storm label itself stays visible.
          const status=$("trackThreatConeStatus");
          if(status) status.textContent =
            `${track.track_id}: +90m cone withheld · latest measured storm motion is `+
            `too slow or changes direction too abruptly to support a `+
            `reliable extrapolation. Waiting for consistent measured scans; `+
            `rain imagery and the ST label remain available.`;
        } else {
          renderIssuedThreatCone(track, projection, null, observation);
        }
      }

      const top40Text = volume?.high_support_top_40_m_amsl != null
        ? `${(volume.high_support_top_40_m_amsl / 1000).toFixed(1)} km`
        : "—";
      const trendText = trend
        ? `${trend.metres_per_10_min >= 0 ? "+" : ""}${(trend.metres_per_10_min / 1000).toFixed(1)} km/10m`
        : "—";
      const supportText = volume
        ? `${volume.high_support_points}/${volume.inferred_point_count}`
        : "—";
      const dopplerContext = dopplerContextForTrack(index, track.track_id);
      const primaryDoppler = dopplerContext?.primary ?? null;
      const dopplerSummary = primaryDoppler
        ? `Doppler ${primaryDoppler.radar_id}: ${formatSignedKmh(primaryDoppler.strongest_toward_kmh)} toward / ${formatSignedKmh(primaryDoppler.strongest_away_kmh)} away; span ${primaryDoppler.radial_span_kmh == null ? "—" : `${primaryDoppler.radial_span_kmh.toFixed(0)} km/h`}; ${primaryDoppler.sample_count} footprint samples`
        : "Doppler — no time-matched non-zero samples in this measured footprint";
      const assessment = buildFootprintRestrictedTrackAssessment(
        track,
        dopplerContext,
        { referenceTime: new Date(hybridFrames[index].observedUtc) }
      );
      const dopplerAssessmentText = assessment.doppler_integrated
        ? `Doppler contribution ${assessment.doppler_component_score}/${assessment.doppler_component_maximum} from radar ${assessment.doppler_radar_id} (${assessment.doppler_sample_count} strict footprint samples)`
        : "Doppler contribution unavailable for this ST footprint";
      const assessmentText = `Convective/lightning assessment ${assessment.category} ${assessment.score}/100; confidence ${assessment.confidence}; evidence ${assessment.evidence_coverage_percent}/100`;
      rows.push(
        `<div class="track-volume-row"><div><strong>${track.track_id}</strong><span>${track.observation_count} obs</span><span>${track.motion ? `${track.motion.speed_kmh.toFixed(0)} km/h` : "motion —"}</span></div><div><span>high-support 40 dBZ top ${top40Text}</span><span>vertical trend ${trendText}</span><span>support ${supportText}</span><span>${dopplerSummary}</span><span><strong>${assessmentText}</strong></span><span>${dopplerAssessmentText}</span></div></div>`
      );
    }

    $("hybridPersistentCount").textContent = String(
      (result.tracks ?? []).filter(track => track.observation_count >= 3).length
    );
    $("hybridRows").innerHTML = rows.length
      ? rows.join("")
      : '<div class="hybrid-muted">No measured ≥40 dBZ 2-D storm tracks in this frame.</div>';
  } finally {
    hybridSource.entities.resumeEvents();
    stormTrackLabelOverlay.setMarkers(stormTrackMarkers);
    // Visibility must be honoured on paused frames AND after rebuilding a
    // frame: no fresh history trail can reappear while labels are off.
    const trackAnnotationsVisible =
      Boolean($("showTrackLabels")?.checked) && !isNativeDopplerPlayback();
    stormTrackLabelOverlay.setVisible(trackAnnotationsVisible);
    setStormTrackTrailVisibility(hybridSource.entities,trackAnnotationsVisible);
  }
  scene.requestRender();
}

function updateHybridSourceMetrics(frame) {
  const inference =
    frame.sourceMetadata
      ?.temporalInference;

  $("sourceTime").textContent =
    inference
      ? `${formatProductTime(frame.observedUtc)} · INFERRED between ${formatProductTime(inference.beforeUtc, { compact: true })} and ${formatProductTime(inference.afterUtc, { compact: true })}`
      : formatProductTime(frame.observedUtc);

  $("decodedPixels").textContent =
    (
      frame.sourceMetadata
        ?.colouredPixelCount
      ?? 0
    ).toLocaleString();

  const category =
    frame.sourceMetadata
      ?.maxCategory
    ?? 0;

  const lower =
    frame.sourceMetadata
      ?.maxDbzLowerBound;

  $("sourceMaximum").textContent =
    category
      ? (
          lower == null
            ? `category ${category}`
            : `category ${category} (>=${lower} dBZ)`
        )
      : "none";
}


async function showDopplerOnlyFrame(index) {
  if (!isNativeDopplerPlayback() || !shouldDisplayDopplerForSelectedWindow())
    return false;
  const renderToken=++hybridSceneRenderToken;
  const started=performance.now();
  const next=Math.max(0,Math.min(windPlaybackFrames.length-1,Number(index)));
  const source=windPlaybackFrames[next];
  if (!source) return false;
  // Same source-true prepare/commit workflow used by multi-site RAIN:
  // prepare genuine site-specific Doppler scans while the primary decodes,
  // stage each optional native image, then reveal all ready sites together.
  const extrasPreparing=supplementalDopplerDisplay.prepare(source.observedUtc);
  let prepared;
  try {
    prepared=await prepareWindObservation(next);
    await waitForSecondaryWindPreparation(extrasPreparing);
  } catch(error) {
    setStatus("Doppler scan unavailable: "+error.message,"warning");
    return false;
  }
  if(renderToken!==hybridSceneRenderToken ||
     !isNativeDopplerPlayback() || !shouldDisplayDopplerForSelectedWindow())
    return false;
  try {
    if(!await commitWindObservation(prepared,{renderToken,updateUi:true}))
      return false;
  } catch(error) {
    setStatus("Doppler scan held: "+error.message,"warning");
    return false;
  }
  if(renderToken!==hybridSceneRenderToken || !isNativeDopplerPlayback())
    return false;
  // Same atomic handover boundary as rain's supplementalRadarDisplay.commit.
  // No asynchronous site-by-site map changes after primary UTC advances.
  supplementalDopplerDisplay.commit(source.observedUtc);
  const time=prepared.record?.observedUtc ?? source.observedUtc;
  syncFrameSlider($("hybridFrameSlider"),windPlaybackFrames.length,next);
  $("hybridFrameLabel").textContent=(next+1)+"/"+windPlaybackFrames.length;
  $("hybridSceneFrame").textContent=formatProductTime(time);
  $("sourceTime").textContent=formatProductTime(time);
  $("mapTruthLabel").textContent="GENUINE BoM DOPPLER RADIAL VELOCITY · no synthetic wind observations";
  updateDualSourceTimes();
  const telemetry=playbackPerformanceMeter.record({
    frameMs:performance.now()-started,
    targetMs:playbackDelayForSpeed(selectedPlaybackSpeed()),
    windMs:performance.now()-started,radarMs:0,volumeMs:0
  });
  const meter=$("playbackPerformanceSummary");
  if(meter){
    meter.textContent=`Doppler ${telemetry.actualFps.toFixed(1)} fps · target ${telemetry.targetFps.toFixed(1)} fps · ${telemetry.overruns}/${telemetry.samples} slow frames`;
    meter.title="Native measured wind animation; radar surface and volumetric geometry are not redrawn";
  }
  prewarmUpcomingFrames(next);
  setStatus(`Genuine BoM Doppler ${next+1}/${windPlaybackFrames.length} · ${formatProductTime(time,{compact:true})} · radial wind, not measured surface gust`,"ok");
  return true;
}

async function showHybridFrame(index) {
  const renderToken =
    ++hybridSceneRenderToken;
  const totalStart=performance.now();
  let windPreparationMs=0,radarPresentationMs=0,volumeConstructionMs=0;
  const previousVisibleIndex = latestFrame
    ? hybridFrames.findIndex(item => item.observedUtc === latestFrame.observedUtc)
    : -1;

  const requestedIndex =
    Math.max(0,Math.min(hybridFrames.length-1,Number(index)));
  const frame=hybridFrames[requestedIndex];

  // Actual BoM frames remain at their recorded source times and are the
  // ONLY frames delivered to storm science, Doppler or threat-cone analysis.
  // Extra motion-warped 2-D images exist only on-screen during sequential
  // playback; no scene opacity or whole-screen image crossfade is used.
  const previousFrame = latestFrame;
  // Native wind may advance without a new radar scan. Preserve the genuine
  // visible radar image and its expensive inferred/track geometry.
  const windOnlyStep = isDopplerOnlyPlaybackStep(
    previousFrame, frame, hybridCombinedSchedule.length > 0, Boolean(surfaceLayer)
  );
  motionTransition.cancel();
  // Start decoding original supplemental windows while primary wind/volume
  // preparation proceeds. The PRIMARY image remains at its old timestamp
  // until all available secondary tiles can reveal atomically.
  const supplementalAnchor=additionalRadarSiteIds.length
    ? supplementalAnchorForFrame(frame):null;
  const supplementalMeasurable=Boolean(supplementalAnchor);
  // Inferred primary images are display-only and carry no NEW source scan.
  // Their secondary windows already belong to the last measured anchor;
  // never hold the playback clock waiting on 1–3 optional WMTS downloads
  // (or repeat unsuccessful requests for each 5-minute synthetic step).
  // Genuine observed steps still synchronise measured secondary imagery
  // before the primary atomic reveal, as before.
  const extraPreparation=shouldPrepareSupplementalForPlayback(supplementalAnchor)
    ? supplementalRadarDisplay.prepare(supplementalAnchor.observedUtc)
    : Promise.resolve([]);
  const motionGeneration=visualMotionGeneration;
  // A display-only motion-warp rain image has NO matching measured 3-D
  // geometry. Never show it when inferred volumetric structure is visible:
  // otherwise the 2-D echo advances while the 3-D plume stays at the previous
  // observed timestamp. At zero 3-D opacity, the original smooth rain preview
  // remains available without affecting scientific tracks.
  const hasVisibleVolume = Number($("volumeOpacity").value)>0;
  // Multiple radar windows show only source-measured frames. Do not warp the
  // primary image between scans while additional site images remain at a
  // measured timestamp; that would create inconsistent cross-site playback.
  const steps=(hybridCombinedSchedule.length || hasVisibleVolume) ? 0 :
    (additionalRadarSiteIds.length ? 0 :
      radarMotionStepsForSpeed(selectedPlaybackSpeed()));
  const canAnimate=steps>0 && playback.isPlaying() &&
    previousVisibleIndex>=0 && requestedIndex===previousVisibleIndex+1 &&
    canMotionInterpolateRadar(previousFrame,frame);
  if(canAnimate){
    try{
      const motion=createRadarMotionTransition(previousFrame,frame);
      const morphStarted=performance.now();
      for(let i=1;i<=steps;i++){
        if(performance.now()-morphStarted>
            playbackDelayForSpeed(selectedPlaybackSpeed())*.5)break;
        if(renderToken!==hybridSceneRenderToken ||
           motionGeneration!==visualMotionGeneration || !playback.isPlaying())break;
        const displayFrame=motion.frame(i/(steps+1));
        const shown=await renderSurface(displayFrame,renderToken,{
          timeoutMs:Math.min(180,Math.round(playbackDelayForSpeed(selectedPlaybackSpeed())*.4))
        });
        if(!shown)break;
        // A display-only morph, not another BoM measurement. The
        // measurement timeline and all scientific overlays remain unchanged.
        $("mapTruthLabel").textContent="MOTION-INTERPOLATED RAIN · DISPLAY ONLY";
        // No additional sleep: rendering itself occupies the playback budget.
      }
    }catch{
      // If motion estimation or an interim tile fails, go directly to the
      // genuine next BoM observation, never leave a fabricated reading.
    }
  }
  if(renderToken!==hybridSceneRenderToken)return;
  // Prepare the original-source wind texture BEFORE committing a new radar
  // frame. Never announce a combined step that cannot display its real wind.
  let preparedWind=null;
  try{
    const windStart=performance.now();
    preparedWind=await prepareWindForPlayback(requestedIndex);
    windPreparationMs=performance.now()-windStart;
  }catch(error){
    setStatus("Combined observation held: "+error.message,"warning");
    return false;
  }
  if(renderToken!==hybridSceneRenderToken)return;
  // Bounded individual supplemental deadlines avoid holding the primary
  // indefinitely on a failed optional BoM tile. The genuine scan may then
  // commit without the unavailable site, never using old-UTC pixels.
  await extraPreparation;
  if(renderToken!==hybridSceneRenderToken)return;
  const radarStart=performance.now();
  let surfaceApplied=false,geometryCommitted=false;
  const commitMeasuredGeometry=()=>{
    if(renderToken!==hybridSceneRenderToken)return;
    const began=performance.now();
    // Synchronously create/show the measured-frame inference and tracks
    // BEFORE the newly decoded 2-D BoM surface becomes visible. Cesium then
    // renders both together, never offset by a source observation.
    renderInferredVolume(frame);
    updateTrackDisplayControls(requestedIndex);
    applyHybridVolumeMode(requestedIndex);
    renderHybridTracks(requestedIndex);
    syncSevereStormAlerts(requestedIndex);
    if(supplementalMeasurable){
      if(supplementalAnchor.held &&
         supplementalRadarDisplay.targetTime!==supplementalAnchor.observedUtc){
        // An inferred step cannot initiate its own time-changing secondary
        // handover. A missing genuine anchor will be retried by a later
        // observed scan or an explicit paused selection, never by this step.
        void supplementalRadarDisplay.show(null,{enabled:false});
        displaySupplementalHoldStatus(null);
      }else{
        supplementalRadarDisplay.commit(supplementalAnchor.observedUtc,{
          alpha:Number($("radarOpacity").value)/100
        });
        displaySupplementalHoldStatus(supplementalAnchor);
      }
    }else{
      void supplementalRadarDisplay.show(null,{enabled:false});
      displaySupplementalHoldStatus(null);
    }
    volumeConstructionMs=performance.now()-began;
    geometryCommitted=true;
  };
  try {
    surfaceApplied=windOnlyStep ? true : await renderSurface(frame,renderToken,{
      timeoutMs:playback.isPlaying() ? 1100 : 2200,
      onBeforeReveal:commitMeasuredGeometry
    });
  } catch(error) {
    // A corrupt/expired source tile is not a reason to freeze every cycle.
    setStatus("Skipping unavailable original BoM frame: "+error.message,"warning");
    return false;
  }
  radarPresentationMs=performance.now()-radarStart;
  if(renderToken!==hybridSceneRenderToken)return;

  if (!surfaceApplied) {
    // A rejected tile handover must not leave the UI claiming an undrawn
    // observation. Keep the previous scan and retry normally on the next cycle.
    motionTransition.cancel();
    setStatus("New radar imagery is still loading. Retaining the previous radar frame.", "warning");
    return false;
  }
  if(preparedWind){
    try{await commitWindObservation(preparedWind,{updateUi:false,renderToken});}
    catch(error){
      // Report a missing partner explicitly, rather than announcing the
      // combination as one measured radar+wind state.
      setStatus("Rain loaded; Doppler could not commit: "+error.message,"warning");
      return false;
    }
  }
  // All requested imagery is now staged/committed. The UI cursor and source
  // clocks finally advance together, never at the beginning of a render.
  hybridFrameIndex=requestedIndex;
  latestFrame=frame;
  // Supplemental image+volume reveal already happened synchronously inside
  // primary beforeReveal; never run a second asynchronous show/hide here.
  const temporalInferred=isTemporallyInferredRadarFrame(frame);
  // The handover has already presented the matching measured 3-D geometry
  // in the same Cesium frame as this source raster. Wind-only events reuse it.
  if(!windOnlyStep && !geometryCommitted)
    throw Error("Measured radar volume was not committed with its 2-D frame");
  // Combined wind was committed synchronously above; no asynchronous
  // wind driver may overtake the now-visible radar/slider transaction.

  updateHybridSourceMetrics(
    frame
  );

  updateOperationalOverview(
    frame,
    "sequence"
  );

  // A postRender boundary is the first point at which the Cesium surface,
  // native wind imagery and regenerated 3-D/context layers are display-ready.
  // Keep the slider and the two clocks on the PREVIOUS observation until then.
  await new Promise(resolve=>{
    let completed=false;
    let remove=()=>{};
    let timeout;
    const finish=()=>{
      if(completed)return;
      completed=true;remove();clearTimeout(timeout);resolve();
    };
    remove=scene.postRender.addEventListener(finish);
    timeout=setTimeout(finish,250);
    scene.requestRender();
  });
  if(renderToken!==hybridSceneRenderToken)return;
  syncFrameSlider($("hybridFrameSlider"),hybridFrames.length,hybridFrameIndex);
  $("hybridFrameLabel").textContent=
    `${hybridFrameIndex+1}/${hybridFrames.length}${temporalInferred?" · inferred":""}`;
  if(preparedWind)updateIndependentDopplerUi();
  else updateDualSourceTimes();
  if (!windOnlyStep) prewarmUpcomingFrames(hybridFrameIndex);
  const telemetry=playbackPerformanceMeter.record({
    frameMs:performance.now()-totalStart,
    targetMs:effectivePlaybackDelayMs(),
    windMs:windPreparationMs,
    radarMs:radarPresentationMs,
    volumeMs:volumeConstructionMs
  });
  const metricsNode=$("playbackPerformanceSummary");
  if(metricsNode){
    metricsNode.textContent=
      `Actual ${telemetry.actualFps.toFixed(1)} fps · target ${telemetry.targetFps.toFixed(1)} fps · `+
      `${telemetry.overruns}/${telemetry.samples} slow frames`;
    metricsNode.title=
      `Mean frame ${telemetry.averageMs.toFixed(0)}ms · radar ${telemetry.radarMs.toFixed(0)}ms · `+
      `wind prep ${telemetry.windMs.toFixed(0)}ms · 3-D ${telemetry.volumeMs.toFixed(0)}ms. `+
      "Slow means presentation exceeded the requested interval; no BoM observation was discarded.";
  }

  const sceneFrame =
    $("hybridSceneFrame");

  if (sceneFrame) {
    sceneFrame.textContent =
      formatProductTime(frame.observedUtc);
  }

  $("mapTruthLabel").textContent =
    temporalInferred
      ? "TEMPORALLY INFERRED 2-D · inferred vertical structure · display only"
      : "BoM measured 2-D reflectivity core (projected) / inferred vertical structure";

  setStatus(
    temporalInferred
      ? (
          `Frame ${hybridFrameIndex + 1}/${hybridFrames.length} · ` +
          `${formatProductTime(frame.observedUtc, { compact: true })} · ` +
          "INFERRED temporal gap-fill · display only · excluded from tracking/scoring"
        )
      : (
          `Frame ${hybridFrameIndex + 1}/${hybridFrames.length} · ` +
          `${formatProductTime(frame.observedUtc, { compact: true })} · ` +
          "radar tracking history"
        ),
    "ok"
  );
  // No opacity fade. The last full observed frame is the final step of
  // the spatially advected radar animation.
  return true;
}

async function warmRadarHistoryCache(
  region,
  observedTimes
) {
  // Let the interactive load finish first. Cache warming is opportunistic and
  // must never compete with a user-requested loop or a site change.
  await new Promise(
    resolve => setTimeout(resolve, 1500)
  );

  const candidates =
    normaliseRadarHistoryTimes(
      observedTimes
    );

  let warmedCount = 0;
  const pressureGuardActive =
    LABEL_GPU_QA || window.location.pathname.includes("/preview/network-guard/");

  for (const observedUtc of candidates) {
    if (
      selectedRadarRegion() !== region
      || sequenceLoading
    ) {
      return;
    }

    if (radarFrameCache.has(observedUtc)) {
      continue;
    }

    try {
      const frame =
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
      );

      await putRadarFrame(
        region,
        frame
      );

      warmedCount++;
    } catch (error) {
      // A single 403/429/502/503 means background warming is now competing
      // with a refusing/unavailable BoM relay. Hold the known-good loop and
      // stop requesting more full mosaics until the next normal refresh.
      const relayUnavailable=pressureGuardActive &&
        /HTTP (?:403|429|502|503|504)\b/.test(String(error?.message??error));
      if(relayUnavailable){
        console.warn("BoM history cache warming paused after relay rejection:",
          region,observedUtc,String(error?.message??error));
        break;
      }
      // A missing 400 tile invalidates that real frame, not other frames.
      console.warn(
        `Unable to warm radar history cache for ${region} at ${observedUtc}`,
        error
      );
    }
  }

  pruneRadarFrames({
    beforeEpoch:
      Date.now()
      - 4 * 60 * 60 * 1000,
    maxRecords: 240
  }).catch(error =>
    console.warn(
      "Unable to prune warmed radar history cache",
      error
    )
  );

  if (
    warmedCount > 0
    && selectedRadarRegion() === region
  ) {
    // Re-run the cheap automatic path immediately so newly warmed historical
    // observations become visible without requiring a manual Refresh click.
    void autoRefresh.check();
  }
}


async function loadDopplerSequence(automatic=false) {
  if(!isDopplerSourceActive()) throw Error("Choose a published BoM Doppler radar site");
  if(independentDopplerFrames.length<2) {
    await refreshIndependentDopplerHistory(false);
  }
  const plan=buildDopplerOnlySchedule(independentDopplerFrames);
  if(plan.length<2) throw Error("At least two genuine BoM Doppler scans are required");
  if(automatic && !hasNewDopplerWindow()) return;
  const oldTime=independentDopplerFrames[independentDopplerIndexValue]?.observedUtc;
  const resume=automatic ? playback.isPlaying() : true;
  await playback.pause();
  ++hybridSceneRenderToken;
  windPlaybackFrames=plan.map(step=>independentDopplerFrames.find(frame=>
    frame.observedUtc===step.dopplerObservedUtc)).filter(Boolean);
  loadedLoopSelection=DOPPLER_AVAILABLE_LOOP_VALUE;
  hybridCombinedSchedule=[]; // Never insert rain timestamps into Doppler playback.
  lastCombinedDopplerLatestUtc=windPlaybackFrames.at(-1)?.observedUtc ?? null;
  const recovered=automatic ? windPlaybackFrames.findIndex(frame=>
    frame.observedUtc===oldTime) : 0;
  independentDopplerIndexValue=Math.max(0,recovered);
  // Extra reflectivity is removed; measured Doppler from selected additional
  // sites now replaces it when each genuine scan has a nearby UTC.
  showSupplementalRadarSites(null);
  supplementalDopplerDisplay.setEnabled(true);
  // All reflectivity-only objects are removed, including the selected +90m
  // threat cone and standalone Cesium primitives (not controlled by Labels).
  clearReflectivityForDoppler();
  radarImageryHandover.setOpacity(0);
  const minutes=Math.round((Date.parse(windPlaybackFrames.at(-1).observedUtc)-
    Date.parse(windPlaybackFrames[0].observedUtc))/60000);
  $("operationalLoopWindow").textContent=
    `Doppler only · ${minutes} min / ${windPlaybackFrames.length} real scans`;
  $("sharedHistoryNote").textContent=
    `Original BoM Doppler radial velocity · ${windPlaybackFrames.length} real scans · no added rain frames · ${formatProductTimeRange(windPlaybackFrames[0].observedUtc,windPlaybackFrames.at(-1).observedUtc)}`;
  $("autoRefreshNote").textContent=
    "Auto update: new actual Doppler observations checked every 5 minutes.";
  syncFrameSlider($("hybridFrameSlider"),windPlaybackFrames.length,independentDopplerIndexValue);
  $("hybridPlayButton").disabled=windPlaybackFrames.length<2;
  $("hybridFrameSlider").disabled=false;
  const displayed=await showDopplerOnlyFrame(independentDopplerIndexValue);
  if(!displayed) throw Error("Initial genuine BoM Doppler image could not be presented");
  if(resume) playback.play();
}

async function loadHybridSequence(automatic = false) {
  if(selectedLoopSelection()===DOPPLER_AVAILABLE_LOOP_VALUE)
    return loadDopplerSequence(automatic);
  supplementalDopplerDisplay.setEnabled(false);
  windPlaybackFrames=[];
  hybridSource.show=true;
  $("showTrackLabels").disabled=false;
  stormTrackLabelOverlay.setVisible(Boolean($("showTrackLabels")?.checked));
  radarImageryHandover.setOpacity(Number($("radarOpacity").value)/100);
  if (!automatic) setStatus("Checking available BOM radar history…");

  const region = selectedRadarRegion();
  const now = Date.now();
  const cacheCutoff =
    now - 4 * 60 * 60 * 1000;

  const recentDiscovery =
    !automatic
    && lastSourceDiscoveryRegion === region
    && now - lastSourceDiscoveryAt < 60 * 1000
    && lastSourceDiscoveryTimes.length;

  const sourceDiscovery =
    automatic
      ? (BOUNDED_RADAR_RECOVERY_QA
          ? discoverBoundedBomReflectivityHistory(now,180,region)
          : findLatestBomReflectivityTime(now,region)
              .then(observedUtc=>[observedUtc]))
      : recentDiscovery
        ? Promise.resolve([...lastSourceDiscoveryTimes])
        : (LABEL_GPU_QA
            ? discoverBoundedBomReflectivityHistory(now,180,region)
            : discoverBomReflectivityHistory(now,180,region));

  // Startup metadata failure must not throw away authentic frames already
  // saved in this browser. Do not invent earlier tiles or backdate a newer
  // scan. Automatic poll failures leave the existing live loop untouched.
  const [sourceResult, cachedFrames] = await Promise.all([
    BOUNDED_RADAR_RECOVERY_QA
      ? sourceDiscovery.then(times=>({times}),error=>({error}))
      : sourceDiscovery.then(times=>({times})),
    getRadarFrames(region, cacheCutoff).catch(error => {
      console.warn("Persistent radar history cache unavailable", error);
      return [];
    })
  ]);
  const resolvedSource=BOUNDED_RADAR_RECOVERY_QA
    ? resolveSourceDiscovery({outcome:sourceResult,cachedFrames,automatic})
    : {times:sourceResult.times,keepCurrent:false,cachedOnly:false};
  if(resolvedSource.keepCurrent) {
    if (automatic) recordRadarAutoRefreshAudit({
      failure: String(sourceResult.error?.message ?? "BoM imagery unavailable"),
      outcome: "source unavailable; retaining genuine imagery"
    });
    $("autoRefreshNote").textContent =
      "BoM new imagery currently unavailable · retaining last genuine displayed radar scan";
    // Keep rendered real imagery, but tell the scheduler this check failed:
    // it must retry without a manual reload, not report a successful poll.
    if (automatic) throw new Error(
      "BoM radar discovery unavailable: " +
      String(sourceResult.error?.message ?? sourceResult.error)
    );
    return;
  }
  if(resolvedSource.cachedOnly)
    $("autoRefreshNote").textContent =
      "BoM live scan unavailable · genuine locally cached observations only";
  const discoveredTimes=resolvedSource.times;
  if(BOUNDED_RADAR_RECOVERY_QA && !discoveredTimes.length && !cachedFrames.length)
    throw Error("No verified BoM reflectivity frames available; nothing fabricated");
  const sources = { histories:new Map(),palettes:new Map(),
    latestRecords:new Map(),errors:new Map() };

  if (!automatic && !recentDiscovery) {
    lastSourceDiscoveryRegion = region;
    lastSourceDiscoveryAt = now;
    lastSourceDiscoveryTimes =
      [...discoveredTimes];
  }

  for (const frame of cachedFrames) {
    radarFrameCache.set(
      frame.observedUtc,
      frame
    );
  }

  const combinedHistory =
    normaliseRadarHistoryTimes([
      ...cachedFrames.map(
        frame => frame.observedUtc
      ),
      ...discoveredTimes
    ]);

  const newestHistoryEpoch =
    Math.max(
      ...combinedHistory.map(
        observedUtc =>
          Date.parse(observedUtc)
      )
    );

  const threeHourCutoff =
    newestHistoryEpoch
    - 180 * 60 * 1000;

  const historyTimes =
    combinedHistory.filter(
      observedUtc =>
        Date.parse(observedUtc)
        >= threeHourCutoff
    );

  updateRadarHistoryOptions(historyTimes);
  enforceDopplerWindow();

  const loopSelection = selectedLoopSelection();
  const loopMinutes = selectedLoopMinutes();
  const isCombined = loopSelection === DOPPLER_AVAILABLE_LOOP_VALUE;
  const combinedRequested = isCombined
    ? buildDopplerAvailableSchedule(availableRadarHistoryTimes, independentDopplerFrames)
    : [];
  if (isCombined && !combinedRequested.length) {
    throw new Error("Radar + Doppler window requires published wind history and at least one readable radar observation in the window.");
  }
  const rainWindow = isCombined ? null
    : resolveRainHistoryWindow(availableRadarHistoryTimes, loopSelection);
  const rainHistoryIncomplete = Boolean(rainWindow?.partial);
  const withDoppler = false; // Never gate measurements on identical timestamps.
  const requestedPlan = isCombined
    ? [...new Set(combinedRequested.map(entry=>entry.radarObservedUtc))]
        .map(observedUtc=>({kind:"observed",observedUtc}))
    : rainWindow.plan;
  const times =
    requestedPlan
      .filter(entry => entry.kind === "observed")
      .map(entry => entry.observedUtc);
  const requestedInferred = requestedPlan.filter(entry => entry.kind === "inferred").length;

  if (!automatic) {
    setStatus("Loading independent reflectivity history: " + times.length + " observed frames…");
  }

  // Match each genuine reflectivity observation against its nearest real
  // Doppler product within eight minutes; never relabel source timestamps.
  const shared = buildRadarPrimaryProductTimeline(
    times, new Map(), new Map(), [], 0
  );

  // Radar-only playback must advance on new reflectivity even at sites that
  // also have a Doppler product. Doppler availability gates automatic refresh
  // only while the user has explicitly enabled the Doppler overlay.
  // A missing Doppler source cannot delay a valid radar observation.
  // Unmatched radar frames display no Doppler rather than fabricated winds.
  const dopplerGatedRefresh = false;

  const needsHistoricalRebuild =
    automatic
    && needsChronologicalRadarRebuild(
      times,
      trackedThrough,
      radarResultCache.keys()
    );

  if (
    automatic
    && dopplerGatedRefresh
  ) {
    const required =
      publishedSharedTimeline?.radarIds.length
        ? publishedSharedTimeline.radarIds
        : selectedSourceRadars();

    const failed =
      required.filter(
        id =>
          sources.errors.has(id)
      );

    if (failed.length) {
      throw new Error(
        failed
          .map(
            id =>
              `Doppler ${id}: ${sources.errors.get(id)}`
          )
          .join("; ")
      );
    }
  }
  // Doppler frame cache cannot be pruned by a reflectivity source refresh.
  const availableEndUtc =
    automaticRefreshEndUtc({
      withDoppler: false,
      radarTimes:
        times,
      sharedEndUtc:
        shared.endUtc
    });

  if (automatic && isCombined && !hasNewDopplerWindow()) {
    $("autoRefreshNote").textContent =
      "Auto update: waiting for the next actual Doppler observation (checking every 5 minutes).";
    return;
  }
  if (
    automatic
    && !isCombined
    && !needsHistoricalRebuild
    && (
      (
        dopplerGatedRefresh
        && !hasNewMatchedProducts(
          publishedSharedTimeline,
          shared
        )
      )
      || (
        hybridFrames.length
        && Date.parse(availableEndUtc)
          <= Date.parse(
            hybridFrames.at(-1).observedUtc
          )
      )
    )
  ) {
    $("autoRefreshNote").textContent =
      dopplerGatedRefresh
        ? "Auto update: waiting for new matching radar + Doppler images."
        : "Auto update: waiting for a new radar image.";
    recordRadarAutoRefreshAudit({ failure: null, outcome: "waiting for new published scan" });
    return;
  }
  const radarTimes = automatic ? times.filter(time => Date.parse(time) <= Date.parse(availableEndUtc)) : times;
  const timeline = radarHistoryTimeline(radarTimes, shared);
  if (!timeline.entries.length) throw new Error("No matching source history available. The current loop is retained.");
  const frames = [], states = [], failures = [], failureDiagnostics = [];
  let newestFailure = "";
  for (const [index, entry] of timeline.entries.entries()) {
    if (
      automatic
      && !needsHistoricalRebuild
      && trackedThrough
      && !radarResultCache.has(entry.observedUtc)
      && Date.parse(entry.observedUtc) <= Date.parse(trackedThrough)
    ) {
      failures.push(entry.observedUtc);
      continue;
    }
    if (!automatic) setStatus(`Loading frame ${index + 1}/${timeline.entries.length}: ${formatProductTime(entry.observedUtc, { compact: true })}`);
    const radarLoad = (await Promise.allSettled([
      radarFrameCache.has(entry.observedUtc)
        ? Promise.resolve(radarFrameCache.get(entry.observedUtc))
        : loadBomReflectivityMosaicAtTime(entry.observedUtc, selectedRadarRegion(), discoveredTimes)
    ]))[0];
    const dopplerLoad = { status:"fulfilled", value:{
      reflectivityUtc:entry.observedUtc, pairings:[], records:[], sourceFailures:0
    } };
    const availability = sourceFrameLoadDecision({
      radarLoad, dopplerLoad,
      requiresDoppler: false,
      requiredRadarIds: shared.requestedRadarIds
    });
    if (!availability.accepted) {
      failures.push(entry.observedUtc);
      failureDiagnostics.push({
        observedUtc: entry.observedUtc,
        kind: availability.kind,
        message: availability.message
      });
      if (entry.observedUtc === availableEndUtc) {
        newestFailure = availability.kind + ': ' + availability.message;
      }
      continue;
    }
    radarFrameCache.set(
      entry.observedUtc,
      radarLoad.value
    );

    if (
      !isTemporallyInferredRadarFrame(
        radarLoad.value
      )
    ) {
      putRadarFrame(
        region,
        radarLoad.value
      ).catch(error =>
        console.warn(
          "Unable to persist radar history frame",
          error
        )
      );
    }

    frames.push(radarLoad.value);
    states.push(availability.state);
  }
  if (!frames.length || (automatic && !isCombined && frames.at(-1).observedUtc !== availableEndUtc)) {
    throw new Error(newestFailure || "Newest matching images could not be loaded; keeping the current loop and retrying automatically.");
  }
  // Reuse observations across normal forward refreshes so the worker sees each
  // scan once and retains storm IDs/history. Manual backfill and detected
  // browser-cache backfill rebuild chronologically before continuing forward.
  const rebuild =
    trackedThrough == null
    || needsHistoricalRebuild
    || frames.some(frame =>
      !radarResultCache.has(frame.observedUtc)
      && Date.parse(frame.observedUtc) <= Date.parse(trackedThrough));
  if (rebuild) {
    await hybridWorker.reset();
    radarResultCache.clear();
    trackedThrough = null;
  }
  const results = [];
  for (const frame of frames) {
    let result = radarResultCache.get(frame.observedUtc);
    if (!result) {
      result = await hybridWorker.processFrameBucket({ frames: [frame], referenceTime: frame.observedUtc,
        includeSegmentationLabels: true });
      radarResultCache.set(frame.observedUtc, result);
      trackedThrough = frame.observedUtc;
    }
    results.push(result);
  }
  const observedFrameByTime =
    new Map(
      frames.map(frame => [frame.observedUtc, frame])
    );
  const observedResultByTime =
    new Map(
      frames.map((frame, index) => [
        frame.observedUtc,
        results[index]
      ])
    );
  const observedStateByTime =
    new Map(
      frames.map((frame, index) => [
        frame.observedUtc,
        states[index]
      ])
    );

  let displayPlan;

  const combinedSchedule = isCombined
    ? buildDopplerAvailableSchedule(frames.map(frame=>frame.observedUtc),independentDopplerFrames)
    : [];
  if(isCombined && !combinedSchedule.length) {
    throw Error("No measured reflectivity survived inside the current Doppler source window.");
  }
  if(isCombined) {
    displayPlan = combinedSchedule.map(entry=>({
      kind:"observed",observedUtc:entry.radarObservedUtc
    }));
  } else {
    displayPlan = resolveRainHistoryWindow(
      frames.map(frame => frame.observedUtc),
      loopSelection
    ).plan;
  }

  const displayFrames = [];
  const displayResults = [];
  const displayStates = [];

  for (const entry of displayPlan) {
    if (entry.kind === "observed") {
      const frame =
        observedFrameByTime.get(entry.observedUtc);
      if (!frame) continue;

      displayFrames.push(frame);
      displayResults.push(
        observedResultByTime.get(entry.observedUtc)
        ?? null
      );
      displayStates.push(
        observedStateByTime.get(entry.observedUtc)
        ?? {
          reflectivityUtc: entry.observedUtc,
          pairings: [],
          records: [],
          sourceFailures: 0
        }
      );
      continue;
    }

    const before =
      observedFrameByTime.get(entry.beforeUtc);
    const after =
      observedFrameByTime.get(entry.afterUtc);

    if (!before || !after) continue;

    const inferredFrame =
      interpolateRadarFrame(
        before,
        after,
        entry.observedUtc,
        entry.weight
      );

    displayFrames.push(inferredFrame);
    displayResults.push(null);
    displayStates.push({
      reflectivityUtc:
        entry.observedUtc,
      pairings:
        selectedSourceRadars()
          .map(radarId => ({
            radarId,
            matched: false,
            candidate: null,
            deltaMinutes: null
          })),
      records: [],
      sourceFailures: 0,
      inferredDisplayOnly: true
    });
  }

  if (!displayFrames.length) {
    throw new Error(
      "No radar display frames could be assembled from the available history."
    );
  }

  const oldTime = hybridFrames[hybridFrameIndex]?.observedUtc;
  // Operators parked on Latest must follow genuine newly accepted scans.
  // Preserve a deliberately scrubbed historical position instead.
  const wasFollowingLatest = automatic && !isCombined &&
    hybridFrames.length > 0 && hybridFrameIndex === hybridFrames.length - 1;
  const resume = automatic ? playback.isPlaying() : true;
  $("hybridFrameSlider").disabled = true;
  $("hybridPlayButton").disabled = true;
  await playback.pause();
  hybridFrames = displayFrames;
  hybridResults = displayResults;
  preparedDopplerStates = displayStates;
  hybridCombinedSchedule = isCombined ? combinedSchedule : [];
  lastCombinedDopplerLatestUtc = isCombined ? independentDopplerFrames.at(-1)?.observedUtc : null;
  windLastRadarDriveKey = null;
  const publishedEntries = shared.entries.filter(entry => frames.some(frame => frame.observedUtc === entry.observedUtc));
  publishedSharedTimeline = { ...shared, entries: publishedEntries, endUtc: publishedEntries.at(-1)?.observedUtc ?? null };
  loadedLoopSelection = loopSelection;
  loadedWithDoppler = false;
  sharedTimeline = {
    ...timeline,
    startUtc: hybridFrames[0].observedUtc,
    endUtc: hybridFrames.at(-1).observedUtc,
    spanMinutes:
      (
        Date.parse(hybridFrames.at(-1).observedUtc)
        - Date.parse(hybridFrames[0].observedUtc)
      ) / 60000,
    failures
  };
  hybridHistory = new Map();
  hybridTrackVolumes = [];
  hybridDopplerFrameStates = [];
  hybridFrameIndex = automatic
    ? (wasFollowingLatest
      ? hybridFrames.length - 1
      : Math.max(0,hybridFrames.findIndex(frame=>frame.observedUtc===oldTime)))
    : 0;
  if(isCombined && automatic) hybridFrameIndex=0; // New Doppler cycle starts both streams together.
  // Keep the current Doppler layer visible while the replacement frame is
  // prepared. showHybridFrame() will reuse, crossfade or fade it out as required.
  const range = formatProductTimeRange(sharedTimeline.startUtc, sharedTimeline.endUtc);
  $("operationalLoopWindow").textContent =
    isCombined
      ? `Radar + Doppler · ${Math.round(loopMinutes)} min / ${hybridCombinedSchedule.length} steps`
      : rainHistoryIncomplete
        ? `${Math.round(sharedTimeline.spanMinutes)} min available · collecting BoM scans`
        : loopSelection === ALL_AVAILABLE_LOOP_VALUE
          ? `${Math.round(sharedTimeline.spanMinutes)} min available`
          : `${loopMinutes} min loop`;
  $("operationalLoopWindow").title =
    isCombined
      ? `${Math.round(loopMinutes)} min actual Doppler source window; both streams restart together`
      : rainHistoryIncomplete
        ? `Only ${Math.round(sharedTimeline.spanMinutes)} min of genuine recent reflectivity is currently available. Original BoM scan times are preserved.`
        : `${Math.round(sharedTimeline.spanMinutes)} min actual reflectivity span`;
  $("sharedHistoryNote").title =
    `${formatProductTime(sharedTimeline.startUtc)} → ${formatProductTime(sharedTimeline.endUtc)}`;
  const inferredLoaded =
    hybridFrames.filter(
      frame =>
        isTemporallyInferredRadarFrame(frame)
    ).length;
  const observedLoaded =
    hybridFrames.length - inferredLoaded;

  const frameFailures = summariseSkippedObservedFrames(failureDiagnostics);
  $("sharedHistoryNote").textContent = isCombined
    ? `Doppler-defined loop · ${independentDopplerFrames.length} measured Doppler frames + ${new Set(hybridFrames.map(frame=>frame.observedUtc)).size} measured radar frames · ${hybridCombinedSchedule.length} shared playback steps · ${Math.round(loopMinutes)} min source window` +
      (frameFailures.summary ? ` · ${frameFailures.summary}` : "")
    : `${availableHistorySummary()} · Loaded ${observedLoaded} observed` +
      " reflectivity frames" +
      (rainHistoryIncomplete ? ` · source history shorter than ${loopMinutes} min; showing available scans only` : "") +
      (inferredLoaded ? ` + ${inferredLoaded} inferred display frames` : "") +
      ` (${range})` +
      (shared.unavailableRadarIds.length ? ` · Doppler unavailable: ${shared.unavailableRadarIds.join(" / ")}` : "") +
      (frameFailures.summary ? ` · ${frameFailures.summary}` : "");
  $("sharedHistoryNote").title =
    (isCombined
      ? `${formatProductTime(independentDopplerFrames[0].observedUtc)} → ${formatProductTime(independentDopplerFrames.at(-1).observedUtc)} (Doppler source bounds)`
      : `${formatProductTime(sharedTimeline.startUtc)} → ${formatProductTime(sharedTimeline.endUtc)}`) +
    (frameFailures.detail ? `\nOmitted frame details:\n${frameFailures.detail}` : "");
  $("autoRefreshNote").textContent =
    isCombined
      ? "Auto update: checking every 5 min; rebuilding together when new Doppler arrives."
      : needsHistoricalRebuild
        ? "Auto update: historical cache expanded; loop rebuilt chronologically."
        : "Auto update: independent radar and Doppler refresh every 5 minutes.";
  if (
    selectedRadarRegion() !== "SEQ"
    && !["66","50","08"].includes(
      selectedRadarRegion()
    )
    && shared.requestedRadarIds.length > 0
  ) {
    $("sharedHistoryNote").textContent += " · wind display only (nominal registration)";
  }
  $("autoRefreshNote").title = "";

  const previousByTrack =
    new Map();

  for (
    let frameIndex = 0;
    frameIndex < hybridFrames.length;
    frameIndex++
  ) {
    const frame =
      hybridFrames[
        frameIndex
      ];

    const result =
      hybridResults[
        frameIndex
      ];

    const segmentation =
      result
        ?.segmentations
        ?.[0];

    const volumeMap =
      new Map();

    for (
      const track
      of result?.tracks ?? []
    ) {
      const observation =
        track.history?.find(
          item =>
            sameObservedInstant(
              item.observed_utc,
              frame.observedUtc
            )
        );

      if (!observation) {
        continue;
      }

      const volume =
        buildMeasuredTrackVolume(
          frame,
          segmentation,
          observation,
          model,
          {
            occupancyThreshold:
              Number(
                $("occupancyThreshold").value
              ),

            minimumOutputDbz:
              20,

            // Display threshold no longer changes measured-cell inference styles.
            displayThresholdDbz: 30,

            basePointSize:
              Number(
                $("pointSize").value
              )
          }
        );

      if (!volume) {
        continue;
      }

      // The stable QA renders the persistent, frame-wide 3-D volume.
      // Preserve track top, trend and support metrics without keeping another
      // complete set of redundant per-track 3-D point/footprint arrays for
      // every observation in the 60/120/180-minute history.
      const retainedVolume=INCREMENTAL_VOLUME_PREVIEW ? {
        high_support_top_40_m_amsl:volume.high_support_top_40_m_amsl,
        high_support_points:volume.high_support_points,
        inferred_point_count:volume.inferred_point_count
      } : volume;

      const previous =
        previousByTrack.get(
          track.track_id
        );

      const trend =
        previous
          ? highSupportTop40Trend(
              previous.volume,
              previous.observedUtc,
              retainedVolume,
              frame.observedUtc
            )
          : null;

      const record = {
        volume:retainedVolume,
        trend,
        observedUtc:
          frame.observedUtc
      };

      volumeMap.set(
        track.track_id,
        record
      );

      previousByTrack.set(
        track.track_id,
        record
      );
    }

    hybridTrackVolumes.push(
      volumeMap
    );
  }

  hybridDopplerFrameStates = []; // Independent Doppler never borrows a radar frame timestamp.
  syncFrameSlider(
    $("hybridFrameSlider"),
    hybridFrames.length,
    hybridFrameIndex
  );
  $("hybridPlayButton").disabled = hybridFrames.length < 2;
  await showHybridFrame(hybridFrameIndex);
  recordRadarAutoRefreshAudit({
    acceptedUtc: frames.at(-1).observedUtc,
    failure: frameFailures.detail || null,
    outcome: frameFailures.summary
      ? "updated; some genuine source frames unavailable"
      : automatic ? "updated" : "manual load complete"
  });
  if (resume) playback.play();
  // Bound decoded imagery and per-frame results while retaining worker tracks.
  // Playback references remain in hybridFrames and hybridResults. The extra
  // archive cache can release old decoded source data beyond that window.
  const activeSourceTimes=new Set(hybridFrames
    .filter(f=>!isTemporallyInferredRadarFrame(f)).map(f=>f.observedUtc));
  const latestTimes=[...radarResultCache.keys()].sort().slice(
    -(INCREMENTAL_VOLUME_PREVIEW?12:48));
  const retained = new Set(INCREMENTAL_VOLUME_PREVIEW
    ? [...activeSourceTimes,...latestTimes]
    : latestTimes);
  for (const cache of [radarFrameCache, radarResultCache]) {
    for (const key of cache.keys()) if (!retained.has(key)) cache.delete(key);
  }
  // Wind history cache retained independently of radar loop updates.

  pruneRadarFrames({
    beforeEpoch:
      Date.now()
      - 4 * 60 * 60 * 1000,
    maxRecords: 240
  }).catch(error =>
    console.warn(
      "Unable to prune persistent radar history cache",
      error
    )
  );

  // Bootstrap the browser-local archive with every source frame that the
  // Bureau still exposes, not just the currently selected display window.
  // This shortens the time needed to accumulate a full three-hour history.
  if (
    !automatic
    && !recentDiscovery
  ) {
    warmRadarHistoryCache(
      region,
      discoveredTimes
    );
  }
}

async function runSourceLoad(loader, background = false) {
  if (sequenceLoading || !model) return false;
  if (!background) motionTransition.cancel();
  sequenceLoading = true;
  $("loopDurationMinutes").disabled = true;
  $("radarSite").disabled = true;
  const buttons = background ? ["loadHybridButton", "loadButton"] : ["loadHybridButton", "loadButton", "jumpLatestButton", "hybridPlayButton"];
  for (const id of buttons) $(id).disabled = true;
  if (!background) {
    $("hybridFrameSlider").disabled = true;
    await playback.pause();
  }
  try {
    await loader();
    return true;
  } catch (error) {
    if (background) {
      recordRadarAutoRefreshAudit({
        failure: String(error?.message ?? error), outcome: "failed"
      });
      const failedRadar = error.message.match(/Doppler (\d{2,3})/)?.[1];
      $("autoRefreshNote").textContent = failedRadar
        ? `Auto update: Doppler ${failedRadar} unavailable; retrying.`
        : "Auto update: newest matched images unavailable; retrying.";
      $("autoRefreshNote").title = error.message;
      // An automatic source failure is not a successful refresh. Scheduler
      // applies bounded retry without resetting the normal 5-minute cadence.
      throw error;
    }
    else setStatus(error.message, "error");
  } finally {
    sequenceLoading = false;
    prewarmUpcomingFrames(hybridFrameIndex);
    $("loopDurationMinutes").disabled = !availableRadarHistoryTimes.length && independentDopplerFrames.length<2;

    $("radarSite").disabled = false;
    for (const id of ["loadButton", "jumpLatestButton"]) $(id).disabled = false;
    const selectedWindow = $("loopDurationMinutes").selectedOptions?.[0];
    $("loadHybridButton").disabled = !selectedWindow ||
      selectedWindow.disabled || !selectedWindow.value;
    const activeCount=isNativeDopplerPlayback() ? windPlaybackFrames.length : hybridFrames.length;
    $("hybridPlayButton").disabled = activeCount < 2;
    $("hybridFrameSlider").disabled = !activeCount;
  }
}

async function loadLatest() {
  setStatus(
    "Loading latest BOM reflectivity and building inferred vertical volume…"
  );

  const frame =
    await loadLatestBomReflectivityMosaic(Date.now(), selectedRadarRegion());

  latestFrame = frame;
  hybridSource.entities.removeAll();
  clearHybridTrackVolumeCollection();
  hybridFrames = [];
  hybridResults = [];
  hybridDopplerFrameStates = [];
  severeStormAlertOverlay.setFrame();
  syncFrameSlider(
    $("hybridFrameSlider"),
    0,
    0
  );
  hybridTrackVolumes = [];
  hybridFrameIndex = 0;
  sharedTimeline = null;
  publishedSharedTimeline = null;
  loadedLoopSelection = null;
  loadedWithDoppler = null;
  $("hybridFrameLabel").textContent = "—";
  $("hybridRows").innerHTML = '<div class="hybrid-muted">Load radar history to view storm tracks.</div>';
  $("operationalLoopWindow").textContent = "Latest only";
  $("sharedHistoryNote").textContent = "Reflectivity and Doppler have independent source histories.";
  $("hybridTrackCount").textContent = "0";
  $("hybridPersistentCount").textContent = "0";

  const renderToken =
    ++hybridSceneRenderToken;

  // Latest-only stays source-atomic, and never invents supplemental scans.
  const latestSupplementalAnchor=additionalRadarSiteIds.length
    ? supplementalAnchorForFrame(frame):null;
  if(latestSupplementalAnchor)
    await supplementalRadarDisplay.prepare(latestSupplementalAnchor.observedUtc);
  if(renderToken!==hybridSceneRenderToken)return;
  const surfaceApplied =
    await renderSurface(
      frame,
      renderToken,{
        onBeforeReveal:()=>{
          if(latestSupplementalAnchor){
            supplementalRadarDisplay.commit(latestSupplementalAnchor.observedUtc,{
              alpha:Number($("radarOpacity").value)/100
            });
            displaySupplementalHoldStatus(latestSupplementalAnchor);
          }else{
            void supplementalRadarDisplay.show(null,{enabled:false});
            displaySupplementalHoldStatus(null);
          }
        }
      }
    );

  if (!surfaceApplied) {
    return;
  }

  renderInferredVolume(
    frame
  );

  $("sourceTime").textContent =
    formatProductTime(frame.observedUtc);

  $("decodedPixels").textContent =
    (
      frame.sourceMetadata
        ?.colouredPixelCount
      ?? 0
    ).toLocaleString();

  const maximumCategory =
    frame.sourceMetadata
      ?.maxCategory
    ?? 0;

  const maxLower =
    frame.sourceMetadata
      ?.maxDbzLowerBound;

  $("sourceMaximum").textContent =
    maximumCategory
      ? (
          maxLower == null
            ? `category ${maximumCategory}`
            : `category ${maximumCategory} (>=${maxLower} dBZ)`
        )
      : "none";

  updateOperationalOverview(
    frame,
    "latest"
  );

  setStatus(
    `INFERRED LIVE 3-D built from public BOM 2-D reflectivity at ${formatProductTime(frame.observedUtc)}. ` +
    `Vertical structure is empirical and uncertainty-qualified; it is not measured volumetric radar.`,
    "ok"
  );
}

async function initialise() {
  const [
    modelResponse,
    validationResponse
  ] = await Promise.all([
    fetch(
      MODEL_URL,
      { cache: "no-store" }
    ),
    fetch(
      VALIDATION_URL,
      { cache: "no-store" }
    )
  ]);

  if (!modelResponse.ok) {
    throw new Error(
      `Inferred model request failed: ${modelResponse.status}`
    );
  }

  if (!validationResponse.ok) {
    throw new Error(
      `Validation report request failed: ${validationResponse.status}`
    );
  }

  model =
    await modelResponse.json();

  validation =
    await validationResponse.json();

  if (
    model.format
    !== "StormTrackerEmpiricalVerticalReflectivityModelV2"
  ) {
    throw new Error(
      "Unexpected multi-event inferred model format."
    );
  }

  const aggregate =
    validation.overall;

  $("validationMae").textContent =
    `${aggregate.mean_event_intensity_mae_dbz.toFixed(2)} dBZ`;

  $("validationIou40").textContent =
    aggregate.thresholds["40"]
      .mean_iou
      .toFixed(3);

  $("validationTop40").textContent =
    `${(
      aggregate.thresholds["40"]
        .median_event_echo_top_absolute_error_m
      / 1000
    ).toFixed(2)} km`;

  $("occupancyThreshold").value =
    String(
      DEFAULT_OCCUPANCY_THRESHOLD
    );

  $("occupancyValue").textContent =
    DEFAULT_OCCUPANCY_THRESHOLD
      .toFixed(2);

  // Terrain is configured directly by the engine: no retired UI control.
  // The isolated street-flat diagnostic route retains its intentional override.
  (FLAT_TERRAIN_PERFORMANCE_TEST
    ? terrainManager.setEnabled(false,{persist:false})
    : terrainManager.setEnabled(true))
    .then(() => {
      if(FLAT_TERRAIN_PERFORMANCE_TEST)
        setTerrainStatus("FLAT TERRAIN TEST · elevation tiles disabled","ok");
    })
    .catch(error => {
      console.warn("3-D terrain initialisation failed",error);
      setTerrainStatus(
        "3-D terrain unavailable · using flat fallback",
        "error"
      );
    });

  resetView();

  updateLoopButtonLabel();

  setAdvancedScienceVisible(
    false
  );

  updateOperationalOverview(
    null,
    "latest"
  );

  for (const id of ["loadHybridButton", "loadButton", "jumpLatestButton"]) $(id).disabled = false;
  setStatus("Loading live radar tracking history…");
  autoRefresh.start();
  independentDopplerRefresh.start();
  await runSourceLoad(loadHybridSequence);
  updateIndependentDopplerUi();
  if(isDopplerSourceActive()) {
    void refreshIndependentDopplerHistory(false).catch(error=>{
      $("dopplerOverlayStatus").textContent = "Doppler retry: " + error.message;
    });
  }
}


$("radarSite").addEventListener("change", () => runSourceLoad(async () => {
  motionTransition.cancel();
  ++independentDopplerRequest;
  independentDopplerFrames=[];
  independentDopplerIndexValue=0;
  independentDopplerRecord=null;
  independentDopplerSourceId=null;
  hybridCombinedSchedule=[];
  windPlaybackFrames=[];
  lastCombinedDopplerLatestUtc=null;
  windLastRadarDriveKey=null;
  windCycleCursor=-1;
  // A user changing the primary within an active multi-site selection
  // should not silently lose the radar they were viewing previously.
  // Single-site V9 switching keeps its original one-radar behaviour.
  const nextPrimary=selectedRadarRegion();
  if(additionalRadarSiteIds.length && nextPrimary!==previousPrimaryRadarId){
    additionalRadarSiteIds=chooseSupplementalRadarSites(nextPrimary,
      [...additionalRadarSiteIds,previousPrimaryRadarId],BORDER_RADAR_SITES);
  }
  previousPrimaryRadarId=nextPrimary;
  configureRadarSite(); resetView(); clearDopplerOverlay();
  refreshAdditionalRadarChoices();
  if(INCREMENTAL_VOLUME_PREVIEW)
    supplementalVolumeDisplay?.pruneSites(additionalRadarSiteIds);
  showSupplementalRadarSites(null);
  resetTrackDisplaySelection();
  updateIndependentDopplerUi();
  radarFrameCache.clear(); radarResultCache.clear(); dopplerFrameCache.clear();
  measuredRadarProviderCache.clear?.();
  trackedThrough = null; publishedSharedTimeline = null; latestFrame = null;
  lastSourceDiscoveryRegion = null;
  lastSourceDiscoveryAt = 0;
  lastSourceDiscoveryTimes = [];
  radarImageryHandover.reset();
  surfaceLayer = null;
  clearVolumeGeometryCache();
  hybridFrames = []; hybridResults = []; hybridDopplerFrameStates = [];
  severeStormAlertOverlay.setFrame(); // Never carry alerts into a different radar region.
  stormTrackLabelOverlay.setMarkers([]); // Clear obsolete track identities during source change.
  syncFrameSlider(
    $("hybridFrameSlider"),
    0,
    0
  );
  availableRadarHistoryTimes = [];
  const historyOption = document.createElement("option");
  historyOption.value = "";
  historyOption.textContent = "Checking radar history…";
  $("loopDurationMinutes").replaceChildren(historyOption);
  $("loopDurationMinutes").disabled = true;
  $("operationalLoopWindow").textContent = "Checking history";
  hybridSource.entities.removeAll(); clearHybridTrackVolumeCollection();
  // Both reloads run on independent source pathways and clocks.
  if(isDopplerSourceActive()) {
    if(selectedLoopSelection()===DOPPLER_AVAILABLE_LOOP_VALUE)
      await refreshIndependentDopplerHistory(false);
    else void refreshIndependentDopplerHistory(false).catch(error=>{
      $("dopplerOverlayStatus").textContent=error.message;
    });
  }
  await loadHybridSequence();
}));

$("loadHybridButton").addEventListener("click", () => runSourceLoad(loadHybridSequence));
$("basemapSelect").addEventListener(
  "change",
  event => {
    motionTransition.cancel();

    try {
      const result =
        basemapManager.setBasemap(
          event.target.value
        );

      event.target.value =
        result.id;

      syncBasemapReferenceLayer(
        result.id
      );
    } catch (error) {
      event.target.value =
        basemapManager.currentId
        ?? BASEMAP_IDS.STREET;

      setBasemapStatus(
        `Basemap switch failed · ${error.message ?? error}`,
        "error"
      );
    }
  }
);

// The optional terrain checkbox has been retired from the operator UI.
// The manager always attempts world elevation in this preview; a source
// failure remains visible in terrainStatus and uses its safe flat fallback.

$("loopDurationMinutes").addEventListener("change", () => {
  persistentWeatherLegend.sync();
  motionTransition.cancel();
  // Immediately retire all additional velocity imagery when leaving native
  // Doppler, before any new source request can be delayed by a long load.
  if (selectedLoopSelection() !== DOPPLER_AVAILABLE_LOOP_VALUE)
    supplementalDopplerDisplay.setEnabled(false);
  // Invalidate any pending combined-frame handover BEFORE clearing Doppler.
  // Otherwise an awaiting native BoM image can resurrect the outgoing wind.
  ++hybridSceneRenderToken;
  ++independentDopplerRequest;
  // Apply the visible-mode boundary immediately, before asynchronous loading
  // can redraw obsolete ST tracks or a previously selected threat cone.
  if (selectedLoopSelection() === DOPPLER_AVAILABLE_LOOP_VALUE)
    clearReflectivityForDoppler();
  renderDopplerOverlay();
  updateIndependentDopplerUi();
  updateLoopButtonLabel();
  if (!sequenceLoading) runSourceLoad(loadHybridSequence);
});
function checkRadarOnForegroundReturn() {
  if (document.hidden) return;
  void autoRefresh.check();
  void independentDopplerRefresh.check();
}
// iOS Safari can restore a frozen tab with pageshow/focus but no reliable
// visibilitychange. The scheduler coalesces duplicate events.
document.addEventListener("visibilitychange", checkRadarOnForegroundReturn);
window.addEventListener("pageshow", checkRadarOnForegroundReturn);
window.addEventListener("focus", checkRadarOnForegroundReturn);
$("jumpLatestButton").addEventListener("click", async () => {
  if (sequenceLoading) return;
  await playback.pause();
  if(isNativeDopplerPlayback()){
    showDopplerOnlyFrame(windPlaybackFrames.length-1).catch(error=>setStatus(error.message,"error"));
  } else if (hybridFrames.length) {
    showHybridFrame(hybridFrames.length - 1).catch(error => setStatus(error.message, "error"));
  } else {
    runSourceLoad(loadLatest);
  }
});
$("openDetailsButton").addEventListener("click", () => {
  selectDetailsTab("tracks");
  setAdvancedScienceVisible(true);
});
$("closeDetailsButton").addEventListener("click", () => setAdvancedScienceVisible(false));
for (const button of document.querySelectorAll("[data-detail-tab]")) {
  button.addEventListener("click", () => selectDetailsTab(button.dataset.detailTab));
}
$("hybridFrameSlider").addEventListener("input", async event => {
  motionTransition.cancel();
  const index = Number(event.target.value);
  await playback.pause();
  (isNativeDopplerPlayback() ? showDopplerOnlyFrame(index) : showHybridFrame(index))
    .catch(error => setStatus(error.message, "error"));
});
$("hybridPlayButton").addEventListener("click", () => {
  motionTransition.cancel();
  if (playback.isPlaying()) playback.pause();
  else playback.play();
});

// Toggle BOTH tracking points and their labels on the CURRENT (even paused)
// frame, without updating radar, volume primitives or the playback position.
function updateRenderedTrackLabels() {
  const show = Boolean($("showTrackLabels")?.checked) && !isNativeDopplerPlayback();
  // Hidden trail geometry is no longer generated at every weather frame.
  // Build it once only when the operator explicitly enables Labels.
  if(show && hybridResults[hybridFrameIndex] && !isNativeDopplerPlayback()){
    renderHybridTracks(hybridFrameIndex);
    return;
  }
  stormTrackLabelOverlay.setVisible(show);
  setStormTrackTrailVisibility(hybridSource.entities, show);
  scene.requestRender();
}
// The QFD legend uses exactly the public GroupedType symbols fetched by the
// existing incident layer. Reveal the key automatically whenever jobs are on.
$("showQfdTechnicalRescues").addEventListener("change",event=>{
  const legend=$("qfdIncidentLegendDetails");
  if(legend)legend.open=Boolean(event.target.checked);
});
$("showTrackLabels").addEventListener("change",updateRenderedTrackLabels);
$("trackDisplayFilter").addEventListener("change", event => {
  selectedTrackDisplayId = event.target.value || "";
  if (!selectedTrackDisplayId) $("showTrackThreatCone").checked = false;
  if(!isNativeDopplerPlayback()) {
    updateTrackDisplayControls(hybridFrameIndex);
    applyHybridVolumeMode(hybridFrameIndex);
    renderHybridTracks(hybridFrameIndex);
  }
});
$("showTrackThreatCone").addEventListener("change", () => {
  if(!isNativeDopplerPlayback()) renderHybridTracks(hybridFrameIndex);
});

// Doppler is a separate native display with fixed 100% opacity.
// Radar and inferred 3-D opacity remain independent.
$("radarOpacity").addEventListener("input", event => {
  motionTransition.cancel();
  const opacity = Number(event.target.value) / 100;
  $("radarOpacityValue").textContent = `${event.target.value}%`;
  radarImageryHandover.setOpacity(isNativeDopplerPlayback() ? 0 : opacity);
  supplementalRadarDisplay.setOpacity(isNativeDopplerPlayback() ? 0 : opacity);
  surfaceLayer = radarImageryHandover.currentLayer;
  scene.requestRender();
});
// Display-only point transparency: retained measured source reflectivity and
// empirical 3-D intensity calculations do not change. No radar/2-D surface
// opacity is altered; standalone Doppler always stays fully opaque.
$("volumeOpacity").addEventListener("input", event => {
  const percent=Number(event.target.value);
  $("volumeOpacityValue").textContent=`${percent}%`;
  incrementalVolumeRenderer?.finishAnimation();
  setVolumeDisplayOpacity(inferredCollection,percent);
  setVolumeDisplayOpacity(hybridTrackVolumeCollection,percent);
  setVolumeDisplayOpacity(hybridTrackFootprintCollection,percent);
  supplementalVolumeDisplay?.setOpacity(percent);
  scene.requestRender();
});

$("loadButton").addEventListener("click", () => runSourceLoad(
  isNativeDopplerPlayback() ? ()=>loadDopplerSequence(false) : loadLatest));

$("minimumDbzh").addEventListener(
  "input",
  event => {
    $("minimumDbzhValue")
      .textContent =
        event.target.value;

    if (latestFrame && !isNativeDopplerPlayback()) {
      renderInferredVolume(
        latestFrame
      );
      supplementalVolumeDisplay?.refresh();

      if (hybridResults.length) {
        applyHybridVolumeMode(
          hybridFrameIndex
        );

        renderHybridTracks(
          hybridFrameIndex
        );
      }
    }
  }
);

$("occupancyThreshold").addEventListener(
  "input",
  event => {
    $("occupancyValue")
      .textContent =
        Number(
          event.target.value
        ).toFixed(2);

    if (latestFrame && !isNativeDopplerPlayback()) {
      renderInferredVolume(
        latestFrame
      );
      supplementalVolumeDisplay?.refresh();

      if (hybridResults.length) {
        applyHybridVolumeMode(
          hybridFrameIndex
        );

        renderHybridTracks(
          hybridFrameIndex
        );
      }
    }
  }
);

$("verticalScale").addEventListener(
  "input",
  event => {
    $("verticalScaleValue")
      .textContent =
        Number(
          event.target.value
        ).toFixed(1);

    if (latestFrame && !isNativeDopplerPlayback()) {
      renderInferredVolume(
        latestFrame
      );
      supplementalVolumeDisplay?.refresh();

      if (hybridResults.length) {
        applyHybridVolumeMode(
          hybridFrameIndex
        );

        renderHybridTracks(
          hybridFrameIndex
        );
      }
    }
  }
);

$("pointSize").addEventListener(
  "input",
  event => {
    $("pointSizeValue")
      .textContent =
        event.target.value;

    if (latestFrame && !isNativeDopplerPlayback()) {
      renderInferredVolume(
        latestFrame
      );
      supplementalVolumeDisplay?.refresh();

      if (hybridResults.length) {
        applyHybridVolumeMode(
          hybridFrameIndex
        );

        renderHybridTracks(
          hybridFrameIndex
        );
      }
    }
  }
);

$("resetButton").addEventListener(
  "click",
  () => {
    resetView();
  }
);

refreshReflectivityLegend();

initialise().catch(
  error => {
    console.error(error);

    setStatus(
      error.message,
      "error"
    );
  }
);
