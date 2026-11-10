// Q-SCOPE V10.6 research-only BoM station-observation corroboration.
// Observed station gusts are 3-second surface measurements. They do NOT
// validate radar-derived wind speed, tornadoes or impacts between stations.
// Pure functions + dependency-injected transport: NO new Worker dependency
// or automatic polling until an authorised observation route is available.
export const BOM_RESEARCH_WIND_RULES=Object.freeze({
  maxStationKm:35,maxTimeMinutes:20,
  strongMatchKm:15,strongMatchMinutes:15,
  observedDamagingKmh:90,observedDestructiveKmh:125,
  stationCacheMs:10*60*1000,maxSourceRows:200,
  maxStationsPerEvent:2
});
const finite=v=>typeof v==="number"&&Number.isFinite(v);
export function kilometresApart(a,b){
  const r=Math.PI/180,lat1=a.latitude*r,lat2=b.latitude*r,
    dlat=lat2-lat1,dlon=(b.longitude-a.longitude)*r;
  const h=Math.sin(dlat/2)**2+Math.cos(lat1)*Math.cos(lat2)*
    Math.sin(dlon/2)**2;
  return 12742*Math.asin(Math.min(1,Math.sqrt(h)));
}
function validPosition(point){
  return finite(point?.latitude)&&Math.abs(point.latitude)<=90&&
    finite(point?.longitude)&&Math.abs(point.longitude)<=180;
}
// The operator's selected NEW BoM Queensland observations page. This is a
// human-readable source link; the new site uses separate structured station
// observations behind it. Never parse map UI HTML or mix WMO and BoM IDs.
export const BOM_QUEENSLAND_OBSERVATIONS_URL=
  "https://www.bom.gov.au/location/australia/queensland#observations";
export const BOM_MODERN_SURFACE_OBSERVATION_PATH=
  "/observations/latest/{station_id}/atm/surf_air?include_qc_results=false";
