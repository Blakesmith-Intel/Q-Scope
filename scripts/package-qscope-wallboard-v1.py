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
assert "readOnly = false" in (site/"src/context-layers/river-gauge-layer-v1.js").read_text()
assert not any(x in html for x in ("<button","<select","<input","<iframe"))
# Verify the published module graph using the same files the browser imports.
subprocess.run(["node","--experimental-default-type=module","--input-type=module","-e",
'import {formatCountdown,summariseRoads,summariseRain,summariseWind,summariseFloods} from "./_site/src/qscope-wallboard-model-v1.js"; if(formatCountdown(61000,0)!=="01:01")throw Error("countdown"); if(summariseRoads([],null).total!==0)throw Error("road count"); if(summariseFloods([],[],null).total!==0)throw Error("flood count"); if(summariseWind([]).total!==0)throw Error("wind count"); const r=summariseRain({observations:{since9am:[],last24Hours:[]}},{}); if(r.total||r.notable)throw Error("rain count");'],check=True)
with (site/"BUILD.txt").open("a") as f:
    f.write("\nQ-SCOPE OPERATIONS WALLBOARD V1 2026-11-20: eight source-backed panels, independent refresh clocks, map unchanged.\n")
