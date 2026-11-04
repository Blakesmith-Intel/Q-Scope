import {
  BOM_RIVER_TIDE_GAUGE_ATTRIBUTION,
  DEFAULT_RIVER_GAUGE_REFRESH_MS,
  riverGaugeSummary
} from "./river-gauges-v1.js?v=9.12.0";

import {
  loadRiverGaugeOperationalSnapshot
} from "./river-gauge-observations-v1.js?v=9.12.0";
import {withStationFloodLevels}
  from "./river-flood-thresholds-v1.js?v=20261020-new-beith-ahd-v2";

import {
  FLOOD_SIGNAL_STORAGE_KEY,
  FLOOD_SIGNAL_MAX_AGE_MS,
  appendGaugeObservation,
  cleanFloodSignalHistory,
  compactFloodHistory,
  filterOperationalFloodGauges,
  coastalGaugeTidalCoverage
} from "./river-flood-signals-v1.js?v=9.13.2";

import {
  FLOOD_EVENTS_STORAGE_KEY,cleanFloodEvents,reconcileFloodEvents
} from "./river-flood-events-v1.js?v=9.13.2";

import {
  OFFICIAL_FLOOD_STORAGE_KEY,cleanConfirmedFloodStations,
  retainConfirmedFloodStations
} from "./river-official-flood-persistence-v1.js?v=20261018-stage-persistence";

import {
  LATEST_RIVER_GAUGE_STORAGE_KEY,cleanLatestGaugeObservations,
  retainLatestGaugeObservations
} from "./river-gauge-latest-v1.js?v=20261019-fresh-observation-v1";

import {
  recentFloodHistoryCandidate,
  recentFloodHistoryGap,
  planBoMStationTableLookups,
  classifyBoMRecentHistoryFailure,
  fetchBoMRecentHistoryDetail,
  reconcileOfficialBoMTableHeight,
  officialRecentTableTarget
} from "./bom-recent-river-history-v1.js?v=9.13.1";

// Preserve exact same-station browser observations after a numeric BoM
// network ID gains its published leading zero (35295 -> 035295).
// Never join by geography/name and never reassign a different AWRC station.
export function canonicaliseLegacyBoMStationCache(records){
  if(!records||typeof records!=="object"||Array.isArray(records))return records;
  const entries=Object.entries(records);
  entries.sort(([a],[b])=>{
    const canonical=id=>!/^bom:\d{1,6}$/.test(id)||
      id.slice(4).length===6;
    return Number(canonical(b))-Number(canonical(a));
  });
  const out={};
  for(const [id,value] of entries){
    const canonical=/^bom:\d{1,6}$/.test(id)
      ?"bom:"+id.slice(4).padStart(6,"0"):id;
    const repairFeature=feature=>{
      if(!feature||typeof feature!=="object"||feature.id!==id)return feature;
      const native=String(feature.properties?.bom_stn_num??"");
      if(native&&(!/^\d{1,6}$/.test(native)||
         native.padStart(6,"0")!==canonical.slice(4)))return feature;
      return {...feature,id:canonical};
    };
    const repaired=id===canonical?value:
      value&&typeof value==="object"&&!Array.isArray(value)
        ?{...value,
          ...(value.feature?{feature:repairFeature(value.feature)}:{}),
          ...(value.latestFeature?
            {latestFeature:repairFeature(value.latestFeature)}:{})}
        :value;
    if(!Object.hasOwn(out,canonical)){out[canonical]=repaired;continue;}
    if(Array.isArray(out[canonical])&&Array.isArray(repaired)){
      const byTime=new Map();
      for(const item of [...repaired,...out[canonical]]){
        if(Number.isFinite(item?.time)&&Number.isFinite(item?.height))
          byTime.set(item.time,item);
      }
      out[canonical]=[...byTime.values()].sort((a,b)=>a.time-b.time);
    }
  }
  return out;
}

