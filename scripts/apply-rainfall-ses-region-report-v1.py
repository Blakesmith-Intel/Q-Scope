#!/usr/bin/env python3
"""Add Queensland SES administrative region grouping to final Q-Scope Pages root.

Apply AFTER the sealed production build and the separate BoM forecast-district
overlay. Change only rainfall reporting metadata/labels, never observations,
AEP science, map geometry, radar, warnings or Cloudflare relay.
"""
from pathlib import Path
from shutil import copy2

site=Path("_site")
runtime=site/"src/context-layers/significant-rainfall-operational-v1.js"
page=site/"live3d-operational-v9.html"
engine=site/"src/live3d-operational-v9.js"
index=site/"index.html"
registry=site/"data/qld-rainfall-ses-regions-v1.json"
module=site/"src/context-layers/rainfall-ses-region-v1.js"
stylesheet=site/"src/rainfall-ses-region-v1.css"
assert all(p.is_file() for p in (runtime,page,engine,index,registry)), "Missing tested root asset"
assert "Q-SCOPE BOM IDM00001 FORECAST DISTRICT RAINFALL REPORTS" in (site/"BUILD.txt").read_text()

def once(s,needle,replacement,label):
    count=s.count(needle)
    if count!=1: raise ValueError(f"{label}: expected one anchor, found {count}: {needle[:100]}")
    return s.replace(needle,replacement,1)

copy2("frontend/src/context-layers/rainfall-ses-region-v1.js",module)
copy2("frontend/src/rainfall-ses-region-v1.css",stylesheet)
code=runtime.read_text(encoding="utf-8")
code=once(code,
    'import {buildSignificantRainfallReport} from "./significant-rainfall-report-v1.js',
    'import {sesRegionForStation,groupRainfallBySESRegion,validSESRegionRegistry,\n'
    ' SES_REGION_REGISTRY_URL} from "./rainfall-ses-region-v1.js?v=20261113-ses-region-v1";\n'
    'import {buildSignificantRainfallReport} from "./significant-rainfall-report-v1.js',
    "SES module import")
code=once(code,
    'const reportDistrictFilter=$("significantRainfallDistrictFilter");',
    'const reportDistrictFilter=$("significantRainfallDistrictFilter");\n'
    ' const reportGroupBy=$("significantRainfallRegionGrouping");\n'
    ' const reportSESFilter=$("significantRainfallSESFilter");\n'
    ' const reportSESFilterWrap=$("significantRainfallSESFilterWrap");\n'
    ' const reportForecastFilterWrap=$("significantRainfallForecastFilterWrap");',
    "SES grouping controls")
ses_lookup=''' let sesRegionRegistry=null,sesRegionLoading=null,sesRegionAttempted=false;
 function updateSESRegionOptions(){
  if(!reportSESFilter)return;
  const previous=reportSESFilter.value||"all";
  const choices=[{code:"all",name:"All SES regions"},
   ...(sesRegionRegistry?.regions??[]).map(name=>({code:name,name})),
   {code:"unavailable",name:"SES region unavailable"}];
  reportSESFilter.replaceChildren();
  for(const choice of choices){
   const option=document.createElement("option");
   option.value=choice.code;option.textContent=choice.name;
   reportSESFilter.append(option);
  }
  reportSESFilter.value=choices.some(x=>x.code===previous)?previous:"all";
 }
 function loadSESRegions(){
  if(sesRegionRegistry||sesRegionLoading||sesRegionAttempted)
   return sesRegionLoading??Promise.resolve();
  sesRegionAttempted=true;
  sesRegionLoading=(async()=>{
   try{
    const response=await fetchImpl(SES_REGION_REGISTRY_URL,{
     cache:"force-cache",signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error("SES static region data HTTP "+response.status);
    const registry=await response.json();
    if(!validSESRegionRegistry(registry))
     throw Error("Unverified official Queensland SES region registry");
    sesRegionRegistry=registry;
    updateSESRegionOptions();
    if(selectedId)showInfo(visibleRows.find(x=>x.id===selectedId)??null);
    if(reportDialog?.open)renderReport();
   }catch(error){
    console.warn("Static Queensland SES region registry unavailable",error);
    if(reportDialog?.open)renderReport();
   }finally{sesRegionLoading=null}
  })();
  return sesRegionLoading;
 }
 function updateReportRegionControls(){
  const ses=reportGroupBy?.value!=="forecast";
  if(reportSESFilterWrap)reportSESFilterWrap.hidden=!ses;
  if(reportForecastFilterWrap)reportForecastFilterWrap.hidden=ses;
 }
'''
code=once(code,
    ' let forecastDistrictRegistry=null,forecastDistrictLoading=null,forecastDistrictAttempted=false;',
    ses_lookup+' let forecastDistrictRegistry=null,forecastDistrictLoading=null,forecastDistrictAttempted=false;',
    "SES static registry and controls")
code=once(code,
    'detailRow(rows,"BoM forecast district",forecastDistrict?.name??'
    '(forecastDistrictAttempted?"District unavailable":"Checking district registry…"));',
    'detailRow(rows,"BoM forecast district",forecastDistrict?.name??'
    '(forecastDistrictAttempted?"District unavailable":"Checking district registry…"));\n'
    '  const sesRegion=sesRegionForStation(record,sesRegionRegistry);\n'
    '  detailRow(rows,"SES administrative region",sesRegion?.name??'
    '(sesRegionAttempted?"SES region unavailable":"Checking SES region registry…"));',
    "SES gauge popup detail")