export function formatWindKmh(value){
  return finite(value)&&value>=0?Math.round(value)+" km/hr":"Unavailable";
}
export function readBoMStationGusts(source,{expectedStationId=null}={}){
  // New BoM location site's station API shape: stn.identity + obs.wind.
  // BoM station number, e.g. 040913 (returned as 40913), is NOT the
  // WMO station number (e.g. 94576). No cross-family ID comparisons.
  const ident=source?.stn?.identity,loc=source?.stn?.location,
    obs=source?.obs,wind=obs?.wind;
  const rawId=ident?.bom_stn_num;
  if(!Number.isInteger(rawId)||rawId<1||rawId>999999||
     (expectedStationId!==null &&
      !/^\\d{6}$/.test(String(expectedStationId))))
    return null;
  const stationId=String(rawId).padStart(6,"0");
  if(expectedStationId!==null&&stationId!==String(expectedStationId).padStart(6,"0"))
    return null;
  const point={latitude:loc?.lat_dec_deg,longitude:loc?.long_dec_deg};
  const time=obs?.datetime_utc;
  if(!validPosition(point)||typeof time!=="string"||
     !/^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(?:\\.\\d+)?Z$/.test(time)||
     !Number.isFinite(Date.parse(time))||
     !finite(wind?.gust_speed_10m_max_mps)||
     wind.gust_speed_10m_max_mps<0||
     wind.gust_speed_10m_max_mps>125)return null;
  const speed=wind.speed_10m_mps;
  const rawDirection=String(wind.dirn_10m_ord??"");
  return [{
    source:"BoM Queensland Observations",
    sourcePage:BOM_QUEENSLAND_OBSERVATIONS_URL,
    stationName:String(ident.bom_stn_name??"").slice(0,100),
    stationId,wmo:Number.isInteger(ident.wmo_stn_id)?ident.wmo_stn_id:null,
    observedUtc:new Date(time).toISOString(),
    latitude:point.latitude,longitude:point.longitude,
    // The new API reports metres per second. Convert once to operator km/hr.
    gustKmh:Math.round(wind.gust_speed_10m_max_mps*36)/10,
    meanWindKmh:finite(speed)&&speed>=0&&speed<=125?
      Math.round(speed*36)/10:null,
    windDir:/^[A-Z]{1,3}$/.test(rawDirection)?rawDirection:null,
    provisional:true
  }];
}
export function matchObservedBoMGusts(event,stationSamples,{
  rules=BOM_RESEARCH_WIND_RULES
}={}){
  if(!validPosition(event))return null;
  const times=Array.isArray(event.evidence)?
    event.evidence.map(e=>Date.parse(e.frameUtc)).filter(Number.isFinite):
    [Date.parse(event.latestUtc)].filter(Number.isFinite);
  if(!times.length)return null;
  const matches=[];
  for(const sample of stationSamples??[]){
    if(!validPosition(sample)||!finite(sample.gustKmh))continue;
    const observed=Date.parse(sample.observedUtc);
    if(!Number.isFinite(observed))continue;
    const delta=Math.min(...times.map(t=>Math.abs(t-observed)))/60000;
    const distance=kilometresApart(event,sample);
    if(distance>rules.maxStationKm||delta>rules.maxTimeMinutes)continue;
    const close=distance<=rules.strongMatchKm&&
      delta<=rules.strongMatchMinutes;
    matches.push({
      ...sample,distanceKm:Math.round(distance*10)/10,
      differenceMinutes:Math.round(delta*10)/10,
      nearby:close,
      // Only observed 3-second gust meets official numeric criteria;
      // station matching does not establish storm causation.
      evidenceClass:close&&sample.gustKmh>=rules.observedDamagingKmh?
        "nearby-damaging-gust":
        (close?"nearby-station-reading":"regional-context"),
      gustClassification:sample.gustKmh>=rules.observedDestructiveKmh?
        "destructive-threshold":
        sample.gustKmh>=rules.observedDamagingKmh?
        "damaging-threshold":"below-damaging-threshold"
    });
  }
  return matches.sort((a,b)=>
    (Number(b.evidenceClass==="nearby-damaging-gust")-
      Number(a.evidenceClass==="nearby-damaging-gust")) ||
    a.distanceKm-b.distanceKm ||
    a.differenceMinutes-b.differenceMinutes ||
    b.gustKmh-a.gustKmh)[0]??null;
}
export function createBoMWindGustResearchLookup({
  stations=[],fetchStation,now=()=>Date.now(),
  rules=BOM_RESEARCH_WIND_RULES
}={}){
  if(typeof fetchStation!=="function")throw new TypeError("BoM feed transport required");
  const cache=new Map(),pending=new Map();
  async function get(station){
    const key="modern:"+station.stationId;
    const existing=cache.get(key);
    if(existing&&now()<existing.expires)return existing.samples;
    if(pending.has(key))return pending.get(key);
    const job=Promise.resolve().then(()=>fetchStation(station)).then(raw=>{
      const parsed=readBoMStationGusts(raw,{expectedStationId:station.stationId});
      // Fail closed if the station directory and returned BoM location do
      // not describe the SAME physical observing site.
      const samples=parsed&&kilometresApart(station,parsed[0])<=5?
        parsed:null;
      cache.set(key,{
        samples,expires:now()+rules.stationCacheMs
      });
      return samples;
    }).finally(()=>pending.delete(key));
    pending.set(key,job);
    return job;
  }
  async function lookup(event){
    if(!validPosition(event))return null;
    // Only fetch at most TWO VERIFIED new BoM location-site station IDs
    // on operator review; never a user-supplied URL and no statewide polling.
    // The site's latest feed cannot time-correlate expired historical events.
    const near=stations.filter(s=>validPosition(s)&&
      /^\\d{6}$/.test(String(s.stationId))&&
      kilometresApart(event,s)<=rules.maxStationKm)
      .sort((a,b)=>kilometresApart(event,a)-kilometresApart(event,b))
      .slice(0,rules.maxStationsPerEvent);
    if(!near.length)return null;
    const results=await Promise.allSettled(near.map(get));
    return matchObservedBoMGusts(event,results.flatMap(x=>
      x.status==="fulfilled"?(x.value??[]):[]),{rules});
  }
  return {lookup,get inFlight(){return pending.size;},
    get stationCacheCount(){return cache.size}};
}
