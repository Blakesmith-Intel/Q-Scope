#!/usr/bin/env python3
"""Minimal post-seal Q-SCOPE power-outage report UI patch.

Keep every existing approved map/radar/Doppler/warning control and the whole
power outage polling, ingestion and count pipeline unchanged. Replace only the
report-window manual refresh with a timer driven by the same layer schedule.
"""
from pathlib import Path

ROOT=Path("_site")
HTML=ROOT/"live3d-operational-v9.html"
SOURCE=Path("frontend/live3d-operational-v9.html")
old='<button id="refreshPowerOutageExplorer" type="button">Refresh</button>'
new='<output id="powerOutageExplorerCountdown" class="power-outage-refresh-countdown" role="timer" aria-label="Time until next automatic power outage check" aria-live="off">Next refresh in --:--</output>'
source=SOURCE.read_text(encoding="utf-8")
html=HTML.read_text(encoding="utf-8")
assert source.count(new)==1 and old not in source, "Approval source mismatch"
assert html.count(old)==1 and new not in html, "Generated pinned report changed"
for control in ('id="outageByProviderReport"','id="resetButton"',
                'id="showBomWindObservations"','id="bomWindGustReport"',
                'id="powerOutageExplorer"','id="sidebarPowerLastRefresh"'):
    assert html.count(control)==1, "Approved control missing: "+control
HTML.write_text(html.replace(old,new,1),encoding="utf-8")

# The sealed Pages build uses explicit module query cache identities. Bust ONLY
# the changed outage imports and shell; do not invalidate radar tiles/frames.
SUFFIX="-qscope-power-timer-20261112-v1"
changes={
  "index.html": ["live3d-operational-v9.html?v="],
  "live3d-operational-v9.html": [
    "src/live3d-operational-v9.js?v=",
    "power-outage-suburb-explorer-v1.css?v="],
  "src/live3d-operational-v9.js": ["power-outages-operational-v1.js?v="],
  "src/context-layers/power-outages-operational-v1.js":[
    "power-outages-v1.js?v=",
    "power-outage-suburb-explorer-v1.js?v="]
}
for relative,ids in changes.items():
    file=ROOT/relative
    data=file.read_text(encoding="utf-8")
    for needle in ids:
        assert data.count(needle)==1,(relative,needle,data.count(needle))
        data=data.replace(needle,needle+SUFFIX,1)
    file.write_text(data,encoding="utf-8")

module=ROOT/"src/context-layers/power-outage-suburb-explorer-v1.js"
poll=ROOT/"src/context-layers/power-outages-v1.js"
css=ROOT/"src/power-outage-suburb-explorer-v1.css"
assert "formatPowerOutageRefreshCountdown" in module.read_text()
assert "getNextRefreshAt()" in module.read_text()
assert "nextScheduledRefreshAt = Date.now() + refreshMs" in poll.read_text()
assert "power-outage-refresh-countdown" in css.read_text()
assert "15 * 60 * 1000" in poll.read_text()
assert "id=\"refreshPowerOutageExplorer\"" not in HTML.read_text()
with (ROOT/"BUILD.txt").open("a",encoding="utf-8") as file:
    file.write("Q-SCOPE POWER REPORT COUNTDOWN 20261112; unchanged 15m source polling and source EXTRACTED timestamps\n")
print("PASS power report countdown, active source clocks and complete original operator controls")
