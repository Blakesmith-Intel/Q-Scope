import { decodeReflectivityImageData, decodeDopplerImageData } from "./palette.js?v=live-bom-v1";
import { createRadarRequestPressureGuard } from "./radar-request-pressure-v1.js?v=20261101-multi-radar-reliability";

const guardedRadarRequests=createRadarRequestPressureGuard();
// Keep source-verified compressed PNGs rather than 256x256 RGBA bitmaps:
// adjacent radar sites may share many tiles, and rapid site switches must
// not re-download identical original BoM images. URLs include exact UTC,
// tile row/column and product, so a cached blob cannot be misdated.
const VERIFIED_WMTS_BLOB_LIMIT=96;
// A stalled relay/browser fetch must not hold a scarce source request slot
// indefinitely. The timer starts only after the queued request runs.
export const WMTS_TILE_REQUEST_TIMEOUT_MS=15000;
const verifiedWmtsBlobs=new Map();
const refusedWmtsUrls=new Set();
const isWmtsTile=url=>/\/wmts\?/i.test(String(url));
function noteRefusedWmtsUrl(url){
  const key=String(url);
  refusedWmtsUrls.delete(key);
  refusedWmtsUrls.add(key);
  while(refusedWmtsUrls.size>120)
    refusedWmtsUrls.delete(refusedWmtsUrls.values().next().value);
}
// Browser-reachable native source for the EXACT SAME PUBLIC BoM WMTS PNG.
// Use only if the relay denies this one authentic source tile.
const NATIVE_BOM_WMTS="https://api.bom.gov.au/apikey/v1/mapping/timeseries/wmts";
export function officialWmtsFallbackUrl(url){
  try{
    const target=new URL(String(url));
    if(target.origin!=="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev" ||
       target.pathname!=="/wmts" ||
       target.searchParams.get("LAYER")!=="atm_surf_air_precip_reflectivity_dbz" ||
       !target.searchParams.get("time"))return null;
    return NATIVE_BOM_WMTS+target.search;
  }catch{return null;}
}
function cachedVerifiedWmtsBlob(url){
  const key=String(url),blob=verifiedWmtsBlobs.get(key);
  if(blob){verifiedWmtsBlobs.delete(key);verifiedWmtsBlobs.set(key,blob);}
  return blob;
}
function rememberVerifiedWmtsBlob(url,blob){
  const key=String(url);
  verifiedWmtsBlobs.delete(key);
  verifiedWmtsBlobs.set(key,blob);
  while(verifiedWmtsBlobs.size>VERIFIED_WMTS_BLOB_LIMIT)
    verifiedWmtsBlobs.delete(verifiedWmtsBlobs.keys().next().value);
}
export function networkPressureDiagnostics(){
  return {...guardedRadarRequests.snapshot(),verifiedTileBlobs:verifiedWmtsBlobs.size};
}
function isNetworkGuardPreview(){
  // Production V9.19.0 uses the same bounded WMTS request pressure as its
  // accepted preview, not the obsolete unguarded V9.18 network path.
  return ["/preview/network-guard/","/preview/label-gpu-guard/","/preview/radar-history-fix/","/preview/next-baseline/","/preview/incremental-3d/"].some(
    route=>globalThis.location?.pathname?.includes(route)===true) ||
    (/\/live3d-operational-v9\.html$/.test(
      String(globalThis.location?.pathname??"")) &&
      !String(globalThis.location?.pathname??"").includes("/preview/"));
}
// Diagnostics are read-only and available in every production/QA viewer,
// so operator-side tests can verify the same bounded live network behaviour.
if(typeof globalThis.window!=="undefined")
  globalThis.__stormtrackerRelayPressureDiagnostics=networkPressureDiagnostics;

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

async function blobToImageData(blob) {
  let source;

  if (typeof createImageBitmap === "function") {
    source = await createImageBitmap(blob);
  } else if (typeof document !== "undefined") {
    source = await new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(blob);

      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Unable to decode browser image."));
      };

      image.src = objectUrl;
    });
  } else {
    throw new Error("This browser cannot decode radar image blobs.");
  }

  const width = source.width ?? source.naturalWidth;
  const height = source.height ?? source.naturalHeight;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) throw new Error("Unable to create image decode canvas.");

  ctx.drawImage(source, 0, 0);
  return ctx.getImageData(0, 0, width, height);
}

