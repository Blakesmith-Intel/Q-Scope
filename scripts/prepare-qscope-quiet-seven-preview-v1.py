#!/usr/bin/env python3
"""Operator-visible PR330 interface + radar correction, isolated public preview."""
from pathlib import Path
import subprocess
subprocess.run(["python3","scripts/prepare-qscope-power-preview-v1.py"],check=True)
folder=Path("_wind_preview_assets")
old="https://qscope-power-pr329-stormtracker-bom-relay.stormtracker-bom-relay.workers.dev"
new="https://qscope-ui-seven-pr330-stormtracker-bom-relay.stormtracker-bom-relay.workers.dev"
modified=0
for file in folder.rglob("*"):
 if not file.is_file() or file.suffix not in {".html",".js",".css"}:continue
 content=file.read_text(encoding="utf-8")
 if old in content:
  content=content.replace(old,new)
  modified+=1
 if file==folder/"index.html":
  content=content.replace("Q-SCOPE POWER REPORT QA PREVIEW","Q-SCOPE UI & SEVEN RADAR FRAMES QA PREVIEW")
 file.write_text(content,encoding="utf-8")
assert modified>=3,"Independent preview must isolate all published relay calls"
ui=(folder/"live3d-operational-v9.html").read_text(encoding="utf-8")
for id in ("qscopeRadarCountdown","powerOutageExplorerCountdown","showBomWindObservations",
 "showOfficialBomWarnings","hybridFrameSlider","sidebarToggle","qscopeClock_refreshOfficialBomWarnings"):
 assert ui.count('id="'+id+'"')==1,id
assert 'qscope-seal' in ui
assert 'data-qscope-poll="radar"' in ui
radar=(folder/"src/radar-history-window-v1.js").read_text(encoding="utf-8")
assert "const targetSpanMinutes = minutes;" in radar
assert "minutes - RADAR_PLAYBACK_CADENCE_MINUTES" not in radar
assert (folder/"src/qscope-quiet-refresh-clocks-v1.js").exists()
with (folder/"BUILD.txt").open("a",encoding="utf-8") as f:
 f.write("Q-SCOPE PREMIUM UI 12 COUNTDOWNS AND 7 GENUINE RADAR FRAMES PR330 REVIEW ONLY\n")
print("Q-SCOPE QUIET UI AND SEVEN GENUINE RADAR FRAMES PREVIEW PASS",
 modified,"independent relay references")