export function riverGaugeOperationalSummary(
  feature
) {
  const base =
    riverGaugeSummary(
      feature
    );

  const properties =
    feature?.properties
    ?? {};

  const height =
    Number(
      properties
        .STORMTRACKER_HEIGHT_METRES
    );

  return {
    ...base,

    heightMetres:
      Number.isFinite(
        height
      )
        ? height
        : null,

    tendency:
      String(
        properties
          .STORMTRACKER_TENDENCY
        ?? "unknown"
      ),

    floodClass:
      String(
        properties
          .STORMTRACKER_FLOOD_CLASS
        ?? ""
      ),

    observedText:
      String(
        properties
          .STORMTRACKER_OBSERVED_TEXT
        ?? ""
      ),

    sourceProduct:
      String(
        properties
          .STORMTRACKER_SOURCE_PRODUCT
        ?? ""
      ),

    recentDataHref:
      String(
        properties
          .STORMTRACKER_RECENT_DATA_HREF
        ?? ""
      ),

    displayState:
      String(
        properties
          .STORMTRACKER_DISPLAY_STATE
        ?? "unknown"
      ),

    tidalContext:
      String(
        properties
          .STORMTRACKER_TIDAL_CONTEXT
        ?? ""
      ),

    alertReason:
      String(properties.STORMTRACKER_ALERT_REASON ?? ""),

    riseRateMetresPerHour:
      typeof properties.STORMTRACKER_RISE_RATE_M_PER_H === "number"
        ? properties.STORMTRACKER_RISE_RATE_M_PER_H : null,

    rateIntervalMinutes:
      typeof properties.STORMTRACKER_RATE_INTERVAL_MINUTES === "number"
        ? properties.STORMTRACKER_RATE_INTERVAL_MINUTES : null,

    tidalBaselineMetresPerHour:
      typeof properties.STORMTRACKER_TIDAL_BASELINE_M_PER_H === "number"
        ? properties.STORMTRACKER_TIDAL_BASELINE_M_PER_H : null,

    observationStale:Boolean(properties.STORMTRACKER_OBSERVATION_STALE),
    classificationUnverified:Boolean(properties.STORMTRACKER_CLASSIFICATION_UNVERIFIED),
    lastConfirmedFloodClass:String(properties.STORMTRACKER_LAST_CONFIRMED_FLOOD_CLASS??""),
    lastConfirmedFloodAt:Number(properties.STORMTRACKER_LAST_CONFIRMED_FLOOD_AT)||null,
    thresholdStatus:String(properties.STORMTRACKER_THRESHOLD_STATUS??""),
    thresholdSource:String(properties.STORMTRACKER_THRESHOLD_SOURCE??""),
    thresholdSourceDate:String(properties.STORMTRACKER_THRESHOLD_SOURCE_DATE??""),
    thresholdReference:String(properties.STORMTRACKER_THRESHOLD_REFERENCE??""),
    gaugeIdentityWarning:String(properties.STORMTRACKER_IDENTITY_WARNING??""),
    floodThresholds:{
      minor:properties.STORMTRACKER_MINOR_FLOOD_METRES??null,
      moderate:properties.STORMTRACKER_MODERATE_FLOOD_METRES??null,
      major:properties.STORMTRACKER_MAJOR_FLOOD_METRES??null},
    crossingLevelMetres:typeof properties.STORMTRACKER_CROSSING_LEVEL_METRES==="number"
      ?properties.STORMTRACKER_CROSSING_LEVEL_METRES:null,
    crossingName:String(properties.STORMTRACKER_CROSSING_NAME??""),
    crossingType:String(properties.STORMTRACKER_CROSSING_TYPE??""),
    crossingSource:String(properties.STORMTRACKER_CROSSING_SOURCE??""),
    crossingReached:Boolean(properties.STORMTRACKER_CROSSING_REACHED),
    alertSource:String(properties.STORMTRACKER_ALERT_SOURCE??""),
    officialObservedAt:Number(properties.STORMTRACKER_OFFICIAL_OBSERVED_AT)||null,
    alertPersisted:Boolean(properties.STORMTRACKER_ALERT_PERSISTED),
    recoveryReadings:Number(properties.STORMTRACKER_RECOVERY_READINGS??0),
    recoveryBaselineMetres:typeof properties.STORMTRACKER_RECOVERY_BASELINE_METRES==="number"?
      properties.STORMTRACKER_RECOVERY_BASELINE_METRES:null,
    rapidRise:Boolean(properties.STORMTRACKER_RAPID_RISE),
    tidalScreened:Boolean(properties.STORMTRACKER_TIDAL_SCREENED)
  };
}

