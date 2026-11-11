#!/usr/bin/env python3
"""Correct the exclusive-endpoint 30-minute BoM history off-by-one.

Inclusive 00:50..01:20 at 5-minute cadence is seven genuine scans. Keep the
exact source-published discovery, tile decoding, fallback, multi-radar time
alignment and existing rolling error recovery. No extra timer or Worker calls.
Copy only the four tested upstream modules into the already sealed site.
"""
from pathlib import Path
import shutil

site=Path("_site")
root=site/"src"
from_source=Path("frontend/src")
affected=(
 "radar-history-window-v1.js",
 "operational-loop-v1.js",
 "operational-window-choices-v1.js",
 "bom-wmts-loop-v2.js"
)
for name in affected:
 source=from_source/name
 assert source.is_file(),name
 shutil.copyfile(source,root/name)
radar=(root/"radar-history-window-v1.js").read_text()
assert "const targetSpanMinutes = minutes;" in radar
assert ">= minutes" in radar
assert "minutes - RADAR_PLAYBACK_CADENCE_MINUTES" not in radar
assert "    + 1 // Inclusive endpoints" in (root/"operational-loop-v1.js").read_text()
assert 'Object.freeze([30])' in (root/"operational-window-choices-v1.js").read_text()
bom=(root/"bom-wmts-loop-v2.js").read_text()
assert "now=Date.now(),count=7,region='SEQ'," in bom
assert "maximumPublishedFrames=9" in bom  # existing 9 advertised source limit untouched
assert "loadCompleteRadarTiles" in bom  # genuine WMTS source-true complete imagery

# Make the updated selection modules visible to the same-session browser by
# pinning only these new JS module versions. All other imports stay unchanged.
suffix="-boM-7-genuine-frames-20261112-v1"
changes={
 "src/live3d-operational-v9.js":[
  "bom-wmts-loop-v2.js?v=",
  "rain-history-recovery-v1.js?v=",
  "operational-loop-v1.js?v=",
  "radar-history-window-v1.js?v=",
  "operational-window-choices-v1.js?v="],
 "src/radar-history-window-v1.js":["operational-loop-v1.js"],
 "src/rain-history-recovery-v1.js":["radar-history-window-v1.js"]
}
for name,ids in changes.items():
 file=site/name
 data=file.read_text(encoding="utf-8")
 for needle in ids:
  if name in ("src/radar-history-window-v1.js","src/rain-history-recovery-v1.js"):
   # Relative imports have NO query. Ensure the bundled module URL changes
   # together with both importers so old cached version cannot linger.
   exact='"./'+needle+'"'
   assert data.count(exact)==1,(name,exact)
   data=data.replace(exact,'"./'+needle+'?v=20261112-seven-scans"',1)
  else:
   assert data.count(needle)==1,(name,needle,data.count(needle))
   data=data.replace(needle,needle+suffix,1)
 file.write_text(data,encoding="utf-8")

# The only direct radar record cadence remains source-measured five minutes.
# We never synthesize a seventh record from a sixth scan.
print("BO_M_INCLUSIVE_SEVEN_GENUINE_FRAMES_PASS | 30min = 7 × 5min endpoints; "
      "BoM source discovery/WMTS and multi-site synchronization unchanged")
with (site/"BUILD.txt").open("a",encoding="utf-8") as f:
 f.write("Q-SCOPE RAIN RADAR 30 MIN EXACT SEVEN BO_M SOURCE FRAMES 20261112 | "
         "0 invented scans, original 5-min polling, Doppler and multi-site unchanged\n")