export async function fetchReadableImage(url) {
  // Valid previously decoded BoM PNGs may be reused without contacting a
  // busy relay again. Decode on demand to bound mobile memory use.
  const isWmts=isWmtsTile(url);
  const verifiedBlob=isWmts?cachedVerifiedWmtsBlob(url):null;
  if(verifiedBlob)return blobToImageData(verifiedBlob);
  const read=async()=>{
  let blob;
  const controller=new AbortController();
  const timer=isWmts?setTimeout(()=>controller.abort(),WMTS_TILE_REQUEST_TIMEOUT_MS):null;
  try {
    let response=await fetch(url, {
      mode: "cors",
      // Exact WMTS URLs include the immutable BoM observation UTC and tile.
      // Let the browser reuse a successful PNG instead of needlessly asking
      // the relay for the same source bytes on every loop/site switch.
      // On retry, bypass an older cached 403 without changing the exact BoM
      // tile URL. Successful source PNGs retain normal browser caching.
      cache: isWmts && !refusedWmtsUrls.has(String(url)) ? "default" : "no-store",
      signal:controller.signal
    });
    if(isWmts && response.status===403)noteRefusedWmtsUrl(url);
    // A 403 from the relay is not proof that the original BoM tile is gone.
    // Try one native request for the IDENTICAL UTC, coordinates and layer,
    // within the existing guarded request slot and 15-second deadline.
    // If direct access is also refused or CORS-blocked, retain the original
    // 403 and normal exact-tile cooldown; never substitute another image.
    // GitHub Pages cannot read this native endpoint: its response lacks
    // Access-Control-Allow-Origin. Do not repeatedly make doomed browser
    // CORS requests after an isolated relay 403; let the existing exact-tile
    // cooldown/recovery retry the original PNG via the approved relay.
    const browserNativeCorsBlocked=globalThis.location?.origin===
      "https://blakesmith-intel.github.io";
    const nativeUrl=isWmts && response.status===403 && !browserNativeCorsBlocked
      ? officialWmtsFallbackUrl(url):null;
    if(nativeUrl){
      try{
        const official=await fetch(nativeUrl,{
          mode:"cors",cache:"default",signal:controller.signal
        });
        if(official.ok)response=official;
      }catch{/* source refusal remains retriable after the usual cooldown */}
    }
    if(response.ok && isWmts)refusedWmtsUrls.delete(String(url));
    if (!response.ok) {
      const error=new Error(`Image request failed: HTTP ${response.status}`);
      error.status=response.status;
      throw error;
    }
    // Keep the deadline active until every real PNG byte arrives. Receiving
    // HTTP headers alone does not verify an authentic source image.
    blob=await response.blob();
  } catch (error) {
    if(Number(error?.status))throw error;
    if(error?.name==="AbortError")
      throw new Error(`BoM WMTS tile timed out after ${WMTS_TILE_REQUEST_TIMEOUT_MS} ms`);
    throw new Error(
      `Browser could not fetch readable radar pixels (network/CORS): ${error?.message??error}`
    );
  } finally {
    if(timer!==null)clearTimeout(timer);
  }
  const pixels=await blobToImageData(blob);
  if(isWmts)rememberVerifiedWmtsBlob(url,blob);
  return pixels;
  };
  // Every StormTracker route uses the same source pipeline. Keep the
  // established two-request BoM WMTS bound on production AND all preview
  // subpaths; otherwise a review can burst 9–16 tiles per scan and lose a
  // genuine frame to intermittent relay limits (403/429/502/503).
  // The exact-UTC verified-PNG blob cache above remains unchanged.
  if(isWmts) return guardedRadarRequests.run(String(url),read);
  return read();
}

export async function fileToImageData(file) {
  return blobToImageData(file);
}

export async function reflectivityFromUrl(url, palette, tolerance = 0) {
  const imageData = await fetchReadableImage(url);
  return {
    width: imageData.width,
    height: imageData.height,
    categories: decodeReflectivityImageData(imageData, palette, tolerance)
  };
}

export async function reflectivityFromFile(file, palette, tolerance = 0) {
  const imageData = await fileToImageData(file);
  return {
    width: imageData.width,
    height: imageData.height,
    categories: decodeReflectivityImageData(imageData, palette, tolerance)
  };
}

export async function dopplerFromUrl(url, palette, tolerance = 0) {
  const imageData = await fetchReadableImage(url);
  return {
    width: imageData.width,
    height: imageData.height,
    velocities: decodeDopplerImageData(imageData, palette, tolerance)
  };
}
