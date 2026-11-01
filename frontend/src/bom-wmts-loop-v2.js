// One national BoM reflectivity raster when it is genuinely current. The
// independently verified FTP archive is the bounded source-of-truth fallback.
// No direct Cloudflare TCP/FTP, guessed timestamps or stitched 22-site frontend.
export const NATIONAL_MOSAIC_PRIMARY=true;
export const HIGH_RESOLUTION_FRAMES_ONLY=true;
import { BORDER_RADAR_SITES } from "./border-radar-sites-v1.js";
import { decodeReflectivityImageData, SOURCE_PALETTES, REFLECTIVITY_CLASSES } from "./palette.js?v=diagnostics-v1";
import { fetchReadableImage } from "./radar-source.js?v=diagnostics-v1";
import { loadCompleteRadarTiles } from "./radar-tile-retry-v1.js?v=9.16-radar-recovery";
import {publishedReflectivityTimes} from "./bom-wmts-published-times-v1.js?v=20261019-native-bom-hires-current";

// Retain the genuine high-resolution national BoM WMTS PNG product; only
// transport it through our existing CORS relay so browsers can read pixels.
const BOM_WMTS_BASE = "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/wmts";
const REFLECTIVITY_LAYER = "atm_surf_air_precip_reflectivity_dbz";
const TILE_MATRIX_SET = "GoogleMapsCompatible_BoM";
const ZOOM = 8;
const WORLD_EXTENT_M = 40075016.68557849;
// GetCapabilities is a hint, NOT proof tiles are retrievable. BoM's live
// endpoint has advertised 80+-minute-old times that subsequently return 400.
// Older genuine observations can remain in the existing local radar archive.
export const WMTS_SOURCE_FRESHNESS_MS = 45*60000;

export function createWmtsTimeFailureGuard({
  now=()=>Date.now(),ttlMs=300000,maxEntries=36
}={}){
  const rejected=new Map();
  const prune=()=>{for(const [time,until] of rejected)
    if(until<=now())rejected.delete(time);};
  return {
    isRejected: time=>{prune();return (rejected.get(time)??0)>now();},
    reject: time=>{prune();rejected.set(time,now()+ttlMs);
      while(rejected.size>maxEntries)rejected.delete(rejected.keys().next().value);},
    clear: time=>rejected.delete(time),
    size:()=>{prune();return rejected.size;}
  };
}
const unavailableTime=createWmtsTimeFailureGuard();

// Current BOM observed-weather WMTS matrix metadata for native zoom 8.
const MATRIX = Object.freeze({
  tlx: 11584952,
  tly: -740105.880375,
  width: 43,
  height: 33
});

// SEQ window covering Gympie/Mt Kanigan, Marburg and Mt Stapylton plus
// surrounding storm approach/departure area.
const SEQ_WINDOW = Object.freeze({
  colStart: 33,
  colEnd: 35,
  rowStart: 13,
  rowEnd: 16
});

export function reflectivityWindowForRegion(region = 'SEQ') {
  if (region === 'SEQ') return SEQ_WINDOW;
  const site = BORDER_RADAR_SITES[region];
  if (!site) throw new Error(`Unknown radar site: ${region}`);
  const R = 6378137, span = tileSpanM();
  const x = R * site.longitude * Math.PI / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + site.latitude * Math.PI / 360));
  const radius = 160000 / Math.cos(site.latitude * Math.PI / 180);
  return Object.freeze({
    colStart: Math.max(0, Math.floor((x - radius - MATRIX.tlx) / span)),
    colEnd: Math.min(MATRIX.width - 1, Math.floor((x + radius - MATRIX.tlx) / span)),
    rowStart: Math.max(0, Math.floor((MATRIX.tly - y - radius) / span)),
    rowEnd: Math.min(MATRIX.height - 1, Math.floor((MATRIX.tly - y + radius) / span))
  });
}

function tileSpanM() {
  return WORLD_EXTENT_M / (2 ** ZOOM);
}

