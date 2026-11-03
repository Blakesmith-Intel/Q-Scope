import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {splitOutageSuburbs,groupOutagesBySuburb,filterOutageSuburbGroups,outageLocation}
 from "../src/context-layers/power-outage-suburb-model-v1.js";
const read=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");
const event=(id,suburbs,extra={})=>({
  id:"energex:"+id,
  geometry:{type:"Point",coordinates:[153.12,-27.67]},
  properties:{
    TYPE:"Unplanned",EVENT_ID:id,STORMTRACKER_PROVIDER:"Energex",
    SUBURBS:suburbs,CUSTOMERS_AFFECTED:120,
    STATUS:"Active",STREETS:"Main Street",...extra
  }
});
assert.deepEqual(splitOutageSuburbs("Ormeau, Pimpama ; Coomera"),["Ormeau","Pimpama","Coomera"]);
assert.deepEqual(splitOutageSuburbs("MOUNT WARREN PARK / EAGLEBY"),["MOUNT WARREN PARK / EAGLEBY"]);
assert.deepEqual(splitOutageSuburbs("Coomera, coomera"),["coomera"]);
assert.deepEqual(splitOutageSuburbs(""),["Suburb not supplied"]);
const data=[
  event(2,"Ormeau, Pimpama"),
  event(2,"Ormeau, Pimpama"), // Point/polygon duplicate by ID: do not count twice.
  event(3,"Ormeau"),
  event(4,"Upper Coomera", {STREETS:"Foxwell Road"}),
  event(5,"", {STREETS:"Unknown address"}),
  event(6,"Yatala",{TYPE:"Planned"})
];
const groups=groupOutagesBySuburb(data);
assert.deepEqual(groups.map(g=>g.name),[
  "Ormeau","Pimpama","Suburb not supplied","Upper Coomera"
]);
assert.equal(groups.find(g=>g.name==="Ormeau").items.length,2);
assert.equal(groups.find(g=>g.name==="Ormeau").shared,1);
assert.equal(groups.find(g=>g.name==="Pimpama").items.length,1);
assert.equal(groups.find(g=>g.name==="Pimpama").items[0].summary.customersAffected,120);
assert.equal(groups.some(g=>g.name==="Yatala"),false);
assert.deepEqual(filterOutageSuburbGroups(groups,"FOXWELL").map(g=>g.name),["Upper Coomera"]);
assert.deepEqual(filterOutageSuburbGroups(groups,"PIMPAMA").map(g=>g.name),["Pimpama"]);
assert.deepEqual(filterOutageSuburbGroups(groups,"main street").map(g=>g.name),["Ormeau","Pimpama"]);
assert.deepEqual(outageLocation(event(3,"Ormeau")),{longitude:153.12,latitude:-27.67});
assert.deepEqual(outageLocation({geometry:{type:"Polygon",coordinates:[[
  [153,-28],[154,-28],[154,-27],[153,-27],[153,-28]
]]}}),{longitude:153.5,latitude:-27.5});
assert.equal(outageLocation({geometry:{type:"Point",coordinates:[170,0]}}),null);
const html=read("../live3d-operational-v9.html");
const runtime=read("../src/context-layers/power-outages-operational-v1.js");
const view=read("../src/context-layers/power-outage-suburb-explorer-v1.js");
const css=read("../src/power-outage-suburb-explorer-v1.css");
const simpleCss=read("../src/friendly-ui-v1.css");
for(const id of ["openPowerOutageExplorer","powerOutageExplorer","outageSuburbSearch",
  "outageSuburbResults","outageSuburbSummary","outageSuburbFeedStatus",
  "refreshPowerOutageExplorer","outageByProviderReport","outageSuburbMore","closePowerOutageExplorer"])
  assert.ok(html.includes('id="'+id+'"'),id+" missing");
assert.match(html,/power-outage-suburb-explorer-v1\.css/);
assert.match(view,/groupOutagesBySuburb\(features\)/);
assert.match(view,/document\.createElement/);
assert.ok(view.includes("renderProviderReport()"));
assert.ok(view.includes("powerOutageProviderCounts(latestFeatures"));
assert.ok(view.includes('byProvider.addEventListener("click",onProviderView)'));
assert.ok(view.includes('providerView?"Report by LGA":"Report by provider"'));
assert.ok(view.includes('item.state==="partial"?"Partial feed":"Unavailable"'));

assert.match(view,/dialog\.showModal\(\)/);
assert.match(view,/status\.kind==="error"/);
assert.match(view,/outageLocation\(item\.feature\)/);
assert.match(view,/mapCamera\.setView/);
assert.ok(view.includes('const suburbName=create("button","outage-suburb-map"'));
assert.ok(view.includes("focusPublishedOutages(group.items)"));
assert.ok(view.includes("event.stopPropagation()"));
assert.ok(view.includes('byId("showPowerOutages")'));

assert.ok(view.includes('const title=create("button","outage-row-locate"'));
assert.ok(view.includes('row.addEventListener("click"'));
assert.ok(view.includes('event.target.closest("button,a,summary,details")'));
assert.ok(view.includes('const label=create("summary","","Details"'));
assert.ok(view.includes("if(!points.length)return false;"));
assert.ok(view.includes('13000'));
assert.ok(view.includes('spanMetres'));
assert.ok(css.includes("outage-row-locate"));
assert.ok(!view.includes("scene.drillPick"));
assert.ok(!view.includes("powerOutageIdFromPick"));
assert.match(view,/getLoadedAt\(\)/);
assert.match(runtime,/explorer\.updateFeatures\(features\)/);
assert.match(runtime,/explorer\.updateStatus\(status\)/);
assert.match(runtime,/refresh:\(\)=>layer\.refresh\(\{force:true\}\)/);
assert.match(runtime,/explorer\.destroy\(\)/);
assert.match(css,/#powerOutageExplorer\[open\]/);
assert.match(css,/\.outage-explorer-results/);
assert.ok(simpleCss.includes("body.simple-ui .dashboard-heading"));
assert.doesNotMatch(view,/fetch\s*\(/); // reuse source only
assert.doesNotMatch(view,/new CesiumRef\.GeoJsonDataSource/);
console.log("Power outages by suburb: source-safe grouping, filters, search, UI and integration passed.");