// Same water marker at every stage; only BoM flood severity changes colour.
// ONE blue arrow badge is used for measured rapid rise / possible flash flooding.
// A below-minor candidate is the blue icon with the same blue arrow.
const FLOOD_MARKER_COLORS=Object.freeze({
  "rapid-rise":"#1269e8",elevated:"#1269e8",crossing:"#f5a21b",minor:"#2db76f",
  moderate:"#ffd43b",major:"#e53935",unverified:"#8292a2"
});
export function createRiverGaugeMarkerImage(state,rapidRise=false){
  const level=Object.hasOwn(FLOOD_MARKER_COLORS,state)?state:"rapid-rise";
  const colour=FLOOD_MARKER_COLORS[level];
  const arrow=rapidRise || level==="rapid-rise";
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="88" viewBox="0 0 80 88">
    <path d="M35 5 C16 5 6 19 6 35 C6 54 19 65 35 80 C51 65 64 54 64 35 C64 19 54 5 35 5Z"
      fill="${colour}" stroke="#132337" stroke-width="2.6" stroke-linejoin="round"/>
    ${level==="crossing"?`<!-- Bridge deck and supports with blue water overtopping the roadway. -->
    <path d="M18 26 H52 M21 26 V47 M49 26 V47
             M21 47 Q35 33 49 47"
       fill="none" stroke="#ffffff" stroke-width="4.4"
       stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M16 31 Q21 26 26 31 T36 31 T46 31 T56 31
             M16 39 Q21 34 26 39 T36 39 T46 39 T56 39"
       fill="none" stroke="#1269e8" stroke-width="4.2"
       stroke-linecap="round"/>`:`
    <circle cx="35" cy="34" r="21" fill="none" stroke="#fff" stroke-width="3"/>
    <path d="M20 30 Q25 35 30 30 T40 30 T50 30
             M20 39 Q25 44 30 39 T40 39 T50 39"
      fill="none" stroke="#fff" stroke-width="3.8" stroke-linecap="round"/>`}
    ${arrow?`<circle cx="61" cy="16" r="14" fill="#1269e8"
       stroke="#ffffff" stroke-width="3"/>
      <path d="M61 6 L52.5 17 H57.5 V25 H64.5 V17 H69.5Z"
        fill="#fff"/>`:""}
  </svg>`;
  return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
}


// Cesium on iOS Safari must receive a REAL, uniformly rasterised bitmap.
// Supplying a mixture of SVG data-URL textures allowed visually different
// pin footprints despite identical BillboardCollection width/height values.
// Share the existing EXACT colours and SVG path coordinates; icon/alert logic
// and the SVG used in the legend/information card remain untouched.
// 2x antialiasing is downsampled by Cesium into the SAME 38x42 map footprint.
export function createRiverGaugeMapMarkerBitmap(
 state,rapidRise=false,
 canvasFactory=()=>globalThis.document?.createElement?.("canvas"),
 Path2DRef=globalThis.Path2D
){
 const fallback=()=>createRiverGaugeMarkerImage(state,rapidRise);
 const level=Object.hasOwn(FLOOD_MARKER_COLORS,state)?state:"rapid-rise";
 if(typeof Path2DRef!=="function"||typeof canvasFactory!=="function")
  return fallback();
 try{
  const canvas=canvasFactory();
  if(!canvas?.getContext||!canvas?.toDataURL)return fallback();
  canvas.width=160;canvas.height=176;
  const ctx=canvas.getContext("2d");
  if(!ctx)return fallback();
  ctx.scale(2,2);
  const path=d=>new Path2DRef(d);
  const draw=(d,fill,stroke,weight=0,linecap="butt")=>{
   const p=path(d);
   if(fill){ctx.fillStyle=fill;ctx.fill(p);}
   if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=weight;
    ctx.lineCap=linecap;ctx.lineJoin="round";ctx.stroke(p);}
  };
  draw("M35 5 C16 5 6 19 6 35 C6 54 19 65 35 80 C51 65 64 54 64 35 C64 19 54 5 35 5Z",
   FLOOD_MARKER_COLORS[level],"#132337",2.6);
  if(level==="crossing"){
   draw("M18 26 H52 M21 26 V47 M49 26 V47 M21 47 Q35 33 49 47",
    null,"#ffffff",4.4,"round");
   draw("M16 31 Q21 26 26 31 T36 31 T46 31 T56 31 M16 39 Q21 34 26 39 T36 39 T46 39 T56 39",
    null,"#1269e8",4.2,"round");
  }else{
   ctx.beginPath();ctx.arc(35,34,21,0,2*Math.PI);
   ctx.strokeStyle="#fff";ctx.lineWidth=3;ctx.stroke();
   draw("M20 30 Q25 35 30 30 T40 30 T50 30 M20 39 Q25 44 30 39 T40 39 T50 39",
    null,"#fff",3.8,"round");
  }
  if(rapidRise||level==="rapid-rise"){
   ctx.beginPath();ctx.arc(61,16,14,0,2*Math.PI);
   ctx.fillStyle="#1269e8";ctx.fill();
   ctx.strokeStyle="#ffffff";ctx.lineWidth=3;ctx.stroke();
   draw("M61 6 L52.5 17 H57.5 V25 H64.5 V17 H69.5Z","#fff");
  }
  const png=canvas.toDataURL("image/png");
  return typeof png==="string"&&png.startsWith("data:image/png;base64,")
   ?png:fallback();
 }catch{
  // Do not sacrifice an operational BoM flood marker if browser canvas fails.
  return fallback();
 }
}

import {createSeverityMarkerLayers,floodIconPriority} from "./severity-marker-layer-v1.js?v=20261024-flood-recovery-severity-v1-single-flood-path-v10.2.21-final-pixel-size";

// Every flood map pin is exactly the same screen size, regardless of stage,
// crossing status or measured rapid rise. Keep legend sizing independent.
// The artwork still uses its source-native 80:88 pin aspect ratio.
export const RIVER_GAUGE_MAP_MARKER_SIZE=Object.freeze({width:38,height:42});
export function riverGaugeMapMarkerDimensions(){
  return RIVER_GAUGE_MAP_MARKER_SIZE;
}

export function createRiverGaugeLayer({
  viewer,

  CesiumRef =
    globalThis.Cesium,

  fetchImpl =
    globalThis.fetch,

  refreshMs =
    DEFAULT_RIVER_GAUGE_REFRESH_MS,

  visible =
    false,

  onStatus =
    () => {},

  onUpdate =
    () => {},

  storage = globalThis.localStorage,
  now = () => Date.now()
} = {}) {
  if (
    !viewer
    || !CesiumRef
  ) {
    throw new Error(
      "River-gauge layer requires Cesium and a viewer."
    );
  }

  const severityLayers=createSeverityMarkerLayers({
    viewer,CesiumRef,owner:"flood",priorities:[0,1,2,4,6],visible
  });
  const dataSource=severityLayers.dataSource;

  const markerImages =
    new Map();

  let currentFeatures = [];
  let history = {};
  let floodEvents={};
  // Bounded, same-station BoM table crossing metadata survives browser reloads.
  // Negative results are cached too, preventing repeated lookups for stations
  // whose official table does not publish a crossing level.
  const PLOT_CROSSING_CACHE_KEY="stormtracker.qld-plot-crossings.v2";
  const PLOT_CROSSING_CACHE_MS=24*3600000;
  let plotCrossings={};
  try{
    // Preserve old verified station references while rechecking false-negative
    // results from when approaches were excluded.
    const currentCache=storage?.getItem(PLOT_CROSSING_CACHE_KEY);
    const migrating=!currentCache;
    const saved=canonicaliseLegacyBoMStationCache(
      JSON.parse(currentCache??storage?.getItem("stormtracker.qld-plot-crossings.v1")??"{}"));
    for(const [id,item] of Object.entries(saved??{}).slice(0,1800)){
      if(!/^bom:\d{6}$/.test(id)||!Number.isFinite(item?.checkedAt)||
         now()-item.checkedAt>PLOT_CROSSING_CACHE_MS)continue;
      if(migrating&&!item?.crossing)continue;
      plotCrossings[id]=item;
    }
    if(migrating)storePlotCrossings();
  }catch{plotCrossings={};}
  function storePlotCrossings(){
    try{storage?.setItem(PLOT_CROSSING_CACHE_KEY,JSON.stringify(plotCrossings));}
    catch{/* unavailable browser storage must not lose live session metadata */}
  }
  function attachPlotCrossings(features){
    return features.map(feature=>{
      const entry=plotCrossings[String(feature?.id??"")];
      if(!entry?.crossing)return feature;
      return {...feature,properties:{...feature.properties,
        STORMTRACKER_PLOT_CROSSING:entry.crossing}};
    });
  }
  let crossingCatalogue=null;
  let confirmedFloodCache={};
  let latestHeightCache={};
  try{
    latestHeightCache=cleanLatestGaugeObservations(
      canonicaliseLegacyBoMStationCache(
        JSON.parse(storage?.getItem(LATEST_RIVER_GAUGE_STORAGE_KEY)??"{}")),now());
  }catch{latestHeightCache={};}
  try {
    confirmedFloodCache=cleanConfirmedFloodStations(
      canonicaliseLegacyBoMStationCache(
        JSON.parse(storage?.getItem(OFFICIAL_FLOOD_STORAGE_KEY)??"{}")),now()
    );
  }catch{confirmedFloodCache={};}
  const persistConfirmedFloods=()=>{
    try{storage?.setItem(OFFICIAL_FLOOD_STORAGE_KEY,JSON.stringify(confirmedFloodCache));}
    catch{/* private browsing or storage pressure: retain in session */}
  };
  try {
    floodEvents=cleanFloodEvents(
      canonicaliseLegacyBoMStationCache(
        JSON.parse(storage?.getItem(FLOOD_EVENTS_STORAGE_KEY)??"{}")),now()
    );
  }catch{floodEvents={};}
  const persistEventState=()=>{
    try{storage?.setItem(FLOOD_EVENTS_STORAGE_KEY,JSON.stringify(floodEvents));}
    catch{/* storage disabled/full: preserve active in-memory state */}
  };
  try {
    history = cleanFloodSignalHistory(
      canonicaliseLegacyBoMStationCache(
        JSON.parse(storage?.getItem(FLOOD_SIGNAL_STORAGE_KEY) ?? "{}")), now()
    );
  } catch {
    history = {};
  }
  let loading = null;
  let timer = null;
  let lastLoadedAt = 0;
  let diagnostics = null;
  // Per-session bounded requests. The existing worker handles CORS, while
  // observations and flood classification remain entirely in the browser.
  // Record attempted stations for diagnostics, not as a permanent retry ban.
  const recentAttempted = new Set();
  const recentNextAttemptAt = new Map();
  let recentLoading = null;
  let crossingScanTimer=null;
  // Optional historical station pages must never flood the relay or hold up
  // the core radar map when an upstream 403/429/502/503/504 occurs.
  let recentRelayBlockedUntil = 0;
  let latestSourceFeatures = [];
  // Uncached source bulletin observations, kept only for corroboration of
  // conflicting cached heights against the independent BoM station table.
  let latestPublishedById=new Map();
  let lastBulletinsPartial = false;

  function persistHistory(){
    try {storage?.setItem(FLOOD_SIGNAL_STORAGE_KEY,JSON.stringify(history));}
    catch {/* storage quotas/private mode must not break the map */}
  }

  function recentHistoryCoverage(features=latestSourceFeatures,at=now()){
    const gaps=features.map(feature=>recentFloodHistoryGap(feature,history,at,crossingCatalogue))
      .filter(Boolean);
    return {
      incomplete:gaps.length,
      missingSource:gaps.filter(gap=>!gap.target).length
    };
  }

  async function backfillRecentBoMHistory(features){
    if(recentLoading)return recentLoading;
    const nowMs=now();
    if(nowMs<recentRelayBlockedUntil)return null;
    const list=planBoMStationTableLookups(features,{
      history,plotCrossings,crossingCatalogue,nowMs
    });
    // All BoM stations with a current reported height are eligible.
    // Crossing discovery does not depend on the bulletin saying "rising".
    // A previously failed or insufficient station becomes eligible again
    // after its own cooldown. Cap each pass without increasing concurrency.
    const candidates=list.filter(item=>nowMs >= (recentNextAttemptAt.get(item.id)??0))
      .slice(0,64);
    if(!candidates.length){
      // A station-specific cooldown is not an exclusion from future scans.
      const next=list.reduce((min,item)=>
        Math.min(min,recentNextAttemptAt.get(item.id)??nowMs),Infinity);
      if(Number.isFinite(next)&&next>nowMs)
        scheduleCrossingScan(Math.max(3000,next-nowMs));
      return null;
    }
    recentLoading=(async()=>{
      let success=0,failures=0,noData=0,lastFailureScope=null;
      const tableHeightUpdates=new Map();
      // Four simultaneous reads on the EXISTING BoM relay, rather than
      // 64 serial waits. Keep four simultaneous requests, 64 stations/pass.
      for(let i=0;i<candidates.length;i+=4){
       if(now()<recentRelayBlockedUntil)break;
       await Promise.all(candidates.slice(i,i+4).map(async target=>{
        if(now()<recentRelayBlockedUntil)return;
        recentAttempted.add(target.id);
        // A successful but still insufficient table may gain observations
        // later; never permanently blacklist this station.
        recentNextAttemptAt.set(target.id,now()+15*60*1000);
        try{
          const detail=await fetchBoMRecentHistoryDetail(target,{
            // The relay's upstream deadline is 12 s; leave time to deliver JSON.
            fetchImpl,timeoutMs:18000
          });
          const observations=detail.samples;
          // The Worker reads this from the same BoM table already fetched.
          // An absent crossing is a verified absence, not permission to
          // borrow another station's bridge or causeway reference.
          plotCrossings[target.id]={crossing:detail.crossing,checkedAt:now()};
          storePlotCrossings();
          if(!observations.length){
            // BoM explicitly has no recent usable measurements for this
            // station. Not a gateway failure, warning log, or false "safe".
            noData++;
            recentNextAttemptAt.set(target.id,now()+15*60*1000);
            return;
          }
          const existing=new Map((history[target.id]??[])
            .map(x=>[x.time,x.height]));
          for(const obs of observations){
            // Station table is the canonical measurement at its own timestamp.
            // Correct an erroneous earlier bulletin value on the same minute.
            existing.set(obs.time,obs.height);
          }
          history[target.id]=[...existing].sort((a,b)=>a[0]-b[0])
            .map(([time,height])=>({time,height}));
          const current=latestSourceFeatures.find(f=>f.id===target.id);
          if(current){
            const verified=reconcileOfficialBoMTableHeight(
              current,observations,now(),latestPublishedById.get(target.id));
            if(verified!==current)tableHeightUpdates.set(target.id,verified);
          }
          success++;
        }catch(error){
          failures++;
          const scope=classifyBoMRecentHistoryFailure(error);
          // A failed SINGLE station is not evidence that all 1,000+ BoM
          // stations are unavailable. Only explicit upstream rate limiting
          // pauses the shared queue; every other error retries by station.
          const rateLimited=error?.code==="source_rate_limited"||
            Number(error?.upstreamStatus)===429||Number(error?.status)===429;
          lastFailureScope=rateLimited?"rate-limited":"station";
          recentNextAttemptAt.set(target.id,now()+
            (scope==="station"?60:15)*60*1000);
          if(rateLimited)recentRelayBlockedUntil=now()+15*60*1000;
          if(failures===1&&error?.code!=="source_timeout"&&
             error?.name!=="AbortError")console.warn(
            "BoM station reference check failed for "+target.id+
            (rateLimited?" (rate limited; pausing queue)":" (continuing other gauges)")+":",
            String(error?.message??error)
          );
          // A failure for one station must not block the remaining sources.
        }
       }));
      }
      if(success||candidates.some(item=>plotCrossings[item.id])){
        if(tableHeightUpdates.size){
          latestSourceFeatures=latestSourceFeatures.map(f=>
            tableHeightUpdates.get(f.id)??f);
          // Update the SAME browser caches as a bulletin refresh so an older
          // CDN bulletin cannot resurrect a false flood stage ten minutes later.
          for(const [id,feature] of tableHeightUpdates){
            latestHeightCache[id]={
              observedAt:feature.properties.STORMTRACKER_OFFICIAL_OBSERVED_AT,
              feature
            };
          }
          try{storage?.setItem(LATEST_RIVER_GAUGE_STORAGE_KEY,
            JSON.stringify(latestHeightCache));}catch{}
          const retained=retainConfirmedFloodStations(
            latestSourceFeatures,confirmedFloodCache,now());
          latestSourceFeatures=retained.features;
          confirmedFloodCache=retained.cache;
          persistConfirmedFloods();
        }
        latestSourceFeatures=attachPlotCrossings(latestSourceFeatures);
        history=compactFloodHistory(history,latestSourceFeatures,now());
        persistHistory();
        // Only re-render when genuine new observations arrived. A failed
        // optional history fetch must not rebuild the Cesium map.
        const signals=reconcileFloodEvents(
          latestSourceFeatures,history,floodEvents,now(),crossingCatalogue
        );
        floodEvents=signals.events;
        persistEventState();
        render({type:"FeatureCollection",features:signals.features});
        diagnostics={...(diagnostics??{}),floodSignalCounts:signals.counts,
          coastalTidalCoverage:coastalGaugeTidalCoverage(latestSourceFeatures,history,now())};
      }
      const coverage=recentHistoryCoverage();
      diagnostics={...(diagnostics??{}),
        historyScreeningIncomplete:coverage.incomplete,
        historySourceMissing:coverage.missingSource,
        recentHistory:{loaded:success,failed:failures,noData,
          attempted:recentAttempted.size,screeningIncomplete:coverage.incomplete,
          missingSource:coverage.missingSource,blockedUntil:recentRelayBlockedUntil}};
      if(failures||success||noData){
        const counts=diagnostics.floodSignalCounts??{};
        const count=currentFeatures.length;
        const incompleteText=coverage.incomplete
          ? ` · 30-minute rise screening incomplete for ${coverage.incomplete} gauge(s)`
          : "";
        const missingText=coverage.missingSource
          ? ` · ${coverage.missingSource} without a valid history link`
          : "";
        onStatus({kind:coverage.incomplete||lastBulletinsPartial?"warning":"ok",
          message:`${count} qualifying flood signals · ${success} station histories loaded`+
            (failures?` · ${failures} source failures (${lastFailureScope??"unknown"})`:"")+
            (noData?` · ${noData} station(s) without recent history`:"")+
            incompleteText+missingText+
            " · screening only; follow BoM warnings",
          count,...counts,partial:lastBulletinsPartial,
          screeningIncomplete:coverage.incomplete,
          historySourceMissing:coverage.missingSource,
          historyLoaded:success,historyFailed:failures,historyNoData:noData});
      }
    })();
    try{return await recentLoading;}
    finally{
      recentLoading=null;
      const remaining=planBoMStationTableLookups(latestSourceFeatures,{
        history,plotCrossings,crossingCatalogue,nowMs:now()
      });
      if(remaining.length){
        // Continue a bounded statewide scan in browser without waiting for
        // the next 10-minute observation refresh. Not an unbounded burst.
        const earliest=Math.min(...remaining.map(item=>
          recentNextAttemptAt.get(item.id)??now()));
        const nextDue=Math.max(now(),earliest);
        const delay=now()<recentRelayBlockedUntil
          ?Math.max(0,recentRelayBlockedUntil-now()):nextDue-now();
        scheduleCrossingScan(delay);
      }
    }
  }

  // The report must finish the entire currently eligible source catalogue,
  // not stop after the first 64 gauge tables. Reuse the existing bounded
  // worker calls and their verified exact-station cache.
  let crossingAudit=null;
  async function finishCrossingReferenceChecks(){
    if(crossingAudit)return crossingAudit;
    crossingAudit=(async()=>{
      const initial=planBoMStationTableLookups(latestSourceFeatures,{
        history,plotCrossings,crossingCatalogue,nowMs:now()
      }).length;
      // Each pass handles at most 64 sources. This is an iteration safety
      // guard, NOT a limit on the stations checked.
      const maxPasses=Math.ceil(initial/64)+2;
      for(let pass=0;pass<maxPasses;pass++){
        if(now()<recentRelayBlockedUntil)break;
        const pending=planBoMStationTableLookups(latestSourceFeatures,{
          history,plotCrossings,crossingCatalogue,nowMs:now()
        });
        if(!pending.length)break;
        const due=pending.filter(item=>now()>=(recentNextAttemptAt.get(item.id)??0));
        if(!due.length)break;
        const tried=recentAttempted.size;
        const cached=Object.keys(plotCrossings).length;
        await backfillRecentBoMHistory(latestSourceFeatures);
        // A failed source must not cause an endless retry loop. Existing
        // station-specific and relay-wide cooldowns remain in force.
        if(recentAttempted.size===tried&&Object.keys(plotCrossings).length===cached)break;
      }
      return getCrossingCoverage();
    })();
    try{return await crossingAudit;}
    finally{crossingAudit=null;}
  }

  function getCrossingCoverage(){
    const pending=planBoMStationTableLookups(latestSourceFeatures,{
      history,plotCrossings,crossingCatalogue,nowMs:now()
    }).filter(item=>item.needsCrossing);
    const blocked=now()<recentRelayBlockedUntil;
    const available=pending.filter(item=>now()>=(recentNextAttemptAt.get(item.id)??0));
    const sourceMissing=latestSourceFeatures.filter(feature=>{
      const p=feature?.properties??{};
      const id=String(feature?.id??"");
      if(!/^bom:\d{6}$/.test(id)||p.STORMTRACKER_IDENTITY_WARNING||
         typeof p.STORMTRACKER_HEIGHT_METRES!=="number"||
         !Number.isFinite(p.STORMTRACKER_HEIGHT_METRES)||
         Object.hasOwn(plotCrossings,id)||
         crossingCatalogue?.entries?.[id])return false;
      const expected=officialRecentTableTarget(p.STORMTRACKER_RECENT_DATA_HREF);
      return !expected||expected.station!==id.slice(4);
    }).length;
    return {pending:pending.length,checking:Boolean(recentLoading||crossingAudit),
      blockedUntil:recentRelayBlockedUntil,sourceMissing,
      retryPending:blocked?pending.length:pending.length-available.length};
  }

  function scheduleCrossingScan(delayMs=0){
    // No autonomous scans on a stopped layer or bare refresh test harness.
    if(!timer||crossingScanTimer||!latestSourceFeatures.length)return;
    crossingScanTimer=setTimeout(()=>{
      crossingScanTimer=null;
      if(!timer)return;
      if(typeof document!=="undefined"&&document.hidden){
        scheduleCrossingScan(60000);
        return;
      }
      void backfillRecentBoMHistory(latestSourceFeatures).catch(error=>
        console.warn("BoM crossing catalogue scan unavailable:",error));
    },Math.max(0,Math.min(15*60000,delayMs)));
  }

  function markerImage(state,rapidRise=false){
    const key=state+":"+(rapidRise?"rising":"normal");
    if(!markerImages.has(key))
      markerImages.set(key,createRiverGaugeMapMarkerBitmap(state,rapidRise));
    return markerImages.get(key);
  }

  function render(
    payload
  ) {
    currentFeatures =
      payload?.features
      ?? [];

    severityLayers.clear();

    const drawOrder=[...currentFeatures].sort((a,b)=>{
      const x=riverGaugeOperationalSummary(a),y=riverGaugeOperationalSummary(b);
      return floodIconPriority(x.displayState)-floodIconPriority(y.displayState)||
        Number(Boolean(x.rapidRise))-Number(Boolean(y.rapidRise))||
        String(x.id).localeCompare(String(y.id));
    });
    for(const feature of drawOrder) {
      const summary =
        riverGaugeOperationalSummary(
          feature
        );

      if (
        !Number.isFinite(
          summary.longitude
        )
        || !Number.isFinite(
          summary.latitude
        )
      ) {
        continue;
      }

      const mapMarkerDimensions=riverGaugeMapMarkerDimensions();
      const entity =
        severityLayers.sourceFor(floodIconPriority(summary.displayState)).entities
          .add({
            id:
              summary.id,

            name:
              summary.name,

            position:
              CesiumRef.Cartesian3
                .fromDegrees(
                  summary.longitude,
                  summary.latitude,
                  0
                ),


          });

      // One map renderer: the BoM-ID source entity has NO BillboardGraphics.
      entity.stormTrackerFloodBillboard = {
        image: markerImage(summary.displayState,summary.rapidRise),
        width: mapMarkerDimensions.width,
        height: mapMarkerDimensions.height,
        verticalOrigin: CesiumRef.VerticalOrigin?.CENTER,
        heightReference: CesiumRef.HeightReference?.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      };

      entity
        .stormTrackerRiverGaugeId =
        summary.id;
    }

    severityLayers.finish();

    viewer.scene
      .requestRender();

    onUpdate(
      currentFeatures
        .slice(),
      diagnostics
    );
  }

  async function refresh({
    force =
      false
  } = {}) {
    if (loading) {
      if(force){
        // A manual click arriving during a scheduled fetch must still make
        // its OWN uncached source request after the ongoing one completes.
        try{await loading;}catch{}
        return refresh({force:true});
      }
      return loading;
    }

    loading =
      (async () => {
        onStatus({
          kind:
            "loading",

          message:
            "Checking BoM river gauges..."
        });

        const result =
          await loadRiverGaugeOperationalSnapshot({
            fetchImpl,force
          });
        latestPublishedById=new Map(result.payload.features.map(f=>[f.id,f]));
        const newest=retainLatestGaugeObservations(
          result.payload.features,latestHeightCache,now());
        latestHeightCache=newest.cache;
        result.payload.features=attachPlotCrossings(withStationFloodLevels(newest.features,result.thresholds));
        try{storage?.setItem(LATEST_RIVER_GAUGE_STORAGE_KEY,
          JSON.stringify(latestHeightCache));}catch{}

        const observedAt = now();
        history = cleanFloodSignalHistory(history, observedAt);
        for (const feature of result.payload.features) {
          appendGaugeObservation(history, feature, observedAt);
        }
        history = compactFloodHistory(
          history, result.payload.features, observedAt
        );
        try {
          storage?.setItem(FLOOD_SIGNAL_STORAGE_KEY, JSON.stringify(history));
        } catch {
          // Browser storage may be disabled or full; fresh evidence still works.
        }

        const retained=retainConfirmedFloodStations(
          result.payload.features,confirmedFloodCache,observedAt
        );
        confirmedFloodCache=retained.cache;
        persistConfirmedFloods();
        latestSourceFeatures=retained.features;
        lastBulletinsPartial = Boolean(result.partialBulletins);
        const alerts = reconcileFloodEvents(
          retained.features,history,floodEvents,observedAt,crossingCatalogue
        );
        floodEvents=alerts.events;
        persistEventState();
        diagnostics = {...result, floodSignalCounts:alerts.counts,
          coastalTidalCoverage:coastalGaugeTidalCoverage(retained.features,history,observedAt)};
        // Report listeners run synchronously during render().
        lastLoadedAt = observedAt;
        render({type:"FeatureCollection",features:alerts.features});

        const summaries =
          currentFeatures.map(
            riverGaugeOperationalSummary
          );

        const {minor,major,moderate,rapidRise,tidalAnomaly} = alerts.counts;
        const staleOfficial=alerts.features.filter(f=>
          f.properties?.STORMTRACKER_OBSERVATION_STALE).length;

        const screening=recentHistoryCoverage(latestSourceFeatures,observedAt);
        diagnostics.historyScreeningIncomplete=screening.incomplete;
        diagnostics.historySourceMissing=screening.missingSource;

        const staleText=staleOfficial ? ` · ${staleOfficial} last-confirmed flood stage(s), observations stale` : "";
        const partialText =
          result.partialBulletins
            ? ` · partial (${result.failedProducts.length} product${result.failedProducts.length === 1 ? "" : "s"} unavailable)`
            : "";

        onStatus({
          kind:
            (result.partialBulletins || screening.incomplete || staleOfficial)
              ? "warning"
              : "ok",

          message:
            `${summaries.length} qualifying flood signal${summaries.length === 1 ? "" : "s"} · ${major} major · ${moderate} moderate · ${minor} minor · ${rapidRise} rapid above minor · ${tidalAnomaly} unusual tidal rise${staleText}${partialText}${screening.incomplete ? ` · 30-minute rise screening incomplete for ${screening.incomplete} gauge(s)` : ""}${screening.missingSource ? ` · ${screening.missingSource} without a valid history link` : ""} · screening only; follow BoM warnings`,

          count:
            summaries.length,

          major,
          moderate,
          minor,
          rapidRise,
          tidalAnomaly,
          staleOfficial,

          partial:
            result.partialBulletins,

          screeningIncomplete:
            screening.incomplete,

          historySourceMissing:
            screening.missingSource,

          failedProducts:
            result.failedProducts,

          loadedAt:
            lastLoadedAt
        });

        // Bootstrap classified, inland, and active crossing stations asynchronously. Severe
        // BoM classifications render immediately without waiting for history.
        void backfillRecentBoMHistory(latestSourceFeatures).catch(error=>{
          console.warn("BoM history bootstrap skipped:",error);
        });
        return currentFeatures;
      })();

    try {
      return await loading;
    } catch (error) {
      // An outage is not a measured fall below minor. Retain source-backed
      // stations with a visibly stale observation; no old rapid-rise arrow.
      const retained=retainConfirmedFloodStations(
        [],confirmedFloodCache,now()
      );
      confirmedFloodCache=retained.cache;
      if(retained.features.length){
        const alerts=reconcileFloodEvents(
          retained.features,history,floodEvents,now(),crossingCatalogue
        );
        render({type:"FeatureCollection",features:alerts.features});
      }else if(lastLoadedAt && now()-lastLoadedAt>FLOOD_SIGNAL_MAX_AGE_MS){
        render({type:"FeatureCollection",features:[]});
      }
      onStatus({
        kind:
          "error",

        message:
          `${error?.message ?? String(error)}${Object.keys(confirmedFloodCache).length ? " · last confirmed flood stages retained, observations stale" : ""}`
      });

      throw error;
    } finally {
      loading =
        null;
    }
  }

  function setVisible(
    nextVisible
  ) {
    severityLayers.setVisible(nextVisible);

    viewer.scene
      .requestRender();

    if (
      dataSource.show
    ) {
      const stale =
        !lastLoadedAt
        || (
          Date.now()
          - lastLoadedAt
        ) >= refreshMs;

      if (stale) {
        refresh()
          .catch(
            () => {}
          );
      }
    }
  }

  function start() {
    if (timer) {
      return;
    }

    // Keep collecting observed water heights even when the visual layer is
    // toggled off, otherwise a first-time alert has no measured rise history.
    // This only works while the browser tab is open; no backend is required.
    refresh().catch(() => {});

    timer =
      setInterval(
        () => {
          if (
            typeof document
              !== "undefined"
            && document.hidden
          ) {
            return;
          }

          refresh()
            .catch(
              () => {}
            );
        },
        refreshMs
      );
  }

  function stop() {
    if(crossingScanTimer){clearTimeout(crossingScanTimer);crossingScanTimer=null;}
    if (!timer) {
      return;
    }

    clearInterval(
      timer
    );

    timer =
      null;
  }

  function featureById(
    id
  ) {
    const wanted =
      String(
        id ?? ""
      );

    return (
      currentFeatures
        .find(
          feature =>
            String(
              feature.id
            )
            === wanted
        )
      ?? null
    );
  }

  return {
    dataSource,
    severityDataSources:severityLayers.dataSources,
    refresh,
    setCrossingCatalogue(catalogue){
      crossingCatalogue=catalogue?.schema==="StormTrackerBoMQldCrossingHeightsV1"
        ?catalogue:null;
      if(latestSourceFeatures.length){
        const alerts=reconcileFloodEvents(latestSourceFeatures,history,floodEvents,
          now(),crossingCatalogue);
        floodEvents=alerts.events;
        persistEventState();
        render({type:"FeatureCollection",features:alerts.features});
      }
    },
    setVisible,
    start,
    stop,
    // Complete every currently accessible BoM station-page source check.
    checkCrossingReferences:finishCrossingReferenceChecks,
    featureById,

    get features() {
      return currentFeatures
        .slice();
    },

    // All newest source station observations, including low river heights.
    // The map's flood-only feature list is unsuitable for crossing reports.
    get sourceFeatures() {
      return latestSourceFeatures.slice();
    },

    // A crossing report is provisional until every source-identified station
    // has been checked. Missing height references are never assumed safe.
    get crossingCoverage(){return getCrossingCoverage();},

    get lastLoadedAt() {
      return lastLoadedAt;
    },

    get diagnostics() {
      return diagnostics;
    },

    get historyStationCount() {
      return Object.keys(history).length;
    },

    get activeScreeningEvents(){return Object.keys(floodEvents).length;},

    get recentHistoryRequestCount() {
      return recentAttempted.size;
    },

    attribution:
      BOM_RIVER_TIDE_GAUGE_ATTRIBUTION
  };
}
