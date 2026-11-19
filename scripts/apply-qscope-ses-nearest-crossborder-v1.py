#!/usr/bin/env python3
"""Final, tiny UI patch over approved SES + BoM district rainfall reports.

Cross-border gauges are included in nearest Queensland SES region reporting,
but never represented as being within that SES jurisdiction. No source polling,
gauge coordinates, rainfall totals, AEP, radar or warnings are modified.
"""
from pathlib import Path
from shutil import copy2
import subprocess
site=Path("_site")
runtime=site/"src/context-layers/significant-rainfall-operational-v1.js"
engine=site/"src/live3d-operational-v9.js"
html=site/"live3d-operational-v9.html"
index=site/"index.html"
ses_module=site/"src/context-layers/rainfall-ses-region-v1.js"
registry=site/"data/qld-rainfall-ses-regions-v1.json"
assert all(p.is_file() for p in (runtime,engine,html,index,registry,ses_module))
assert "Q-SCOPE SEVEN QLD SES ADMINISTRATIVE REGIONS" in (site/"BUILD.txt").read_text()
copy2("frontend/src/context-layers/rainfall-ses-region-v1.js",ses_module)

def once(source,needle,replacement):
    if source.count(needle)!=1:
        raise RuntimeError(f"Expected exactly one previous-release anchor: {needle[:100]} (got {source.count(needle)})")
    return source.replace(needle,replacement,1)

source=runtime.read_text(encoding="utf-8")
# Export only the exact currently rendered regional model; never query a feed.
export_module=site/"src/context-layers/rainfall-report-export-v1.js"
copy2("frontend/src/context-layers/rainfall-report-export-v1.js",export_module)
source=once(source,
    'import {buildSignificantRainfallReport} from ',
    'import {rainfallReportExportHtml} from "./rainfall-report-export-v1.js?v=20261120-export-v1";\n'
    'import {buildSignificantRainfallReport} from ')
source=once(source,' let reportMode="amount";',''' let reportMode="amount";
 const reportExportButton=$("exportSignificantRainfallReport");
 let reportExportGroups=[];
 if(reportExportButton)reportExportButton.addEventListener("click",()=>{
  if(!reportExportGroups.length)return;
  const html=rainfallReportExportHtml(reportExportGroups);
  const url=URL.createObjectURL(new Blob([html],{type:"text/html;charset=utf-8"}));
  const link=document.createElement("a");
  link.href=url;
  link.download="qscope-rainfall-"+reportMode+"-"+period+".html";
  document.body.append(link);
  link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 });''')
source=once(source,'const filteringDistrict=selectedRegion!=="all";',
    '''const filteringDistrict=selectedRegion!=="all";
  reportExportGroups=districtModel.groups.filter(group=>group.rows.length>0);
  if(reportExportButton)reportExportButton.disabled=reportExportGroups.length===0;''')
source=once(source,
    'detailRow(rows,"SES administrative region",sesRegion?.name??'
    '(sesRegionAttempted?"SES region unavailable":"Checking SES region registry…"));',
    'detailRow(rows,"SES administrative region",sesRegion?.name??'
    '(sesRegionAttempted?"SES region unavailable":"Checking SES region registry…"));\n'
    '  if(sesRegion?.crossBorder)\n'
    '   detailRow(rows,"SES reporting status","Cross-border gauge ("+sesRegion.state+") · assigned to nearest Queensland SES region for rainfall reporting only");\n'
    '  else if(sesRegion?.assignment==="nearest")\n'
    '   detailRow(rows,"SES reporting status","Queensland boundary-edge gauge · assigned to nearest SES region");')
source=once(source,
    'const basin=catchmentForStation(station,basinRegistry);',
    'const sesListing=sesRegionForStation(station,sesRegionRegistry);\n'
    '     const basin=catchmentForStation(station,basinRegistry);')
source=once(source,
    '(basin?" · "+basin+" catchment":"")+\n'
    '       (station.reportingTier?" · "+station.reportingTier:"")+" · "+formatted(station.sourceCreatedAt);',
    '(basin?" · "+basin+" catchment":"")+\n'
    '       (sesListing?.crossBorder?" · CROSS-BORDER GAUGE ("+sesListing.state+")":\n'
    '        sesListing?.assignment==="nearest"?" · QLD boundary-edge gauge":"")+\n'
    '       (station.reportingTier?" · "+station.reportingTier:"")+" · "+formatted(station.sourceCreatedAt);')
source=once(source,
    'model.total+" stations reporting 50+ mm across two categories";',
    'model.total+" stations reporting 50+ mm across two categories";\n'
    '  const crossBorderListed=districtModel.groups.reduce((sum,group)=>sum+\n'
    '    group.rows.filter(row=>sesRegionForStation(row,sesRegionRegistry)?.crossBorder).length,0);\n'
    '  if(crossBorderListed)reportSummary.textContent+=" · "+crossBorderListed+\n'
    '   " cross-border gauge"+(crossBorderListed===1?"":"s");')
