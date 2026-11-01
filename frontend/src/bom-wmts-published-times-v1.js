// Only advertise REAL observation UTC timestamps published by BoM WMTS.
// The existing Cloudflare relay already passes through GetCapabilities with
// the approved LAYER allow-list. This is NOT a new data service or polling loop.
export const REFLECTIVITY_WMTS_LAYER="atm_surf_air_precip_reflectivity_dbz";
export const REFLECTIVITY_CAPABILITIES_URL=
  "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/wmts-native-capabilities";

const escapeRegex=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
function canonicalUtc(value){
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(value))
    return null;
  const d=new Date(value);
  if(!Number.isFinite(d.valueOf())||d.toISOString().replace(".000Z","Z")!==value)
    return null;
  return value;
}

// Parse only the time dimension of the exact BoM reflectivity layer. Reject
// dates from another layer, XML 'Default' (not a published Value), unbounded
// lists, malformed UTC or an HTML error masquerading as capabilities.
export function parsePublishedReflectivityTimes(xml){
  const source=String(xml??"");
  if(source.length>1_000_000||!/<(?:\w+:)?Capabilities\b/i.test(source))
    throw Error("BoM WMTS capabilities unavailable or unrecognised");
  const layers=[...source.matchAll(/<Layer\b[^>]*>([\s\S]*?)<\/Layer\s*>/gi)]
    .map(m=>m[1]);
  const id=new RegExp("<(?:\\w+:)?Identifier\\s*>\\s*"+
    escapeRegex(REFLECTIVITY_WMTS_LAYER)+"\\s*</(?:\\w+:)?Identifier\\s*>","i");
  const layer=layers.find(x=>id.test(x));
  if(!layer)throw Error("BoM reflectivity layer missing from WMTS capabilities");
  const dimension=[...layer.matchAll(/<Dimension\b[^>]*>([\s\S]*?)<\/Dimension\s*>/gi)]
    .map(m=>m[1])
    .find(x=>/<(?:\w+:)?Identifier\s*>\s*time\s*<\/(?:\w+:)?Identifier\s*>/i.test(x));
  if(!dimension)throw Error("BoM reflectivity source time dimension missing");
  const values=[...dimension.matchAll(/<Value\b[^>]*>\s*([^<]+?)\s*<\/Value\s*>/gi)]
    .map(m=>canonicalUtc(m[1].trim())).filter(Boolean);
  const sorted=[...new Set(values)].sort();
  if(!sorted.length||sorted.length>60)
    throw Error("BoM reflectivity published times missing or outside safe bounds");
  return sorted;
}

// The radar site selector and primary/secondary scans all share this ONE
// small browser cache (approx 88 KB capabilities, 120-second TTL). Also share
// in-flight GETs during rapid site switching. Never make guessed WMTS requests
// when metadata fails; the caller falls back to genuine cached observations.
export function createPublishedReflectivityTimeSource({
  fetchImpl=(...args)=>globalThis.fetch(...args),
  now=()=>Date.now(),cacheMs=120000,timeoutMs=12000,
  retryDelayMs=750
}={}){
  let expiresAt=0,cached=null,pending=null;
  return async function publishedReflectivityTimes(){
    const current=now();
    if(cached&&current<expiresAt)return [...cached];
    if(pending)return [...await pending];
    const load=async()=>{
      // Metadata is a single shared ~88 KB GET, NOT a radar frame. On a
      // temporary 502/503, transport abort or timeout retry it once before
      // declaring the source unavailable. Do not treat unavailable metadata
      // as a verified zero-frame result or invent new observation UTCs.
      for(let attempt=0;attempt<2;attempt++){
        const controller=new AbortController();
        const timer=setTimeout(()=>controller.abort(),timeoutMs);
        try{
          const response=await fetchImpl(REFLECTIVITY_CAPABILITIES_URL,{
            headers:{Accept:"application/xml,text/xml"},
            cache:"no-store",signal:controller.signal
          });
          if(!response.ok)throw Error("BoM WMTS capabilities HTTP "+response.status);
          const size=Number(response.headers?.get?.("content-length"))||0;
          if(size>1_000_000)throw Error("BoM WMTS capabilities unexpectedly large");
          const text=await response.text();
          const times=parsePublishedReflectivityTimes(text);
          cached=times;
          expiresAt=now()+cacheMs;
          return times;
        }catch(error){
          const message=String(error?.message??error);
          const transient=error?.name==="AbortError" ||
            /abort|timeout|network|failed to fetch|HTTP\s+(?:502|503|504)\b/i.test(message);
          if(attempt===1||!transient)throw error;
        }finally{clearTimeout(timer);}
        await new Promise(resolve=>setTimeout(resolve,retryDelayMs));
      }
    };
    pending=load();
    try{return [...await pending];}
    finally{pending=null;}
  };
}
export const publishedReflectivityTimes=createPublishedReflectivityTimeSource();
