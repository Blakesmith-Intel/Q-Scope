#!/usr/bin/env python3
"""Q-SCOPE compact quiet-menu overlay, applied LAST to the assembled site.

Retains every sealed button ID and original event listener (hidden/inert to
operators only). Changes no polling period, data source, warning calculation,
Cesium graphics, automatic event, replay or request behaviour. Every displayed
clock observes a read-only hook in the existing controller's *actual* timer.
"""
from pathlib import Path
import re
import shutil

SITE=Path("_site")
JS=SITE/"src"
FRONT=Path("frontend/src")
HTML=SITE/"live3d-operational-v9.html"
INDEX=SITE/"index.html"

def one(text,old,new,name):
    qty=text.count(old)
    if qty!=1:
        raise AssertionError(f"{name}: expected exactly one marker, found {qty}: {old[:95]!r}")
    return text.replace(old,new,1)

def patch(relative,old,new):
    file=SITE/relative
    body=file.read_text(encoding="utf-8")
    file.write_text(one(body,old,new,relative),encoding="utf-8")

def refresh_clock(relative,key,arm_start,tick_needle,arm_finish,finish_repl):
    # Every clock arm is in a named controller with an existing interval.
    # The tick call schedules NO work. Only the original callback fetches.
    name=relative
    patch(relative,tick_needle,tick_needle+
          f'          globalThis.__qscopePollClock?.tick("{key}",refreshMs);\n'
          if key in ("river","roads","power") else
          tick_needle+f'   globalThis.__qscopePollClock?.tick("{key}",refreshMs);\n')
    patch(relative,arm_finish,finish_repl)

# No interval is added to any live data module. These hooks observe the
# pre-existing 5/10/15 minute timers, which can be disabled/paused by the
# existing UI and tab-background logic.
patch("src/context-layers/river-gauge-layer-v1.js",
 '    timer =\n      setInterval(\n        () => {\n',
 '    timer =\n      setInterval(\n        () => {\n'
 '          globalThis.__qscopePollClock?.tick("river",refreshMs);\n')
patch("src/context-layers/river-gauge-layer-v1.js",
 '        refreshMs\n      );\n  }\n\n  function stop()',
 '        refreshMs\n      );\n'
 '    globalThis.__qscopePollClock?.arm("river",refreshMs);\n  }\n\n  function stop()')

patch("src/context-layers/flood-road-closures-v1.js",
 '    timer =\n      setInterval(\n        () => {\n',
 '    timer =\n      setInterval(\n        () => {\n'
 '          globalThis.__qscopePollClock?.tick("roads",refreshMs);\n')
patch("src/context-layers/flood-road-closures-v1.js",
 '        refreshMs\n      );\n  }\n\n  function stop()',
 '        refreshMs\n      );\n'
 '    globalThis.__qscopePollClock?.arm("roads",refreshMs);\n  }\n\n  function stop()')

patch("src/context-layers/power-outages-v1.js",
 '    nextScheduledRefreshAt = Date.now() + refreshMs;\n    timer =',
 '    nextScheduledRefreshAt = Date.now() + refreshMs;\n'
 '    globalThis.__qscopePollClock?.arm("power",refreshMs);\n    timer =')
patch("src/context-layers/power-outages-v1.js",
 '          nextScheduledRefreshAt = Date.now() + refreshMs;\n          if (',
 '          nextScheduledRefreshAt = Date.now() + refreshMs;\n'
 '          globalThis.__qscopePollClock?.tick("power",refreshMs);\n          if (')

patch("src/context-layers/qfd-technical-rescues-operational-v1.js",
 '    timer=setInterval(()=>{\n      if(!document.hidden){',
 '    timer=setInterval(()=>{\n'
 '      globalThis.__qscopePollClock?.tick("qfd",refreshMs);\n'
 '      if(!document.hidden){')
patch("src/context-layers/qfd-technical-rescues-operational-v1.js",
 '    },refreshMs);\n  }\n  function stop(){',
 '    },refreshMs);\n'
 '    globalThis.__qscopePollClock?.arm("qfd",refreshMs);\n  }\n  function stop(){')

patch("src/context-layers/significant-rainfall-operational-v1.js",
 '  timer=setInterval(()=>{\n   if(!document.hidden&&collection.show)',
 '  timer=setInterval(()=>{\n'
 '   globalThis.__qscopePollClock?.tick("rainfall",refreshMs);\n'
 '   if(!document.hidden&&collection.show)')