export function buildBomReflectivityTileUrl(col, row, observedUtc) {
  if (!Number.isInteger(col) || !Number.isInteger(row)) {
    throw new TypeError("BOM WMTS col and row must be integers.");
  }
  if (col < 0 || col >= MATRIX.width || row < 0 || row >= MATRIX.height) {
    throw new RangeError(`BOM WMTS tile outside matrix: col=${col}, row=${row}`);
  }

  const params = new URLSearchParams({
    SERVICE: "WMTS",
    REQUEST: "GetTile",
    VERSION: "1.0.0",
    LAYER: REFLECTIVITY_LAYER,
    STYLE: "default",
    FORMAT: "image/png",
    TILEMATRIXSET: TILE_MATRIX_SET,
    TILEMATRIX: String(ZOOM),
    TILEROW: String(row),
    TILECOL: String(col),
    time: observedUtc
  });

  return `${BOM_WMTS_BASE}?${params.toString()}`;
}

function floorToFiveMinutes(epochMs) {
  return Math.floor(epochMs / 300000) * 300000;
}

export function candidateBomReflectivityTimes(now = Date.now(), count = 8) {
  const base = floorToFiveMinutes(Number(now)) - 10 * 60 * 1000;
  return Array.from({ length: count }, (_, index) =>
    new Date(base - index * 5 * 60 * 1000)
      .toISOString()
      .replace(".000Z", "Z")
  );
}

async function probeTimestamp(observedUtc, region = 'SEQ') {
  const window = reflectivityWindowForRegion(region);
  const col = region === "SEQ" ? 34 : Math.floor((window.colStart + window.colEnd) / 2);
  const row = region === "SEQ" ? 15 : Math.floor((window.rowStart + window.rowEnd) / 2);
  const url = buildBomReflectivityTileUrl(col, row, observedUtc);
  const image = await fetchReadableImage(url);
  return image.width > 0 && image.height > 0;
}

// WMTS GetCapabilities publishes the nine ACTUAL source times. NEVER probe
// speculative 5-minute UTC offsets: BoM reports "failed to validate requested
// value for dimension (time)" and HTTP 400 for unpublished timestamps.
// Source freshness decides whether a new live scan can be discovered.
// Replay eligibility independently preserves older genuine observations.
export function publishedRadarHistoryTimes(times,now=Date.now()){
  const epoch=Number(now);
  return [...new Set(Array.isArray(times)?times:[])]
    .filter(time=>{
      const t=Date.parse(time);
      return Number.isFinite(t)&&Number.isFinite(epoch)&&
        t>=epoch-180*60000&&t<=epoch+5*60000&&
        !unavailableTime.isRejected(time);
    }).sort();
}
function currentPublishedTimes(times,now=Date.now()){
  const epoch=Number(now);
  return publishedRadarHistoryTimes(times,now)
    .filter(time=>Date.parse(time)>=epoch-WMTS_SOURCE_FRESHNESS_MS);
}
async function validatedNationalTimes(now,region,publishedTimes,verifyTile=probeTimestamp){
 const history=publishedRadarHistoryTimes(await publishedTimes(),now);
 const published=currentPublishedTimes(history,now);
 if(!published.length)
  throw Error("National BoM mosaic has no verified current observation timestamp");
 // BoM GetCapabilities may list times with missing 400 tiles. Check one REAL
 // central source PNG before exposing a whole history or prewarming images.
 for(const observedUtc of published.slice(-3).reverse()){
  try{
   if(await verifyTile(observedUtc,region))
    return history.filter(t=>t<=observedUtc);
  }catch(error){
   unavailableTime.reject(observedUtc);
   console.warn("National BoM reflectivity frame unavailable",observedUtc,
    String(error?.message??error));
  }
 }
 throw Error("BoM national reflectivity timestamps have no readable tiles");
}
export async function findLatestBomReflectivityTime(
 now=Date.now(),region='SEQ',{
 publishedTimes=publishedReflectivityTimes,
 verifyNationalTile=probeTimestamp
 }={}
){
 // Only authentic currently issued high-resolution national dBZ imagery.
 // No regional FTP mosaics, interpolation, substituted timestamps or textures.
 return (await validatedNationalTimes(now,region,publishedTimes,verifyNationalTile)).at(-1);
}

