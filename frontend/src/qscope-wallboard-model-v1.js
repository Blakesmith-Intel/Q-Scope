// Pure wallboard summaries. All classifications reuse the approved Q-SCOPE models.
import {powerOutageProviderCounts} from "./context-layers/power-outages-v1.js";
import {groupedRoadOwnershipFeatures,groupRoadClosureItemsByHazard} from "./context-layers/road-ownership-report-v1.js";
import {groupRoadClosuresByLga} from "./context-layers/road-closure-lga-model-v1.js";
import {stationFloodLevels,observedFloodClass} from "./context-layers/river-flood-thresholds-v1.js";
import {parseQueenslandObservationTime,FLOOD_SIGNAL_MAX_AGE_MS} from "./context-layers/river-flood-signals-v1.js";
import {publishedCrossingForFeature} from "./context-layers/river-crossing-state-v1.js";
import {qualifiesRainfallSnapshot,dedupeSignificantRainfall,validatedRainfallPayload} from "./context-layers/significant-rainfall-source-v1.js?v=20261126-rollover-v1";
import {classifyRainfallAep} from "./context-layers/rainfall-ifd-aep-v1.js";
import {windStationSeverity,WIND_OBS_VALID_AGE_MS} from "./context-layers/qscope-bom-wind-observation-model-v1.js";

export const FLOOD_BANDS=[
 ["below","Below minor","#517687"],["rapid-rise","Rapid rise / elevated","#1269e8"],
 ["minor","Minor","#2db76f"],["moderate","Moderate","#ffd43b"],["major","Major","#e53935"],
 ["crossing","Crossing reached","#f5a21b"],["unknown","Unclassified","#8292a2"],["stale","Stale / unverified","#42515e"]
];
export const AEP_BANDS=[
 ["below","Below 20% AEP","#647986"],["20","Notable · 20%","#39734e"],
 ["10","Unusual · 10%","#c39b31"],["5","Rare · 5%","#d47b26"],
 ["2","Very rare · 2%","#d44953"],["1","Exceptional · 1%","#a25ac7"],
 ["unknown","IFD unverified","#66717b"]
];
const sum=(values)=>values.reduce((a,b)=>a+b,0);
const bands=(defs,counts)=>defs.map(([key,label,color])=>({key,label,color,count:counts[key]??0}));
const finite=v=>typeof v==="number"&&Number.isFinite(v);
const unique=(rows,key)=>[...new Map(rows.filter(x=>key(x)).map(x=>[key(x),x])).values()];
export function summarisePower(result){
 return powerOutageProviderCounts(result.reportFeatures??result.payload?.features??[],{
  availableProviders:result.providers,failedProviders:result.failedProviders
 });
}
export function summariseRoads(features,ownership){
 const classified=groupedRoadOwnershipFeatures(features,ownership);
 const groups=groupRoadClosureItemsByHazard(groupRoadClosuresByLga(classified.state).flatMap(x=>x.items));
 return {total:classified.state.length,unverified:classified.unverified.length,
  local:classified.local.length,rows:groups.map(g=>({name:g.name,count:g.items.length}))};
}
export function summariseFloods(source,alerts,catalogue,now=Date.now()){
 const counts={},active=new Map(unique(alerts??[],x=>String(x?.id??"")).map(x=>[String(x.id),x]));
 const byId=new Map(unique(source??[],x=>String(x?.id??"")).map(x=>[String(x.id),x]));
 // Retained source-confirmed flood stages are never silently counted as current.
 for(const [id,f] of active)if(!byId.has(id))byId.set(id,f);
 let notable=0,staleSignals=0,crossings=0,rapid=0;
 for(const [id,f] of byId){
  const p=f.properties??{},q=active.get(id)?.properties??{},height=p.STORMTRACKER_HEIGHT_METRES;
  const reported=Number(p.STORMTRACKER_OFFICIAL_OBSERVED_AT);
  const at=reported>0?reported:parseQueenslandObservationTime(p.STORMTRACKER_OBSERVED_TEXT,now);
  let key="unknown";
  const stale=!finite(at)||at>now+300000||now-at>FLOOD_SIGNAL_MAX_AGE_MS||
    Boolean(p.STORMTRACKER_OBSERVATION_STALE||q.STORMTRACKER_OBSERVATION_STALE);
  if(stale){key="stale";if(active.has(id))staleSignals++;}
  else if(finite(height)){
   const measured=observedFloodClass(height,stationFloodLevels(f));
   const stage=measured===undefined?String(p.STORMTRACKER_FLOOD_CLASS??"").toLowerCase():measured;
   const crossing=publishedCrossingForFeature(f,catalogue);
   const crossed=Boolean(q.STORMTRACKER_CROSSING_REACHED||(crossing&&height>=crossing.heightMetres));
   if(crossed)crossings++;
   if(q.STORMTRACKER_RAPID_RISE)rapid++;
   if(stage==="major"||stage==="moderate"||stage==="minor")key=stage;
   else if(crossed)key="crossing";
   else if(["rapid-rise","elevated"].includes(q.STORMTRACKER_DISPLAY_STATE))key="rapid-rise";
   else if(stage===null||stage==="below-minor")key="below";
   if(["major","moderate","minor","crossing","rapid-rise"].includes(key))notable++;
  }
  counts[key]=(counts[key]??0)+1;
 }
 return {rows:bands(FLOOD_BANDS,counts),total:sum(Object.values(counts)),notable,staleSignals,crossings,rapid};
}
export function summariseRain(data,grid,now=Date.now()){
 const period="since9am";
 const raw=dedupeSignificantRainfall(validatedRainfallPayload(data).observations[period],period,{minimumMm:0});
 const rows=raw.filter(x=>qualifiesRainfallSnapshot(x,period,now,90*60000,{minimumMm:0}));
 const notable=rows.filter(x=>x.mm>=50),counts={};
 for(const row of notable){
  const aep=classifyRainfallAep({...row,grid});
  const key=aep.classification==="below-20pct-aep"?"below":
   aep.aepDesignThreshold?String(aep.aepDesignThreshold):"unknown";
  counts[key]=(counts[key]??0)+1;
 }
 const max24=dedupeSignificantRainfall(data.observations.last24Hours,"last24Hours",{minimumMm:0})
  .filter(x=>qualifiesRainfallSnapshot(x,"last24Hours",now,90*60000,{minimumMm:0}))[0]??null;
 return {total:rows.length,notable:notable.length,heavy:rows.filter(x=>x.mm>=100).length,
  peak:rows[0]??null,peak24:max24,stale:raw.length-rows.length,failed:data.failed?.length??0,
  aep:bands(AEP_BANDS,counts),unknown:counts.unknown??0};
}
export function summariseWind(rows,now=Date.now()){
 const day=ms=>new Date(ms+10*3600000).toISOString().slice(0,10);
 const current=unique(rows,x=>String(x?.wmo??"")).filter(s=>{
  const at=Date.parse(s.observedUtc);
  return s.current===true&&Number.isFinite(at)&&at<=now+300000&&now-at<=WIND_OBS_VALID_AGE_MS&&day(at)===day(now);
 });
 const peak=current.filter(x=>finite(x.todayMaximumGustKmh)).sort((a,b)=>b.todayMaximumGustKmh-a.todayMaximumGustKmh)[0]??null;
 const counts={destructive:0,damaging:0,gale:0,below:0};
 for(const s of current)counts[windStationSeverity(s)]++;
 return {peak,counts,total:current.length,qualifying:counts.destructive+counts.damaging+counts.gale};
}
export function formatCountdown(next,now=Date.now()){
 if(!next)return "—";
 const seconds=Math.max(0,Math.ceil((next-now)/1000));
 return String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");
}

