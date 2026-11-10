import {
  filterQueenslandRiverGauges,
  riverGaugeSummary
} from "./river-gauges-v1.js?v=9.12.0";
import {withStationFloodLevels}
  from "./river-flood-thresholds-v1.js?v=20261020-new-beith-ahd-v2";
import {parseQueenslandObservationTime} from "./river-flood-signals-v1.js?v=9.13.2";

export const DEFAULT_RIVER_GAUGE_METADATA_RELAY_URL =
  "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/river-gauge-metadata";

export const DEFAULT_RIVER_HEIGHT_RELAY_URL =
  "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/river-height-bulletins";

function text(
  value
) {
  return String(
    value ?? ""
  ).trim();
}

function stationIdKey(
  value
) {
  const raw =
    text(
      value
    ).toUpperCase();

  if (!raw) {
    return "";
  }

  if (
    /^\d+$/.test(
      raw
    )
  ) {
    return String(
      Number(raw)
    );
  }

  return raw.replace(
    /[^A-Z0-9]/g,
    ""
  );
}

export function normaliseRiverStationName(
  value
) {
  return text(
    value
  )
    .toLowerCase()
    .replace(
      /&/g,
      " and "
    )
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function stationIdIndex(
  features
) {
  const index =
    new Map();

  for (
    const feature
    of features
  ) {
    const summary =
      riverGaugeSummary(
        feature
      );

    for (
      const value
      of [
        summary.bomStationNumber,
        summary.awrcStationId
      ]
    ) {
      const key =
        stationIdKey(
          value
        );

      if (!key) continue;
      // Ambiguous station identifiers must never bind arbitrarily.
      if (index.has(key)) index.set(key, null);
      else index.set(key, feature);
    }
  }

  return index;
}

function observationsFromPayload(
  payload
) {
  const products =
    Array.isArray(
      payload?.products
    )
      ? payload.products
      : [];

  return products.flatMap(
    product =>
      Array.isArray(
        product?.observations
      )
        ? product.observations
        : []
  );
}

export function riverGaugeDisplayState({
  tidal = false,
  tendency = "unknown",
  floodClass = ""
} = {}) {
  const flood =
    text(
      floodClass
    ).toLowerCase();

  if (
    flood === "major"
  ) {
    return "major";
  }

  if (
    flood === "moderate"
  ) {
    return "moderate";
  }

  if (
    flood === "minor"
  ) {
    return "minor";
  }

  const trend =
    text(
      tendency
    ).toLowerCase();

  if (
    trend === "rising"
  ) {
    return tidal
      ? "tidal-rise"
      : "rising";
  }

  if (
    trend === "falling"
  ) {
    return "falling";
  }

  if (
    trend === "steady"
  ) {
    return "steady";
  }

  return "unknown";
}

function featureWithObservation(
  feature,
  observation
) {
  const summary =
    riverGaugeSummary(
      feature
    );

  const state =
    riverGaugeDisplayState({
      tidal:
        summary.tidal,
      tendency:
        observation.tendency,
      floodClass:
        observation.floodClass
    });

  return {
    ...feature,

    properties: {
      ...(
        feature.properties
        ?? {}
      ),

      // Directly from BoM's station-type column. Never infer 'manual'
      // from station names, source gaps, or similar nearby gauges.
      ...(observation.reportingMode==="manual"
        ?{STORMTRACKER_REPORTING_MODE:"manual"}:{}),

      STORMTRACKER_HEIGHT_METRES:
        observation.heightMetres,

      STORMTRACKER_TENDENCY:
        observation.tendency,

      STORMTRACKER_FLOOD_CLASS:
        observation.floodClass,

      STORMTRACKER_OBSERVED_TEXT:
        observation.observedText,

      STORMTRACKER_SOURCE_PRODUCT:
        observation.sourceProduct,

      STORMTRACKER_RECENT_DATA_HREF:
        observation.recentDataHref,

      STORMTRACKER_DISPLAY_STATE:
        state,

      STORMTRACKER_TIDAL_CONTEXT:
        summary.tidal
          ? (
              state
              === "tidal-rise"
                ? "Tidal site · rising may reflect normal tide"
                : "Tidal site"
            )
          : ""
    }
  };
}

export function joinRiverGaugeObservations({
  gauges,
  bulletins,
  nowMs=Date.now()
} = {}) {
  const gaugePayload =
    filterQueenslandRiverGauges(
      gauges
    );

  const gaugeFeatures =
    gaugePayload.features;

  const observations =
    observationsFromPayload(
      bulletins
    );

  const byId =
    stationIdIndex(
      gaugeFeatures
    );

  const matched =
    new Map();
  const matchedObservedTimes=new Map();

  const unmatchedObservations =
    [];

  for (
    const observation
    of observations
  ) {
    const idKey =
      stationIdKey(
        observation.stationId
      );

    // Station ID is authoritative; NEVER backfill a missing/mismatched ID
    // using a similar place name (Mirani Township 533178 vs Mirani 033152).
    const feature = idKey ? byId.get(idKey) : null;

    if (!feature) {
      unmatchedObservations.push(
        observation
      );

      continue;
    }

    const featureId =
      String(
        feature.id
      );

    // Duplicate stations in overlapping BoM products: choose newest
    // SOURCE observation time, not the first bulletin in response order.
    const latestAt=parseQueenslandObservationTime(observation.observedText,nowMs);
    if(matched.has(featureId)){
      const prior=matchedObservedTimes.get(featureId);
      if(latestAt===null || (prior!==null && latestAt<=prior))continue;
    }
    matchedObservedTimes.set(featureId,latestAt);

    matched.set(
      featureId,
      featureWithObservation(
        feature,
        observation
      )
    );
  }

  return {
    payload: {
      type:
        "FeatureCollection",

      features:
        [
          ...matched
            .values()
        ]
    },

    totalGaugeLocations:
      gaugeFeatures.length,

    totalObservations:
      observations.length,

    matchedCount:
      matched.size,

    unmatchedObservations,

    partialBulletins:
      Boolean(
        bulletins?.partial
      ),

    failedProducts:
      Array.isArray(
        bulletins?.failed
      )
        ? bulletins.failed
        : []
  };
}

async function fetchJson(
  fetchImpl,
  url,
  label,
  timeoutMs = 15000,
  force = false,
  onResponse = null
) {
  const controller =
    typeof AbortController
      === "function"
      ? new AbortController()
      : null;

  const timeout =
    controller
      ? setTimeout(
          () =>
            controller.abort(),
          timeoutMs
        )
      : null;

  try {
    // Manual refresh bypasses browser and Worker response caches.
    const target = force && url.includes("/river-height-bulletins")
      ? url+"?force=1&_ts="+Date.now() : url;
    const response =
      await fetchImpl(
        target,
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/json,application/geo+json"
          },
          cache: force ? "no-store" : "default",

          signal:
            controller?.signal
        }
      );

    if (!response.ok) {
      throw new Error(
        `${label} HTTP ${response.status}`
      );
    }

    if(typeof onResponse==="function")onResponse(response);
    return await response.json();
  } catch (error) {
    // Distinguish our own deadline from genuine BoM upstream errors.
    if (controller?.signal.aborted)
      throw new Error(`${label} timed out locally after ${timeoutMs / 1000}s`,{cause:error});
    throw error;
  } finally {
    if (timeout) {
      clearTimeout(
        timeout
      );
    }
  }
}