function createCanvas(width, height) {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }

  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  throw new Error("No browser canvas implementation is available.");
}

export async function loadVerifiedNationalMosaicAtTime(observedUtc, region = 'SEQ') {
  if (!observedUtc) throw new Error("observedUtc is required.");
  const window = reflectivityWindowForRegion(region);
  const columns = window.colEnd - window.colStart + 1;
  const rows = window.rowEnd - window.rowStart + 1;
  const tileSize = 256;
  const width = columns * tileSize;
  const height = rows * tileSize;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) throw new Error("Unable to create a 2-D canvas context.");

  const tasks = [];
  for (let row = window.rowStart; row <= window.rowEnd; row++) {
    for (let col = window.colStart; col <= window.colEnd; col++) {
      tasks.push({
        col, row,
        url: buildBomReflectivityTileUrl(col, row, observedUtc),
        x: (col - window.colStart) * tileSize,
        y: (row - window.rowStart) * tileSize
      });
    }
  }
  // Source times remain untrusted until a *real source pixel* loads. Probe
  // one tile BEFORE requesting the rest of the mosaic; previously each stale
  // time produced 9-16 simultaneous 400s, repeated per radar and prewarm.
  if(unavailableTime.isRejected(observedUtc))
    throw Error("BoM WMTS timestamp unavailable (cached source rejection): "+observedUtc);
  const first=tasks[0];
  let firstImage;
  try{
    firstImage=await fetchReadableImage(first.url);
  }catch(error){
    if(/HTTP\s+400\b/.test(String(error?.message??error)))
      unavailableTime.reject(observedUtc);
    throw Error("BoM WMTS source time preflight failed at "+
      observedUtc+": "+String(error?.message??error));
  }
  let tiles;
  try{
    tiles=await loadCompleteRadarTiles(tasks,
      url=>url===first.url?Promise.resolve(firstImage):fetchReadableImage(url),{
      retries:1,stopOnPermanent:true
    });
  }catch(error){
    if(/HTTP\s+400\b/.test(String(error?.message??error)))
      unavailableTime.reject(observedUtc);
    throw error;
  }

  for (const tile of tiles) {
    ctx.putImageData(tile.image, tile.x, tile.y);
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const categories = decodeReflectivityImageData(
    imageData,
    SOURCE_PALETTES.reflectivityRgb,
    2
  );

  const span = tileSpanM();

  const minX = MATRIX.tlx + window.colStart * span;
  const maxX = MATRIX.tlx + (window.colEnd + 1) * span;
  const maxY = MATRIX.tly - window.rowStart * span;
  const minY = MATRIX.tly - (window.rowEnd + 1) * span;

  let colouredPixelCount = 0;
  let strongPixelCount = 0;
  let maxCategory = 0;
  const categoryHistogram = Array(16).fill(0);

  for (const value of categories) {
    if (value > 0) {
      colouredPixelCount++;
      categoryHistogram[value]++;
      if (value > maxCategory) maxCategory = value;
    }
    if (value >= 7) strongPixelCount++;
  }

  const [maxDbzLowerBound, maxDbzUpperBound] =
    REFLECTIVITY_CLASSES[maxCategory] ?? [null, null];

  return {
    radarId: "BOM-MOSAIC",
    sourceId: "BOM-MOSAIC",
    observedUtc,
    width,
    height,
    categories,
    georef: {
      projection: "EPSG:3857",
      minX,
      maxX,
      minY,
      maxY
    },
    sourceMetadata: {
      provider: "Australian Bureau of Meteorology",
      transport: "Official high-resolution Bureau national WMTS PNG via same-byte CORS relay (native Australian matrix)",
      metadataRelay: "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/wmts-native-capabilities",
      product: "Public observed rain reflectivity WMTS",
      layer: REFLECTIVITY_LAYER,
      tileMatrixSet: TILE_MATRIX_SET,
      zoom: ZOOM,
      tileWindow: { ...window },
      region,
      colouredPixelCount,
      strongPixelCount,
      maxCategory,
      maxDbzLowerBound,
      maxDbzUpperBound,
      categoryHistogram,
      volumeStatus: "live-2d-only"
    }
  };
}

