#!/usr/bin/env python3
"""Package the separate wallboard and one-link navigation; leave map logic unchanged."""
from pathlib import Path
from shutil import copy2
import subprocess

site=Path("_site")
front=Path("frontend")
for name in ("dashboard.html","src/qscope-wallboard-v1.css","src/qscope-wallboard-v1.js","src/qscope-wallboard-model-v1.js"):
    dest=site/name
    dest.parent.mkdir(parents=True,exist_ok=True)
    copy2(front/name,dest)
    if name.endswith(".js"):
        subprocess.run(["node","--check",str(dest)],check=True)
html=(site/"dashboard.html").read_text()
assert html.count('class="panel"')==8
assert html.count('class="panel-icon"')==8
assert 'aepDropClip' in html and 'australian-states' in html
assert 'id="qscopeMapView" class="view-switch" href="./"' in html
# The production map lives inside the root page's iframe. Navigate the TOP
# window, not the iframe, so switching does not leave a hidden map polling.
map_page=site/"live3d-operational-v9.html"
map_html=map_page.read_text(encoding="utf-8")
nav_start=map_html.index('<div id="nav">')
nav_end=map_html.index('</div>',nav_start)
assert 'id="sidebarToggle"' in map_html[nav_start:nav_end]
assert 'id="qscopeDashboardView"' not in map_html
map_html=map_html[:nav_end]+'<a id="qscopeDashboardView" href="./dashboard.html" target="_top" aria-label="Switch to operations dashboard">Dashboard</a>'+map_html[nav_end:]
style='<style>#qscopeDashboardView{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;white-space:nowrap;min-height:29px;padding:4px 8px;border:1px solid #40a7ae;border-radius:6px;background:#0a3948;color:#ddfffc;text-decoration:none;font-size:11px;font-weight:700;line-height:1.2}#qscopeDashboardView:focus-visible{outline:2px solid #75eee2;outline-offset:2px}#qscopeDashboardView:hover{background:#145563}@media(max-width:700px){#nav #qscopeDashboardView{font-size:10px;padding:3px 5px}}</style>'
assert map_html.count('</head>')==1
map_page.write_text(map_html.replace('</head>',style+'\n</head>',1),encoding="utf-8")
# Bust only the iframe document cache, never scientific module identities.
index=site/"index.html"
index_html=index.read_text(encoding="utf-8")
assert index_html.count('live3d-operational-v9.html?v=')==1
index.write_text(index_html.replace('live3d-operational-v9.html?v=','live3d-operational-v9.html?v=view-switch-20261120-v2-',1),encoding="utf-8")
# Produce a separate headless copy from the FINAL approved source engine.
# Never modify the operational map module or its cache identity.
map_engine=site/"src/context-layers/river-gauge-layer-v1.js"
engine=map_engine.read_text()
original=engine
def once(old,new):
    global engine
    if engine.count(old)!=1:
        raise RuntimeError("Unexpected flood engine anchor: "+old[:100])
    engine=engine.replace(old,new,1)
once("    !viewer\n    || !CesiumRef","    false // Headless wallboard requires no Cesium")
once("  const severityLayers=createSeverityMarkerLayers({\n    viewer,CesiumRef,owner:\"flood\",priorities:[0,1,2,4,6],visible\n  });\n  const dataSource=severityLayers.dataSource;","  const severityLayers=null;\n  const dataSource={show:false};")
# Keep the engine's authoritative source, diagnostics, event reconciliation,
# history and persistent cache logic. Skip only GPU/DOM rendering.
start=engine.index("    severityLayers.clear();",engine.index("  function render("))
end=engine.index("  async function refresh(",start)
assert "onUpdate(" in engine[start:end]
engine=engine[:start]+"    onUpdate(currentFeatures.slice(),diagnostics);\n  }\n\n"+engine[end:]
start=engine.index("  function setVisible(")
end=engine.index("  function start(",start)
engine=engine[:start]+"  function setVisible() {}\n\n"+engine[end:]
once("severityDataSources:severityLayers.dataSources,","severityDataSources:[],")
# The wallboard scheduler owns the 10-minute observation refresh, so
# enable the existing bounded station-history queue separately. Do not
# call layer.start(), which would create a second observation interval.
once("  let timer = null;", "  let timer = null;\n  let wallboardHistoryRunning=false;")
once("if(!timer||crossingScanTimer||!latestSourceFeatures.length)return;",
     "if(!wallboardHistoryRunning||crossingScanTimer||!latestSourceFeatures.length)return;")