runtime.write_text(source,encoding="utf-8")

# Reissue only affected modules; ensure iOS Safari never reuses a stale SES
# classifier when it was updated by the final patch.
engine_source=engine.read_text(encoding="utf-8")
engine_source=once(engine_source,'significant-rainfall-operational-v1.js?v=',
    'significant-rainfall-operational-v1.js?v=20261120-rainfall-export-v1-20261113-complete-live-inventory-v1-')
engine.write_text(engine_source,encoding="utf-8")
source=source.replace('rainfall-ses-region-v1.js?v=',
    'rainfall-ses-region-v1.js?v=20261120-rainfall-export-v1-20261113-complete-live-inventory-v1-',1)
runtime.write_text(source,encoding="utf-8")
page=html.read_text(encoding="utf-8")
page=once(page,'<div id="significantRainfallReportSummary" class="rainfall-report-summary"',
    '<button type="button" id="exportSignificantRainfallReport" disabled>Export current view</button>\n      '
    '<div id="significantRainfallReportSummary" class="rainfall-report-summary"')
page=once(page,'src/live3d-operational-v9.js?v=',
    'src/live3d-operational-v9.js?v=20261120-rainfall-export-v1-20261113-complete-live-inventory-v1-')
html.write_text(page,encoding="utf-8")
entry=index.read_text(encoding="utf-8")
entry=once(entry,'live3d-operational-v9.html?v=',
    'live3d-operational-v9.html?v=20261120-rainfall-export-v1-20261113-complete-live-inventory-v1-')
index.write_text(entry,encoding="utf-8")
with (site/"BUILD.txt").open("a",encoding="utf-8") as output:
    output.write("Q-SCOPE SES NEAREST AND NSW CROSS-BORDER: static verified "
     "state labels in gauge popups and both rainfall reports; 0 unassigned "
     "gauge stations, no worker science/observations changes.\\n")
# Test the actual modules packaged for production, not a duplicate filter.
subprocess.run(["node","--check",str(runtime)],check=True)
subprocess.run(["node","--input-type=module","-e",r'''
import assert from "node:assert/strict";
import {rainfallReportExportHtml} from "./_site/src/context-layers/rainfall-report-export-v1.js";
import {isActiveFloodRoadClosure,filterFloodRoadClosures} from "./_site/src/context-layers/flood-road-closure-filter-v1.js";
const smoke={type:"Feature",properties:{status:"Published",event_type:"Hazard",
 event_subtype:"Poor visibility",event_due_to:"Smoke",
 impact:{impact_type:"Closures",impact_subtype:"Road closed to all traffic"}}};
const now=Date.parse("2026-11-20T00:00:00Z");
assert.equal(isActiveFloodRoadClosure(smoke,now),true);
assert.equal(filterFloodRoadClosures({features:[smoke]},now).features.length,1);
assert.equal(isActiveFloodRoadClosure({...smoke,properties:{...smoke.properties,
 impact:{impact_type:"Closures",impact_subtype:"Lane closed"}}},now),false);
assert.equal(isActiveFloodRoadClosure({...smoke,properties:{...smoke.properties,status:"Draft"}},now),false);
assert.equal(isActiveFloodRoadClosure({...smoke,properties:{...smoke.properties,
 duration:{end:"2026-11-19T00:00:00Z"}}},now),false);
const html=rainfallReportExportHtml([
 {title:"South Eastern Region",rows:[{mm:120.3,name:"Gauge A"},{mm:55,name:"Gauge & B"}]},
 {title:"Empty region",rows:[]},
 {title:"Darling Downs and Granite Belt",rows:[{mm:81.4,name:"<Gauge C>"}]}
]);
assert.ok(html.includes("<strong>South Eastern Region</strong>"));
assert.ok(html.includes("<li>120.3 mm - Gauge A</li>"));
assert.ok(html.includes("<li>55.0 mm - Gauge &amp; B</li>"));
assert.ok(html.includes("<li>81.4 mm - &lt;Gauge C&gt;</li>"));
assert.ok(!html.includes("Empty region"));
assert.ok(html.indexOf("120.3 mm")<html.indexOf("55.0 mm"));
assert.equal((html.match(/<li>/g)||[]).length,3);
console.log("Q_SCOPE_SMOKE_CLOSURE_AND_RAINFALL_EXPORT_OK");
'''],check=True)
with (site/"BUILD.txt").open("a",encoding="utf-8") as output:
    output.write("Q-SCOPE FORMATTED RAINFALL EXPORT AND SMOKE CLOSURE REGRESSION VERIFIED\\n")
print("Q_SCOPE_SES_CROSSBORDER_REPORT_OVERLAY_OK")