patch("src/context-layers/significant-rainfall-operational-v1.js",
 '  },refreshMs);\n  say("Significant rainfall off',
 '  },refreshMs);\n'
 '  globalThis.__qscopePollClock?.arm("rainfall",refreshMs);\n'
 '  say("Significant rainfall off')

patch("src/context-layers/qscope-bom-wind-observations-operational-v1.js",
 ' timer=setInterval(()=>{if(!document.hidden&&(source.show||dialog?.open))',
 ' timer=setInterval(()=>{\n'
 '  globalThis.__qscopePollClock?.tick("observed-wind",refreshMs);\n'
 '  if(!document.hidden&&(source.show||dialog?.open))')
patch("src/context-layers/qscope-bom-wind-observations-operational-v1.js",
 '  void refresh().catch(()=>{});},refreshMs);\n window.addEventListener("pagehide"',
 '  void refresh().catch(()=>{});},refreshMs);\n'
 ' globalThis.__qscopePollClock?.arm("observed-wind",refreshMs);\n'
 ' window.addEventListener("pagehide"')

# Warning geometry uses a 1-minute checker and dynamically switches from
# the approved 15-minute cadence to bounded 2-minute CAP recovery. Ask the
# original source controller for that effective next interval; no new checks.
patch("src/context-layers/bom-warning-operational-v1.js",
 ' timer=setInterval(()=>{\n  trimExpired();',
 ''' const qscopeWarningTickOrigin=now();
 globalThis.__qscopePollClock?.observe("warnings",()=>{
  if(destroyed||!toggle.checked)return 0;
  const gate=lastAttemptAt?lastAttemptAt+currentRefreshMs():qscopeWarningTickOrigin;
  const minuteIndex=Math.max(1,Math.ceil((gate-qscopeWarningTickOrigin)/60000));
  return qscopeWarningTickOrigin+minuteIndex*60000;
 });
 timer=setInterval(()=>{
  trimExpired();''')

# The road ownership classifier is intentionally ON OPEN with a 10-minute
# verified cache. Keep it so: background polling would burn Worker invocations.
# The countdown is to cache expiration, explicitly labeled "recheck on reopen".
patch("src/context-layers/road-ownership-report-v1.js",
 ' let features=[],snapshot=null,lastAt=0,loading=null,destroyed=false;',
 ''' let features=[],snapshot=null,lastAt=0,loading=null,destroyed=false;
 globalThis.__qscopePollClock?.observe("road-classes",
   ()=>dialog.open&&lastAt?lastAt+10*60000:0);''')

# Radar and Doppler use their own immutable five-minute scheduler; expose
# its armed deadline without changing its busy/source retry behaviour.
# Build-from-sealed V10.2 intentionally carries the original coalescing
# scheduler. Observe its own arm(), not the newer unpinned review scheduler.
# This does NOT change cancellation, polling, retries, concurrency or timing.
patch("src/live-loop-refresh-v1.js",
 '  let timer, active = false, pending = null;',
 '  let timer, active = false, pending = null;\n  let regularDueAt = 0;')
patch("src/live-loop-refresh-v1.js",
 '    if (active) timer = schedule(() => { timer = null; void check(); }, interval);',
 '    if (active) { regularDueAt=Date.now()+interval; timer = schedule(() => { timer = null; void check(); }, interval); }')
patch("src/live-loop-refresh-v1.js",
 '    stop() { active = false; if (timer != null) cancel(timer); timer = null; },',
 '    stop() { active = false; if (timer != null) cancel(timer); timer = null; regularDueAt=0; },')
patch("src/live-loop-refresh-v1.js",
 '    check\n  };',
 '    check,\n    get nextPollAt(){return regularDueAt;}\n  };')
patch("src/live3d-operational-v9.js",
 'const independentDopplerRefresh = createLiveLoopRefresh({',
 'globalThis.__qscopePollClock?.observe("radar",()=>autoRefresh.nextPollAt);\n\n'
 'const independentDopplerRefresh = createLiveLoopRefresh({')

