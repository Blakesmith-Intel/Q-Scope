
import {readFileSync,writeFileSync} from "node:fs";

const audit=JSON.parse(readFileSync("docs/BOM_2026_GAUGE_COVERAGE_AUDIT.json","utf8"));
const verifiedIDs=new Set(audit.stations.map(x=>x.station));
if(verifiedIDs.size!==1808)throw Error("Unexpected BoM 2026 network audit station count");
const providers=[
  {
    name:"Queensland Reconstruction Authority BoM SLS Gauges",
    tag:"qra-bom-sls",
    url:"https://gisservices.qra.qld.gov.au/arcgis/rest/services/FWIN/BoM_SLS_Gauges/FeatureServer/0/query",
    id:"Bureau_Number", nameField:"Station_Name",basin:"Basin",agency:"Agency_Number",
    fields:"Bureau_Number,Station_Name,State,Basin,Agency_Number",
    sort:"OBJECTID"
  },
  {
    name:"Queensland Government FloodCheck BoM Flood Warning Network",
    tag:"qld-floodcheck-bom",
    url:"https://spatial-gis.information.qld.gov.au/arcgis/rest/services/FloodCheck/FloodWarningNetworkBOM/MapServer/0/query",
    id:"gaugeno",nameField:"stn_name",basin:"basin",agency:"agency",
    fields:"gaugeno,stn_name,basin,agency",
    sort:"objectid"
  }
];
const matches=new Map();
const checkedAt=new Date().toISOString(),counts={};
for(const provider of providers){
  let found=0,accepted=0;
  for(const offset of [0,2000]){
    const p=new URLSearchParams({where:"1=1",
      outFields:provider.fields,returnGeometry:"true",outSR:"4326",
      f:"geojson",resultOffset:String(offset),resultRecordCount:"2000",
      orderByFields:provider.sort});
    const url=provider.url+"?"+p;
    const response=await fetch(url,{signal:AbortSignal.timeout(18000),
      headers:{Accept:"application/geo+json"}});
    if(!response.ok)throw Error(provider.tag+" HTTP "+response.status);
    const raw=await response.json();
    if(!Array.isArray(raw.features))throw Error(provider.tag+" invalid response");
    found+=raw.features.length;
    for(const f of raw.features){
      const idRaw=String(f.properties?.[provider.id]??"").trim();
      if(!/^\d{1,6}$/.test(idRaw))continue;
      const id="bom:"+idRaw.padStart(6,"0");
      if(!verifiedIDs.has(id)||matches.has(id))continue;
      const [lon,lat]=f.geometry?.coordinates??[];
      if(f.geometry?.type!=="Point"||
         !Number.isFinite(lon)||!Number.isFinite(lat)||
         lon<136||lon>155.8||lat< -30.5||lat> -9)continue;
      const props=f.properties??{};
      const stationName=String(props[provider.nameField]??"").trim();
      if(!stationName)continue;
      matches.set(id,{
        type:"Feature",id,
        geometry:{type:"Point",coordinates:[lon,lat]},
        properties:{
          bom_stn_num:Number(id.slice(4)),
          awrc_stateid:"",
          name:stationName,lat,long:lon,state:"QLD",
          // Neither Queensland source supplies BoM's own verified
          // location_types/qualitative labels. Do NOT infer them.
          location_types:"",
          forecast_site_classification:"",
          basin:String(props[provider.basin]??"").trim(),
          agency:String(props[provider.agency]??"").trim(),
          featreal:null,
          stormtracker_reference_source:provider.tag
        }
      });
      accepted++;
    }
  }
  counts[provider.tag]={sourceRows:found,matched:accepted};
}
if(matches.size<1600||matches.size>verifiedIDs.size)
  throw Error("Reference coverage outside trusted BoM audit bounds: "+matches.size);
const missing=[...verifiedIDs].filter(id=>!matches.has(id));
const payload={
  type:"FeatureCollection",
  stormtrackerReference:{
    schema:"StormTrackerQldBoMGaugeReferenceV1",
    generatedAt:checkedAt,
    source:"Queensland Government BoM-linked gauge networks, joined by exact Bureau station ID to StormTracker's original BoM 2026 audit",
    auditedTotal:verifiedIDs.size,matchedTotal:matches.size,
    missingCount:missing.length,missingBoMStationIDs:missing,
    providers:counts,
    note:"This is a location/reference catalogue, not live BoM readings. River heights remain live and independent. Unknown tidal/qualitative tags are not inferred."
  },
  features:[...matches.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([,f])=>f)
};
const file="relay/qld-bom-gauge-reference-20261110-v1.js";
writeFileSync(file,
  "// Verified public Queensland Government gauge locations. Generated from exact BoM 2026 audited IDs.\n"+
  "// Static reference ONLY: no river heights, invented classifications, or observation timestamps.\n"+
  "export const QLD_BOM_GAUGE_REFERENCE="+JSON.stringify(payload)+";\n");
console.log(JSON.stringify({
  file,matchingBoMStations:matches.size,missingStations:missing.length,
  providers:counts,bytes:readFileSync(file).length,
  sampleMissing:missing.slice(0,15),generatedAt:checkedAt
}));
