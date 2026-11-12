#!/usr/bin/env python3
"""Apply ONLY the approved read-only BoM forecast-district rainfall report overlay.

Target: final Github Pages production _site, after the pinned rainfall/radar
overlays have been packaged. Never rewrite source observation/AEP/relay logic.
"""
from pathlib import Path
from shutil import copy2

site = Path("_site")
runtime = site / "src/context-layers/significant-rainfall-operational-v1.js"
page = site / "live3d-operational-v9.html"
engine = site / "src/live3d-operational-v9.js"
index = site / "index.html"
module = site / "src/context-layers/rainfall-forecast-district-v1.js"
registry = site / "data/qld-rainfall-forecast-districts-v1.json"

def once(text, before, after, label):
    if text.count(before) != 1:
        raise ValueError(f"{label} marker missing or ambiguous: {before[:95]}")
    return text.replace(before, after, 1)

assert all(item.is_file() for item in (runtime, page, engine, index, registry))
copy2("frontend/src/context-layers/rainfall-forecast-district-v1.js", module)
source = runtime.read_text(encoding="utf-8")
source = once(source,
    'import {buildSignificantRainfallReport} from "./significant-rainfall-report-v1.js',
    'import {forecastDistrictForStation,groupRainfallByForecastDistrict,\n'
    ' validForecastDistrictRegistry,FORECAST_DISTRICT_REGISTRY_URL} from '
    '"./rainfall-forecast-district-v1.js?v=20261113-forecast-district-v1";\n'
    'import {buildSignificantRainfallReport} from "./significant-rainfall-report-v1.js',
    "district module import")
source = once(source,
    'const reportSummary=$("significantRainfallReportSummary"),reportRows=$("significantRainfallReportRows");',
    'const reportSummary=$("significantRainfallReportSummary"),reportRows=$("significantRainfallReportRows");\n'
    ' const reportDistrictFilter=$("significantRainfallDistrictFilter");',
    "district filter control")
anchor = ' const pendingCells=new Set(),attempts=new Map(),queue=[];'
addition = ''' let forecastDistrictRegistry=null,forecastDistrictLoading=null,forecastDistrictAttempted=false;
 function updateForecastDistrictOptions(){
  if(!reportDistrictFilter)return;
  const old=reportDistrictFilter.value||"all";
  const choices=[{code:"all",name:"All forecast districts"},
   ...(forecastDistrictRegistry?.districts??[]),
   {code:"unavailable",name:"District unavailable"}];
  reportDistrictFilter.replaceChildren();
  for(const district of choices){
   const option=document.createElement("option");
   option.value=district.code;option.textContent=district.name;
   reportDistrictFilter.append(option);
  }
  reportDistrictFilter.value=choices.some(x=>x.code===old)?old:"all";
 }
 function loadForecastDistricts(){
  if(forecastDistrictRegistry||forecastDistrictLoading||forecastDistrictAttempted)
   return forecastDistrictLoading??Promise.resolve();
  forecastDistrictAttempted=true;
  forecastDistrictLoading=(async()=>{
   try{
    // Static build asset only: no relay calls and no per-observation polling.
    const response=await fetchImpl(FORECAST_DISTRICT_REGISTRY_URL,{
     cache:"force-cache",signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error("Forecast district data HTTP "+response.status);
    const registry=await response.json();
    if(!validForecastDistrictRegistry(registry))
     throw Error("Unverified BoM forecast-district station registry");
    forecastDistrictRegistry=registry;
    updateForecastDistrictOptions();
    if(selectedId)showInfo(visibleRows.find(x=>x.id===selectedId)??null);
    if(reportDialog?.open)renderReport();
   }catch(error){
    console.warn("Static BoM forecast districts unavailable",error);
    if(reportDialog?.open)renderReport();
   }finally{forecastDistrictLoading=null}
  })();
  return forecastDistrictLoading;
 }
'''
source = once(source, anchor, addition + anchor, "forecast district static lookup")
source = once(source,
    'detailRow(rows,"BoM station number",record.id);',
    'detailRow(rows,"BoM station number",record.id);\n'
    '  const forecastDistrict=forecastDistrictForStation(record,forecastDistrictRegistry);\n'
    '  detailRow(rows,"BoM forecast district",forecastDistrict?.name??'
    '(forecastDistrictAttempted?"District unavailable":"Checking district registry…"));',
    "station detail row")
