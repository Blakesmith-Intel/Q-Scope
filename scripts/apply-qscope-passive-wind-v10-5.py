#!/usr/bin/env python3
"""Convert ONLY a copied Q-SCOPE V10.5 science-preview runtime into a passive
notification system. Never patch the real production root or pinned V10.3/4.
Every mutation is strict and fails closed on upstream source changes.
"""
from argparse import ArgumentParser
from pathlib import Path

def replace_once(source: str, old: str, new: str, label: str):
    n=source.count(old)
    if n != 1:
        raise ValueError(f"{label}: expected 1 source anchor; got {n}")
    return source.replace(old,new,1)

def replace_range(source: str, before: str, after: str, new: str, label: str):
    if source.count(before)!=1 or source.count(after)!=1:
        raise ValueError(f"{label}: source range not unique")
    a=source.index(before)
    b=source.index(after,a)
    if b <= a: raise ValueError(f"{label}: invalid boundaries")
    return source[:a]+new+source[b:]

PASSIVE_FUNCTIONS = r'''
// Passive detection is an independent event queue. It never changes the
// displayed radar frame, forces the camera, or removes an unacknowledged event.
// One source pair at a time; 8 adjacent genuine radar scans maximum per
// published loop and no extra Cloudflare Worker route.
const passiveResearchSeen=new Set();
let passiveResearchQueue=Promise.resolve();
function queuePassiveResearchPair(mode,index){
  if(!isWindHookQaPreview || !windHookResearchEnabled)return;
  if(!["rain","doppler"].includes(mode))return;
  const frames=mode==="rain"?hybridFrames:windPlaybackFrames;
  if(index<1 || index>=frames.length)return;
  const current=frames[index], previous=frames[index-1];
  if(!current || !previous ||
     !Number.isFinite(Date.parse(current.observedUtc)) ||
     !Number.isFinite(Date.parse(previous.observedUtc)) ||
     current.observedUtc===previous.observedUtc ||
     (mode==="rain" &&
       (current.sourceMetadata?.temporalInference ||
        previous.sourceMetadata?.temporalInference)))return;
  const radarId=String($("dopplerOverlayRadar")?.value??"");
  const sourceSites=selectedSourceRadars().join(",")+":"+selectedRadarRegion();
  const unique=mode+":"+sourceSites+":"+radarId+":"+
    previous.observedUtc+":"+current.observedUtc;
  if(passiveResearchSeen.has(unique))return;
  passiveResearchSeen.add(unique);
  if(passiveResearchSeen.size>512)
    passiveResearchSeen.delete(passiveResearchSeen.values().next().value);
  const result=mode==="rain"?hybridResults[index]:null;
  const previousResult=mode==="rain"?hybridResults[index-1]:null;
  passiveResearchQueue=passiveResearchQueue.then(async()=>{
    if(!isWindHookQaPreview || !windHookResearchEnabled ||
       sourceSites!==selectedSourceRadars().join(",")+":"+selectedRadarRegion())return;
    if(mode==="rain"){
      if(!result || !previousResult)return;
      let currentRecords=[],priorRecords=[];
      try {
        const sources=await windHookOriginalSources();
        [currentRecords,priorRecords]=await Promise.all([
          researchRecordsForRadarFrame(current,sources),
          researchRecordsForRadarFrame(previous,sources)
        ]);
      } catch(error) {
        // Reflectivity-only hook shapes remain legitimate research, but
        // no yellow/red radar-velocity evidence can be invented.
        console.warn("Q-SCOPE source Doppler could not be verified:",error);
      }
      if(sourceSites!==selectedSourceRadars().join(",")+":"+selectedRadarRegion())return;
      const assessment=assessV10RadarFrame({
        frame:current,result,previousFrame:previous,previousResult,
        dopplerState:{records:currentRecords},
        previousDopplerState:{records:priorRecords}
      });
      passiveRadarInbox?.observe(assessment.alerts,
        {mode:"rain",frameUtc:current.observedUtc});
    } else {
      if(!["08","50","66"].includes(radarId) ||
         QLD_RADAR_SITES[radarId]?.analysisGeorefVerified!==true)return;
      const [prior,latest]=await Promise.all([
        decodeHistoricalDopplerFrame(radarId,previous),
        decodeHistoricalDopplerFrame(radarId,current)
      ]);
      if(sourceSites!==selectedSourceRadars().join(",")+":"+selectedRadarRegion() ||
         radarId!==String($("dopplerOverlayRadar")?.value??""))return;
      // Genuine source data / native image must be decoded, never synthetic.
      if(!prior?.nativePanel?.data || !latest?.nativePanel?.data)return;
      const result=assessConsecutiveDopplerWind(
        {...prior,geometryVerified:true},{...latest,geometryVerified:true}
      );
      passiveRadarInbox?.observe(result.alerts,
        {mode:"doppler",frameUtc:latest.observedUtc,radarId});
    }
  }).catch(error=>{
    // A transient failed genuine-source load may be attempted at the
    // next ordinary refresh; never publish a synthetic replacement.
    passiveResearchSeen.delete(unique);
    console.warn("Q-SCOPE passive radar evidence unavailable",mode,error);
  });
}

// The operator explicitly requested alert-to-evidence navigation. This is
// the ONLY path in the passive system allowed to move the user's camera or
// change the displayed radar frame. No closest-time substitution is allowed.
async function navigateToPassiveResearchEvidence(_event,evidence){
  const site=String(evidence?.radarId??"");
  const targetUtc=evidence?.frameUtc;
  if(!Number.isFinite(Date.parse(targetUtc)) ||
     !Number.isFinite(evidence?.latitude) ||
     !Number.isFinite(evidence?.longitude))
    return {ok:false,message:"Invalid source frame reference; nothing changed."};
  if(sequenceLoading)
    return {ok:false,message:"A radar source update is underway. Try opening this event again."};
  await playback.pause();
  const desiredDoppler=evidence.mode==="doppler";
  try{
    if(desiredDoppler){
      if(!["08","50","66"].includes(site) ||
         QLD_RADAR_SITES[site]?.analysisGeorefVerified!==true)
        return {ok:false,message:"This radar's original velocity geometry is unavailable."};
      const dopplerSite=$("dopplerOverlayRadar");
      const matching=[...(dopplerSite?.options??[])].some(o=>o.value===site);
      if(!matching)
        return {ok:false,message:"Radar "+site+" is not available in the current source selector."};
      if(!isNativeDopplerPlayback() ||
         String(dopplerSite.value)!==site){
        dopplerSite.value=site;
        $("loopDurationMinutes").value=DOPPLER_AVAILABLE_LOOP_VALUE;
        await refreshIndependentDopplerHistory(false);
        await loadDopplerSequence(false);
        await playback.pause();
      }
      const index=windPlaybackFrames.findIndex(frame=>
        frame.observedUtc===targetUtc);
      if(index>=0){
        const displayed=await showDopplerOnlyFrame(index);
        if(displayed!==true)
          return {ok:false,message:"The genuine Doppler frame could not be presented."};
      }else{
        mapCamera?.setView({
          longitude:evidence.longitude,latitude:evidence.latitude,
          targetHeight:0,range:42000,heading:0,
          pitch:Cesium.Math.toRadians(-52)
        });
        scene.requestRender();
        return {ok:false,message:"Location centred, but the exact "+
          targetUtc+" Doppler frame has expired from the available original BoM loop."};
      }
    }else{
      if(isNativeDopplerPlayback() || !hybridFrames.length){
        // 30-minute original BoM radar history: never ask for a fabricated
        // historical cache extension or switch a production setting.
        const loop=$("loopDurationMinutes");
        if([...(loop?.options??[])].some(o=>o.value==="30"))loop.value="30";
        else return {ok:false,message:"The rain-radar loop is unavailable."};
        await loadHybridSequence(false);
        await playback.pause();
      }
      const index=hybridFrames.findIndex(frame=>
        frame.observedUtc===targetUtc &&
        !frame.sourceMetadata?.temporalInference);
      if(index>=0){
        const displayed=await showHybridFrame(index);
        if(displayed!==true)
          return {ok:false,message:"The genuine reflectivity frame could not be presented."};
      }else{
        mapCamera?.setView({
          longitude:evidence.longitude,latitude:evidence.latitude,
          targetHeight:0,range:42000,heading:0,
          pitch:Cesium.Math.toRadians(-52)
        });
        scene.requestRender();
        return {ok:false,message:"Location centred, but the exact "+
          targetUtc+" reflectivity frame has expired from the available original BoM loop."};
      }
    }
    mapCamera?.setView({
      longitude:evidence.longitude,latitude:evidence.latitude,
      targetHeight:0,range:42000,heading:0,
      pitch:Cesium.Math.toRadians(-52)
    });
    scene.requestRender();
    return {ok:true,message:"Original BoM "+(desiredDoppler?"Doppler":"reflectivity")+
      " frame "+targetUtc+" displayed at the event's recorded position."};
  }catch(error){
    return {ok:false,message:"Original frame unavailable: "+String(error?.message??error)+
      ". No substitute timestamp was selected."};
  }
}
'''