// Station IDs, coordinates and tidal tags come from ONE official BoM
// metadata source. Fetch that stable catalogue once per page/session; the
// river HEIGHT bulletins retain their approved ten-minute live refresh.
// Metadata used to be re-fetched on every update and cancelled locally at
// 15 seconds while radar requests were busy. Do not restart or multiply it.
const verifiedGaugeMetadata=new WeakMap();
const GAUGE_METADATA_TIMEOUT_MS=10000; // Local versioned relay reference, no upstream GIS wait.
const STORED_METADATA_KEY="stormtracker.verified-qld-bom-gauge-metadata.v1";
const STORED_METADATA_MAX_AGE_MS=14*24*60*60*1000;

// Persist ONLY data that passed the original official BoM source validation.
// The verified date is never advanced when recovering an old catalogue.
function readStoredBoMMetadata(){
  try{
    const raw=globalThis.localStorage?.getItem(STORED_METADATA_KEY);
    if(!raw)return null;
    const item=JSON.parse(raw),checkedAt=Number(item?.checkedAt);
    const age=Date.now()-checkedAt;
    if(!Number.isFinite(checkedAt)||checkedAt<=0||
       age<0||age>STORED_METADATA_MAX_AGE_MS||
       !Array.isArray(item?.payload?.features)||
       !filterQueenslandRiverGauges(item.payload).features.length)return null;
    return {payload:item.payload,metadataFallback:true,
      metadataSource:"cached-verified-bom-browser",metadataCheckedAt:checkedAt};
  }catch{return null;}
}
function storeVerifiedBoMMetadata(item){
  try{
    const checkedAt=Number(item.metadataCheckedAt);
    if(!Number.isFinite(checkedAt)||checkedAt<=0||
       Date.now()-checkedAt<0||
       Date.now()-checkedAt>STORED_METADATA_MAX_AGE_MS)return;
    globalThis.localStorage?.setItem(STORED_METADATA_KEY,JSON.stringify({
      checkedAt,payload:item.payload
    }));
  }catch{/* Storage quota or private mode cannot interrupt live observations. */}
}
async function loadVerifiedGaugeMetadata(fetchImpl,gaugeUrl){
  const prior=verifiedGaugeMetadata.get(fetchImpl);
  if(prior?.url===gaugeUrl){
    if(prior.data)return prior.data;
    if(prior.pending)return prior.pending;
  }
  let responseMetadata={metadataFallback:false,metadataSource:"bom-live",
    metadataCheckedAt:Date.now()};
  const pending=fetchJson(fetchImpl,gaugeUrl,
    "BoM river-gauge metadata",GAUGE_METADATA_TIMEOUT_MS,false,response=>{
      const get=name=>response.headers?.get?.(name)??null;
      const cached=get("X-StormTracker-Metadata-Fallback")==="1";
      const date=Date.parse(get("X-StormTracker-Metadata-Checked-At")??"");
      const declaredSource=get("X-StormTracker-Metadata-Source");
      responseMetadata={
        metadataFallback:cached,
        metadataSource:declaredSource==="qld-government-bom-sls-reference"
          ?declaredSource
          :cached?"cached-verified-bom-worker":"bom-live",
        metadataCheckedAt:Number.isFinite(date)?date:Date.now()
      };
    }).then(payload=>{
    if(!Array.isArray(payload?.features)||
       !filterQueenslandRiverGauges(payload).features.length)
      throw Error("BoM river-gauge metadata returned no verified Queensland gauge locations");
    const reference=payload.stormtrackerReference;
    const auditedTotal=Number(reference?.auditedTotal);
    const matchedTotal=Number(reference?.matchedTotal);
    const metadataCoverage=Number.isInteger(auditedTotal)&&auditedTotal>0&&
      Number.isInteger(matchedTotal)&&matchedTotal>=0&&matchedTotal<=auditedTotal
      ?{matched:matchedTotal,total:auditedTotal}:null;
    const data={payload,...responseMetadata,metadataCoverage};
    verifiedGaugeMetadata.set(fetchImpl,{url:gaugeUrl,data});
    storeVerifiedBoMMetadata(data);
    return data;
  }).catch(error=>{
    const recovered=readStoredBoMMetadata();
    if(recovered){
      verifiedGaugeMetadata.set(fetchImpl,{url:gaugeUrl,data:recovered});
      return recovered;
    }
    const current=verifiedGaugeMetadata.get(fetchImpl);
    if(current?.url===gaugeUrl&&current.pending===pending)
      verifiedGaugeMetadata.delete(fetchImpl);
    throw error;
  });
  verifiedGaugeMetadata.set(fetchImpl,{url:gaugeUrl,pending});
  return pending;
}

