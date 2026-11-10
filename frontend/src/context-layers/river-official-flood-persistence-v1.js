// Offline/browser-only persistence of source-CONFIRMED flood-class stations.
// Never match by site name. Any newer BoM below-minor observation clears its
// own exact station ID. A stale missing observation is NOT proof of recovery.
import {parseQueenslandObservationTime,floodStageEvidenceMaxAge} from "./river-flood-signals-v1.js?v=20261018-inland-rise";
import {stationFloodLevels,observedFloodClass}
  from "./river-flood-thresholds-v1.js?v=20261020-new-beith-ahd-v2";

export const OFFICIAL_FLOOD_STORAGE_KEY="stormtracker.qld-confirmed-flood-stations.v1";
// The absence of new telemetry must NOT preserve a flood classification
// indefinitely. After 24 h without a source-observed flood level, retire
// the map record without asserting that the crossing is safe.
export const FLOOD_CONFIRMATION_MAX_AGE_MS=24*60*60*1000; // default automatic/stale expiry
const officialLevels=new Set(["minor","moderate","major"]);
const normalised=value=>String(value??"").trim().toLowerCase();
const stationId=id=>/^(bom|awrc):[a-z0-9_-]+$/i.test(String(id??""));
const validPoint=f=>{
  const p=f?.properties??{};
  const lon=Number(p.long??f?.geometry?.coordinates?.[0]);
  const lat=Number(p.lat??f?.geometry?.coordinates?.[1]);
  return f?.geometry?.type==="Point" && Number.isFinite(lon) &&
    Number.isFinite(lat) && lon>=137 && lon<=154.5 && lat>=-29.5 && lat<=-9;
};
function confirmedObservationAt(f,now){
  const p=f?.properties??{};
  const saved=Number(p.STORMTRACKER_OFFICIAL_OBSERVED_AT);
  if(Number.isFinite(saved)&&saved>0&&saved<=now+5*60000)return saved;
  return parseQueenslandObservationTime(p.STORMTRACKER_OBSERVED_TEXT,now);
}
function safeRecord(id,record,now){
  const f=record?.feature??record;
  const observedAt=Number(record?.observedAt);
  if(!stationId(id)||String(f?.id)!==String(id)||!validPoint(f) ||
      !officialLevels.has(normalised(f?.properties?.STORMTRACKER_FLOOD_CLASS))||
      !Number.isFinite(observedAt)||observedAt<=0||
      observedAt>now+5*60000||
      now-observedAt>floodStageEvidenceMaxAge(f)||
      f.properties?.STORMTRACKER_IDENTITY_WARNING||
      f.properties?.STORMTRACKER_STATION_TABLE_CONFLICT)return null;
  const latest=record?.latestFeature;
  const latestAt=Number(record?.latestObservedAt);
  const verifiedLatest=latest && String(latest.id)===id && validPoint(latest) &&
    Number.isFinite(latestAt)&&latestAt>=observedAt&&latestAt<=now+5*60000 &&
    Number.isFinite(Number(latest.properties?.STORMTRACKER_HEIGHT_METRES));
  return {observedAt,feature:{
    ...f,properties:{...f.properties,
      STORMTRACKER_OFFICIAL_OBSERVED_AT:observedAt}
  },...(verifiedLatest?{latestObservedAt:latestAt,latestFeature:latest}:{})};
}
export function cleanConfirmedFloodStations(input,now=Date.now()){
  const cache={};
  if(!input||typeof input!=="object"||Array.isArray(input))return cache;
  for(const [id,record] of Object.entries(input).slice(0,500)){
    const valid=safeRecord(id,record,now);
    if(valid)cache[id]=valid;
  }
  return cache;
}

