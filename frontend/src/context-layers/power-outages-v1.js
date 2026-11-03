import {MAX_CONTEXT_SNAPSHOT_AGE_MS,sourceSnapshotState,sourceFailureStatus,checkedAtAest} from "./source-freshness-v1.js?v=9.14.0";
import {
  parseEssentialEnergyKml
} from "./essential-energy-kml-v1.js?v=9.11.2";

import {
  QUEENSLAND_MAINLAND_QUERY_URL,
  filterFeaturesToQueensland
} from "./queensland-mainland-filter-v1.js?v=9.11.2";

export const ENERGEX_ATTRIBUTION =
  "Energex | Energy Queensland";

export const ERGON_ATTRIBUTION =
  "Ergon Energy | Energy Queensland";

export const ESSENTIAL_ENERGY_ATTRIBUTION =
  "Essential Energy";

const OUTAGE_QUERY_SUFFIX =
  "?where=1%3D1"
  + "&outFields=EVENT_ID%2CTYPE%2CSTATUS%2CCUSTOMERS_AFFECTED%2CSUBURBS%2CSTREETS%2CSTART%2CFINISH%2CEST_FIX_TIME%2CREASON%2CEXTRACTED"
  + "&returnGeometry=true"
  + "&outSR=4326"
  + "&f=geojson";

export const ENERGEX_OUTAGE_AREA_QUERY_URL =
  "https://services.arcgis.com/bfVzktoY0OhzQCDj/arcgis/rest/services/VwEnergexOutages/FeatureServer/0/query"
  + OUTAGE_QUERY_SUFFIX;

export const ERGON_OUTAGE_AREA_QUERY_URL =
  "https://services.arcgis.com/33eHbTVqo7gtiCE8/ArcGIS/rest/services/VwErgonOutages/FeatureServer/0/query"
  + OUTAGE_QUERY_SUFFIX;

export const ENERGEX_OUTAGE_POINT_QUERY_URL =
  ENERGEX_OUTAGE_AREA_QUERY_URL.replace("/0/query", "/1/query");
export const ERGON_OUTAGE_POINT_QUERY_URL =
  ERGON_OUTAGE_AREA_QUERY_URL.replace("/0/query", "/1/query");

export const DEFAULT_ESSENTIAL_ENERGY_RELAY_URL =
  "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/essential-energy-outages";

export const DEFAULT_POWER_OUTAGE_REFRESH_MS =
  15 * 60 * 1000;

const PROVIDER_META =
  Object.freeze({
    Energex:
      Object.freeze({
        idPrefix:
          "energex",
        attribution:
          ENERGEX_ATTRIBUTION
      }),

    Ergon:
      Object.freeze({
        idPrefix:
          "ergon",
        attribution:
          ERGON_ATTRIBUTION
      }),

    "Essential Energy":
      Object.freeze({
        idPrefix:
          "essential",
        attribution:
          ESSENTIAL_ENERGY_ATTRIBUTION
      })
  });

function normalise(value) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}

function propertiesOf(
  featureOrProperties
) {
  return (
    featureOrProperties
      ?.properties
    ?? featureOrProperties
    ?? {}
  );
}