export async function loadRiverGaugeOperationalSnapshot({
  fetchImpl =
    globalThis.fetch,

  gaugeUrl =
    DEFAULT_RIVER_GAUGE_METADATA_RELAY_URL,

  relayUrl =
    DEFAULT_RIVER_HEIGHT_RELAY_URL,
  force = false
} = {}) {
  if (
    typeof fetchImpl
      !== "function"
  ) {
    throw new Error(
      "River-gauge operational fetch is unavailable."
    );
  }

  const [
    gauges,
    bulletins
  ] =
    await Promise.all([
      loadVerifiedGaugeMetadata(fetchImpl,gaugeUrl),

      fetchJson(
        fetchImpl,
        relayUrl,
        "BoM river-height relay",15000,force
      )
    ]);

  const joined =
    joinRiverGaugeObservations({gauges:gauges.payload,bulletins});
  // Observations are always freshly sourced from the original BoM bulletin
  // relay; only source-verified station reference metadata is reused.
  // Station thresholds are a single bundled, versioned BoM 2026 catalogue.
  // No third upstream HTTP request, no competing 2022 relay overrides and
  // no 12-second stall for each 10-minute height refresh.
  const thresholds={};
  joined.payload.features=withStationFloodLevels(joined.payload.features);
  return {
    ...joined,
    thresholds,
    metadataSource:gauges.metadataSource,
    metadataFallback:gauges.metadataFallback,
    metadataCheckedAt:gauges.metadataCheckedAt,
    metadataCoverage:gauges.metadataCoverage??null,

    source:
      "Bureau of Meteorology",

    transport:
      gauges.metadataSource==="qld-government-bom-sls-reference"
        ?"Versioned QRA/QLD Government station references + live BoM river heights"
        :"BoM ArcGIS metadata + StormTracker river-height relay"
  };
}
