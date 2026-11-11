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

# The production restore has accumulated historical import query identities.
# For the inclusive seven-scan selector, use ONE unambiguous new module path,
# not an old source filename with yet another cache query suffix. This avoids
# serving the archived six-scan selector to an existing mobile browser.
# Both the original and new modules contain the SAME verified official data
# policy; neither changes BoM retrieval, textures, Doppler or playback cadence.
import re
model_source=(root/"radar-history-window-v1.js").read_text(encoding="utf-8")
rain_source=(root/"rain-history-recovery-v1.js").read_text(encoding="utf-8")
assert model_source.count("const targetSpanMinutes = minutes;")==1
assert "minutes - RADAR_PLAYBACK_CADENCE_MINUTES" not in model_source
unique_model="radar-history-window-seven-genuine-v1.js"
unique_rain="rain-history-recovery-seven-genuine-v1.js"
(root/unique_model).write_text(model_source,encoding="utf-8")
old_dep='./radar-history-window-v1.js?v=20261112-seven-scans'
assert rain_source.count(old_dep)==1
rain_source=rain_source.replace(old_dep,'./'+unique_model,1)
(root/unique_rain).write_text(rain_source,encoding="utf-8")
app=site/"src/live3d-operational-v9.js"
app_source=app.read_text(encoding="utf-8")
for old,new in (
    ("radar-history-window-v1.js",unique_model),
    ("rain-history-recovery-v1.js",unique_rain)
):
    pattern=r'(?<=\./)'+re.escape(old)+r'\?v=[^"]+'
    app_source,number=re.subn(pattern,new+"?v=20261112-seven-genuine-unique-v1",
                               app_source,count=1)
    assert number==1,"Missing exactly one runtime seven-scan import: "+old
# One read-only acceptance trace: compare genuine requested UTCs with accepted
# actual pixels and committed playback. No extra Worker requests or timers.
request_needle='  const requestedInferred = requestedPlan.filter(entry => entry.kind === "inferred").length;'
assert app_source.count(request_needle)==1
app_source=app_source.replace(request_needle,request_needle+'''
  console.log("QSCOPE_RADAR_DOM "+JSON.stringify({
    stage:"source-to-request",selection:loopSelection,
    advertised:availableRadarHistoryTimes.length,requested:times.length,
    requestedUtc:times,partial:rainHistoryIncomplete
  }));''',1)
loaded_needle='  if (!displayFrames.length) {'
assert app_source.count(loaded_needle)==1
app_source=app_source.replace(loaded_needle,'''
  console.log("QSCOPE_RADAR_DOM "+JSON.stringify({
    stage:"verified-to-display",selection:loopSelection,
    accepted:frames.length,displayFrames:displayFrames.length,
    acceptedUtc:frames.map(f=>f.observedUtc),
    failures:failureDiagnostics
  }));
'''+loaded_needle,1)
app.write_text(app_source,encoding="utf-8")
assert unique_model in app_source and unique_rain in app_source
assert "const targetSpanMinutes = minutes;" in (root/unique_model).read_text()
assert "selectRadarHistoryPlan" in (root/unique_rain).read_text()

# CRITICAL: Q-SCOPE's iframe and ES-module URLs retain long historical cache
# identities. Rotating only the imported selector path does not invalidate
# a browser/CDN-cached copy of the PARENT module or page. Guarantee the
# corrected selector imports are actually executed, not merely uploaded.
entry_revision="20261112-seven-inclusive-actual-playback-v2-"
for relative,needle in (
    ("live3d-operational-v9.html","src/live3d-operational-v9.js?v="),
    ("index.html","live3d-operational-v9.html?v=")
):
    file=site/relative
    body=file.read_text(encoding="utf-8")
    assert body.count(needle)==1,"Ambiguous final radar entrypoint: "+relative
    body=body.replace(needle,needle+entry_revision,1)
    file.write_text(body,encoding="utf-8")
assert entry_revision in (site/"index.html").read_text()
assert entry_revision in (site/"live3d-operational-v9.html").read_text()

# The only direct radar record cadence remains source-measured five minutes.
# We never synthesize a seventh record from a sixth scan.
print("BO_M_INCLUSIVE_SEVEN_GENUINE_FRAMES_PASS | 30min = 7 × 5min endpoints; "
      "BoM source discovery/WMTS and multi-site synchronization unchanged")
with (site/"BUILD.txt").open("a",encoding="utf-8") as f:
 f.write("Q-SCOPE RAIN RADAR 30 MIN EXACT SEVEN BO_M SOURCE FRAMES 20261112 | "
         "0 invented scans, original 5-min polling, Doppler and multi-site unchanged\n")
