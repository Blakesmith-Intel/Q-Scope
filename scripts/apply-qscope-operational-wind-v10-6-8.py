#!/usr/bin/env python3
"""Strictly additive Q-SCOPE operator-accepted V10.6.8 wind events promotion.

Apply ONLY to the generated _site root AFTER every pinned operational overlay.
NEVER modify checked production source, normal radar/3D/timeline modules,
historical previews, Workers, other layers, or existing UI nodes.
"""
from pathlib import Path
import re
import shutil
import sys

def once(source,old,new,label):
    n=source.count(old)
    if n!=1:
        raise ValueError(f"Root wind overlay {label}: expected 1 anchor, found {n}")
    return source.replace(old,new,1)

IMPORT='''import {createOperationalWindBridge,assessOperationalWindPair} from "./qscope-operational-wind-bridge-v1.js?v=v10-6-8-main";\n'''

# This is a new parallel observer. Existing Doppler/rain frame consumers and
# official BoM warning routes do not call into it and remain unchanged.
ROOT_ADDITION=r'''
// BEGIN Q-SCOPE V10.6.8 ACCEPTED PASSIVE RADAR SIGNATURES (ADDITIVE)
// Experimental radar-review priorities only. No official warnings or gusts.
let qscopeWindNavigating=false;
let qscopeWindSourceKey="",qscopeWindSourceCache=null;
let qscopeWindSourceAt=0,qscopeWindSourcePending=null;
async function qscopeWindOriginalBoMSources(){
  const key=selectedRadarRegion()+":"+selectedSourceRadars().join(",");
  if(qscopeWindSourceKey!==key){
    qscopeWindSourceKey=key;
    qscopeWindSourceCache=null;
    qscopeWindSourcePending=null;
  }
  if(qscopeWindSourceCache&&Date.now()-qscopeWindSourceAt<4*60000)
    return qscopeWindSourceCache;
  if(!qscopeWindSourcePending){
    qscopeWindSourcePending=loadDopplerHistoriesAndPalettes()
      .then(sources=>{
        if(key===qscopeWindSourceKey){
          qscopeWindSourceCache=sources;
          qscopeWindSourceAt=Date.now();
        }
        return sources;
      }).finally(()=>{if(key===qscopeWindSourceKey)qscopeWindSourcePending=null;});
  }
  return qscopeWindSourcePending;
}
async function qscopeWindRecordsForRainFrame(frame,sources){
  if(!frame||frame.sourceMetadata?.temporalInference||
     !Number.isFinite(Date.parse(frame.observedUtc)))return [];
  const approved=selectedSourceRadars().filter(r=>
    ["08","50","66"].includes(r)&&QLD_RADAR_SITES[r]?.analysisGeorefVerified===true);
  const time=Date.parse(frame.observedUtc);
  const settled=await Promise.allSettled(approved.map(async radarId=>{
    const frames=buildIndependentDopplerFrames(
      sources.histories.get(radarId),null);
    const nearest=frames.filter(x=>x.source_kind!=="latest"&&
      Number.isFinite(Date.parse(x.observedUtc))&&
      Math.abs(Date.parse(x.observedUtc)-time)<=8*60000)
      .sort((a,b)=>Math.abs(Date.parse(a.observedUtc)-time)-
        Math.abs(Date.parse(b.observedUtc)-time))[0];
    if(!nearest)return null;
    const real=await decodeHistoricalDopplerFrame(
      radarId,nearest,sources.palettes);
    return real?.nativePanel?.data&&Array.isArray(real?.samples)
      ?{...real,geometryVerified:true}:null;
  }));
  return settled.filter(x=>x.status==="fulfilled"&&x.value).map(x=>x.value);
}
function qscopeWindPairIdentity(mode,index){
  const frames=mode==="rain"?hybridFrames:windPlaybackFrames;
  const curr=frames[index],prev=frames[index-1];
  if(!curr||!prev||curr.observedUtc===prev.observedUtc||
     !Number.isFinite(Date.parse(curr.observedUtc))||
     !Number.isFinite(Date.parse(prev.observedUtc))||
     (mode==="rain"&&(curr.sourceMetadata?.temporalInference||
       prev.sourceMetadata?.temporalInference)))return null;
  const radar=String($("dopplerOverlayRadar")?.value??"");
  return [mode,selectedRadarRegion(),selectedSourceRadars().join(","),
    radar,prev.observedUtc,curr.observedUtc].join(":");
}
async function qscopeWindEvaluatePair(mode,index){
  if(mode==="rain"){
    const frame=hybridFrames[index],prev=hybridFrames[index-1];
    const result=hybridResults[index],previousResult=hybridResults[index-1];
    if(!frame||!result||!prev||!previousResult)return null;
    let currentRecords=[],previousRecords=[];
    try {
      const sources=await qscopeWindOriginalBoMSources();
      [currentRecords,previousRecords]=await Promise.all([
        qscopeWindRecordsForRainFrame(frame,sources),
        qscopeWindRecordsForRainFrame(prev,sources)
      ]);
    }catch(error){
      // Without original Doppler, hook-shape-only may still be reviewed.
      console.warn("Q-SCOPE authentic wind source not verified",error);
    }
    return assessOperationalWindPair({
      mode,frame,result,previousFrame:prev,previousResult,
      currentRecords,previousRecords
    });
  }
  if(mode==="doppler"){
    const radar=String($("dopplerOverlayRadar")?.value??"");
    if(!["08","50","66"].includes(radar)||
      QLD_RADAR_SITES[radar]?.analysisGeorefVerified!==true)return null;
    const prior=windPlaybackFrames[index-1],current=windPlaybackFrames[index];
    if(!prior||!current)return null;
    const [oldNow,newNow]=await Promise.all([
      decodeHistoricalDopplerFrame(radar,prior),
      decodeHistoricalDopplerFrame(radar,current)
    ]);
    if(!oldNow?.nativePanel?.data||!newNow?.nativePanel?.data)return null;
    return assessOperationalWindPair({
      mode,currentRecords:[{...newNow,geometryVerified:true}],
      previousRecords:[{...oldNow,geometryVerified:true}]
    });
  }
  return null;
}
async function qscopeWindNavigateToActualFrame(_event,evidence){
  const target=evidence?.frameUtc;
  if(!Number.isFinite(Date.parse(target))||
     !Number.isFinite(evidence?.latitude)||
     !Number.isFinite(evidence?.longitude))
    return {ok:false,message:"No valid original radar source or location."};
  if(sequenceLoading)
    return {ok:false,message:"Radar window is updating; no frame substituted."};
  const wind=evidence.mode==="doppler";
  const list=wind?windPlaybackFrames:hybridFrames;
  const idx=list.findIndex(x=>x.observedUtc===target&&
    (wind||!x.sourceMetadata?.temporalInference));
  if(idx<0 || wind!==isNativeDopplerPlayback())
    return {ok:false,message:
      "Exact original source frame is unavailable in the currently selected loop. "+
      "Select the corresponding BoM radar playback window; no substitute was shown."};
  qscopeWindNavigating=true;
  try {
    await playback.pause();
    const shown=wind?await showDopplerOnlyFrame(idx):await showHybridFrame(idx);
    if(shown!==true)return {ok:false,
      message:"Original source frame could not be displayed."};
    mapCamera.setView({
      longitude:evidence.longitude,latitude:evidence.latitude,
      targetHeight:0,range:42000,heading:0,pitch:Cesium.Math.toRadians(-52)
    });
    scene.requestRender();
    return {ok:true,message:"Original BoM "+(wind?"Doppler":"reflectivity")+
      " scan "+target+" displayed at event location."};
  }catch(error){
    return {ok:false,message:"Source frame unavailable: "+String(error?.message??error)};
  }finally{
    qscopeWindNavigating=false;
  }
}
const qscopeOperationalWindEvents=createOperationalWindBridge({
  map:$("mapPanel"),
  doc:document,win:window,
  storage:(()=>{try{return window.localStorage;}catch{return null;}})(),
  sourceKey:qscopeWindPairIdentity,evaluate:qscopeWindEvaluatePair,
  navigate:qscopeWindNavigateToActualFrame,
  isPlaying:()=>playback.isPlaying(),
  pause:()=>playback.pause(),
  status:message=>setStatus(message,"warning")
});
// END Q-SCOPE V10.6.8 ACCEPTED PASSIVE RADAR SIGNATURES
'''

