#!/usr/bin/env python3
"""Apply Q-SCOPE V10.7 alert/legend collision fix to a SEPARATE QA preview.

Preserve the original site, source science, Cloudflare relay and all older
V10.3/V10.4/V10.5/V10.6 research previews byte-for-byte unchanged.
"""
from pathlib import Path
from argparse import ArgumentParser

def exact(source, old, new, label):
    count=source.count(old)
    if count != 1:
        raise ValueError(f"{label}: expected one exact anchor, got {count}")
    return source.replace(old,new,1)

def main(site):
    if site.name!="wind-hook-v10-7" or site.parent.name!="preview":
        raise ValueError("Layout patch may only touch preview/wind-hook-v10-7.")
    index=site/"index.html"
    html=site/"live3d-operational-v9.html"
    runtime=site/"src/live3d-operational-v9.js"
    a=index.read_text(encoding="utf-8")
    b=html.read_text(encoding="utf-8")
    s=runtime.read_text(encoding="utf-8")
    a=exact(a,
      "<title>Q-SCOPE | Persistent Wind & Hook Event Research V10.6</title>",
      "<title>Q-SCOPE | Radar Events Layout Research V10.7</title>",
      "browser title")
    a=exact(a,"qscope-v10-6-persistent-evidence",
      "qscope-v10-7-event-dock-fix","fresh preview iframe")
    b=exact(b,"<title>Q-SCOPE | Persistent Radar Evidence V10.6</title>",
      "<title>Q-SCOPE | Collision-Free Radar Events V10.7</title>",
      "map scene identity")
    b=exact(b,"PERSISTENT WIND EVENTS · EXPERIMENTAL, NOT OFFICIAL WARNINGS",
      "PERSISTENT WIND EVENTS · CLEAR LEGEND LAYOUT · RESEARCH",
      "research sidebar heading")
    if s.count("/preview/wind-hook-v10-6/")!=2:
        raise ValueError("Preview path guard has changed; abort rather than rewriting operational paths.")
    s=s.replace("/preview/wind-hook-v10-6/","/preview/wind-hook-v10-7/")
    s=exact(s,
      'import { shouldPauseForNewResearchEvent } from "./qscope-intelligent-pause-v10-6.js";',
      '''import { shouldPauseForNewResearchEvent } from "./qscope-intelligent-pause-v10-6.js";
import { attachQScopeRadarEventLayout } from "./qscope-event-dock-layout-v10-7.js";''',
      "source-true layout-only import")
    s=exact(s,
      '  document.head.appendChild(inboxStyle);',
      '''  document.head.appendChild(inboxStyle);
  const layoutStyle=document.createElement("link");
  layoutStyle.rel="stylesheet";
  layoutStyle.href="./src/qscope-event-dock-layout-v10-7.css?v=research-layout";
  document.head.appendChild(layoutStyle);''',
      "additional QA-only layout style")
    s=exact(s,
      '''      onNewEvent:pauseForGenuineNewResearchEvent
    })
  : null;''',
      '''      onNewEvent:pauseForGenuineNewResearchEvent
    })
  : null;
// Run once after the inbox DOM exists. Observe both panels and the original
// BoM legend; this is positioning only and never reaches storm science.
const qscopeEventDockLayout=isWindHookQaPreview
  ? attachQScopeRadarEventLayout({mapPanel:$("mapPanel")})
  : null;''',
      "responsive map dock after persistent inbox construction")
    for forbidden in ("enableWindHookResearch",
                      "windHookResearchQaControl",
                      "syncSevereStormAlerts(",
                      "syncIndependentDopplerResearch("):
        if forbidden in s:
            raise ValueError(f"Legacy transient alert resurfaced: {forbidden}")
    a.encode("utf-8")
    index.write_text(a,encoding="utf-8")
    html.write_text(b,encoding="utf-8")
    runtime.write_text(s,encoding="utf-8")
    with (site/"BUILD.txt").open("a",encoding="utf-8") as out:
        out.write("Q-SCOPE V10.7 NON-OVERLAP ALERT DOCK — BoM LEGEND AND PERSISTENT RESEARCH EVENTS IN DISTINCT SLOTS; HIGHER CONTROL STACK; SOURCE AND SCIENCE FROZEN\n")

if __name__=="__main__":
    parser=ArgumentParser()
    parser.add_argument("--site",required=True,type=Path)
    main(parser.parse_args().site)
