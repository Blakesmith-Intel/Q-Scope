// Pure transport efficiency. Never changes upstream BoM URLs, products,
// station validation, thresholds, observation times or alert decisions.
// Isolate-local single-flight only combines simultaneous identical GETs.
// Radar tiles/frames and manual freshness bypasses are never included.
export const SAFE_TEXT_PRODUCT_ROUTES = Object.freeze(new Set([
  "/flood-road-closures",
  "/flood-road-closures-v9-15",
  "/road-ownership-report",
  "/bom-official-warning-polygons",
  "/essential-energy-outages",
  "/qld-ifd-point",
  "/qld-significant-rainfall",
  "/river-crossing-heights",
  "/river-gauge-metadata",
  "/river-flood-thresholds",
  "/river-height-bulletins",
  "/river-recent-history",
  "/wmts-native-capabilities",
  "/ftp-live-manifest"
]));
const HISTORY_CACHE_TTL_MS = 60000;
const HISTORY_BROWSER_MAX_AGE_SECONDS = 60;
const MAX_INFLIGHT_READS = 48;
const CACHE_LABEL = "X-StormTracker-Relay-Cache";
const VERIFIED_LABEL = "X-StormTracker-Verified-History";

export function requestBypassesReuse(request){
  if(request.method!=="GET")return true;
  const url=new URL(request.url);
  return url.searchParams.get("force")==="1"||
    request.cache==="no-store"||
    /no-store|no-cache/i.test(request.headers.get("Cache-Control")??"")||
    /no-cache/i.test(request.headers.get("Pragma")??"");
}

function observedAgeSeconds(headers,now){
  const timestamp=Number(headers.get("X-StormTracker-Latest-Observation-Ms"));
  return Number.isFinite(timestamp)&&timestamp>0
    ?Math.max(0,Math.floor((now-timestamp)/1000)):null;
}

function annotatedResponse(response,status,started,now){
  const headers=new Headers(response.headers);
  headers.set(CACHE_LABEL,status);
  headers.set("X-StormTracker-Relay-Ms",String(Math.max(0,now-started)));
  const age=observedAgeSeconds(headers,now);
  if(age!==null)headers.set("X-StormTracker-Observation-Age-Sec",String(age));
  const exposed=headers.get("Access-Control-Expose-Headers")??"";
  const extra=[CACHE_LABEL,"X-StormTracker-Relay-Ms",
    "X-StormTracker-Observation-Age-Sec"];
  headers.set("Access-Control-Expose-Headers",[exposed,...extra].filter(Boolean).join(","));
  return new Response(response.body,{
    status:response.status,statusText:response.statusText,headers
  });
}

export function createRelayEfficiency({
  getCache=()=>globalThis.caches?.default,
  now=()=>Date.now(),
  maxInflight=MAX_INFLIGHT_READS
}={}){
  const pending=new Map();
  const stats={coalesced:0,source:0,historyHits:0,historyMisses:0,
    historySourceFailures:0};
  async function identicalRead(request,handler){
    const url=new URL(request.url);
    if(!SAFE_TEXT_PRODUCT_ROUTES.has(url.pathname)||
      requestBypassesReuse(request))return handler();
    const origin=request.headers.get("Origin")??"";
    const key=request.method+"|"+request.url+"|"+origin;
    const existing=pending.get(key);
    if(existing){
      stats.coalesced++;
      const response=await existing;
      return annotatedResponse(response.clone(),"COALESCED",now(),now());
    }
    if(pending.size>=maxInflight)return handler();
    stats.source++;
    const started=now();
    const task=Promise.resolve().then(handler);
    pending.set(key,task);
    try{
      const response=await task;
      // The retained original response is never consumed by clients. Keep
      // the more precise history HIT/MISS label when it is already present.
      const cloned=response.clone();
      return cloned.headers.has(CACHE_LABEL)?cloned:
        annotatedResponse(cloned,"SOURCE",started,now());
    }finally{
      if(pending.get(key)===task)pending.delete(key);
    }
  }
  async function verifiedStationHistory(request,product,station,origin,handler,ctx){
    const started=now();
    if(requestBypassesReuse(request))return handler();
    // The product and 5-7 digit BoM number have already passed the relay's
    // strict allowlist before this function is called.
    // Include CORS origin identity in the cache key: never mix a browser
    // response with a request that lacked an Origin header.
    const channel=origin==="https://blakesmith-intel.github.io"?"pages":"server";
    const key=new Request("https://stormtracker.internal/verified-history-v1"+
      "?product="+encodeURIComponent(product)+"&station="+
      encodeURIComponent(station)+"&channel="+channel);
    let cache=null;
    try{cache=getCache();}catch{}
    if(cache?.match){
      try{
        const hit=await cache.match(key);
        const stamp=Number(hit?.headers.get("X-StormTracker-Verified-At"));
        if(hit?.ok&&hit.headers.get(VERIFIED_LABEL)==="v1"&&
          Number.isFinite(stamp)&&stamp>0&&
          now()>=stamp&&now()-stamp<HISTORY_CACHE_TTL_MS){
          stats.historyHits++;
          return annotatedResponse(hit,"HIT",started,now());
        }
      }catch{/* Cache API is opportunistic, never required for BoM readings. */}
    }
    stats.historyMisses++;
    const response=await handler();
    if(response.status!==200||
      response.headers.get(VERIFIED_LABEL)!=="v1"){
      stats.historySourceFailures++;
      return annotatedResponse(response,"UNCACHED",started,now());
    }
    // Keep output browser TTL short, so Worker, upstream, and browser caches
    // cannot compound a 5-minute historical table into long data delays.
    const payloadHeaders=new Headers(response.headers);
    payloadHeaders.set("Cache-Control",
      "public, max-age="+HISTORY_BROWSER_MAX_AGE_SECONDS);
    const annotated=annotatedResponse(new Response(response.body,{
      status:response.status,statusText:response.statusText,
      headers:payloadHeaders
    }),"MISS",started,now());
    if(cache?.put){
      const cacheHeaders=new Headers(annotated.headers);
      cacheHeaders.set("Cache-Control",
        "public, max-age="+HISTORY_BROWSER_MAX_AGE_SECONDS);
      cacheHeaders.set("X-StormTracker-Verified-At",String(now()));
      cacheHeaders.delete(CACHE_LABEL);
      cacheHeaders.delete("X-StormTracker-Relay-Ms");
      cacheHeaders.delete("X-StormTracker-Observation-Age-Sec");
      const stored=new Response(annotated.clone().body,{
        status:annotated.status,headers:cacheHeaders
      });
      try{
        const save=Promise.resolve(cache.put(key,stored)).catch(()=>{});
        if(ctx?.waitUntil)ctx.waitUntil(save);
        else await save;
      }catch{/* Cache failure must never block authoritative data. */}
    }
    return annotated;
  }
  return {identicalRead,verifiedStationHistory,stats};
}