def main(site=Path("_site")):
    if site.as_posix()!="_site":
        raise ValueError("Operational addition targets generated _site only")
    js=site/"src/live3d-operational-v9.js"
    html=site/"live3d-operational-v9.html"
    index=site/"index.html"
    for p in (js,html,index):
        if not p.is_file():raise ValueError(f"Missing pinned build: {p}")
    src=Path("frontend/src")
    modules=(
      "qscope-operational-wind-bridge-v1.js",
      "qscope-reviewable-event-inbox-v10-6.js",
      "qscope-source-evidence-thumbnail-v10-6.js",
      "qscope-intelligent-pause-v10-6.js",
      "qscope-research-event-dock-layout-v10-6-1.js",
      "qscope-wind-artefact-guard-v10-6.js",
      "severe-storm-v10.js","doppler-persistence-v10-3.js",
    )
    runtime=js.read_text(encoding="utf-8")
    page=html.read_text(encoding="utf-8")
    landing=index.read_text(encoding="utf-8")
    if "qscopeOperationalWindEvents" in runtime:
        raise ValueError("Wind addon already mounted: never install twice")
    if "isWindHookQaPreview" in runtime:
        raise ValueError("Research-preview runtime cannot replace operational")
    # The pinned root retains a permanently disabled legacy analysis method.
    # Never remove, activate, or rewrite it as part of this additive rollout.
    if "PUBLISHED_PRODUCTION_RUNTIME" not in runtime:
        raise ValueError("Unexpected root: pinned operational invariant absent")
    runtime=IMPORT+runtime
    anchor="severeStormAlertOverlay.setEnabled(false);"
    runtime=once(runtime,anchor,anchor+"\n"+ROOT_ADDITION,
      "independent event overlay initialisation")
    # Only after successful original radar-loop setup; never intercept its
    # promise, change response, replace cache or mutate a scan.
    runtime=once(runtime,
      '  if(resume) playback.play();\n}\n\nasync function loadHybridSequence(',
      '  qscopeOperationalWindEvents.queueWindow("doppler",windPlaybackFrames.length);\n'+
      '  if(resume) playback.play();\n}\n\nasync function loadHybridSequence(',
      "native Doppler successful window")
    runtime=once(runtime,
      '  await showHybridFrame(hybridFrameIndex);\n  if (resume) playback.play();',
      '  await showHybridFrame(hybridFrameIndex);\n'+
      '  qscopeOperationalWindEvents.queueWindow("rain",hybridFrames.length);\n'+
      '  if (resume) playback.play();',
      "genuine rain successful window")
    if "<head>" not in page or "</head>" not in page:
        raise ValueError("Pinned operator document head unavailable")
    page=once(page,"</head>",
      '  <link rel="stylesheet" href="./src/qscope-reviewable-event-inbox-v10-6.css?v=v10-6-8-main" />\n</head>',
      "isolated radar event styles")
    # Do not change any approved query token: append exactly one new token
    # to existing live module and outer iframe URL, preserving all others.
    def refresh_reference(text,regex,label):
        found=list(re.finditer(regex,text))
        if len(found)!=1:raise ValueError(label+": expected one cache ref")
        m=found[0]
        return text[:m.end(1)]+"-wind-alerts-v10-6-8-main"+text[m.end(1):]
    page=refresh_reference(page,
      r'(src="\./src/live3d-operational-v9\.js\?v=[^"]+)',
      "operator runtime import")
    landing=refresh_reference(landing,
      r'(src="\./live3d-operational-v9\.html\?v=[^"]+)',
      "site frame import")
    # Commit ONLY once all source anchors and required modules are verified.
    for module in modules:
        original=src/module
        target=site/"src"/module
        if not original.is_file():raise ValueError(f"Missing reviewed source {original}")
        if target.exists():raise ValueError(f"Refuse to overwrite existing {target}")
    for module in modules:shutil.copyfile(src/module,site/"src"/module)
    shutil.copyfile(src/"qscope-reviewable-event-inbox-v10-6.css",
      site/"src"/"qscope-reviewable-event-inbox-v10-6.css")
    js.write_text(runtime,encoding="utf-8")
    html.write_text(page,encoding="utf-8")
    index.write_text(landing,encoding="utf-8")
    with (site/"BUILD.txt").open("a",encoding="utf-8") as f:
        f.write("\nQ-SCOPE ACCEPTED MAIN WIND EVENTS V10.6.8 — ISOLATED PASSIVE SIGNATURE OBSERVER / AUTHENTIC SOURCE / ARTEFACT GATE; NO OTHER PRODUCT REWRITE\n")

if __name__=="__main__":
    if len(sys.argv)!=1:raise SystemExit("No source paths accepted")
    main()