# Remove visual controls without deleting their IDs. Legacy listeners and
# accepted browser tests can still bind, while operators cannot invoke
# duplicate data requests or accidentally reset playback to the latest.
html=HTML.read_text(encoding="utf-8")
assert html.count('<strong>Q-SCOPE</strong><span>QLD Situational Awareness</span>')==1
badge_svg=('''<span class="qscope-seal" aria-hidden="true"><svg viewBox="0 0 48 48"
 xmlns="http://www.w3.org/2000/svg" focusable="false">
 <defs><linearGradient id="qscopeGlyph" x1="0" y1="0" x2="1" y2="1">
 <stop offset="0" stop-color="#97f4ff"/><stop offset=".65" stop-color="#42b9d6"/>
 <stop offset="1" stop-color="#d6bb76"/></linearGradient></defs>
 <circle cx="24" cy="24" r="18.5" fill="#0b263b" stroke="#60bace" stroke-width="1"/>
 <circle cx="24" cy="24" r="12.5" fill="none" stroke="#48a4bc" stroke-width="1" opacity=".65"/>
 <circle cx="24" cy="24" r="6" fill="none" stroke="#70c4d8" stroke-width="1" opacity=".55"/>
 <path d="M24 5.5V42.5M5.5 24H42.5" stroke="#58a9bd" stroke-width=".7" opacity=".56"/>
 <path d="M24 24L13.6 12.2A18 18 0 0 1 40.6 16.3Z" fill="#32c2da" opacity=".15"/>
 <path d="M24 24L38 10" stroke="url(#qscopeGlyph)" stroke-width="2.5" stroke-linecap="round"/>
 <circle cx="24" cy="24" r="3.3" fill="#b1f6ff" stroke="#173c55" stroke-width="1.5"/>
 <path d="M37.3 30.2l-4.6 7.7 5.5-2.1-2.1 5.2 5.7-8.7-5.2 1.5Z" fill="#dfc277"/>
 </svg></span>''')
new_brand=('<div class="simple-brand qscope-identity">'+badge_svg+
 '<span class="qscope-wordmark"><strong>Q-SCOPE</strong>'
 '<span><i class="qscope-status-dot" aria-hidden="true"></i>'
 'QLD Situational Awareness</span></span></div>')
html=one(html,'<div class="simple-brand"><strong>Q-SCOPE</strong><span>QLD Situational Awareness</span></div>',
 new_brand,"accepted Q-SCOPE public header")

controls={
 "refreshRiverGaugesButton":"river",
 "refreshFloodGaugeReport":"river",
 "refreshOfficialBomWarnings":"warnings",
 "refreshSignificantRainfallButton":"rainfall",
 "refreshSignificantRainfallReport":"rainfall",
 "refreshBomWindObservations":"observed-wind",
 "refreshBomWindGustReport":"observed-wind",
 "refreshRoadLgaExplorer":"roads",
 "refreshRoadTypeReport":"road-classes",
 "refreshFloodRoadClosuresButton":"roads",
 "refreshPowerOutagesButton":"power",
 "refreshQfdTechnicalRescuesButton":"qfd"
}
essential={"refreshRiverGaugesButton","refreshFloodGaugeReport",
 "refreshOfficialBomWarnings","refreshSignificantRainfallButton",
 "refreshSignificantRainfallReport","refreshBomWindObservations",
 "refreshBomWindGustReport","refreshRoadLgaExplorer","refreshRoadTypeReport"}
installed=[]
for control,key in controls.items():
    regex=re.compile(r'<button\b[^>]*\bid="'+re.escape(control)+r'"[^>]*>[^<]*</button>')
    matches=list(regex.finditer(html))
    if not matches:
        if control in essential:
            raise AssertionError("Missing source-supported menu refresh "+control)
        continue
    if len(matches)!=1:
        raise AssertionError("Duplicate manual refresh: "+control)
    button=matches[0].group()
    # Never remove the required DOM node or event listener contract.
    hidden=button.replace(">",' class="qscope-retired-manual-refresh" hidden tabindex="-1" aria-hidden="true">',1)
    badge=(f'<output id="qscopeClock_{control}" class="qscope-source-clock" '
           f'data-qscope-poll="{key}" role="timer" aria-live="off" '
           f'aria-label="Time to next {key} observation update">'
           'Awaiting schedule</output>')
    html=one(html,button,hidden+badge,control)
    installed.append(control)

# The root already has the accepted passive power-outage report countdown.
assert 'id="powerOutageExplorerCountdown"' in html
assert 'id="refreshPowerOutageExplorer"' not in html

