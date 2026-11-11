// Official Queensland BoM surface winds. One state-wide published product,
// identical for map and report. Never calculate a 24-hour station maximum or
// fan out to station-history feeds to manufacture an unpublished statistic.
import {parseQueenslandWindXml,QLD_BOM_WIND_PRODUCT}
 from "../frontend/src/context-layers/qscope-bom-wind-observation-model-v1.js";
const STATE_URL="https://www.bom.gov.au/fwo/IDQ60920.xml";
const CACHE_STATE_SECONDS=300;
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
 // The official statewide product has no per-WMO 24-hour maximum. Fail
 // closed rather than generating derived peaks or silently ignoring params.
 if(incoming.search)
  return errorResponse("Only the published BoM statewide wind product is supported",400,origin);
 try{
  // Worker-isolate single flight; one BoM source, no station-history fanout.
  const key="state";
  let job=statePromise.get(key);
  if(!job){
   job=getVerifiedState(fetchImpl,now());
   statePromise.set(key,job);
   job.finally(()=>{if(statePromise.get(key)===job)statePromise.delete(key)}).catch(()=>{});
  }
  const stations=await job;
  return reply({format:"QScopeBoMWindObservationsV1",
    product:QLD_BOM_WIND_PRODUCT,checkedAt:new Date(now()).toISOString(),
    source:STATE_URL,
    officialPage:"https://www.bom.gov.au/location/australia/queensland#observations",
    highestGustPeriod:"since-midnight-aest",
    observations:stations},origin,corsHeaders,60);
 }catch(error){
  return errorResponse("Official BoM wind observations unavailable: "+
    String(error?.message??error).slice(0,140),502,origin);
 }
}
