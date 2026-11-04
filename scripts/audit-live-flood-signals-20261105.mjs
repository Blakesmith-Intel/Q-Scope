// Read-only production flood-signal audit. Uses the EXACT same modules/sources
// as the browser. Never fabricates a gauge or changes operational data.
import {joinRiverGaugeObservations} from "../frontend/src/context-layers/river-gauge-observations-v1.js";
import {withStationFloodLevels,stationFloodLevels} from "../frontend/src/context-layers/river-flood-thresholds-v1.js";
import {reconcileFloodEvents} from "../frontend/src/context-layers/river-flood-events-v1.js";
import {evaluateFloodSignal} from "../frontend/src/context-layers/river-flood-signals-v1.js";

const urls={
  gauges:"https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/river-gauge-metadata",
  bulletins:"https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/river-height-bulletins?force=1&_ts="+Date.now()
};
const fetchJson=async (name,url)=>{
  const response=await fetch(url,{headers:{Accept:"application/json,application/geo+json"},cache:"no-store",signal:AbortSignal.timeout(25000)});
  const body=await response.text();
  if(!response.ok)throw Error(name+" HTTP "+response.status+" "+body.slice(0,300));
  try {return JSON.parse(body);}catch{throw Error(name+" invalid JSON "+body.slice(0,150));}
};
const results=await Promise.allSettled(Object.entries(urls).map(([name,url])=>fetchJson(name,url)));
for(let i=0;i<results.length;i++){
  if(results[i].status==="rejected"){
    console.error("FLOOD AUDIT "+Object.keys(urls)[i]+" FAILED",String(results[i].reason));
  }
}
if(results.some(x=>x.status==="rejected"))process.exit(2);
const [gauges,bulletins]=results.map(x=>x.value);
const now=Date.now();
const joined=joinRiverGaugeObservations({gauges,bulletins,nowMs:now});
const sourceFeatures=withStationFloodLevels(joined.payload.features);
const signal=reconcileFloodEvents(sourceFeatures,{}, {},now,null);
const reasons={};
const sourceStages={};
let measuredAboveMinor=0;
const samples=[];
for(const feature of sourceFeatures){
  const p=feature.properties??{};
  const stage=String(p.STORMTRACKER_FLOOD_CLASS??"").toLowerCase()||"(none)";
  sourceStages[stage]=(sourceStages[stage]??0)+1;
  const decision=evaluateFloodSignal(feature,{},now);
  const key=decision.show ? "SHOW:"+decision.state : "HIDE:"+decision.reason;
  reasons[key]=(reasons[key]??0)+1;
  const thresholds=stationFloodLevels(feature);
  if(thresholds && typeof p.STORMTRACKER_HEIGHT_METRES==="number" &&
    Number.isFinite(thresholds.minor) && p.STORMTRACKER_HEIGHT_METRES>=thresholds.minor){
    measuredAboveMinor++;
  }
  if(["minor","moderate","major"].includes(stage)||
    decision.show|| (/(Cunnamulla|Wallen|Wyandra|Rocky|Balonne|Dirranbandi|Goondiwindi)/i).test(p.name??p.NAME??"")){
    if(samples.length<35)samples.push({
      id:feature.id,name:p.name??p.NAME,height:p.STORMTRACKER_HEIGHT_METRES,
      bulletinStage:stage,at:p.STORMTRACKER_OBSERVED_TEXT,
      threshold:thresholds,decision:decision.show?decision.state:decision.reason,
      observedAt:p.STORMTRACKER_OFFICIAL_OBSERVED_AT??null
    });
  }
}
const report={
  checkedAt:new Date(now).toISOString(),
  source:{metadataCount:gauges?.features?.length??null,
    bulletinProducts:bulletins?.products?.length??null,
    bulletinObservations:bulletins?.products?.reduce((n,p)=>n+(p.observations?.length??0),0)??null,
    partial:bulletins?.partial??null,
    failed:bulletins?.failed??null},
  joined:{locations:joined.totalGaugeLocations,observations:joined.totalObservations,
    matched:joined.matchedCount,unmatched:joined.unmatchedObservations?.length},
  classified:{stages:sourceStages,measuredAboveMinor,
    decisions:reasons,visibleWithoutHistory:signal.features.length,
    visibleStates:signal.counts},
  samples
};
console.log("FLOOD_LIVE_AUDIT_START");
console.log(JSON.stringify(report,null,2));
console.log("FLOOD_LIVE_AUDIT_END");
if(joined.matchedCount<5)throw Error("Healthy statewide relay must match multiple same-ID BoM stations; no verified normal zero result");