// Routine optional history and crossing checks are not a live bulletin fault.
// Keep explicit coverage warnings when the official source is partial or stale.
export function wallboardFloodHealth(status={},coverage={},summary={}){
 if(status.kind==="error")return {kind:"error",message:"Latest BoM check failed · retained observations may be stale"};
 if(status.partial)return {kind:"warning",message:"Partial data coverage · BoM height feed"};
 const stale=Math.max(Number(status.staleOfficial)||0,Number(summary.staleSignals)||0);
 if(stale)return {kind:"warning",message:stale+" flood signal"+(stale===1?"":"s")+" with stale observations"};
 const meta=status.metadataCoverage;
 if(status.metadataFallback&&meta&&Number.isFinite(meta.total)&&Number.isFinite(meta.matched)&&meta.matched<meta.total)
  return {kind:"warning",message:"Partial data coverage · station locations "+meta.matched+"/"+meta.total};
 const affected=Math.max(0,Number(status.historyScreeningAlertsAffected)||0);
 if(affected)return {kind:"ok",message:"Monitoring active · "+affected+" signal"+(affected===1?"":"s")+" awaiting rise checks"};
 if(coverage.sourceMissing||status.historySourceMissing)
  return {kind:"warning",message:"Partial data coverage · some station references unavailable"};
 if(coverage.pending||coverage.checking||status.screeningIncomplete)
  return {kind:"ok",message:"Monitoring active · additional station checks underway"};
 return {kind:"ok",message:"Monitoring active"};
}