function parsedTime(value) {
  if (
    typeof value === "number"
    && Number.isFinite(value)
  ) {
    return value > 0
      ? value
      : null;
  }

  const text =
    String(
      value ?? ""
    ).trim();

  if (!text) {
    return null;
  }

  const numeric =
    Number(text);

  if (
    Number.isFinite(numeric)
    && /^\d{10,}$/.test(text)
  ) {
    return numeric > 0
      ? numeric
      : null;
  }

  const parsed =
    Date.parse(text);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function providerOf(
  featureOrProperties
) {
  const properties =
    propertiesOf(
      featureOrProperties
    );

  const provider =
    String(
      properties
        .STORMTRACKER_PROVIDER
      ?? featureOrProperties
        ?.stormTrackerProvider
      ?? "Energex"
    ).trim();

  return PROVIDER_META[
    provider
  ]
    ? provider
    : "Energex";
}

function eventIdOf(
  feature
) {
  const properties =
    propertiesOf(
      feature
    );

  return String(
    properties.EVENT_ID
    ?? feature?.id
    ?? ""
  );
}

function qualifiedFeatureId(
  feature,
  provider
) {
  const meta =
    PROVIDER_META[
      provider
    ];

  return `${meta.idPrefix}:${eventIdOf(feature)}`;
}

function annotateProvider(
  payload,
  provider
) {
  const features =
    Array.isArray(
      payload?.features
    )
      ? payload.features
      : [];

  return {
    ...(
      payload
      && typeof payload
        === "object"
        ? payload
        : {}
    ),

    type:
      "FeatureCollection",

    features:
      features.map(
        feature => ({
          ...feature,

          id:
            qualifiedFeatureId(
              feature,
              provider
            ),

          properties: {
            ...(
              feature?.properties
              ?? {}
            ),

            STORMTRACKER_PROVIDER:
              provider
          }
        })
      )
  };
}

export function isCurrentPowerOutage(
  featureOrProperties,
  nowMs = Date.now()
) {
  const properties =
    propertiesOf(
      featureOrProperties
    );

  // Only confirmed unplanned faults belong on an operational outage map.
  // Planned, scheduled and unclassified records are excluded before rendering.
  if (
    normalise(
      properties.TYPE
    ) !== "unplanned"
  ) {
    return false;
  }

  const status =
    normalise(
      properties.STATUS
    );

  if (
    status === "cancelled"
    || status === "completed"
    || status === "complete"
    || status === "restored"
    || status === "resolved"
    || status === "closed"
    || status === "inactive"
    || status === "withdrawn"
  ) {
    return false;
  }

  const start =
    parsedTime(
      properties.START
    );

  const finish =
    parsedTime(
      properties.FINISH
    );

  if (
    start !== null
    && start > nowMs
  ) {
    return false;
  }

  if (
    finish !== null
    && finish < nowMs
  ) {
    return false;
  }

  return true;
}

export function powerOutageSummary(
  feature
) {
  const properties =
    propertiesOf(
      feature
    );

  const provider =
    providerOf(
      feature
    );

  const customers =
    Number(
      properties.CUSTOMERS_AFFECTED
      ?? 0
    );

  return {
    id:
      feature?.id
      ?? qualifiedFeatureId(
        feature,
        provider
      ),

    eventId:
      properties.EVENT_ID
      ?? "",

    provider,

    attribution:
      PROVIDER_META[
        provider
      ].attribution,

    type:
      normalise(
        properties.TYPE
      ) === "planned"
        ? "PLANNED"
        : "UNPLANNED",

    status:
      properties.STATUS
      ?? "",

    customersAffected:
      Number.isFinite(
        customers
      )
        ? Math.max(
            0,
            customers
          )
        : 0,

    suburbs:
      properties.SUBURBS
      ?? "",

    streets:
      properties.STREETS
      ?? "",

    start:
      properties.START
      ?? "",

    finish:
      properties.FINISH
      ?? "",

    estimatedFix:
      properties.EST_FIX_TIME
      ?? "",

    reason:
      properties.REASON
      ?? "",

    extracted:
      properties.EXTRACTED
      ?? ""
  };
}

export function filterCurrentPowerOutages(
  payload,
  nowMs = Date.now(),
  {requireGeometry = true} = {}
) {
  const features =
    Array.isArray(
      payload?.features
    )
      ? payload.features
          .filter(
            feature =>
              (!requireGeometry || feature?.geometry)
              && isCurrentPowerOutage(
                feature,
                nowMs
              )
          )
      : [];

  return {
    ...(
      payload
      && typeof payload
        === "object"
        ? payload
        : {}
    ),

    type:
      "FeatureCollection",

    features
  };
}

async function fetchJson(
  fetchImpl,
  url,
  provider,
  timeoutMs = 12000
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
    const response =
      await fetchImpl(
        url,
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/geo+json,application/json"
          },

          signal:
            controller?.signal
        }
      );

    if (!response.ok) {
      const label =
        provider
        === "Queensland boundary"
          ? provider
          : `${provider} outage feed`;

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

async function fetchText(
  fetchImpl,
  url,
  provider,
  timeoutMs = 12000
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
    const response =
      await fetchImpl(
        url,
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/vnd.google-earth.kml+xml,application/xml,text/xml,text/plain"
          },

          signal:
            controller?.signal
        }
      );

    if (!response.ok) {
      throw new Error(
        `${provider} outage feed HTTP ${response.status}`
      );
    }

    return await response.text();
  } finally {
    if (timeout) {
      clearTimeout(
        timeout
      );
    }
  }
}

