#!/usr/bin/env python3
"""Patch only rainfall rollover in the final pinned production package."""
from pathlib import Path
from shutil import copy2
import subprocess
root=Path("_site")
def once(path,old,new):
    content=path.read_text(encoding="utf-8")
    assert content.count(old)==1, (str(path),old[:100])
    path.write_text(content.replace(old,new,1),encoding="utf-8")
layer=root/"src/context-layers/significant-rainfall-operational-v1.js"
# Preserve forecast district / SES / export overlays.
pairs=[
  [
    "import {qualifiesAepRainfallSnapshot,rainfallBand} from \"./significant-rainfall-source-v1.js?v=aest-9am-rollover-20261020\";",
    "import {qualifiesAepRainfallSnapshot,rainfallBand,rainfallReportingStart,validatedRainfallPayload} from \"./significant-rainfall-source-v1.js?v=20261126-rollover-v1\";"
  ],
  [
    "let source=null,visibleRows=[],period=\"since9am\",started=false;",
    "let source=null,visibleRows=[],period=\"since9am\",started=false;\n let rolloverTimer=null;\n function scheduleRollover(){\n  if(rolloverTimer!==null)clearTimeout(rolloverTimer);\n  const at=now();\n  rolloverTimer=setTimeout(()=>{\n   if(period===\"since9am\"&&(collection.show||reportDialog?.open))render();\n   scheduleRollover();\n  },Math.max(1,rainfallReportingStart(at)+86400000-at));\n }"
  ],
  [
    "if(!reportDialog.open)reportDialog.showModal();\n  renderReport();",
    "if(!reportDialog.open)reportDialog.showModal();\n  render();"
  ],
  [
    "if(waiting)return waiting;\n  say(\"Checking BoM significant rainfall…\");",
    "if(period===\"since9am\"&&visibleRows.some(r=>!qualifiesAepRainfallSnapshot(r,period,now())))render();\n  if(waiting)return waiting;\n  say(\"Checking BoM significant rainfall…\");"
  ],
  [
    "source=incoming;lastLoadedAt=now();lastError=null;",
    "source=validatedRainfallPayload(incoming,source);lastLoadedAt=now();lastError=null;"
  ],
  [
    "source=null;render();\n   }",
    "source=null;render();\n   }else if(period===\"since9am\")render();"
  ],
  [
    "timer=setInterval(()=>{",
    "scheduleRollover();\n  timer=setInterval(()=>{"
  ],
  [
    "if(timer!==null)clearInterval(timer);timer=null;",
    "if(timer!==null)clearInterval(timer);timer=null;\n  if(rolloverTimer!==null)clearTimeout(rolloverTimer);rolloverTimer=null;"
  ]
]
for old,new in pairs:
    once(layer,old,new)
copy2("frontend/src/context-layers/significant-rainfall-source-v1.js",root/"src/context-layers/significant-rainfall-source-v1.js")
for rel,anchor in (
    ("index.html","live3d-operational-v9.html?v="),
    ("live3d-operational-v9.html","src/live3d-operational-v9.js?v="),
    ("src/live3d-operational-v9.js","significant-rainfall-operational-v1.js?v="),
):
    once(root/rel,anchor,anchor+"20261126-rainfall-rollover-v1-")
for path in (layer,root/"src/context-layers/significant-rainfall-source-v1.js"):
    subprocess.run(["node","--check",str(path)],check=True)
with (root/"BUILD.txt").open("a",encoding="utf-8") as f:
    f.write("\nQ-SCOPE RAINFALL ROLLOVER 2026-11-26: same-edition hourly consistency, 09:00 AEST expiry, no extra source polling.\n")
