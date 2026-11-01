#!/usr/bin/env node
// Non-deploying live investigation; never fabricate official warning geometry.
import {bomCapRssLinks,parseBomCapProductNotice,parseOfficialBomCap}
  from "../frontend/src/context-layers/bom-warning-cap-source-v1.js";
import {fetchCurrentQldBoMWarningsIndex}
  from "../relay/bom-warning-qld-current-index-v1.js";
import {sourceExactQldBomWfsFeatures,QLD_BOM_GIS_WARNING_REPLICA}
  from "../relay/bom-warning-gis2web-replica-v1.js";

const NOW=Date.now(),CODES={IDQ21033:"IDQ65654",IDQ21035:"IDQ65650"};
const RSS="https://severeweather.wmo.int/v2/cap-alerts/au-bom-en/rss.xml";
const RELAY="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/bom-official-warning-polygons";
async function getText(url,label,timeoutMs=24000){
 const response=await fetch(url,{headers:{Accept:"application/json,application/xml,text/xml,text/html"},
  cache:"no-store",signal:AbortSignal.timeout(timeoutMs)});
 const body=await response.text();
 if(!response.ok)throw Error(label+": HTTP "+response.status+" ("+body.slice(0,120)+")");
 console.log("LIVE_SOURCE",JSON.stringify({label,HTTP:response.status,bytes:body.length,
  age:response.headers.get("age"),date:response.headers.get("date")}));
 return body;
}
function iso(value){
 const m=typeof value==="number"?value:Date.parse(String(value??""));
 return Number.isFinite(m)?new Date(m).toISOString():String(value??"");
}
const notices=new Map();
try{
 const index=await fetchCurrentQldBoMWarningsIndex({nowMs:NOW});
 console.log("OFFICIAL_CURRENT_QSIGNAL",JSON.stringify(index));
}catch(error){console.log("OFFICIAL_CURRENT_QSIGNAL_ERROR",String(error));}
try{
 const json=JSON.parse(await getText(RELAY,"live-production-relay",35000));
 console.log("PRODUCTION_RELAY_WARNING_DIAGNOSTICS",JSON.stringify({
  status:json.status,checkedAt:json.checkedAt,sourceFailures:json.sourceFailures,
  gisFailures:json.gisFailures,sourceComplete:json.sourceComplete,
  qldCurrentIndexStatus:json.qldCurrentIndexStatus,
  stormCellSourceStatus:json.stormCellSourceStatus,
  warningsCount:json.warnings?.length??0,cellsCount:json.stormCells?.length??0,
  productStates:Object.fromEntries(Object.entries(json.products??{}).map(([code,p])=>[
    code,{status:p.status,issue:p.issuedUtc,expires:p.expiresUtc,count:p.count,
    highEnd:p.hazardAssessment?.highEnd??[]}
  ])),message:json.message??null
 }));
}catch(error){console.log("PRODUCTION_RELAY_FETCH_ERROR",String(error));}
try{
 const rss=await getText(RSS,"wmo-official-bom-cap-rss");
 const links=bomCapRssLinks(rss,{nowMs:NOW,maximum:22});
 console.log("CAP_RSS_LINK_SAMPLE",JSON.stringify({sampleCount:links.length,
  capped:links.length>=22}));
 const results=await Promise.allSettled(links.map(async(link)=>{
  const xml=await getText(link,"cap-notice",17000);
  return {notice:parseBomCapProductNotice(xml,{nowMs:NOW}),
    polygons:parseOfficialBomCap(xml,{nowMs:NOW}).length};
 }));
 let failures=0;
 for(const x of results){
  if(x.status==="rejected"){failures++;continue;}
  const n=x.value.notice;
  if(!n||!(n.productCode in CODES))continue;
  console.log("CAP_PRODUCT_CANDIDATE",JSON.stringify({
   product:n.productCode,status:n.status,issued:n.issuedUtc,expires:n.expiresUtc,
   polygonsDirectFromCAP:x.value.polygons
  }));
  const prior=notices.get(n.productCode);
  if(!prior||Date.parse(prior.issuedUtc)<Date.parse(n.issuedUtc))
    notices.set(n.productCode,n);
 }
 console.log("CAP_PRODUCT_DIAGNOSTICS",JSON.stringify({failures,
  mostRecentByProduct:Object.fromEntries([...notices].map(([code,n])=>[
    code,{status:n.status,issue:n.issuedUtc,expires:n.expiresUtc}
  ]))}));
}catch(error){console.log("CAP_SOURCE_ERROR",String(error));}
for(const [code,axf] of Object.entries(CODES)){
 try{
  const endpoint=QLD_BOM_GIS_WARNING_REPLICA+"/3/query";
  const q=new URLSearchParams({f:"geojson",where:"product='"+axf+"'",outFields:"*",
   outSR:"4326",returnGeometry:"true",resultRecordCount:"500"});
  const raw=await getText(endpoint+"?"+q,"qld-wfs-"+code,30000);
  const features=JSON.parse(raw);
  if(features.error)throw Error("WFS server error "+JSON.stringify(features.error));
  const rows=(features.features??[]).map(f=>{
    const p=f.properties??{};
    const issue=iso(p.validfrom_utc),end=iso(p.validto_utc);
    return {product:p.product,sourceIssue:issue,sourceExpiry:end,
      issuedMinutesAgo:Math.round((NOW-Date.parse(issue))/60000),
      expiredMinutesAgo:Math.round((NOW-Date.parse(end))/60000),
      geom:f.geometry?.type,validNow:Date.parse(end)>NOW,
      sourceId:String(p.gml_id??p.OBJECTID??f.id??"").slice(0,65)};
  });
  const n=notices.get(code);
  const joined=n?sourceExactQldBomWfsFeatures(features,n,{nowMs:NOW}):[];
  console.log("SOURCE_GIS_POLYGON_EVIDENCE",JSON.stringify({
   code,requestedAxF:axf,serverCount:rows.length,mostRecent:rows.slice(0,12),
   latestWmoNotice:n?{issued:n.issuedUtc,expires:n.expiresUtc,status:n.status}:null,
   exactMatchedActivePolygons:joined.length,
   rejectedBecauseIssueMismatch:rows.filter(x=>n&&x.validNow&&
      Math.abs(Date.parse(x.sourceIssue)-Date.parse(n.issuedUtc))>120000).length,
   rejectedBecauseGeometryExpired:rows.filter(x=>!x.validNow).length
  }));
 }catch(error){console.log("SOURCE_GIS_POLYGON_ERROR",JSON.stringify({code,error:String(error)}));}
}
console.log("WARNING_LIVE_AUDIT_COMPLETE",new Date(NOW).toISOString());
