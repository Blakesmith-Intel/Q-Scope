#!/usr/bin/env bash
set -euo pipefail

# Run only AFTER the accepted production FTP/AEP overlay AND the immutable
# radar restore. Never rebuild historical QA snapshots or duplicate radar
# patching. Pure final-stage UI + 7 genuine BoM frames for approved ROOT.
# Approved UI-only quiet refresh / premium identity and seven genuine BoM scans.
# Applied AFTER all previously sealed radar/warning/wind/flood/incident overlays.
# Never alter underlying refresh cadence or official source retrieval.
python3 scripts/apply-qscope-quiet-ui-v1.py
python3 scripts/apply-qscope-seven-published-radar-frames-v1.py
node --check _site/src/qscope-quiet-refresh-clocks-v1.js
node --check _site/src/context-layers/bom-warning-operational-v1.js
node --check _site/src/context-layers/river-gauge-layer-v1.js
node --check _site/src/context-layers/flood-road-closures-v1.js
node --check _site/src/context-layers/significant-rainfall-operational-v1.js
node --check _site/src/context-layers/qscope-bom-wind-observations-operational-v1.js
node --check _site/src/context-layers/qfd-technical-rescues-operational-v1.js
node --check _site/src/live-loop-refresh-v1.js
node --check _site/src/live3d-operational-v9.js
node --check _site/src/radar-history-window-v1.js
node --check _site/src/operational-loop-v1.js
node --check _site/src/bom-wmts-loop-v2.js
test "$(find _site/preview -mindepth 1 -maxdepth 1 -type d | wc -l)" -eq 6
grep -Fq 'Q-SCOPE QUIET SOURCE-SCHEDULED COUNTDOWNS' _site/BUILD.txt
grep -Fq 'Q-SCOPE RAIN RADAR 30 MIN EXACT SEVEN' _site/BUILD.txt
grep -Fq 'id="qscopeRadarCountdown"' _site/live3d-operational-v9.html
grep -Fq 'qscope-seal' _site/live3d-operational-v9.html
grep -Fq 'id="sidebarToggle"' _site/live3d-operational-v9.html
grep -Fq 'id="showOfficialBomWarnings"' _site/live3d-operational-v9.html
grep -Fq 'id="showBomWindObservations"' _site/live3d-operational-v9.html
grep -Fq 'qscopeOperationalWindEvents.queueWindow(mode,frames.length)' _site/src/live3d-operational-v9.js

