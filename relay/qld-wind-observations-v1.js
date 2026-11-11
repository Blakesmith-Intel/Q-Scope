// Q-SCOPE official measured Queensland wind observations: separate opt-in
// transport, no changes to the existing radar, Doppler, warning or relay paths.
import {parseQueenslandWindXml,sampledWindPeak24h,QLD_BOM_WIND_PRODUCT}
 from "../frontend/src/context-layers/qscope-bom-wind-observation-model-v1.js";
const STATE_URL="https://www.bom.gov.au/fwo/IDQ60920.xml";
const FWO="https://www.bom.gov.au/fwo/IDQ60801/IDQ60801.";
const CACHE_STATE_SECONDS=300,CACHE_HISTORY_SECONDS=900;
const statePromise=new Map();
function reply(payload,origin,corsHeaders,seconds){
 const h=corsHeaders(origin);
 h.set("Content-Type","application/json; charset=utf-8");
 h.set("Cache-Control","public,max-age="+seconds);
 return new Response(JSON.stringify(payload),{status:200,headers:h});
}
async function getVerifiedState(fetchImpl,now){
 const response=await fetchImpl(STATE_URL,{
  headers:{Accept:"application/xml,text/xml"},
  cf:{cacheEverything:true,cacheTtl:CACHE_STATE_SECONDS},
  signal:AbortSignal.timeout(19000)
 });
 if(!response.ok)throw Error("BoM IDQ60920 HTTP "+response.status);
 const body=await response.text();
 return parseQueenslandWindXml(body,{now});
}
export async function relayQldWindObservations(
 request,incoming,origin,corsHeaders,errorResponse,
 {fetchImpl=fetch,now=Date.now}={}
){
 if(request.method!=="GET"&&request.method!=="HEAD")
  return errorResponse("Method not allowed",405,origin);
 const wmo=incoming.searchParams.get("wmo");
 if(wmo!==null&&!/^\d{5}$/.test(wmo))
  return errorResponse("Invalid BoM WMO station",400,origin);
 try{
  // Worker-isolate single flight prevents accidental simultaneous duplicate
  // fetches. BoM's state XML is one source product, not a station-wide fanout.
  const key="state";
  let job=statePromise.get(key);
  if(!job){
   job=getVerifiedState(fetchImpl,now());
   statePromise.set(key,job);
   job.finally(()=>{if(statePromise.get(key)===job)statePromise.delete(key)}).catch(()=>{});
  }
  const stations=await job;
  if(!wmo){
   return reply({format:"QScopeBoMWindObservationsV1",
     product:QLD_BOM_WIND_PRODUCT,checkedAt:new Date(now()).toISOString(),
     source:STATE_URL,officialPage:
     "https://www.bom.gov.au/location/australia/queensland#observations",
     observations:stations,rolling24hCoverage:"station-history-on-demand"},
     origin,corsHeaders,60);
  }
  const station=stations.find(s=>s.wmo===wmo);
  if(!station)return errorResponse("Station not in verified Queensland product",404,origin);
  const target=FWO+wmo+".json";
  const upstream=await fetchImpl(target,{
   headers:{Accept:"application/json"},
   cf:{cacheEverything:true,cacheTtl:CACHE_HISTORY_SECONDS},
   signal:AbortSignal.timeout(19000)
  });
  if(!upstream.ok)throw Error("BoM station history HTTP "+upstream.status);
  const data=await upstream.json();
  const peak=sampledWindPeak24h(data,{wmo,now:now()});
  // An empty/invalid feed is unavailable, not a zero-km/hr reading.
  if(!peak)return errorResponse("No verified 24h station gust samples",503,origin);
  return reply({format:"QScopeBoMWindStation24hV1",stationId:station.stationId,
    wmo,checkedAt:new Date(now()).toISOString(),peak,
    source:target},origin,corsHeaders,90);
 }catch(error){
  return errorResponse("Official BoM wind observations unavailable: "+
    String(error?.message??error).slice(0,140),502,origin);
 }
}
