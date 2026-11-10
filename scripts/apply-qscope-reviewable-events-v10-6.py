#!/usr/bin/env python3
"""Source-guarded Q-SCOPE V10.6 research-preview-only reliability overlay.
Always apply to a separately copied V10.5 preview, never the live site.
"""
from argparse import ArgumentParser
from pathlib import Path

def one(source, original, replacement, name):
    found=source.count(original)
    if found!=1:
        raise ValueError(f"{name}: expected one source anchor, got {found}")
    return source.replace(original,replacement,1)

def main(site):
    if site.name!="wind-hook-v10-6" or site.parent.name!="preview":
        raise ValueError("V10.6 can only modify its isolated research preview.")
    index=site/"index.html"
    html=site/"live3d-operational-v9.html"
    runtime=site/"src/live3d-operational-v9.js"
    a=index.read_text(encoding="utf-8")
    b=html.read_text(encoding="utf-8")
    s=runtime.read_text(encoding="utf-8")
    a=one(a,"<title>Q-SCOPE | Passive Wind & Hook Event Research V10.5</title>",
      "<title>Q-SCOPE | Persistent Wind & Hook Event Research V10.6</title>","browser title")
    a=one(a,"qscope-v10-5-passive-events",
      "qscope-v10-6-persistent-evidence","iframe source refresh token")
    b=one(b,"<title>Q-SCOPE | Passive Radar Event Research V10.5</title>",
      "<title>Q-SCOPE | Persistent Radar Evidence V10.6</title>","operator title")
    b=one(b,"PASSIVE WIND EVENTS · EXPERIMENTAL, NOT OFFICIAL WARNINGS",
      "PERSISTENT WIND EVENTS · EXPERIMENTAL, NOT OFFICIAL WARNINGS","operator header")
    # The inner script URL is independently cached by the browser. Bump it
    # alongside the outer iframe so the restored compass is truly loaded.
    b=one(b,'src="./src/live3d-operational-v9.js?v=',
      'src="./src/live3d-operational-v9.js?v=v10-6-5-restored-compass-',
      "preview operator-runtime cache revision")
    if s.count("/preview/wind-hook-v10-5/")!=2:
        raise ValueError("V10.5 source route was changed: cannot safely rebrand.")
    s=s.replace("/preview/wind-hook-v10-5/","/preview/wind-hook-v10-6/")
    # The preview originates from pinned V10.3 before true-north compass
    # existed. Fix the BUILD, not the event panel CSS. Mount the exact
    # operational compass on the original map-camera controller here.
    if "mountNorthCompass" in s or "north-compass-v1.js" in s:
        raise ValueError("Pinned V10.3 compass absence contract changed; inspect source")
    s=one(s,
      "// The verified browser-source QA viewer must never call Cesium.camera.flyTo;",
      '''// The original operator compass must be present in V10.6 even with
// NO radar alerts. It is a camera controller tool, independent of the inbox.
mountNorthCompass({
  cameraController:mapCamera,
  mapPanel:document.getElementById("mapPanel")
});

// The verified browser-source QA viewer must never call Cesium.camera.flyTo;''',
      "restore working north compass immediately after camera creation")
    s='import {mountNorthCompass} from "./north-compass-v1.js?v=v10-6-5-operational-compass";\\n'.replace('\\n', '\n')+s
    s=one(s,
      'import { createPassiveWindEventInbox } from "./qscope-passive-wind-inbox-v10-5.js";',
      '''import { createPassiveWindEventInbox } from "./qscope-reviewable-event-inbox-v10-6.js?v=source-retention";
import { captureResearchSourceThumbnail } from "./qscope-source-evidence-thumbnail-v10-6.js?v=observed-only";
import { shouldPauseForNewResearchEvent } from "./qscope-intelligent-pause-v10-6.js";
import { attachQscopeResearchEventDock } from "./qscope-research-event-dock-layout-v10-6-1.js?v=compass-safe-severity-v4";''',
      "new inbox and original-source thumbnail modules")
    s=one(s,
      'inboxStyle.href="./src/qscope-passive-wind-inbox-v10-5.css?v=v10-5";',
      'inboxStyle.href="./src/qscope-reviewable-event-inbox-v10-6.css?v=v10-6-4-compass-safe-severity";',
      "preview-only CSS")
    s=one(s,
      '      onNavigate:navigateToPassiveResearchEvidence',
      '''      onNavigate:navigateToPassiveResearchEvidence,
      onNewEvent:pauseForGenuineNewResearchEvent''',
      "event queue pause handler")
    s=one(s,'const passiveResearchSeen=new Set();',
      '''let researchOperatorNavigationInProgress=false;
const passiveResearchSeen=new Set();
function pauseForGenuineNewResearchEvent(event,context) {
  // Historical replay and archived scans must not interrupt the operator.
  // The inbox triggers this only for a genuinely NEW pending event.
  if(!shouldPauseForNewResearchEvent({
    event,isResearch:isWindHookQaPreview && windHookResearchEnabled,
    isPlaying:playback.isPlaying(),isHidden:document.hidden,
    isNavigating:researchOperatorNavigationInProgress
  }))return;
  void playback.pause();
  setStatus("Experimental Q-SCOPE radar event awaiting review · playback paused by preference.","warning");
}
''',"one-shot recent event playback pause")
    s=one(s,
      '''      passiveRadarInbox?.observe(assessment.alerts,
        {mode:"rain",frameUtc:current.observedUtc});''',
      '''      // Retain only the original decoded observation, not the currently
      // displayed playback frame, terrain, basemap or synthetic interpolation.
      const observed=assessment.alerts.map(alert=>({
        ...alert,
        snapshot:captureResearchSourceThumbnail({
          alert,mode:"rain",frame:current,documentRef:document
        })
      }));
      passiveRadarInbox?.observe(observed,
        {mode:"rain",frameUtc:current.observedUtc});''',
      "genuine measured reflectivity snapshot")
    s=one(s,
      '''      passiveRadarInbox?.observe(result.alerts,
        {mode:"doppler",frameUtc:latest.observedUtc,radarId});''',
      '''      const observed=result.alerts.map(alert=>({
        ...alert,
        snapshot:captureResearchSourceThumbnail({
          alert,mode:"doppler",record:latest,documentRef:document
        })
      }));
      passiveRadarInbox?.observe(observed,
        {mode:"doppler",frameUtc:latest.observedUtc,radarId});''',
      "genuine native Doppler RGB screenshot")
    s=one(s,
      '''  await playback.pause();
  const desiredDoppler=evidence.mode==="doppler";
  try{''',
      '''  await playback.pause();
  const desiredDoppler=evidence.mode==="doppler";
  researchOperatorNavigationInProgress=true;
  try{''',
      "operator-only navigation scope")
    s=one(s,
      '''    return {ok:false,message:"Original frame unavailable: "+String(error?.message??error)+
      ". No substitute timestamp was selected."};
  }
}''',
      '''    return {ok:false,message:"Original frame unavailable: "+String(error?.message??error)+
      ". No substitute timestamp was selected. Review the retained source crop if available."};
  } finally {
    researchOperatorNavigationInProgress=false;
  }
}''',
      "release navigation scope on all results")
    s=one(s,
      '  if (resume) playback.play();\n}',
      '  if (resume && !researchOperatorNavigationInProgress) playback.play();\n}',
      "do not auto-resume while loading an event's Doppler evidence")
    s=one(s,
      '  if (resume) playback.play();\n  // Bound decoded imagery',
      '  if (resume && !researchOperatorNavigationInProgress) playback.play();\n  // Bound decoded imagery',
      "do not auto-resume while loading an event's rain evidence")
    s=one(s,
      '  : null;\n\n// Prevent an older asynchronous radar-image load',
      '''  : null;
// V10.6.1: responsive operator UI placement; no changes to the weather.
if (passiveRadarInbox) {
  const qscopeMap=$("mapPanel");
  attachQscopeResearchEventDock({
    map:qscopeMap,
    inbox:qscopeMap.querySelector(".qscope-wind-event-inbox"),
    details:qscopeMap.querySelector(".qscope-wind-event-detail"),
    documentRef:document,win:window
  });
}

// Prevent an older asynchronous radar-image load''',
      "research dock placement after inbox exists")
    a=one(a,"qscope-v10-6-persistent-evidence",
      "qscope-v10-6-5-restored-compass","browser iframe cache refresh")
    for forbidden in ["enableWindHookResearch", "windHookResearchQaControl",
                      "syncSevereStormAlerts(", "syncIndependentDopplerResearch("]:
        if forbidden in s:raise ValueError(f"Unwanted legacy research UI source: {forbidden}")
    a=a.replace("src=", "src=", 1)  # preserve all DOM routes unchanged
    index.write_text(a,encoding="utf-8")
    html.write_text(b,encoding="utf-8")
    runtime.write_text(s,encoding="utf-8")
    with (site/"BUILD.txt").open("a",encoding="utf-8") as handle:
        handle.write("Q-SCOPE PERSISTENT RESEARCH EVENTS V10.6 — TRUE-SOURCE CROP + OPT-IN SINGLE NEW-EVENT PAUSE + OPERATOR FRAME CONTROL; NO OPERATIONAL ALERTS\n")
        handle.write("Q-SCOPE V10.6.1 MAP LEGEND / ALERT COLLISION REPAIR — DYNAMIC RESPONSIVE OPERATOR-CLICKABLE INBOX; NO WEATHER OR DATA CHANGES\\n")

if __name__=="__main__":
    args=ArgumentParser()
    args.add_argument("--site",type=Path,required=True)
    main(args.parse_args().site)