code=once(code,
    '''const districtModel=groupRainfallByForecastDistrict(model,record=>
   forecastDistrictForStation(record,forecastDistrictRegistry),
   reportDistrictFilter?.value??"all");
  const filteringDistrict=(reportDistrictFilter?.value??"all")!=="all";''',
    '''const isSES=reportGroupBy?.value!=="forecast";
  const selectedRegion=isSES?(reportSESFilter?.value??"all"):
   (reportDistrictFilter?.value??"all");
  const districtModel=isSES?
   groupRainfallBySESRegion(model,record=>sesRegionForStation(record,sesRegionRegistry),selectedRegion):
   groupRainfallByForecastDistrict(model,record=>
    forecastDistrictForStation(record,forecastDistrictRegistry),selectedRegion);
  const filteringDistrict=selectedRegion!=="all";''',
    "Switch grouped report using same measured/AEP source")
code=once(code,
    'districtModel.total+" station"+(districtModel.total===1?"":"s")+" in selected forecast district":',
    'districtModel.total+" station"+(districtModel.total===1?"":"s")+\n'
    '    " in selected "+(isSES?"SES region":"forecast district"):',
    "Dynamic SES/BoM report summary")
code=once(code,
    'void loadForecastDistricts();\n  renderReport();',
    'void loadForecastDistricts();\n  void loadSESRegions();\n  updateReportRegionControls();\n  renderReport();',
    "SES load on report open")
code=once(code,
    'void loadForecastDistricts();\n   // Show persisted classifications immediately;',
    'void loadForecastDistricts();\n   void loadSESRegions();\n'
    '   // Show persisted classifications immediately;',
    "SES static registry load with rainfall")
code=once(code,
    'reportDistrictFilter?.addEventListener("change",renderReport);',
    'reportDistrictFilter?.addEventListener("change",renderReport);\n'
    '  reportSESFilter?.addEventListener("change",renderReport);\n'
    '  reportGroupBy?.addEventListener("change",()=>{\n'
    '   updateReportRegionControls();renderReport();\n'
    '  });\n'
    '  updateReportRegionControls();',
    "SES report control wiring")
runtime.write_text(code,encoding="utf-8")

html=page.read_text(encoding="utf-8")
# Move forecast filter into its own row to avoid squeezing the report status
# and refresh controls on mobile. Preserve its ID and all existing callbacks.
existing='''<label for="significantRainfallDistrictFilter">Forecast district</label>
         <select id="significantRainfallDistrictFilter" aria-label="Filter rainfall report by BoM forecast district"><option value="all">All forecast districts</option></select>
         '''
html=once(html,existing,"","Move existing BoM district filter")
section='''<div class="rainfall-region-filters" role="group" aria-label="Group rainfall reports by official administrative area">
        <label>Group by
          <select id="significantRainfallRegionGrouping" aria-label="Group rainfall by SES region or BoM forecast district">
            <option value="ses" selected>SES administrative region</option>
            <option value="forecast">BoM forecast district</option>
          </select>
        </label>
        <label id="significantRainfallSESFilterWrap">SES region
          <select id="significantRainfallSESFilter" aria-label="Filter rainfall report by SES region">
            <option value="all">All SES regions</option>
          </select>
        </label>
        <label id="significantRainfallForecastFilterWrap" hidden>Forecast district
          <select id="significantRainfallDistrictFilter" aria-label="Filter rainfall report by BoM forecast district">
            <option value="all">All forecast districts</option>
          </select>
        </label>
      </div>
      '''
html=once(html,
    '<div id="significantRainfallReportSummary" class="rainfall-report-summary"',
    section+'<div id="significantRainfallReportSummary" class="rainfall-report-summary"',
    "Independent compact selector row")
html=once(html,'</head>',
    '  <link rel="stylesheet" href="./src/rainfall-ses-region-v1.css?v=20261113-ses-region-v1">\n</head>',
    "SES reporting responsive CSS")
html=once(html,'src/live3d-operational-v9.js?v=',
    'src/live3d-operational-v9.js?v=20261113-ses-report-v1-',
    "Page cache revision")
page.write_text(html,encoding="utf-8")
js=engine.read_text(encoding="utf-8")
js=once(js,'significant-rainfall-operational-v1.js?v=',
    'significant-rainfall-operational-v1.js?v=20261113-ses-report-v1-',
    "Rainfall runtime cache revision")
engine.write_text(js,encoding="utf-8")
entry=index.read_text(encoding="utf-8")
entry=once(entry,'live3d-operational-v9.html?v=',
    'live3d-operational-v9.html?v=20261113-ses-report-v1-',
    "Index cache revision")
index.write_text(entry,encoding="utf-8")
with (site/"BUILD.txt").open("a",encoding="utf-8") as manifest:
    manifest.write("Q-SCOPE SEVEN QLD SES ADMINISTRATIVE REGIONS: verified "
      "station-by-coordinate geographical membership, SES grouping/filter "
      "plus retained BoM forecast district option; no runtime worker or "
      "rainfall/AEP source modifications.\\n")
print("Q_SCOPE_SES_RAINFALL_REPORT_OVERLAY_OK")
