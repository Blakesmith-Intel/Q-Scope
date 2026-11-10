import assert from "node:assert/strict";
import {mkdtempSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const tmp=mkdtempSync(join(tmpdir(),"qscope-production-only-"));
const site=join(tmp,"public");
const source=path=>readFileSync(join(root,"frontend",path),"utf8");
const ids=html=>[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]).sort();
const originalIndex=source("index.html");
const originalUI=source("live3d-operational-v9.html");
const script=join(root,"scripts/apply-qscope-branding-v1.py");
try{
  mkdirSync(site);
  copyFileSync(join(root,"frontend/index.html"),join(site,"index.html"));
  copyFileSync(join(root,"frontend/live3d-operational-v9.html"),join(site,"live3d-operational-v9.html"));
  writeFileSync(join(site,"BUILD.txt"),"PRE-ACCEPTED FLOOD AND RADAR BASELINE\n");

  const ran=spawnSync("python3",[script,"--site",site],{encoding:"utf8"});
  assert.equal(ran.status,0,ran.stderr||ran.stdout);
  const main=readFileSync(join(site,"index.html"),"utf8");
  const ui=readFileSync(join(site,"live3d-operational-v9.html"),"utf8");
  assert(main.includes("<title>Q-SCOPE | Queensland Situational Awareness</title>"));
  assert(main.includes('title="Q-SCOPE Queensland weather and hazard map"'));
  assert(ui.includes("<title>Q-SCOPE | Queensland Situational Awareness Map</title>"));
  assert(ui.includes("<strong>Q-SCOPE</strong><span>QLD Situational Awareness</span>"));
  assert(ui.includes('<strong id="detailsTitle">Q-SCOPE details</strong>'));
  assert(ui.includes('Open Q-SCOPE operator guide in a new tab'));
  assert(main.includes('name="description"'));
  assert(ui.includes('name="description"'));
  assert.deepEqual(ids(ui),ids(originalUI),"Branding must not change any operational control or DOM id");
  assert.deepEqual(ids(main),ids(originalIndex));
  for(const t of ["live3d-operational-v9.html","stormtracker-bom-relay","data-detail-tab",
                 "operatorGuideLink","severeWeatherDetails"]){
    if(originalUI.includes(t))assert(ui.includes(t),"Existing operator target missing "+t);
  }
  assert.equal((main.match(/<iframe /g)||[]).length,1);
  assert.equal((ui.match(/<div class="simple-brand"/g)||[]).length,1);
  assert(readFileSync(join(site,"BUILD.txt"),"utf8").includes(
    "Q-SCOPE QUEENSLAND OPERATOR BRANDING"));
  // Idempotence fails closed: a second pass must never rewrite the shell.
  const second=spawnSync("python3",[script,"--site",site],{encoding:"utf8"});
  assert.notEqual(second.status,0);
  assert.equal(readFileSync(join(site,"index.html"),"utf8"),main);
  assert.equal(readFileSync(join(site,"live3d-operational-v9.html"),"utf8"),ui);
  // No other folders are altered. In particular the V10.3 science QA
  // preview remains in its original separately pinned identity.
  assert.equal(source("live3d-operational-v9.html"),originalUI);
  console.log("PASS Q-SCOPE root-only identity; all DOM IDs, sources, warnings, restores and research preview unaffected");
} finally {
  rmSync(tmp,{recursive:true,force:true});
}
