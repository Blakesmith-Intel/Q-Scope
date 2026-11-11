// Q-SCOPE operator-accepted V10.6.8 wind/hook signatures, additive runtime.
// No radar or Doppler renderer, camera, flood, warning, traffic, QFD, or Worker
// behaviour is replaced. Presentation remains a RESEARCH signature, NOT BoM.
import {
  createPassiveWindEventInbox,
  Q_SCOPE_EVENT_STORAGE_KEY,Q_SCOPE_PAUSE_PREFERENCE_KEY
} from "./qscope-reviewable-event-inbox-v10-6.js";
import {attachQscopeResearchEventDock} from
  "./qscope-research-event-dock-layout-v10-6-1.js";
import {captureResearchSourceThumbnail} from
  "./qscope-source-evidence-thumbnail-v10-6.js";
import {shouldPauseForNewResearchEvent} from
  "./qscope-intelligent-pause-v10-6.js";
import {assessV10RadarFrame} from "./severe-storm-v10.js";
import {assessConsecutiveDopplerWind} from "./doppler-persistence-v10-3.js";
import {screenResearchWindArtefacts} from
  "./qscope-wind-artefact-guard-v10-6.js";
export const OPERATIONAL_WIND_BUILD="v10-6-8-main-isolated-addon";

// The same origin hosts preview branches. Never import preview events or
// preferences into the operational dashboard as if they were live detections.
export function operationalWindStorage(original){
  const prefix="qscope:operational:accepted-wind-v10-6-8:";
  return {
    getItem:key=>original?.getItem(prefix+key)??null,
    setItem:(key,value)=>original?.setItem(prefix+key,String(value)),
    removeItem:key=>original?.removeItem(prefix+key)
  };
}
export function createOperationalWindBridge({
  map,doc=globalThis.document,win=globalThis.window,
  evaluate,sourceKey,now=()=>Date.now(),navigate=async()=>({ok:false,
    message:"The exact observed source frame is unavailable."}),
  isPlaying=()=>false,pause=()=>{},status=()=>{},
  storage=null
}={}){
  if(!map||typeof evaluate!=="function"||typeof sourceKey!=="function")
    throw new TypeError("Q-SCOPE wind bridge requires genuine radar sources");
  const activeStorage=operationalWindStorage(storage);
  let destroyed=false,navigating=false,work=Promise.resolve();
  const seen=new Set();
  const inbox=createPassiveWindEventInbox({
    container:map,documentRef:doc,storage:activeStorage,
    onNavigate:async(event,evidence)=>{
      navigating=true;
      try {return await navigate(event,evidence);}
      finally {navigating=false;}
    },
    onNewEvent:(event)=>{
      if(shouldPauseForNewResearchEvent({
        event,nowMs:now(),isResearch:true,
        isPlaying:isPlaying(),isHidden:Boolean(doc.hidden),
        isNavigating:navigating
      })){
        Promise.resolve(pause()).catch(()=>{});
        status("Q-SCOPE radar event awaiting operator review · playback paused by preference.");
      }
    }
  });
  const positioning=attachQscopeResearchEventDock({
    map,inbox:map.querySelector(".qscope-wind-event-inbox"),
    details:map.querySelector(".qscope-wind-event-detail"),
    documentRef:doc,win
  });
  function queuePair(mode,index){
    if(destroyed||!["rain","doppler"].includes(mode)||
      !Number.isInteger(index)||index<1)return false;
    const identity=sourceKey(mode,index);
    if(typeof identity!=="string"||!identity||seen.has(identity))return false;
    seen.add(identity);
    if(seen.size>128)seen.delete(seen.values().next().value);
    work=work.then(async()=>{
      if(destroyed||sourceKey(mode,index)!==identity)return;
      const evidence=await evaluate(mode,index);
      if(!evidence||destroyed||sourceKey(mode,index)!==identity)return;
      const alerts=Array.isArray(evidence.alerts)?evidence.alerts:[];
      // Keep the genuine observation before any future interface work.
      const annotated=alerts.map(alert=>({
        ...alert,
        snapshot:captureResearchSourceThumbnail({
          alert,mode,frame:evidence.frame,record:evidence.record,
          documentRef:doc
        })
      }));
      const screened=screenResearchWindArtefacts({
        alerts:annotated,
        currentRecords:evidence.currentRecords??[],
        previousRecords:evidence.previousRecords??[]
      });
      inbox.observe(screened.alerts,{
        mode,frameUtc:evidence.frameUtc,radarId:evidence.radarId
      });
    }).catch(error=>{
      seen.delete(identity);
      // Failure must never block radar playback or hide a genuine warning.
      win.console?.warn?.("Q-SCOPE wind review source unavailable",error);
    });
    return true;
  }
  function queueWindow(mode,count){
    if(!Number.isInteger(count)||count<2)return;
    for(let i=1;i<Math.min(count,9);i++)queuePair(mode,i);
  }
  return {inbox,queuePair,queueWindow,
    whenIdle:()=>work,
    destroy(){
      destroyed=true;positioning?.destroy();inbox.destroy();
    }
  };
}
export function assessOperationalWindPair({
  mode,frame,result,previousFrame,previousResult,
  currentRecords=[],previousRecords=[]
}={}){
  if(mode==="rain"){
    if(!frame||!result||!previousFrame||!previousResult)return null;
    const assessment=assessV10RadarFrame({
      frame,result,previousFrame,previousResult,
      dopplerState:{records:currentRecords},
      previousDopplerState:{records:previousRecords}
    });
    return {alerts:assessment.alerts,frame,
      frameUtc:frame.observedUtc,currentRecords,previousRecords};
  }
  if(mode==="doppler"){
    if(currentRecords.length!==1||previousRecords.length!==1)return null;
    const current=currentRecords[0],previous=previousRecords[0];
    const assessment=assessConsecutiveDopplerWind(previous,current);
    return {alerts:assessment.alerts,record:current,
      radarId:String(current.radarId),frameUtc:current.observedUtc,
      currentRecords,previousRecords};
  }
  return null;
}
