#!/usr/bin/env python3
"""Package the separate Q-SCOPE wallboard; do not change the map entrypoint."""
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
headless=map_engine.with_name("river-gauge-wallboard-v1.js")
headless.write_text(engine)
assert map_engine.read_text()==original
subprocess.run(["node","--check",str(headless)],check=True)
assert not any(x in html for x in ("<button","<select","<input","<iframe"))
# Verify the published module graph using the same files the browser imports.
subprocess.run(["node","--experimental-default-type=module","--input-type=module","-e",
'import {formatCountdown,summariseRoads,summariseRain,summariseWind,summariseFloods} from "./_site/src/qscope-wallboard-model-v1.js"; if(formatCountdown(61000,0)!=="01:01")throw Error("countdown"); if(summariseRoads([],null).total!==0)throw Error("road count"); if(summariseFloods([],[],null).total!==0)throw Error("flood count"); if(summariseWind([]).total!==0)throw Error("wind count"); const r=summariseRain({observations:{since9am:[],last24Hours:[]}},{}); if(r.total||r.notable)throw Error("rain count");'],check=True)
# Import the real browser module, including all its transitive dependencies,
# with a minimal inert DOM. Hidden startup must create all eight clocks
# without issuing a fetch or requiring Cesium, WebGL, or the operational map.
subprocess.run(["node","--experimental-default-type=module","--input-type=module","-e",'''
import assert from "node:assert/strict";
const nodes=new Map();
const create=()=>({textContent:"",dataset:{},style:{},children:[],append(...x){this.children.push(...x);},replaceChildren(...x){this.children=x;},closest(){return this;}});
globalThis.document={hidden:true,createElement:create,getElementById(id){if(!nodes.has(id))nodes.set(id,create());return nodes.get(id);},addEventListener(){}};
globalThis.window={addEventListener(){}};
Object.defineProperty(globalThis,"localStorage",{value:{getItem(){return null;},setItem(){}},configurable:true});
globalThis.fetch=()=>{throw Error("Wallboard must not fetch while hidden");};
globalThis.setInterval=()=>1;
await import("./_site/src/qscope-wallboard-v1.js");
for(const id of ["powerStatus","warningStatus","cycloneStatus","windStatus","floodStatus","rainStatus","aepStatus","roadStatus"]){
 const f=nodes.get(id);
 assert.equal(f.children.length,2,id);
 assert.equal(f.children[1].children[1].textContent,"—",id);
}
console.log("PASS wallboard browser module starts headlessly with eight integrated countdowns");
'''],check=True)
# Exercise the actual entry module without network access. This catches named
# import errors and proves every panel receives its own real countdown node.
subprocess.run(["node","--experimental-default-type=module","--input-type=module","-e",r'''
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
const realInterval=globalThis.setInterval;
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
    f.write("\nQ-SCOPE OPERATIONS WALLBOARD V1 2026-11-20: eight source-backed panels, independent refresh clocks, map unchanged.\n")