once("      if(!timer)return;", "      if(!wallboardHistoryRunning)return;")
once("  function stop() {", "  function stop() {\n    wallboardHistoryRunning=false;")
once("    checkCrossingReferences:finishCrossingReferenceChecks,",
     "    enableBackgroundHistoryChecks(){wallboardHistoryRunning=true;},\n    checkCrossingReferences:finishCrossingReferenceChecks,")
headless=map_engine.with_name("river-gauge-wallboard-v1.js")
headless.write_text(engine)
assert map_engine.read_text()==original
subprocess.run(["node","--check",str(headless)],check=True)
assert not any(x in html for x in ("<button","<select","<input","<iframe"))
# Verify the published module graph using the same files the browser imports.
subprocess.run(["node","--input-type=module","-e",
'import {formatCountdown,summariseRoads,summariseRain,summariseWind,summariseFloods,wallboardFloodHealth} from "./_site/src/qscope-wallboard-model-v1.js"; if(formatCountdown(61000,0)!=="01:01")throw Error("countdown"); if(summariseRoads([],null).total!==0)throw Error("road count"); if(summariseFloods([],[],null).total!==0)throw Error("flood count"); if(summariseWind([]).total!==0)throw Error("wind count"); const r=summariseRain({observations:{since9am:[],last24Hours:[]}},{}); if(r.total||r.notable)throw Error("rain count"); if(wallboardFloodHealth({}, {pending:12},{}).kind!=="ok")throw Error("routine checks are not a source fault"); if(wallboardFloodHealth({partial:true},{},{}).kind!=="warning")throw Error("partial data"); if(wallboardFloodHealth({kind:"error"},{},{}).kind!=="error")throw Error("actual source failure"); if(wallboardFloodHealth({historyScreeningAlertsAffected:2},{},{notable:4}).message.indexOf("2 signals")<0)throw Error("active signal checks");'],check=True)
# Exercise the actual entry module without network access. This catches named
# import errors and proves every panel receives its own real countdown node.
subprocess.run(["node","--input-type=module","-e",r'''
import assert from "node:assert/strict";
const nodes=new Map();
function node(tag="div"){
 return {tag,textContent:"",children:[],dataset:{},style:{},
  append(...xs){this.children.push(...xs);},
  replaceChildren(...xs){this.children=xs;},
  closest(){return this;},
  classList:{toggle(){}},setAttribute(){}};
}
globalThis.document={hidden:true,createElement:node,addEventListener(){},
 getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);}};
globalThis.window={addEventListener(){}};
Object.defineProperty(globalThis,"localStorage",{value:{getItem(){return null;},setItem(){}},configurable:true});
const realInterval=globalThis.setInterval;
const {createRiverGaugeLayer}=await import("./_site/src/context-layers/river-gauge-wallboard-v1.js");
const headless=createRiverGaugeLayer();assert.equal(typeof headless.enableBackgroundHistoryChecks,"function");headless.enableBackgroundHistoryChecks();headless.stop();
globalThis.setInterval=()=>1;
globalThis.fetch=()=>{throw Error("Unexpected background or clock-only request");};
await import("./_site/src/qscope-wallboard-v1.js");
for(const id of ["powerStatus","warningStatus","cycloneStatus","windStatus","floodStatus","rainStatus","aepStatus","roadStatus"]){
 const footer=nodes.get(id);assert.equal(footer.children.length,2,id);
 assert.equal(footer.children[1].className,"countdown",id);
 assert.equal(footer.children[1].children[1].textContent,"Paused",id);
}
assert.equal(nodes.get("warningStatus").children[1].children.length,3);
globalThis.setInterval=realInterval;
console.log("All eight wallboard countdowns mounted; hidden clocks do not fetch");
'''],check=True)
with (site/"BUILD.txt").open("a") as f:
    f.write("\nQ-SCOPE OPERATIONS WALLBOARD V1 2026-11-20: eight source-backed panels, independent refresh clocks, bidirectional same-tab navigation; map logic unchanged.\n")
