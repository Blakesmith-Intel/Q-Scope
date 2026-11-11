#!/usr/bin/env python3
"""Review-only PR329 preview packaging, never changes the approved site root."""
from pathlib import Path
import subprocess

subprocess.run(["python3","scripts/prepare-qscope-wind-qa-preview-v1.py"],check=True)
folder=Path("_wind_preview_assets")
wind="https://qscope-wind-pr328-stormtracker-bom-relay.stormtracker-bom-relay.workers.dev"
power="https://qscope-power-pr329-stormtracker-bom-relay.stormtracker-bom-relay.workers.dev"
changed=0
for file in folder.rglob("*"):
    if not file.is_file() or file.suffix not in {".html",".js",".css"}:
        continue
    body=file.read_text(encoding="utf-8")
    if wind in body:
        body=body.replace(wind,power)
        changed+=1
    if file==folder/"index.html":
        body=body.replace("Q-SCOPE WIND QA PREVIEW", "Q-SCOPE POWER REPORT QA PREVIEW")
    file.write_text(body,encoding="utf-8")
assert changed>=3, "QA source references must route only to independent preview"
report=(folder/"live3d-operational-v9.html").read_text(encoding="utf-8")
assert report.count('id="powerOutageExplorerCountdown"')==1
assert 'id="refreshPowerOutageExplorer"' not in report
assert 'id="showBomWindObservations"' in report
layer=(folder/"src/context-layers/power-outages-v1.js").read_text(encoding="utf-8")
assert "nextScheduledRefreshAt = Date.now() + refreshMs" in layer
assert "15 * 60 * 1000" in layer
controller=(folder/"src/context-layers/power-outage-suburb-explorer-v1.js").read_text(encoding="utf-8")
assert "formatPowerOutageRefreshCountdown" in controller
assert "Latest record" in controller
with (folder/"BUILD.txt").open("a",encoding="utf-8") as f:
    f.write("Q-SCOPE POWER OUTAGE REPORT PR329 OPERATOR PREVIEW, unchanged live production and original provider fetches\n")
print("Q-SCOPE POWER REPORT PR329 PREVIEW PACKAGE PASS",changed,"isolated relay references")