// A current observation and a previously CONFIRMED flood classification are
// independent facts. The latter must never replace the former's height or
// timestamp merely because a new bulletin omits its class. Only the exact
// station ID participates; do not confuse a "below-minor" report with a blank.
export function retainConfirmedFloodStations(features,previous={},now=Date.now()){
  const cache=cleanConfirmedFloodStations(previous,now);
  const current=new Map();
  for(const incoming of features??[]){
    const id=String(incoming?.id??"");
    if(!stationId(id)||!validPoint(incoming))continue;
    // A mapped/source station-ID contradiction cannot support a flood stage.
    // Do not let a mismatched live bulletin resurrect an old cached major.
    if(incoming.properties?.STORMTRACKER_IDENTITY_WARNING||
       incoming.properties?.STORMTRACKER_STATION_TABLE_CONFLICT){
      delete cache[id];
      current.set(id,incoming);
      continue;
    }
    const at=confirmedObservationAt(incoming,now);
    // The bulletin and exact-station BoM table independently disproved a
    // falsely newer cached flood height (e.g. Sandy Creek 540386 on 26 Oct).
    // Drop ONLY that contradicted local record, never an unrelated station.
    if(incoming.properties?.STORMTRACKER_STATION_TABLE_CONFLICT)delete cache[id];
    const prior=cache[id];
    const priorAt=prior?.observedAt??-Infinity;
    const flood=normalised(incoming.properties?.STORMTRACKER_FLOOD_CLASS);
    // A stale cached bulletin must never reverse a more recent, known,
    // source-verified station reading. Cache the latest source fact beside the
    // confirmed flood classification, not INSTEAD of it.
    const latestAt=prior?.latestObservedAt??priorAt;
    const latest=prior?.latestFeature??prior?.feature;
    const validAt=Number.isFinite(at)&&at>0&&at<=now+5*60000 &&
      now-at<=floodStageEvidenceMaxAge(incoming);
    const isEarlier=validAt&&at<latestAt;
    const observation=isEarlier && latest ? latest:incoming;
    const observationAt=isEarlier?latestAt:at;
    const currentClass=normalised(observation.properties?.STORMTRACKER_FLOOD_CLASS);
    if(validAt&&!isEarlier&&at>=priorAt){
      const measured=observedFloodClass(
        incoming.properties?.STORMTRACKER_HEIGHT_METRES,stationFloodLevels(incoming));
      // A current station-specific BoM height below minor clears a previously
      // held flood-class marker; an empty/failed bulletin does not.
      if(measured===null){
        delete cache[id];
      }else if(officialLevels.has(flood)){
        const newRecord=safeRecord(id,{observedAt:at,feature:incoming},now);
        if(newRecord)cache[id]={...newRecord,
          latestObservedAt:at,latestFeature:incoming};
      }else if(flood==="below-minor"){
        // A BoM report explicitly stating below minor is an official recovery.
        delete cache[id];
      }else if(prior){
        // The old flood classification stays as last-confirmed context, but
        // only the NEW observation owns the displayed height and timestamp.
        cache[id]={...prior,latestObservedAt:at,latestFeature:incoming};
      }
    }
    const confirmed=cache[id];
    if(confirmed && validAt && !officialLevels.has(currentClass) &&
       currentClass!=="below-minor"){
      const props={...(observation.properties??{}),
        STORMTRACKER_LAST_CONFIRMED_FLOOD_CLASS:
          normalised(confirmed.feature.properties?.STORMTRACKER_FLOOD_CLASS),
        STORMTRACKER_LAST_CONFIRMED_FLOOD_AT:confirmed.observedAt};
      // This timestamp describes the current water HEIGHT, not the older
      // classification. The two facts remain visible separately in the UI.
      if(Number.isFinite(observationAt)&&observationAt>0)
        props.STORMTRACKER_OFFICIAL_OBSERVED_AT=observationAt;
      current.set(id,{...observation,properties:props});
    }else{
      current.set(id,observation);
    }
  }
  for(const [id,record] of Object.entries(cache)){
    if(current.has(id))continue;
    const last=record.latestFeature??record.feature;
    const observedAt=record.latestObservedAt??record.observedAt;
    const lastClass=normalised(last.properties?.STORMTRACKER_FLOOD_CLASS);
    current.set(id,{...last,properties:{
      ...last.properties,
      ...(officialLevels.has(lastClass)?{}:{
        STORMTRACKER_LAST_CONFIRMED_FLOOD_CLASS:
          normalised(record.feature.properties?.STORMTRACKER_FLOOD_CLASS),
        STORMTRACKER_LAST_CONFIRMED_FLOOD_AT:record.observedAt
      }),
      STORMTRACKER_OFFICIAL_OBSERVED_AT:observedAt
    }});
  }
  return {features:[...current.values()],cache};
}