// ArcGIS has a finite per-request maximum (2,000 records per layer).
// Load all pages, never silently treat an incomplete first page as complete.
export async function fetchPagedPowerOutageFeatures({
  fetchImpl, url, provider, pageSize = 1000, maxPages = 12
}) {
  const features = [];
  const seenPageIds = new Set();
  for (let page = 0; page < maxPages; page += 1) {
    const pageUrl = new URL(url);
    pageUrl.searchParams.set("resultOffset", String(page * pageSize));
    pageUrl.searchParams.set("resultRecordCount", String(pageSize));
    const payload = await fetchJson(fetchImpl, pageUrl.toString(), provider);
    if (payload?.error) throw new Error(
      provider + " outage feed: " + (payload.error.message || "ArcGIS query error")
    );
    if (!Array.isArray(payload?.features)) throw new Error(
      provider + " outage feed did not return a GeoJSON FeatureCollection"
    );
    if (payload.features.length) {
      const key = payload.features.map(f => String(
        f?.properties?.OBJECTID ?? f?.properties?.objectid ?? f?.id ?? ""
      )).join("|");
      if (seenPageIds.has(key)) throw new Error(
        provider + " outage feed repeated a page; refusing incomplete data"
      );
      seenPageIds.add(key);
    }
    features.push(...payload.features);
    if (payload.exceededTransferLimit !== true &&
        payload.features.length < pageSize) return features;
  }
  throw new Error(provider + " outage feed exceeded safe pagination limit");
}

async function loadProvider({
  fetchImpl,
  provider,
  url,
  pointUrl,
  nowMs
}) {
  // Polygon and point are separate authoritative layers; a fault without an
  // affected-area polygon still deserves an interactive operational marker.
  const names = ["area", "point"];
  const results = await Promise.allSettled([url, pointUrl].map((source, index) =>
    fetchPagedPowerOutageFeatures({
      fetchImpl, url: source, provider: provider + " " + names[index]
    })
  ));
  const layerErrors = [];
  const all = [];
  for (let i = 0; i < results.length; i += 1) {
    if (results[i].status === "fulfilled") all.push(...results[i].value);
    else layerErrors.push({
      provider: provider + " " + names[i],
      message: results[i].reason?.message ?? String(results[i].reason)
    });
  }
  if (results.every(r => r.status === "rejected")) {
    throw new Error(layerErrors.map(x => x.message).join(" | "));
  }
  // Prefer a surveyed affected-area polygon where both layers publish the
  // same incident. The point remains as a fallback when there is no polygon.
  const unique = new Map();
  // Keep QLD incident records without provider geometry in the STATEWIDE
  // count/report; do not invent a map point or LGA for those incidents.
  const filtered = filterCurrentPowerOutages(annotateProvider({
    type: "FeatureCollection", features: all
  }, provider), nowMs, {requireGeometry:false});
  for (const feature of filtered.features) {
    const key=String(feature.id);
    const prior=unique.get(key);
    // Prefer provider polygon, then provider point, then no geometry.
    if (!prior || (!prior.geometry && feature.geometry)) unique.set(key,feature);
  }
  const reportFeatures=[...unique.values()];
  return {provider, layerErrors,
    payload: {type:"FeatureCollection",features:reportFeatures.filter(f=>f.geometry)},
    reportPayload: {type:"FeatureCollection",features:reportFeatures}
  };
}