export async function loadBomReflectivityMosaicAtTime(
 observedUtc,region='SEQ',knownPublishedTimes=null
){
 if(!observedUtc)throw Error("observedUtc is required");
 // Keep one authentic capability snapshot during a multi-frame load.
 // Every individual PNG tile must still pass source verification.
 const sourceTimes=publishedRadarHistoryTimes(
  Array.isArray(knownPublishedTimes)?knownPublishedTimes:await publishedReflectivityTimes()
 );
 if(!sourceTimes.includes(observedUtc))
  throw Error("BoM high-resolution frame not published in bounded history: "+observedUtc);
 return loadVerifiedNationalMosaicAtTime(observedUtc,region);
}

export async function loadLatestBomReflectivityMosaic(now = Date.now(), region = 'SEQ') {
  const observedUtc = await findLatestBomReflectivityTime(now, region);
  return loadBomReflectivityMosaicAtTime(observedUtc, region);
}

// All site choices consume ONE cached verified BoM GetCapabilities dimension.
// This removes the 4+9 speculative WMTS 400 requests per site/load while
// retaining the browser's genuine old observations for 60/120/180-min loops.
export async function discoverBoundedBomReflectivityHistory(
 now=Date.now(),horizonMinutes=180,region='SEQ',
 {publishedTimes=publishedReflectivityTimes,maximumPublishedFrames=9,
  verifyNationalTile=probeTimestamp}={}
){
 const max=Math.min(9,Math.max(1,Math.trunc(maximumPublishedFrames)));
 const horizon=Math.max(5,Math.min(180,Number(horizonMinutes)||180));
 const times=await validatedNationalTimes(now,region,publishedTimes,verifyNationalTile);
 const newest=Date.parse(times.at(-1));
 // Never silently return unverified 512px FTP imagery if the native mosaic
 // is unavailable. A caller may retain a PREVIOUSLY VERIFIED high-res frame.
 return times.filter(x=>Date.parse(x)>=newest-horizon*60000).slice(-max);
}

export async function discoverBomReflectivityHistory(
  now=Date.now(),horizonMinutes=180,region='SEQ',
  options={}
){
  return discoverBoundedBomReflectivityHistory(
    now,horizonMinutes,region,options
  );
}

export async function findRecentBomReflectivityTimes(
 now=Date.now(),count=6,region='SEQ',
 {publishedTimes=publishedReflectivityTimes,
  verifyNationalTile=probeTimestamp}={}
){
 return (await discoverBoundedBomReflectivityHistory(now,180,region,{
  publishedTimes,maximumPublishedFrames:count,verifyNationalTile
 })).slice(-Math.max(1,Math.min(9,Math.trunc(Number(count)||6))));
}

export async function loadRecentBomReflectivityMosaics(
  now = Date.now(),
  count = 6,
  onProgress = null,
  region = 'SEQ'
) {
  const times = await findRecentBomReflectivityTimes(now, count, region);
  const frames = [];

  for (let index = 0; index < times.length; index++) {
    const observedUtc = times[index];

    onProgress?.({
      stage: "loading",
      index,
      total: times.length,
      observedUtc
    });

    const frame =
      await loadBomReflectivityMosaicAtTime(observedUtc, region);

    frames.push(frame);

    onProgress?.({
      stage: "loaded",
      index,
      total: times.length,
      observedUtc,
      frame
    });
  }

  return frames;
}

