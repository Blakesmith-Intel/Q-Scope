// Latest verified BoM height per station ID, independent of flood classes.
// A replayed CDN bulletin or failed refresh must NEVER roll back a more recent
// measured height. This browser cache holds source records, not inferred data.
import {parseQueenslandObservationTime,floodStageEvidenceMaxAge} from "./river-flood-signals-v1.js?v=9.13.2";

export const LATEST_RIVER_GAUGE_STORAGE_KEY="stormtracker.qld-latest-river-gauge.v1";
// Only source-verified above-minor manual flood observations get a 48h cap.
const MAX_STATIONS=1500;
function sourceTime(f,now){
  const p=f?.properties??{};
  const value=parseQueenslandObservationTime(p.STORMTRACKER_OBSERVED_TEXT,now);
  return Number.isFinite(value) && value>0 && value<=now+5*60000?value:null;
}
function acceptable(id,entry,now){
  if(!/^(?:bom|awrc):[a-z0-9_-]+$/i.test(id))return null;
  const f=entry?.feature,at=Number(entry?.observedAt);
  if(!f || f.id!==id || f.geometry?.type!=="Point" ||
     !Array.isArray(f.geometry.coordinates) ||
     !f.geometry.coordinates.every(Number.isFinite) ||
     !Number.isFinite(at) || at<=0 || at>now+5*60000 ||
     now-at>floodStageEvidenceMaxAge(f) ||
     !Number.isFinite(f.properties?.STORMTRACKER_HEIGHT_METRES))return null;
  return {observedAt:at,feature:f};
}
export function cleanLatestGaugeObservations(previous={},now=Date.now()){
  const out={};
  if(!previous || Array.isArray(previous) || typeof previous!=="object")return out;
  for(const [id,entry] of Object.entries(previous).slice(0,MAX_STATIONS)){
    const kept=acceptable(id,entry,now);
    if(kept)out[id]=kept;
  }
  return out;
}
export function retainLatestGaugeObservations(features,previous={},now=Date.now()){
  const cache=cleanLatestGaugeObservations(previous,now);
  const updated=[];
  for(const fresh of features??[]){
    const id=String(fresh?.id??"");
    const at=sourceTime(fresh,now);
    const valid=acceptable(id,{observedAt:at,feature:fresh},now);
    const cached=cache[id];
    if(valid && (!cached || valid.observedAt>cached.observedAt)){
      cache[id]=valid;
      updated.push(fresh);
    }else if(cached){
      // Even force-refresh can hit an older published CDN snapshot. Do not
      // reverse a genuine station measurement after a newer one was seen.
      updated.push(cached.feature);
    }else{
      updated.push(fresh);
    }
  }
  return {features:updated,cache};
}
