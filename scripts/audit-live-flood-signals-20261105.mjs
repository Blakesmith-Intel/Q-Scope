// Read-only source-to-signal audit of the actual production recovery path.
// Requires network and uses the BoM official station metadata before any
// time-limited verified location cache. Never manufactures water levels.
import {loadRiverGaugeOperationalSnapshot} from "../frontend/src/context-layers/river-gauge-observations-v1.js";
import {reconcileFloodEvents} from "../frontend/src/context-layers/river-flood-events-v1.js";
import {stationFloodLevels} from "../frontend/src/context-layers/river-flood-thresholds-v1.js";
import {evaluateFloodSignal} from "../frontend/src/context-layers/river-flood-signals-v1.js";

const fetchImpl=(url,options={})=>fetch(url,{...options,headers:{
  ...options.headers,Origin:"https://blakesmith-intel.github.io"
}});
let result;
try{
  result=await loadRiverGaugeOperationalSnapshot({fetchImpl,
    storage:{getItem:()=>null,setItem:()=>{}},now:()=>Date.now(),force:true});
}catch(error){
  console.error("FLOOD_SOURCE_RECOVERY_FAILED",String(error?.message??error));
  process.exit(2);
}
const now=Date.now();
const source=result.payload.features;
const classified=reconcileFloodEvents(source,{}, {},now,null);
let aboveMinor=0;
const reasons={},states={};
const examples=[];
for(const feature of source){
  const p=feature.properties??{},levels=stationFloodLevels(feature);
  const decision=evaluateFloodSignal(feature,{},now);
  const key=decision.show?"SHOW:"+decision.state:"HIDE:"+decision.reason;
  reasons[key]=(reasons[key]??0)+1;
  const state=p.STORMTRACKER_FLOOD_CLASS||"(no source stage)";
  states[state]=(states[state]??0)+1;
  if(levels&&Number.isFinite(levels.minor)&&
    typeof p.STORMTRACKER_HEIGHT_METRES==="number"&&
    p.STORMTRACKER_HEIGHT_METRES>=levels.minor)aboveMinor++;
  if((decision.show||/Cunnamulla|Wallen|Wyandra|Balonne|Goondiwindi/i.test(p.name??""))&&examples.length<25){
    examples.push({id:feature.id,name:p.name,height:p.STORMTRACKER_HEIGHT_METRES,
      observed:p.STORMTRACKER_OBSERVED_TEXT,sourceStage:state,
      decision:decision.show?decision.state:decision.reason,
      minorLevel:levels?.minor??null});
  }
}
console.log("FLOOD_LIVE_AUDIT_START");
console.log(JSON.stringify({
  checkedAt:new Date(now).toISOString(),
  metadataSource:result.metadataSource,metadataFallback:result.metadataFallback,
  totalGaugeLocations:result.totalGaugeLocations,
  totalObservations:result.totalObservations,matchedCount:result.matchedCount,
  unmatchedCount:result.unmatchedObservations?.length,
  partialBulletins:result.partialBulletins,failedProducts:result.failedProducts,
  sourceStages:states,measuredAboveMinor:aboveMinor,
  displayStates:classified.counts,qualifyingWithoutBrowserHistory:classified.features.length,
  reasons,examples
},null,2));
console.log("FLOOD_LIVE_AUDIT_END");
if(result.matchedCount<5)throw Error("Live Queensland source did not match enough BoM station IDs");