def transform(site: Path):
    if site.name!="wind-hook-v10-5" or site.parent.name!="preview":
        raise ValueError("Q-SCOPE passive overlay must target ONLY preview/wind-hook-v10-5")
    index=site/"index.html"
    ui=site/"live3d-operational-v9.html"
    runtime=site/"src/live3d-operational-v9.js"
    a=index.read_text(encoding="utf-8")
    b=ui.read_text(encoding="utf-8")
    s=runtime.read_text(encoding="utf-8")
    a=replace_once(a,
        "<title>Q-SCOPE | Experimental Wind & Hook Research V10.4</title>",
        "<title>Q-SCOPE | Passive Wind & Hook Event Research V10.5</title>",
        "preview browser title")
    a=replace_once(a,"qscope-v10-4-research-only",
        "qscope-v10-5-passive-events","preview iframe cache")
    b=replace_once(b,
        "<title>Q-SCOPE | Experimental Radar Evidence V10.4</title>",
        "<title>Q-SCOPE | Passive Radar Event Research V10.5</title>",
        "preview scene title")
    b=replace_once(b,
        "WIND / HOOK RESEARCH · NOT OFFICIAL WARNINGS",
        "PASSIVE WIND EVENTS · EXPERIMENTAL, NOT OFFICIAL WARNINGS",
        "preview sidebar identity")
    s=replace_once(s,
        'import { assessConsecutiveDopplerWind } from "./doppler-persistence-v10-3.js?v=observed-scans-pair1";',
        'import { assessConsecutiveDopplerWind } from "./doppler-persistence-v10-3.js?v=observed-scans-pair1";\n'
        'import { createPassiveWindEventInbox } from "./qscope-passive-wind-inbox-v10-5.js";',
        "research import")
    # The V10.4 copied science preview has two (and only two) literal
    # preview-route comparisons: research and cyclone-archive isolation.
    if s.count("/preview/wind-hook-v10-4/")!=2:
        raise ValueError("Expected both isolated V10.4 route guards.")
    s=s.replace("/preview/wind-hook-v10-4/","/preview/wind-hook-v10-5/")
    s=replace_once(s,"let windHookResearchEnabled = false;",
        "let windHookResearchEnabled = isWindHookQaPreview;",
        "automatic analysis opt-in removal")
    s=replace_range(s,
        "if (isWindHookQaPreview) {\n  const qaStyle = document.createElement",
        "// Prevent an older asynchronous radar-image load",
        '''if (isWindHookQaPreview) {
  const qaStyle=document.createElement("link");
  qaStyle.rel="stylesheet";
  qaStyle.href="./src/wind-hook-research-v10.css?v=qa-v10-3";
  document.head.appendChild(qaStyle);
  const inboxStyle=document.createElement("link");
  inboxStyle.rel="stylesheet";
  inboxStyle.href="./src/qscope-passive-wind-inbox-v10-5.css?v=v10-5";
  document.head.appendChild(inboxStyle);
}
// The queue runs without a layer checkbox and survives frame scrubbing.
const passiveRadarInbox=isWindHookQaPreview
  ? createPassiveWindEventInbox({
      container:$("mapPanel"),
      storage:(()=>{try{return window.localStorage;}catch{return null;}})(),
      onNavigate:navigateToPassiveResearchEvidence
    })
  : null;

''',"research checkbox / source guard")
    s=replace_range(s,
        "async function syncSevereStormAlerts(index) {",
        "function dopplerContextForTrack(",
        PASSIVE_FUNCTIONS+"\n",
        "source-true passive pair analysis")
    s=replace_once(s,
        "    void syncSevereStormAlerts(requestedIndex);",
        '    queuePassiveResearchPair("rain",requestedIndex);',
        "rain passive scene")
    s=replace_once(s,
        "  void syncIndependentDopplerResearch(next,prepared.record,renderToken);",
        '  queuePassiveResearchPair("doppler",next);',
        "native Doppler passive scene")
    s=replace_once(s,
        "  if (resume) playback.play();\n}",
        '''  if(isWindHookQaPreview)
    for(let i=1;i<windPlaybackFrames.length;i++)
      queuePassiveResearchPair("doppler",i);
  if (resume) playback.play();
}''',"Doppler window passive backlog")
    s=replace_once(s,
        "  await showHybridFrame(hybridFrameIndex);\n  if (resume) playback.play();",
        '''  await showHybridFrame(hybridFrameIndex);
  // Scan genuine observations in a bounded, sequential background queue.
  // Passive events are not lost when the operator never starts playback.
  if(isWindHookQaPreview)
    for(let i=1;i<hybridFrames.length;i++)
      queuePassiveResearchPair("rain",i);
  if (resume) playback.play();''',
        "radar window passive backlog")
    # The experimental old alert dock stays hidden in this preview: only the
    # persistent inbox renders research events. Root and V10.4 unaffected.
    if "enableWindHookResearch" in s or "windHookResearchQaControl" in s:
        raise ValueError("Opt-in research layer checkbox survived the passive conversion")
    if "syncSevereStormAlerts(" in s or "syncIndependentDopplerResearch(" in s:
        raise ValueError("Legacy displayed-frame-only alert dependency remains")
    index.write_text(a,encoding="utf-8")
    ui.write_text(b,encoding="utf-8")
    runtime.write_text(s,encoding="utf-8")
    with (site/"BUILD.txt").open("a",encoding="utf-8") as file:
        file.write("Q-SCOPE PASSIVE WIND/HOOK RESEARCH V10.5 — persistent grouped notifications, exact recorded-frame access, no layer toggle; NOT OPERATIONAL WARNINGS\n")

if __name__=="__main__":
    parser=ArgumentParser()
    parser.add_argument("--site",required=True,type=Path)
    args=parser.parse_args()
    transform(args.site)