async function loadEssentialProvider({
  fetchImpl,
  url,
  boundaryUrl,
  nowMs
}) {
  const [
    kml,
    queenslandBoundary
  ] =
    await Promise.all([
      fetchText(
        fetchImpl,
        url,
        "Essential Energy"
      ),

      fetchJson(
        fetchImpl,
        boundaryUrl,
        "Queensland boundary"
      )
    ]);

  const parsed =
    parseEssentialEnergyKml(
      kml
    );

  const queenslandOnly =
    filterFeaturesToQueensland(
      parsed,
      queenslandBoundary
    );

  return {
    provider:
      "Essential Energy",

    payload:
      filterCurrentPowerOutages(
        queenslandOnly,
        nowMs
      ),
    reportPayload:
      filterCurrentPowerOutages(
        queenslandOnly,
        nowMs
      )
  };
}

export async function loadPowerOutages({
  fetchImpl =
    globalThis.fetch,

  energexUrl =
    ENERGEX_OUTAGE_AREA_QUERY_URL,

  ergonUrl =
    ERGON_OUTAGE_AREA_QUERY_URL,

  energexPointUrl =
    ENERGEX_OUTAGE_POINT_QUERY_URL,

  ergonPointUrl =
    ERGON_OUTAGE_POINT_QUERY_URL,

  essentialUrl =
    DEFAULT_ESSENTIAL_ENERGY_RELAY_URL,

  queenslandBoundaryUrl =
    QUEENSLAND_MAINLAND_QUERY_URL,

  nowMs =
    Date.now()
} = {}) {
  if (
    typeof fetchImpl
      !== "function"
  ) {
    throw new Error(
      "Power-outage fetch is unavailable."
    );
  }

  const requests =
    [
      {
        provider:
          "Energex",
        url:
          energexUrl,
        pointUrl:
          energexPointUrl
      },
      {
        provider:
          "Ergon",
        url:
          ergonUrl,
        pointUrl:
          ergonPointUrl,
        kind:
          "geojson"
      },
      {
        provider:
          "Essential Energy",
        url:
          essentialUrl,
        kind:
          "kml"
      }
    ];

  const settled =
    await Promise.allSettled(
      requests.map(
        request =>
          request.kind
          === "kml"
            ? loadEssentialProvider({
                fetchImpl,
                url:
                  request.url,
                boundaryUrl:
                  queenslandBoundaryUrl,
                nowMs
              })
            : loadProvider({
                fetchImpl,
                provider:
                  request.provider,
                url:
                  request.url,
                pointUrl:
                  request.pointUrl,
                nowMs
              })
      )
    );

  const available = [];
  const failed = [];
  const features = [];
  const reportFeatures = [];

  settled.forEach(
    (
      result,
      index
    ) => {
      const provider =
        requests[index]
          .provider;

      if (
        result.status
        === "fulfilled"
      ) {
        available.push(
          provider
        );
        failed.push(...(result.value.layerErrors ?? []));

        features.push(
          ...(
            result.value
              .payload
              .features
            ?? []
          )
        );
        reportFeatures.push(...(
          result.value.reportPayload?.features ?? result.value.payload?.features ?? []
        ));
      } else {
        failed.push({
          provider,
          message:
            result.reason
              ?.message
            ?? String(
              result.reason
            )
        });
      }
    }
  );

  if (!available.length) {
    throw new Error(
      failed
        .map(
          item =>
            item.message
        )
        .join(" | ")
      || "All power-outage feeds failed."
    );
  }

  return {
    payload: {
      type:
        "FeatureCollection",
      features
    },

    // Same incident snapshot as mapped features. Unlocated QLD records
    // remain reportable, but are deliberately not rendered as map entities.
    reportFeatures,

    providers:
      available,

    failedProviders:
      failed,

    partial:
      failed.length > 0,

    transport:
      "Queensland-only unplanned Energex/Ergon ArcGIS GeoJSON + Essential Energy KML clipped by Queensland Government mainland boundary"
  };
}


