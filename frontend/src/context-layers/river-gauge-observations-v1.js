import {
  filterQueenslandRiverGauges,
  riverGaugeSummary,
  BOM_RIVER_TIDE_GAUGE_QUERY_URL
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
  force = false
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

    return await response.json();
  } finally {
    if (timeout) {
      clearTimeout(
        timeout
      );
    }
  }
}

// Independent Queensland Government BoM flood-network station locations.
// This is a source for published coordinates / official gauge numbers ONLY;
// river-height readings and flood classification remain sourced from BoM.
const QLD_FLOODCHECK_GAUGE_URL=
  "https://spatial-gis.information.qld.gov.au/arcgis/rest/services/FloodCheck/FloodGauges/MapServer/1/query"+
  "?where=1%3D1&outFields=gaugeno%2Cstn_name%2Cbasin%2Cagency"+
  "&returnGeometry=true&outSR=4326&f=geojson";
export function officialQueenslandFloodCheckLocations(payload){
  const features=(Array.isArray(payload?.features)?payload.features:[])
    .map(feature=>{
      const p=feature?.properties??{};
      const raw=String(p.gaugeno??"").trim();
      const point=feature?.geometry?.coordinates;
      const lon=Number(point?.[0]),lat=Number(point?.[1]);
      if(!/^\d{1,6}$/.test(raw)||feature?.geometry?.type!=="Point"||
        !Number.isFinite(lon)||!Number.isFinite(lat)||
        lon<137||lon>154.1||lat< -30||lat> -9)return null;
      const id=raw.padStart(6,"0");
      return {type:"Feature",id:"bom:"+id,
        geometry:{type:"Point",coordinates:[lon,lat]},
        properties:{bom_stn_num:id,name:String(p.stn_name??""),
          basin:String(p.basin??""),agency:String(p.agency??""),
          state:"QLD",lat,long:lon,
          // Don't invent tidal or qualitative status from this dataset.
          location_types:"",forecast_site_classification:""}};
    }).filter(Boolean);
  return {type:"FeatureCollection",features};
}

// Reliable station-coordinate intake: a BoM ArcGIS relay outage is not a
// verified zero-gauge result. Use only the SAME official BoM GIS query, then
// a bounded, previously source-verified station-location snapshot. Height
// observations are NEVER sourced from this cache or estimated.
const GAUGE_LOCATION_CACHE_KEY="stormtracker.qld-bom-gauge-locations.v1";
const GAUGE_LOCATION_CACHE_MAX_AGE_MS=30*24*60*60*1000;
const validGaugeLocations=payload=>Array.isArray(payload?.features)&&
  payload.features.some(f=>f?.geometry?.type==="Point"&&
    String(f?.properties?.state??"").toUpperCase()==="QLD"&&
    (f?.properties?.bom_stn_num!==undefined||f?.properties?.awrc_stateid));

