// Original Bureau FWO CAP bulletin, paired with independent GIS2Web geometry.
// BoM publishes these same FWO warning products through anonymous FTP AND
// https://www.bom.gov.au/fwo/. Cloudflare FTP TCP timed out in production on
// 12 Nov 2026. Use the verified original HTTPS publication instead.
// This module NEVER creates or modifies a polygon, storm cell or GIS issue.
import {parseBomCapProductNotice,parseOfficialBomCap}
 from "../frontend/src/context-layers/bom-warning-cap-source-v1.js";

export const FTP_WARNING_CODES=Object.freeze([
 "IDQ21033","IDQ21035","IDQ21037","IDQ21038"
]);
export const OFFICIAL_BOM_FWO_URL="https://www.bom.gov.au/fwo/";
const MAX_CAP_BYTES=240000;
const DECODER=new TextDecoder();
const CACHE_ORIGIN="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev";

export function verifyOfficialFtpWarningCap(code,xml,{nowMs=Date.now()}={}){
 if(!FTP_WARNING_CODES.includes(code)||typeof xml!=="string"||
    xml.length<150||xml.length>MAX_CAP_BYTES)throw Error("Unrecognised BoM FWO CAP product");
 const notice=parseBomCapProductNotice(xml,{nowMs});
 if(!notice||notice.productCode!==code)
  throw Error("BoM original FWO CAP identity or issue invalid");
 return {notice,warnings:parseOfficialBomCap(xml,{nowMs})};
}

// Strict four product filenames, HTTPS origin and bounded payload. No arbitrary
// URL input or OpenGIS geometry substitution. Manual force skips source cache.
// Both HTTPS and anonymous FTP publish the same named ORIGINAL BoM FWO files.
async function originalFwoBytes(code,{fetchImpl=fetch,force=false}={}){
 if(!FTP_WARNING_CODES.includes(code))throw Error("Unsupported BoM FWO product");
 const url=OFFICIAL_BOM_FWO_URL+code+".cap.xml";
 const response=await fetchImpl(url,{
  headers:{Accept:"application/xml,text/xml"},
  signal:AbortSignal.timeout(8500),redirect:"manual",
  cf:{cacheEverything:!force,cacheTtl:force?0:75}
 });
 if(!response.ok)throw Error("BoM original FWO HTTPS "+response.status);
 const length=Number(response.headers.get("content-length"));
 if(Number.isFinite(length)&&length>MAX_CAP_BYTES)
  throw Error("BoM FWO response too large");
 const raw=await response.arrayBuffer();
 if(raw.byteLength<150||raw.byteLength>MAX_CAP_BYTES)
  throw Error("BoM FWO response size invalid");
 return new Uint8Array(raw);
}

// Keep the previously tested API stable for existing relay/browser consumers.
// 'ftpRead' is an injection hook for source-byte regression tests only.
// Runtime retrieval is BoM's original FWO HTTPS publication, not Cloudflare FTP.
export async function fetchOriginalBoMFtpWarning(code,{
 force=false,nowMs=Date.now(),ftpRead=null,fetchImpl=fetch,
 cache=globalThis.caches?.default
}={}){
 if(!FTP_WARNING_CODES.includes(code))throw Error("Unsupported BoM FWO product");
 const key=new Request(CACHE_ORIGIN+"/__internal-fwo-cap/"+code);
 if(cache&&!force){
  try{
   const found=await cache.match(key);
   if(found?.ok){
    const cached=await found.text();
    return verifyOfficialFtpWarningCap(code,cached,{nowMs});
   }
  }catch{/* Corrupt cache never claims a warning or prevents fresh source read */ }
 }
 const bytes=await (ftpRead?ftpRead(code):originalFwoBytes(code,{fetchImpl,force}));
 if(!(bytes instanceof Uint8Array)||bytes.byteLength<150||
    bytes.byteLength>MAX_CAP_BYTES)throw Error("Invalid original BoM FWO CAP payload");
 const xml=DECODER.decode(bytes);
 const verified=verifyOfficialFtpWarningCap(code,xml,{nowMs});
 if(cache){
  try{
   await cache.put(key,new Response(xml,{headers:{
    "Content-Type":"application/xml;charset=utf-8",
    "Cache-Control":"public,max-age=75"
   }}));
  }catch{/* Shared-cache failure does not invalidate original CAP */ }
 }
 return verified;
}