source = once(source,
    'const model=buildSignificantRainfallReport(visibleRows,reportMode);',
    'const model=buildSignificantRainfallReport(visibleRows,reportMode);\n'
    '  const districtModel=groupRainfallByForecastDistrict(model,record=>\n'
    '   forecastDistrictForStation(record,forecastDistrictRegistry),\n'
    '   reportDistrictFilter?.value??"all");\n'
    '  const filteringDistrict=(reportDistrictFilter?.value??"all")!=="all";',
    "report district grouping")
source = once(source,
    'reportSummary.textContent=reportMode==="aep"?',
    'reportSummary.textContent=filteringDistrict?\n'
    '   districtModel.total+" station"+(districtModel.total===1?"":"s")+" in selected forecast district":\n'
    '   reportMode==="aep"?',
    "selected district counts")
source = once(source,
    'for(const group of model.groups){',
    'for(const group of districtModel.groups){',
    "district report groups")
source = once(source,
    'value.className="rainfall-report-mm";value.textContent=station.mm.toFixed(1)+" mm";',
    'value.className="rainfall-report-mm";value.textContent=station.mm.toFixed(1)+" mm";',
    "preserve rainfall mm rendering")
source = once(source,
    '(basin?" · "+basin+" catchment":"")+" · "+formatted(station.sourceCreatedAt);',
    '(basin?" · "+basin+" catchment":"")+\n'
    '       (station.reportingTier?" · "+station.reportingTier:"")+" · "+formatted(station.sourceCreatedAt);',
    "retain AEP and totals tier within district")
source = once(source,
    'if(!reportDialog.open)reportDialog.showModal();\n  renderReport();',
    'if(!reportDialog.open)reportDialog.showModal();\n'
    '  void loadForecastDistricts();\n  renderReport();',
    "load forecast districts on report open")
source = once(source,
    'void loadCatchments();\n   // Show persisted classifications immediately;',
    'void loadCatchments();\n'
    '   void loadForecastDistricts();\n'
    '   // Show persisted classifications immediately;',
    "static registry load with rainfall")
source = once(source,
    'select?.addEventListener("change",e=>setPeriod(e.target.value));',
    'select?.addEventListener("change",e=>setPeriod(e.target.value));\n'
    '  reportDistrictFilter?.addEventListener("change",renderReport);',
    "filter event wiring")
runtime.write_text(source, encoding="utf-8")

html = page.read_text(encoding="utf-8")
html = once(html,
    '<button type="button" id="refreshSignificantRainfallReport"',
    '<label for="significantRainfallDistrictFilter">Forecast district</label>\n'
    '         <select id="significantRainfallDistrictFilter" aria-label="Filter rainfall report by BoM forecast district">'
    '<option value="all">All forecast districts</option></select>\n'
    '         <button type="button" id="refreshSignificantRainfallReport"',
    "shared report district filter")
html = once(html, 'src/live3d-operational-v9.js?v=',
    'src/live3d-operational-v9.js?v=20261113-bom-forecast-districts-v1-',
    "page cache identity")
page.write_text(html, encoding="utf-8")
engine_js = engine.read_text(encoding="utf-8")
engine_js = once(engine_js,
    'significant-rainfall-operational-v1.js?v=',
    'significant-rainfall-operational-v1.js?v=20261113-bom-forecast-districts-v1-',
    "engine rainfall import identity")
engine.write_text(engine_js, encoding="utf-8")
entry = index.read_text(encoding="utf-8")
entry = once(entry, 'live3d-operational-v9.html?v=',
    'live3d-operational-v9.html?v=20261113-bom-forecast-districts-v1-',
    "index page cache identity")
index.write_text(entry, encoding="utf-8")
with (site / "BUILD.txt").open("a", encoding="utf-8") as manifest:
    manifest.write("Q-SCOPE BOM IDM00001 FORECAST DISTRICT RAINFALL REPORTS: "
      "static verified gauge assignment; statewide/district report filter; "
      "no changes to source polling, AEP science, radar, flood or warning logic.\\n")
print("Q_SCOPE_FORECAST_DISTRICT_RAINFALL_OVERLAY_OK")