function cachedGaugeLocations(storage,nowMs){
  try{
    const record=JSON.parse(storage?.getItem(GAUGE_LOCATION_CACHE_KEY)??"null");
    if(Number.isFinite(record?.checkedAt)&&record.checkedAt>0&&
      record.checkedAt<=nowMs&&
      nowMs-record.checkedAt<=GAUGE_LOCATION_CACHE_MAX_AGE_MS&&
      validGaugeLocations(record?.payload))
      return {payload:record.payload,checkedAt:record.checkedAt};
  }catch{/* unavailable storage must never block source reads */}
  // Existing browsers already have BoM-verified POINT metadata embedded in
  // previously joined source observations. Salvage ONLY location/identity
  // attributes (never a cached height, rise, flood class or observation time)
  // to recover current live bulletin IDs when both metadata transports fail.
  try{
    const original=JSON.parse(storage?.getItem("stormtracker.qld-latest-river-gauge.v1")??"{}");
    const keys=["bom_stn_num","awrc_stateid","name","lat","long","state",
      "location_types","forecast_site_classification","basin","agency","featreal"];
    const features=[];
    let oldest=nowMs;
    for(const [id,entry] of Object.entries(original??{}).slice(0,1800)){
      const f=entry?.feature,at=Number(entry?.observedAt);
      if(!/^(?:bom|awrc):[a-z0-9_-]+$/i.test(id)||f?.id!==id||
        !Number.isFinite(at)||at<=0||at>nowMs||
        nowMs-at>GAUGE_LOCATION_CACHE_MAX_AGE_MS||
        f.geometry?.type!=="Point"||
        !Array.isArray(f.geometry.coordinates)||
        f.geometry.coordinates.length<2||
        !f.geometry.coordinates.slice(0,2).every(Number.isFinite)||
        String(f.properties?.state??"").toUpperCase()!=="QLD")continue;
      // Retain source-supplied identity, never remembered display decisions.
      const properties=Object.fromEntries(keys.filter(k=>Object.hasOwn(f.properties,k))
        .map(k=>[k,f.properties[k]]));
      if(!properties.bom_stn_num&&!properties.awrc_stateid)continue;
      features.push({type:"Feature",id,geometry:f.geometry,properties});
      oldest=Math.min(oldest,at);
    }
    const payload={type:"FeatureCollection",features};
    if(validGaugeLocations(payload))return {payload,checkedAt:oldest,
      legacy:true};
  }catch{/* no old source cache or unparseable legacy data */}
  return null;
}
function storeGaugeLocations(storage,payload,nowMs){
  if(!validGaugeLocations(payload))return;
  try{storage?.setItem(GAUGE_LOCATION_CACHE_KEY,
    JSON.stringify({checkedAt:nowMs,payload}));}
  catch{/* browsers may deny/quota-limit localStorage */}
}
async function readVerifiedGaugeLocations({fetchImpl,gaugeUrl,storage,nowMs}){
  let relayError=null,directError=null;
  try{
    const payload=await fetchJson(fetchImpl,gaugeUrl,"BoM river-gauge metadata",15000);
    if(!validGaugeLocations(payload))throw Error("BoM river-gauge metadata has no verified Queensland point locations");
    storeGaugeLocations(storage,payload,nowMs);
    return {payload,source:"metadata-relay",fallback:false};
  }catch(error){relayError=error;}
  // The official source is already approved for direct gauge-location reads
  // in river-gauges-v1.js. Never switch to a third-party map or name match.
  try{
    const payload=await fetchJson(fetchImpl,BOM_RIVER_TIDE_GAUGE_QUERY_URL,
      "Official BoM ArcGIS gauge metadata",15000,true);
    if(!validGaugeLocations(payload))throw Error("Official BoM ArcGIS metadata has no verified Queensland point locations");
    storeGaugeLocations(storage,payload,nowMs);
    return {payload,source:"direct-official-bom-arcgis",fallback:true};
  }catch(error){directError=error;}
  // Separate Queensland Government GIS host: published BoM flood-network
  // gauge numbers, mapped without name matching or invented coordinates.
  let qldError=null;
  try{
    const source=await fetchJson(fetchImpl,QLD_FLOODCHECK_GAUGE_URL,
      "Queensland Government BoM flood network",12000,true);
    const payload=officialQueenslandFloodCheckLocations(source);
    if(!validGaugeLocations(payload))
      throw Error("Queensland Government BoM flood network has no verified numbered point locations");
    storeGaugeLocations(storage,payload,nowMs);
    return {payload,source:"qld-government-bom-flood-network",fallback:true};
  }catch(error){qldError=error;}
  const cached=cachedGaugeLocations(storage,nowMs);
  if(cached)return {payload:cached.payload,
    source:cached.legacy?"cached-verified-bom-station-observations":"cached-official-bom-arcgis",
    fallback:true,checkedAt:cached.checkedAt};
  throw Error("BoM gauge-location sources unavailable; "+
    "relay: "+String(relayError?.message??relayError)+"; official ArcGIS: "+
    String(directError?.message??directError)+
    "; Queensland Government GIS: "+String(qldError?.message??qldError)+
    "; no time-valid verified station-location cache");
}

export async function loadRiverGaugeOperationalSnapshot({
  fetchImpl =
    globalThis.fetch,

  gaugeUrl =
    DEFAULT_RIVER_GAUGE_METADATA_RELAY_URL,

  relayUrl =
    DEFAULT_RIVER_HEIGHT_RELAY_URL,
  force = false,
  storage = globalThis.localStorage,
  now = () => Date.now()
} = {}) {
  if (
    typeof fetchImpl
      !== "function"
  ) {
    throw new Error(
      "River-gauge operational fetch is unavailable."
    );
  }

  const [locations,bulletins]=await Promise.all([
    readVerifiedGaugeLocations({fetchImpl,gaugeUrl,storage,nowMs:now()}),
    fetchJson(fetchImpl,relayUrl,"BoM river-height relay",15000,force)
  ]);
  const joined=joinRiverGaugeObservations({
    gauges:locations.payload,bulletins,nowMs:now()
  });
  // An apparently healthy bulletin with multiple real station IDs and NO
  // geographic joins is an identity/source failure, never an all-clear.
  if(joined.totalObservations>=5 && joined.matchedCount===0)
    throw Error("BoM river bulletin/verified station-location join returned zero matching station IDs; flood status unverified");
  // Station thresholds are a single bundled, versioned BoM 2026 catalogue.
  // No third upstream HTTP request, no competing 2022 relay overrides and
  // no 12-second stall for each 10-minute height refresh.
  const thresholds={};
  joined.payload.features=withStationFloodLevels(joined.payload.features);
  return {
    ...joined,
    metadataSource:locations.source,
    metadataFallback:locations.fallback,
    metadataCheckedAt:locations.checkedAt??null,
    thresholds,

    source:
      "Bureau of Meteorology",

    transport:
      "BoM ArcGIS metadata + StormTracker river-height relay"
  };
}
