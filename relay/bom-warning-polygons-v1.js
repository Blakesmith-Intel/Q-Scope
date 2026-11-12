import {bomCapRssLinks,parseOfficialBomCap,parseBomCapProductNotice}
 from "../frontend/src/context-layers/bom-warning-cap-source-v1.js";
import {reconcileLatestBoMWarnings}
 from "./bom-warning-product-reconcile-v1.js";
import {fetchCurrentQldBoMWarningsIndex}
 from "./bom-warning-qld-current-index-v1.js";
import {fetchQldBomWfsGeometry,fetchQldBomWfsCurrentIndexGeometry,fetchQldBomStormLocations}
 from "./bom-warning-gis2web-replica-v1.js";

export const BOM_CAP_RSS="https://severeweather.wmo.int/v2/cap-alerts/au-bom-en/rss.xml";
const LGA_URL="https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Boundaries/AdministrativeBoundaries/MapServer/1/query";
const DDMG_URL="https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Boundaries/AdminBoundariesFramework/MapServer/240/query";
const NAME="StormTrackerOfficialBoMWarningPolygonsV1";
async function textResponse(url,max=1500000,{force=false}={}){
 const res=await fetch(url,{headers:{Accept:"application/xml,text/xml,application/rss+xml"},
  signal:AbortSignal.timeout(13500),redirect:"manual",
  cf:{cacheEverything:!force,cacheTtl:force?0:120}});
 if(!res.ok)throw Error("WMO CAP HTTP "+res.status);
 const text=await res.text();
 if(text.length>max||text.length<50)throw Error("Unexpected CAP feed size");
 return text;
}
function ringsOf(g){
 return g?.type==="Polygon"?g.coordinates:g?.type==="MultiPolygon"?
  g.coordinates.flatMap(poly=>poly):[];
}
// Critical: ArcGIS esriSpatialRelIntersects has NO percentage, area or min
// overlap cutoff. Even a tiny sliver or boundary intersection is included.
export function boundaryIntersectionRequest(warningGeometry,url,field){
 const rings=ringsOf(warningGeometry);
 if(!rings.length||rings.length>180||rings.some(r=>r.length<4)|| 
   rings.flat().length>18000)throw Error("Invalid BoM polygon for boundaries");
 const form=new URLSearchParams({
  f:"json",where:"1=1",geometryType:"esriGeometryPolygon",
  geometry:JSON.stringify({rings,spatialReference:{wkid:4326}}),
  inSR:"4326",spatialRel:"esriSpatialRelIntersects",
  outFields:field,returnGeometry:"false",resultRecordCount:"2000"
 });
 return {url,form:form.toString()};
}
async function governmentIntersections(geometry,url,field){
 const q=boundaryIntersectionRequest(geometry,url,field);
 const res=await fetch(q.url,{method:"POST",
  headers:{"Content-Type":"application/x-www-form-urlencoded",Accept:"application/json"},
  body:q.form,signal:AbortSignal.timeout(16000)});
 if(!res.ok)throw Error("Official boundary service HTTP "+res.status);
 const raw=await res.json();
 if(raw?.error||raw?.exceededTransferLimit||!Array.isArray(raw?.features))
  throw Error("Incomplete official "+field+" intersection response");
 return [...new Set(raw.features.map(f=>String(Object.entries(f.attributes??{})
    .find(([name])=>name.toLowerCase()===field.toLowerCase())?.[1]??"").trim())
  .filter(Boolean))].sort((a,b)=>a.localeCompare(b,"en-AU"));
}
export async function enrichWarningBoundaries(warning){
 const [lga,ddmg]=await Promise.allSettled([
  governmentIntersections(warning.geometry,LGA_URL,"lga"),
  governmentIntersections(warning.geometry,DDMG_URL,"District")
 ]);
 const areas=lga.status==="fulfilled"?lga.value:[];
 // Under Queensland's Disaster Management Act s29, LDMGs are established for
 // local-government areas. These are intersecting LGA-based groups, not names
 // inferred from BoM bulletin district text.
 return {...warning,
  lgas:areas,
  ldmgs:areas,
  ldmgBasis:"Queensland LGA boundary intersections (DMA 2003 s29)",
  ldmgStatus:lga.status==="fulfilled"?"verified":"unavailable",
  ddmgs:ddmg.status==="fulfilled"?ddmg.value:[],
  lgaStatus:lga.status==="fulfilled"?"verified":"unavailable",
  ddmgStatus:ddmg.status==="fulfilled"?"verified":"unavailable",
  // Partial failures never masquerade as no affected areas.
  geometryIntersectionsMethod:"esriSpatialRelIntersects — no minimum area"
 };
}
// Bound concurrent council boundary requests, but NEVER silently truncate
// the warning features counted for a live warning or LGA/DDMG report.
async function enrichAllWarningBoundaries(warnings){
 const results=new Array(warnings.length);
 let next=0;
 async function worker(){
  while(next<warnings.length){
   const i=next++;
   results[i]=await enrichWarningBoundaries(warnings[i]);
  }
 }
 await Promise.all(Array.from({length:Math.min(8,warnings.length)},worker));
 return results;
}
export async function relayBomWarningPolygons(request,origin,corsHeaders){
 const force=new URL(request.url).searchParams.get("force")==="1";
 const head={"Content-Type":"application/json; charset=utf-8",
  "Cache-Control":force?"no-store":"public,max-age=90"};
 let payload;
 try{
  const now=Date.now();
  // Official QLD CURRENT product listing is separate from international CAP
  // issue history. Query concurrently; failure to confirm it does NOT
  // override valid CAP geometry or fabricate negative reporting.
  const [rssResult,indexResult]=await Promise.allSettled([
   textResponse(BOM_CAP_RSS,3000000,{force}),
   fetchCurrentQldBoMWarningsIndex({nowMs:now,force})
  ]);
  const qldCurrentIndex=indexResult.status==="fulfilled"?indexResult.value:null;
  if(rssResult.status==="rejected"&&!qldCurrentIndex)
   throw new Error("Neither CAP nor current official Queensland warning index verified");
  // An independently verified Queensland CURRENT warning index is sufficient
  // to start genuine product-specific WFS retrieval. Do not leave IDQ21035
  // waiting on up to 22 unrelated national CAP documents before asking GIS2Web.
  // Promise.allSettled preserves per-product independence and cancellation safety.
  const indexedCodes=(qldCurrentIndex?.verified===true?
    qldCurrentIndex.activeCodes:[]).filter(code=>
      ["IDQ21033","IDQ21035","IDQ21037","IDQ21038"].includes(code));
  const indexed=new Set(indexedCodes);
  const indexedRequests=indexedCodes.map(code=>({code,
    run:()=>fetchQldBomWfsCurrentIndexGeometry(code,qldCurrentIndex,{nowMs:now,force})}));
  const indexedResultsPending=Promise.allSettled(indexedRequests.map(r=>r.run()));
  const links=rssResult.status==="fulfilled"?
   bomCapRssLinks(rssResult.value,{nowMs:now}):[];
  // RSS scanning is explicitly bounded (22 most recent matching alert links).
  // When the bound is reached it is NOT a complete national BoM alert index.
  // Never convert "not encountered in the sample" to an official all-clear.
  const indexPossiblyTruncated=links.length>=22;
  const found=await Promise.allSettled(links.map(url=>textResponse(url,1500000,{force}).then(xml=>({
   notice:parseBomCapProductNotice(xml,{nowMs:now}),
   warnings:parseOfficialBomCap(xml,{nowMs:now})
  }))));
  const sourceFailures=found.filter(x=>x.status==="rejected").length+
   (rssResult.status==="rejected"?1:0);
  const messageRecords=found.map(x=>x.status==="fulfilled"?x.value:{failed:true});
  // Obtain source-exact genuine GIS2Web-derived warning polygons only for
  // authenticated, active Bureau CAP issues, not arbitrary geographic guesses.
  // A separate WFS outage never converts a live CAP warning to "no warning".
  const latestIssued=new Map();
  for(const row of messageRecords){
   const n=row?.notice;
   if(n?.status!=="issued"||!n.productCode)continue;
   const prev=latestIssued.get(n.productCode);
   if(!prev||Date.parse(n.issuedUtc)>Date.parse(prev.issuedUtc))
    latestIssued.set(n.productCode,n);
  }
  // The verified Queensland CURRENT index is the product discovery authority.
  // Fetch GIS2Web shapes for EVERY listed active product independently, even
  // when a regional CAP alert fell outside the bounded 22-message global RSS.
  // For an issued CAP product missing from the index, retain the existing
  // source-exact CAP/GIS matching and newer-issue safety behaviour.
  const capOnly=[...latestIssued.values()].filter(n=>!indexed.has(n.productCode));
  const capOnlyRequests=capOnly.map(notice=>({code:notice.productCode,
    run:()=>fetchQldBomWfsGeometry(notice,{nowMs:now,force})
      .then(warnings=>({notice,warnings}))}));
  const requests=[...indexedRequests,...capOnlyRequests];
  const [indexedResults,capOnlyResults]=await Promise.all([
    indexedResultsPending,Promise.allSettled(capOnlyRequests.map(r=>r.run()))
  ]);
  const gisResults=[...indexedResults,...capOnlyResults];
  let gisFailures=0;
  requests.forEach((request,i)=>{
   const result=gisResults[i];
   if(result.status==="rejected"){gisFailures++;return;}
   const match=result.value;
   if(!match?.notice||!Array.isArray(match.warnings)||!match.warnings.length)return;
   const cap=latestIssued.get(request.code);
   // Never render an older, superseded WFS footprint against a newer CAP
   // issuance if its original GIS coordinates have not yet caught up.
   if(cap&&Date.parse(cap.issuedUtc)-Date.parse(match.notice.issuedUtc)>120000)return;
   // CAP's textual bulletin can legitimately precede the latest refreshed
   // source GIS geometry by >2 minutes (11-13 min observed 11 Nov 2026).
   // Preserve its verified *product-level* warning wording and high-end
   // hazard details; NEVER use the CAP time to change GIS source geometry
   // issue, expiry, coordinates or individual cell classification.
   const currentCap=cap&&Date.parse(cap.expiresUtc)>now&&cap.status==="issued"?cap:null;
   const sourceNotice=currentCap&&indexed.has(request.code)?
     {...match.notice,headline:currentCap.headline,
      description:currentCap.description,instruction:currentCap.instruction,
      areaDescription:currentCap.areaDescription,
      bulletinUrl:currentCap.bulletinUrl}:match.notice;
   const sourceWarnings=currentCap&&indexed.has(request.code)?
     match.warnings.map(w=>({...w,headline:currentCap.headline,
       description:currentCap.description,instruction:currentCap.instruction,
       areaDescription:currentCap.areaDescription,
       bulletinIssuedUtc:currentCap.issuedUtc,
       bulletinExpiresUtc:currentCap.expiresUtc})):match.warnings;
   const row=messageRecords.find(r=>r?.notice?.productCode===request.code&&
     Math.abs(Date.parse(r.notice.issuedUtc)-Date.parse(sourceNotice.issuedUtc))<=120000);
   if(row)row.warnings=[...(row.warnings??[]),...sourceWarnings];
   else messageRecords.push({notice:sourceNotice,warnings:sourceWarnings});
  });
  const reconciled=reconcileLatestBoMWarnings(messageRecords,{
    complete:sourceFailures===0&&!indexPossiblyTruncated,nowMs:now,
    qldCurrentIndex
  });
  // NSW clipping against the TRUE installed radar coverage union is required
  // before independently publishing NSW warnings. Do not approximate it.
  const qld=reconciled.warnings.filter(x=>x.state==="QLD");
  // Local government and disaster-district intersections are required for
  // reports, but are independent of the separate original storm-cell feed.
  // Start them together so an IDQ21035 refresh does not wait on two unrelated
  // network stages serially.
  const enrichedPending=enrichAllWarningBoundaries(qld);
  const products=reconciled.products;
  // IDQ65652 is the separate detailed storm-LOCATION product. A published
  // IDQ65650 threat-area polygon must never be treated as an individual cell.
  // A source outage or no available cell geometries never implies "no storms".
  let stormCells=[],stormCellSourceStatus="not-active";
  const detailedNotice=latestIssued.get("IDQ21035")??
    messageRecords.find(r=>r?.notice?.productCode==="IDQ21035"&&
      r.notice.status==="issued"&&Array.isArray(r.warnings)&&r.warnings.length)?.notice;
  if(detailedNotice&&products.IDQ21035?.status!=="cancelled"&&
    products.IDQ21035?.status!=="no-active"){
   try{
    stormCells=await fetchQldBomStormLocations(detailedNotice,{nowMs:now,force});
    stormCellSourceStatus=stormCells.length?"source-verified":"no-verified-cell-geometry";
   }catch{
    stormCellSourceStatus="unavailable";
   }
  }
  const enriched=await enrichedPending;
  // Never label incomplete CAP source scans as confirmed "no warnings".
  const partial=sourceFailures>0||gisFailures>0||indexPossiblyTruncated||Object.values(products).some(p=>
    p.status==="unavailable"||p.status==="geometry-unavailable");
  payload={schema:NAME,checkedAt:new Date(now).toISOString(),
   status:partial?"partial-source-unavailable":
     enriched.length?"active":"no-verified-current-polygons",
   source:"WMO registered Australian Bureau of Meteorology CAP authority",
   sourceUrl:BOM_CAP_RSS,sourceFailures,gisFailures,
   qldCurrentIndexStatus:qldCurrentIndex?"verified-current-products":"unavailable",
   qldCurrentIndexCheckedAt:qldCurrentIndex?.checkedUtc??null,
   geospatialSource:"Queensland emergency-management WFS-derived Bureau GIS2Web warnings",
   products,sourceComplete:reconciled.sourceComplete,
   nswWithheld:reconciled.warnings.filter(x=>x.state==="NSW").length,
   stormCellSourceStatus,stormCells,warnings:enriched};
 }catch(error){
  payload={schema:NAME,checkedAt:new Date().toISOString(),status:"unavailable",
   message:"Official BoM CAP warning geometry cannot be verified: "+String(error?.message??error).slice(0,130),
   sourceUrl:BOM_CAP_RSS,warnings:[]};
 }
 const headers=corsHeaders(origin);
 for(const [k,v] of Object.entries(head))headers.set(k,v);
 return new Response(request.method==="HEAD"?null:JSON.stringify(payload),{status:200,headers});
}