export const QUEENSLAND_POWER_PROVIDERS = Object.freeze([
  "Energex", "Ergon", "Essential Energy"
]);

// The statewide figure is the sum of distinct SOURCE INCIDENT IDs, never
// affected customer totals, polygon rings, map entities or repeated suburbs.
// Every row comes from the same 15-minute provider snapshot as the map.
export function powerOutageProviderCounts(features, {
  availableProviders=QUEENSLAND_POWER_PROVIDERS,
  failedProviders=[]
}={}) {
  const unique=new Set();
  const rows=QUEENSLAND_POWER_PROVIDERS.map(provider=>({
    provider, outages:0, customers:0, withoutGeometry:0,
    state:availableProviders.includes(provider)?"ok":"unavailable"
  }));
  const indexed=new Map(rows.map(row=>[row.provider,row]));
  for(const failure of failedProviders){
    const name=String(failure?.provider??"");
    const row=rows.find(r=>name===r.provider||name.startsWith(r.provider+" "));
    if(row && row.state!=="unavailable") row.state="partial";
  }
  for(const feature of Array.isArray(features)?features:[]){
    const summary=powerOutageSummary(feature);
    if(summary.type!=="UNPLANNED")continue;
    const row=indexed.get(summary.provider);
    if(!row || row.state==="unavailable")continue;
    const key=String(summary.id);
    if(!key || unique.has(key))continue;
    unique.add(key);
    row.outages++;
    row.customers+=summary.customersAffected;
    if(!feature?.geometry)row.withoutGeometry++;
  }
  return {
    rows,
    total:{
      outages:rows.reduce((sum,r)=>sum+r.outages,0),
      customers:rows.reduce((sum,r)=>sum+r.customers,0),
      withoutGeometry:rows.reduce((sum,r)=>sum+r.withoutGeometry,0)
    },
    partial:rows.some(row=>row.state!=="ok")
  };
}

// Ground-clamped Cesium polygon fills cannot use Entity geometry outlines.
// They were silently discarded by the renderer and emitted a warning on every
// outage refresh. PointGraphics outlines remain valid and untouched.
export function styleTerrainClampedPowerOutagePolygon(polygon,colour) {
  if(!polygon)return false;
  // Explicitly draw both ground/3-D classification with visible fill.
  // The previous default GeoJSON style could be effectively invisible over
  // satellite/terrain imagery and its unsupported entity outline was ignored.
  polygon.show=true;
  polygon.fill=true;
  polygon.material=colour.withAlpha(0.46);
  polygon.outline=false;
  polygon.zIndex=25;
  return true;
}

// Use only the exact Energex/Ergon affected-area boundary supplied by
// the provider. Never infer an outage region from a point, suburb or count.
export function officialPowerOutageBoundaryRings(feature){
 const g=feature?.geometry;
 if(!g)return [];
 const polys=g.type==="Polygon"?[g.coordinates]:
  g.type==="MultiPolygon"?g.coordinates:[];
 return polys.flatMap(poly=>(poly??[]).map(ring=>{
  const valid=(ring??[]).filter(c=>Array.isArray(c)&&c.length>=2&&
    Number.isFinite(Number(c[0]))&&Number.isFinite(Number(c[1]))&&
    Number(c[0])>=110&&Number(c[0])<=160&&Number(c[1])>=-45&&Number(c[1])<=-8);
  return valid.length>=4?valid.map(c=>[Number(c[0]),Number(c[1])]):[];
 }).filter(r=>r.length>=4));
}

