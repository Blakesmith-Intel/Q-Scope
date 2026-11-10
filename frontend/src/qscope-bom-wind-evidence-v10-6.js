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
function dateFromBoM(value){
  if(typeof value!=="string"||!/^[0-9]{14}$/.test(value))return null;
  const year=Number(value.slice(0,4)),month=Number(value.slice(4,6)),
    day=Number(value.slice(6,8)),hour=Number(value.slice(8,10)),
    minute=Number(value.slice(10,12)),second=Number(value.slice(12,14));
  const epoch=Date.UTC(year,month-1,day,hour,minute,second);
  const d=new Date(epoch);
  if(d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||
     d.getUTCDate()!==day||d.getUTCHours()!==hour||
     d.getUTCMinutes()!==minute||d.getUTCSeconds()!==second)return null;
  return d.toISOString();
}
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
export function readBoMStationGusts(source,{
  expectedWmo=null,maxRows=BOM_RESEARCH_WIND_RULES.maxSourceRows
}={}){
  const data=source?.observations?.data;
  if(!Array.isArray(data)||data.length>1000)return null;
  const samples=[];
  let name="",wmo=null;
  for(const item of data.slice(0,maxRows)){
    if(!item||typeof item!=="object")continue;
    if(expectedWmo!==null&&String(item.wmo)!==String(expectedWmo))continue;
    if(wmo!==null&&wmo!==item.wmo)continue; // Never cross-match WMO IDs.
    const utc=dateFromBoM(item.aifstime_utc);
    const point={latitude:item.lat,longitude:item.lon};
    if(!utc||!validPosition(point)||!finite(item.gust_kmh)||
       item.gust_kmh<0||item.gust_kmh>450)continue;
    name=String(item.name??"").slice(0,100);
    wmo=item.wmo;
    samples.push({
      source:"BoM",stationName:name,wmo,observedUtc:utc,
      latitude:point.latitude,longitude:point.longitude,
      gustKmh:item.gust_kmh,
      windDir:/^[A-Z]{1,3}$/.test(String(item.wind_dir))?
        item.wind_dir:null,
      meanWindKmh:finite(item.wind_spd_kmh)?item.wind_spd_kmh:null,
      // BoM automatic station observations are subject to later QC.
      provisional:true
    });
  }
  return samples.length?samples:null;
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
    const key=station.product+":"+station.wmo;
    const existing=cache.get(key);
    if(existing&&now()<existing.expires)return existing.samples;
    if(pending.has(key))return pending.get(key);
    const job=Promise.resolve().then(()=>fetchStation(station)).then(raw=>{
      const samples=readBoMStationGusts(raw,{expectedWmo:station.wmo});
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
    // Only fetch at most TWO approved near-station sources on operator
    // review; no statewide polling, no worker fan-out, no remote URL input.
    const near=stations.filter(s=>validPosition(s)&&
      /^[A-Z]{3}[0-9]{5}$/.test(s.product)&&
      /^[0-9]{5}$/.test(String(s.wmo))&&
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
