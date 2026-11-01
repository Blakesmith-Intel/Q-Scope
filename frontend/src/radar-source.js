import { decodeReflectivityImageData, decodeDopplerImageData } from "./palette.js?v=live-bom-v1";
import { createRadarRequestPressureGuard } from "./radar-request-pressure-v1.js?v=20261101-multi-radar-reliability";

const guardedRadarRequests=createRadarRequestPressureGuard();
// Keep source-verified compressed PNGs rather than 256x256 RGBA bitmaps:
// adjacent radar sites may share many tiles, and rapid site switches must
// not re-download identical original BoM images. URLs include exact UTC,
// tile row/column and product, so a cached blob cannot be misdated.
const VERIFIED_WMTS_BLOB_LIMIT=96;
const verifiedWmtsBlobs=new Map();
const isWmtsTile=url=>/\/wmts\?/i.test(String(url));
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
if(isNetworkGuardPreview())
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
  let response;

  try {
    response = await fetch(url, {
      mode: "cors",
      cache: "no-store"
    });
  } catch (error) {
    throw new Error(
      `Browser could not fetch readable radar pixels (network/CORS): ${error.message}`
    );
  }

  if (!response.ok) {
    const error=new Error(`Image request failed: HTTP ${response.status}`);
    error.status=response.status;
    throw error;
  }

  const blob=await response.blob();
  const pixels=await blobToImageData(blob);
  if(isWmts)rememberVerifiedWmtsBlob(url,blob);
  return pixels;
  };
  // Radar scan source is unchanged. Only bound request pressure in this
  // isolated review path; all previously approved previews stay identical.
  if(isNetworkGuardPreview() && /\/wmts\?/i.test(String(url)))
    return guardedRadarRequests.run(String(url),read);
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