// Build filled outage geometry from the ORIGINAL provider boundaries, not
// solely from GeoJsonDataSource entity IDs (Cesium may rename those IDs).
// Interior rings remain holes: no invented affected areas.
export function officialPowerOutagePolygonParts(feature){
 const g=feature?.geometry;
 const polys=g?.type==="Polygon"?[g.coordinates]:
   g?.type==="MultiPolygon"?g.coordinates:[];
 const clean=ring=>(ring??[]).filter(c=>Array.isArray(c)&&c.length>=2&&
   Number.isFinite(Number(c[0]))&&Number.isFinite(Number(c[1]))&&
   Number(c[0])>=110&&Number(c[0])<=160&&Number(c[1])>=-45&&Number(c[1])<=-8
 ).map(c=>[Number(c[0]),Number(c[1])]);
 return polys.flatMap(poly=>{
   const [outer,...holes]=poly??[];
   const outside=clean(outer);
   if(outside.length<4)return [];
   return [{outer:outside,holes:holes.map(clean).filter(r=>r.length>=4)}];
 });
}

export function createPowerOutageLayer({
  viewer,

  CesiumRef =
    globalThis.Cesium,

  fetchImpl =
    globalThis.fetch,

  energexUrl =
    ENERGEX_OUTAGE_AREA_QUERY_URL,

  ergonUrl =
    ERGON_OUTAGE_AREA_QUERY_URL,

  energexPointUrl =
    ENERGEX_OUTAGE_POINT_QUERY_URL,

  ergonPointUrl =
    ERGON_OUTAGE_POINT_QUERY_URL,

  essentialUrl =
    DEFAULT_ESSENTIAL_ENERGY_RELAY_URL,

  queenslandBoundaryUrl =
    QUEENSLAND_MAINLAND_QUERY_URL,

  refreshMs =
    DEFAULT_POWER_OUTAGE_REFRESH_MS,

  visible = true,

  refreshWhileHidden = false,

  onStatus =
    () => {},

  onUpdate =
    () => {}
} = {}) {
  if (
    !viewer
    || !CesiumRef
  ) {
    throw new Error(
      "Power-outage layer requires Cesium and a viewer."
    );
  }

  const dataSource =
    new CesiumRef
      .GeoJsonDataSource(
        "power-outages"
      );

  dataSource.show =
    Boolean(
      visible
    );

  viewer.dataSources.add(
    dataSource
  );

  const unplannedColour =
    CesiumRef.Color
      .fromCssColorString(
        "#ff5252"
      );

  const outlineColour =
    CesiumRef.Color
      .fromCssColorString(
        "#1b1b1b"
      );

  let currentFeatures = [];
  let loading = null;
  let timer = null;
  let lastLoadedAt = 0;
  let snapshotExpired = false;
  let lastPresentedStatus = null;
  function reportStatus(status) {
    lastPresentedStatus = status;
    onStatus(status);
  }
  function expireStaleSnapshot() {
    if (snapshotExpired || !sourceSnapshotState({lastLoadedAt,maxAgeMs:MAX_CONTEXT_SNAPSHOT_AGE_MS.powerOutages}).expired) return false;
    snapshotExpired = true;
    currentFeatures = [];
    dataSource.entities.removeAll();
    viewer.scene.requestRender();
    onUpdate([]);
    reportStatus({kind:"error",message:"Source expired · old outage markers removed · last checked "+checkedAtAest(lastLoadedAt)});
    return true;
  }


  async function render(
    payload,
    reportFeatures = payload.features ?? []
  ) {
    currentFeatures =
      payload.features
      ?? [];

    const wasVisible =
      dataSource.show;

    await dataSource.load(
      payload,
      {
        clampToGround:
          true
      }
    );

    dataSource.show =
      wasVisible;

    for (
      const entity
      of dataSource
        .entities
        .values
    ) {
      const feature =
        currentFeatures
          .find(
            item =>
              String(
                item.id
              )
              === String(
                entity.id
              )
          );

      // All provider polygon fills are reconstructed below from the original
      // source coordinates; never leave a duplicate unstyled GeoJSON polygon.
      if(entity.polygon) entity.polygon.show=false;
      if (!feature) {
        continue;
      }

      const summary =
        powerOutageSummary(
          feature
        );

      entity
        .stormTrackerPowerOutageId =
        String(
          summary.id
        );

      entity
        .stormTrackerPowerOutageProvider =
        summary.provider;

      if (entity.billboard && typeof CesiumRef.PointGraphics === "function") {
        // Cesium GeoJSON's default pin is easy to miss on satellite imagery.
        // Replace with a high-contrast ground-clamped clickable outage node.
        entity.billboard.show = false;
        entity.point = new CesiumRef.PointGraphics({
          pixelSize: 13,
          color: unplannedColour,
          outlineColor: outlineColour,
          outlineWidth: 2,
          heightReference: CesiumRef.HeightReference?.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        });
      }
      // The provider polygon is clamped to the real terrain, so outline
      // graphics are unsupported by Cesium. Keep the existing translucent
      // fill and suppress the previously ineffective geometry outline.
      styleTerrainClampedPowerOutagePolygon(entity.polygon,unplannedColour);
      // Replace GeoJSON polygon with a guaranteed visible source-bound shape.
      // Cesium can assign a different internal entity ID, preventing the fill
      // styling above from matching its provider feature.
      if(entity.polygon) entity.polygon.show=false;
    }

    // Use the surveyed original Polygon/MultiPolygon, including any holes.
    // Exactly the same source geometry is used for the shaded fill and edge.
    for(const feature of currentFeatures){
      const summary=powerOutageSummary(feature);
      for(const [index,part] of officialPowerOutagePolygonParts(feature).entries()){
        const outer=CesiumRef.Cartesian3.fromDegreesArray(part.outer.flat());
        const holes=part.holes.map(ring=>{
          const positions=CesiumRef.Cartesian3.fromDegreesArray(ring.flat());
          return typeof CesiumRef.PolygonHierarchy==="function"?
            new CesiumRef.PolygonHierarchy(positions):{positions,holes:[]};
        });
        const hierarchy=typeof CesiumRef.PolygonHierarchy==="function"?
          new CesiumRef.PolygonHierarchy(outer,holes):{positions:outer,holes};
        const fillEntity=dataSource.entities.add({
          id:"stormtracker-outage-fill-"+summary.id+"-"+index,
          name:summary.suburbs||"Power outage affected area",
          polygon:{
            hierarchy,show:true,fill:true,outline:false,
            material:unplannedColour.withAlpha(0.38),
            zIndex:25
          }
        });
        fillEntity.stormTrackerPowerOutageId=String(summary.id);
        fillEntity.stormTrackerPowerOutageProvider=summary.provider;
      }
    }

    // The official outage boundaries are separately visualised with an
    // elevated render order. Cesium terrain classification can otherwise
    // display an almost invisible translucent fill without its outer edge.
    // These coordinates are always taken from the actual provider polygons.
    for (const feature of currentFeatures) {
      const summary=powerOutageSummary(feature);
      for (const [index,ring] of officialPowerOutageBoundaryRings(feature).entries()) {
        const flat=ring.flatMap(c=>c);
        const edge=dataSource.entities.add({
          id:"stormtracker-outage-boundary-"+summary.id+"-"+index,
          name:summary.suburbs||"Power outage affected area",
          polyline:{
            show:true,
            positions:CesiumRef.Cartesian3.fromDegreesArray(flat),
            width:4,
            clampToGround:true,
            zIndex:35,
            material:unplannedColour.withAlpha(0.96)
          }
        });
        edge.stormTrackerPowerOutageId=String(summary.id);
        edge.stormTrackerPowerOutageProvider=summary.provider;
      }
    }
    viewer.scene.requestRender();
    onUpdate(reportFeatures.slice(), currentFeatures.slice());
  }

  async function refresh({
    force = false
  } = {}) {
    if (
      !dataSource.show
      && !force
    ) {
      return currentFeatures;
    }

    if (loading) {
      return loading;
    }

    loading =
      (async () => {
        reportStatus({
          kind:
            "loading",
          message:
            "Checking power outages..."
        });

        const result =
          await loadPowerOutages({
            fetchImpl,
            energexUrl,
            ergonUrl,
            energexPointUrl,
            ergonPointUrl,
            essentialUrl,
            queenslandBoundaryUrl
          });

        await render(
          result.payload,
          result.reportFeatures
        );

        lastLoadedAt =
          Date.now();
        snapshotExpired = false;

        const summaries =
          result.reportFeatures
            .map(
              powerOutageSummary
            );

        const customers =
          summaries.reduce(
            (
              sum,
              item
            ) =>
              sum
              + item
                .customersAffected,
            0
          );

        const unlocatedCount = result.reportFeatures.length - currentFeatures.length;
        const providerText =
          result.providers
            .join(" + ");

        const partialText =
          result.partial
            ? ` | PARTIAL: ${result.failedProviders.map(item => item.provider).join(", ")} unavailable`
            : "";

        reportStatus({
          kind:
            result.partial
              ? "warning"
              : "ok",

          message:
            `${summaries.length} unplanned outage${summaries.length === 1 ? "" : "s"} | ${customers.toLocaleString("en-AU")} customers | ${providerText}${unlocatedCount ? " | "+unlocatedCount+" without a mapped position" : ""}${partialText} | checked ${checkedAtAest(lastLoadedAt)}`,

          count:
            summaries.length,

          unlocatedCount,

          customers,

          providers:
            result.providers
              .slice(),

          failedProviders:
            result.failedProviders
              .slice(),

          partial:
            result.partial,

          transport:
            result.transport,

          loadedAt:
            lastLoadedAt
        });

        return currentFeatures;
      })();

    try {
      return await loading;
    } catch (error) {
      expireStaleSnapshot();
      reportStatus(sourceFailureStatus({error,lastLoadedAt,maxAgeMs:MAX_CONTEXT_SNAPSHOT_AGE_MS.powerOutages}));

      throw error;
    } finally {
      loading =
        null;
    }
  }

  function setVisible(
    nextVisible
  ) {
    expireStaleSnapshot();
    dataSource.show =
      Boolean(
        nextVisible
      );

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
      else if (lastPresentedStatus) {
        reportStatus(lastPresentedStatus);
      }
    }
  }

  const onVisibilityChange = () => {
    if (document.hidden) return;
    expireStaleSnapshot();
    if (dataSource.show || refreshWhileHidden) refresh({force:refreshWhileHidden}).catch(() => {});
  };

  function start() {
    if (timer) {
      return;
    }

    if (dataSource.show || refreshWhileHidden) {
      refresh({force:refreshWhileHidden}).catch(() => {});
    }

    if (typeof document !== 'undefined') document.addEventListener('visibilitychange',onVisibilityChange);
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

          expireStaleSnapshot();
          refresh({force:refreshWhileHidden}).catch(() => {});
        },
        refreshMs
      );
  }

  function stop() {
    if (!timer) {
      return;
    }

    clearInterval(
      timer
    );
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange',onVisibilityChange);

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
            ) === wanted
        )
      ?? null
    );
  }

  return {
    dataSource,
    refresh,
    setVisible,
    start,
    stop,
    featureById,

    get features() {
      return currentFeatures
        .slice();
    },

    get lastLoadedAt() {
      return lastLoadedAt;
    }
  };
}
