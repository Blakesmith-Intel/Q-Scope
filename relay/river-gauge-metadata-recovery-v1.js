// Recovery for the single approved BoM National Flood Gauge Network source.
// Only a previously validated full QLD gauge catalogue may be reused.
// No alternate source, inferred gauge, fabricated reading or stale river height.
import {filterQueenslandRiverGauges}
  from "../frontend/src/context-layers/river-gauges-v1.js";

const FRESH_MS=6*60*60*1000;
const RETAIN_MS=14*24*60*60*1000;
const MIN_QLD_GAUGES=500; // 2026 official audit: 1,808 locations.
const VERIFIED_HEADER="X-StormTracker-Verified-BoM-Gauges";
const CHECKED_HEADER="X-StormTracker-Metadata-Checked-At";
const FALLBACK_HEADER="X-StormTracker-Metadata-Fallback";

function validCatalogue(payload){
  return payload?.type==="FeatureCollection" &&
    Array.isArray(payload.features) &&
    filterQueenslandRiverGauges(payload).features.length>=MIN_QLD_GAUGES;
}

function cacheKey(request){
  // Same-host cache key is required by Cloudflare's Cache API.
  const url=new URL(request.url);
  url.pathname="/__internal_verified_qld_bom_gauges_v1";
  url.search="";
  return new Request(url.toString(),{method:"GET"});
}

async function readVerified(cache,key,nowMs){
  if(!cache?.match)return null;
  try{
    const hit=await cache.match(key);
    if(!hit?.ok || hit.headers.get(VERIFIED_HEADER)!=="v1")return null;
    const verifiedAt=Number(hit.headers.get("X-StormTracker-Verified-At"));
    const age=nowMs-verifiedAt;
    if(!Number.isFinite(verifiedAt)||verifiedAt<=0||
       age<0||age>RETAIN_MS)return null;
    const payload=await hit.json();
    return validCatalogue(payload)?{payload,verifiedAt,age}:null;
  }catch{return null;}
}

function catalogueResponse(data,request,origin,corsHeaders,fromFallback){
  const headers=corsHeaders(origin);
  headers.set("Content-Type","application/geo+json; charset=utf-8");
  headers.set("Cross-Origin-Resource-Policy","cross-origin");
  headers.set("Cache-Control","public, max-age=300");
  headers.set(CHECKED_HEADER,new Date(data.verifiedAt).toISOString());
  headers.set(FALLBACK_HEADER,fromFallback?"1":"0");
  headers.set("Access-Control-Expose-Headers",
    [headers.get("Access-Control-Expose-Headers"),CHECKED_HEADER,
      FALLBACK_HEADER].filter(Boolean).join(","));
  return new Response(request.method==="HEAD"?null:JSON.stringify(data.payload),
    {status:200,headers});
}

async function storeVerified(cache,key,data,ctx){
  if(!cache?.put)return;
  const headers=new Headers({
    "Content-Type":"application/geo+json; charset=utf-8",
    "Cache-Control":"public, max-age="+Math.floor(RETAIN_MS/1000),
    [VERIFIED_HEADER]:"v1",
    "X-StormTracker-Verified-At":String(data.verifiedAt)
  });
  try{
    const save=Promise.resolve(cache.put(key,new Response(
      JSON.stringify(data.payload),{status:200,headers}))).catch(()=>{});
    if(ctx?.waitUntil)ctx.waitUntil(save);
    else await save;
  }catch{/* The source route works without an available Cache API. */}
}

export async function relayVerifiedRiverGaugeMetadata(
  request,origin,{sourceUrl,corsHeaders,errorResponse,ctx,
    fetchImpl=globalThis.fetch,getCache=()=>globalThis.caches?.default,
    now=()=>Date.now()}={}){
  const nowMs=now();
  let cache=null;
  try{cache=getCache();}catch{}
  const key=cacheKey(request);
  const stored=await readVerified(cache,key,nowMs);
  // Gauge locations, unlike river heights, are a reference catalogue.
  // Avoid repeated costly upstream reads across browser refreshes.
  if(stored&&stored.age<FRESH_MS)
    return catalogueResponse(stored,request,origin,corsHeaders,false);

  let reason="BoM source unavailable";
  try{
    const upstream=await fetchImpl(sourceUrl,{
      method:"GET",
      headers:{Accept:"application/geo+json,application/json"},
      signal:AbortSignal.timeout(25000),
      cf:{cacheEverything:true,cacheTtl:300}
    });
    if(!upstream.ok)throw Error("BoM upstream HTTP "+upstream.status);
    const payload=await upstream.json();
    if(!validCatalogue(payload))
      throw Error("BoM upstream returned invalid or incomplete QLD gauge metadata");
    const data={payload,verifiedAt:now()};
    await storeVerified(cache,key,data,ctx);
    return catalogueResponse(data,request,origin,corsHeaders,false);
  }catch(error){reason=error?.message||String(error);}
  // A stale but still bounded, ORIGINAL BoM reference can locate stations.
  // The UI gets an explicit source-recovery warning; current height bulletins
  // remain compulsory and unchanged. Never return a false zero gauge result.
  if(stored)
    return catalogueResponse(stored,request,origin,corsHeaders,true);
  return errorResponse("BoM river-gauge metadata unavailable: "+reason,502,origin);
}
