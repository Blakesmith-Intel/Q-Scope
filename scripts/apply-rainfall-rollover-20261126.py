#!/usr/bin/env python3
"""Verify the existing rollover implementation after the pinned report overlays."""
from pathlib import Path
import subprocess
root=Path("_site")
def once(path,old,new):
    content=path.read_text(encoding="utf-8")
    assert content.count(old)==1, (str(path),old[:100])
    path.write_text(content.replace(old,new,1),encoding="utf-8")
layer=root/"src/context-layers/significant-rainfall-operational-v1.js"
source=root/"src/context-layers/significant-rainfall-source-v1.js"
# apply-ftp-aep-release-v10.py already copies the current rainfall modules.
# Do not replay the same source edits or destroy district/SES/quiet overlays.
for marker in ("validatedRainfallPayload(incoming,source)", "scheduleRollover();",
               "if(rolloverTimer!==null)clearTimeout(rolloverTimer);",
               "20261126-rollover-v1"):
    assert marker in layer.read_text(encoding="utf-8"), marker
assert source.read_bytes()==Path("frontend/src/context-layers/significant-rainfall-source-v1.js").read_bytes()
# Opening a report revalidates the visible snapshot after all region controls
# have been mounted; keep the historical packaging anchors until this stage.
once(layer,"updateReportRegionControls();\n  renderReport();","updateReportRegionControls();\n  render();")
for rel,anchor in (
    ("index.html","live3d-operational-v9.html?v="),
    ("live3d-operational-v9.html","src/live3d-operational-v9.js?v="),
    ("src/live3d-operational-v9.js","significant-rainfall-operational-v1.js?v="),
):
    once(root/rel,anchor,anchor+"20261126-rainfall-rollover-v2-")
for path in (layer,source):
    subprocess.run(["node","--check",str(path)],check=True)
with (root/"BUILD.txt").open("a",encoding="utf-8") as f:
    f.write("\nQ-SCOPE RAINFALL ROLLOVER 2026-11-26: same-edition hourly consistency, 09:00 AEST expiry, no extra source polling.\n")