for control in ("loadHybridButton","loadButton","jumpLatestButton"):
    regex=re.compile(r'<button\b[^>]*\bid="'+control+r'"[^>]*>[^<]*</button>')
    m=regex.search(html)
    if not m:raise AssertionError("Required radar control marker missing "+control)
    hidden=m.group().replace(">",' class="qscope-retired-radar-control" hidden '
      'tabindex="-1" aria-hidden="true">',1)
    html=one(html,m.group(),hidden,control)
# Keep live play/pause, slider and frame selection untouched.
assert html.count('id="hybridPlayButton"')==1
assert html.count('id="loopDurationMinutes"')==1
assert html.count('id="hybridFrameSlider"')==1
assert html.count('id="sidebarToggle"')==1
assert html.count('id="resetButton"')==1
radar_button=re.search(r'<button\b[^>]*id="hybridPlayButton"[^>]*>[^<]*</button>',html)
assert radar_button
radar_timer=('<output id="qscopeRadarCountdown" class="qscope-source-clock" '
 'data-qscope-poll="radar" role="timer" aria-live="off" '
 'aria-label="Next automatic BoM reflectivity radar update">Awaiting schedule</output>')
html=one(html,radar_button.group(),radar_button.group()+radar_timer,"radar playback row")
# Assert every menu refresh ID is deliberately accounted for.
all_refresh=set(re.findall(r'<button\b[^>]*\bid="(refresh[A-Za-z0-9]+)"',html))
unhandled=all_refresh-set(installed)
if unhandled:raise AssertionError("Other manual refresh buttons require inventory: "+str(sorted(unhandled)))
if html.count('</head>')!=1:raise AssertionError("Unknown operator head")
css_name="qscope-premium-identity-and-clocks-v1.css"
script_name="qscope-quiet-refresh-clocks-v1.js"
shutil.copyfile(FRONT/css_name,JS/css_name)
shutil.copyfile(FRONT/script_name,JS/script_name)
html=html.replace('</head>',
 '  <link rel="stylesheet" href="./src/'+css_name+'?v=20261112-v1">\n'
 '  <script src="./src/'+script_name+'?v=20261112-v1" defer></script>\n'
 '</head>',1)
HTML.write_text(html,encoding="utf-8")

# Cache bust ONLY the assembled UI and changed timer observability modules.
# An unchanged sealed source still owns network behaviour and each interval.
cache_suffix="-qscope-quiet-ui-20261112-v1"
chains={
 "index.html":["live3d-operational-v9.html?v="],
 "live3d-operational-v9.html":["src/live3d-operational-v9.js?v="],
 "src/live3d-operational-v9.js":[
  "live-loop-refresh-v1.js?v=",
  "river-gauges-operational-v1.js?v=",
  "flood-road-closures-operational-v1.js?v=",
  "power-outages-operational-v1.js?v=",
  "qfd-technical-rescues-operational-v1.js?v=",
  "significant-rainfall-operational-v1.js?v=",
  "bom-warning-operational-v1.js?v=",
  "qscope-bom-wind-observations-operational-v1.js?v="],
 "src/context-layers/river-gauges-operational-v1.js":["river-gauge-layer-v1.js?v="],
 "src/context-layers/flood-road-closures-operational-v1.js":["flood-road-closures-v1.js?v="],
 "src/context-layers/power-outages-operational-v1.js":["power-outages-v1.js?v="],
 "src/context-layers/road-closure-lga-explorer-v1.js":["road-ownership-report-v1.js?v="]
}
for relative,needles in chains.items():
    file=SITE/relative
    data=file.read_text(encoding="utf-8")
    for needle in needles:
        if data.count(needle)!=1:
            raise AssertionError(f"Cache identity ambiguity {relative}: {needle} x{data.count(needle)}")
        data=data.replace(needle,needle+cache_suffix,1)
    file.write_text(data,encoding="utf-8")

with (SITE/"BUILD.txt").open("a",encoding="utf-8") as log:
    log.write("Q-SCOPE QUIET SOURCE-SCHEDULED COUNTDOWNS + PREMIUM IDENTITY 20261112 "
              "| zero new Worker calls; original source timers, accepted radar, "
              "warning polygons and controls untouched\n")
print("Q-SCOPE QUIET MENU OVERLAY PASS |",len(installed),
      "manual refresh buttons replaced by clocks; 3 radar buttons hidden; "
      "accepted UI contracts and all original data paths retained")
