import {bomCapRssLinks,parseOfficialBomCap,parseBomCapProductNotice}
 from "../frontend/src/context-layers/bom-warning-cap-source-v1.js";
import {reconcileLatestBoMWarnings}
 from "./bom-warning-product-reconcile-v1.js";
import {fetchCurrentQldBoMWarningsIndex}
 from "./bom-warning-qld-current-index-v1.js";
import {fetchQldBomWfsGeometry,fetchQldBomStormLocations}
 from "./bom-warning-gis2web-replica-v1.js";

export const BOM_CAP_RSS="https://severeweather.wmo.int/v2/cap-alerts/au-bom-en/rss.xml";
const LGA_URL="https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Boundaries/AdministrativeBoundaries/MapServer/1/query";
const DDMG_URL="https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Boundaries/AdminBoundariesFramework/MapServer/240/query";
const NAME="StormTrackerOfficialBoMWarningPolygonsV1";
async function textResponse(url,max=1500000){
 const res=await fetch(url,{headers:{Accept:"application/xml,text/xml,application/rss+xml"},
  signal:AbortSignal.timeout(13500),redirect:"manual",cf:{cacheEverything:true,cacheTtl:120}});
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
// Fallback is permitted ONLY when two independently authoritative live
// sources agree: the fresh BoM Queensland current-product index and the
// original government GIS2Web-derived feature service. It must never turn a
// newer CAP cancellation into an old polygon, or invent bulletin text.
export function reconcileIndexVerifiedWarningGeometry(reconciled,index,indexOnly,{nowMs=Date.now()}={}){
 const checked=Date.parse(index?.checkedUtc??"");
 const active=new Set(index?.verified===true&&Array.isArray(index.activeCodes)?index.activeCodes:[]);
 if(!Number.isFinite(checked)||checked>nowMs+300000||
    nowMs-checked>20*60000)return {...reconciled,indexOnlyCount:0};
 const products={...reconciled.products},warnings=[...reconciled.warnings];
 const seen=new Set(warnings.map(w=>w.id));
 let indexOnlyCount=0;
 for(const warning of indexOnly??[]){
  const code=warning?.productCode,status=products[code]?.status;
  const sourceCode=code==="IDQ21033"?"IDQ65654":code==="IDQ21035"?"IDQ65650":null;
  if(!sourceCode||!active.has(code)||
     !["listed-active","geometry-unavailable","active"].includes(status)||
     warning.capBulletinStatus!=="pending-current-source"||
     warning.official!==true||warning.issuer!=="Bureau of Meteorology"||
     warning.sourceProduct!==sourceCode||!warning.warningGeometrySource||
     !["Polygon","MultiPolygon"].includes(warning.geometry?.type)||
     !(Date.parse(warning.issuedUtc)<=nowMs+300000)||
     !(Date.parse(warning.expiresUtc)>nowMs)||
     seen.has(warning.id))continue;
  seen.add(warning.id);warnings.push(warning);indexOnlyCount++;
  const p=products[code],hasCurrentCap=
    (p.status==="active"||p.status==="geometry-unavailable")&&
    Date.parse(p.issuedUtc)<=nowMs&&Date.parse(p.expiresUtc)>nowMs;
  products[code]={...p,status:"active",count:(p.count??0)+1,
   bulletinVerification:"pending-current-source",
   // An old cancelled CAP is NOT the current bulletin; never present its
   // stale headline, expiry, description or advice as today's warning.
   ...(!hasCurrentCap?{issuedUtc:null,expiresUtc:null,headline:"",
     description:"",instruction:"",areaDescription:"",
     bulletinUrl:warning.bulletinUrl,hazardAssessment:null}:{})
  };
 }
 return {products,warnings,sourceComplete:reconciled.sourceComplete&&indexOnlyCount===0,
   indexOnlyCount};
}

export async function relayBomWarningPolygons(request,origin,corsHeaders){
 const head={"Content-Type":"application/json; charset=utf-8","Cache-Control":"public,max-age=90"};
 let payload;
 try{
  const now=Date.now();
  // Official QLD CURRENT product listing is separate from international CAP
  // issue history. Query concurrently; failure to confirm it does NOT
  // override valid CAP geometry or fabricate negative reporting.
  const [rssResult,indexResult]=await Promise.allSettled([
   textResponse(BOM_CAP_RSS,3000000),
   fetchCurrentQldBoMWarningsIndex({nowMs:now})
  ]);
  const qldCurrentIndex=indexResult.status==="fulfilled"?indexResult.value:null;
  if(rssResult.status==="rejected"&&!qldCurrentIndex)
   throw new Error("Neither CAP nor current official Queensland warning index verified");
  const links=rssResult.status==="fulfilled"?
   bomCapRssLinks(rssResult.value,{nowMs:now}):[];
  // RSS scanning is explicitly bounded (22 most recent matching alert links).
  // When the bound is reached it is NOT a complete national BoM alert index.
  // Never convert "not encountered in the sample" to an official all-clear.
  const indexPossiblyTruncated=links.length>=22;
  const found=await Promise.allSettled(links.map(url=>textResponse(url).then(xml=>({
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
   if(n?.status!=="issued"||!n.productCode||
      !(Date.parse(n.expiresUtc)>now))continue;
   const prev=latestIssued.get(n.productCode);
   if(!prev||Date.parse(n.issuedUtc)>Date.parse(prev.issuedUtc))
    latestIssued.set(n.productCode,n);
  }
  // A fresh official current index may identify a warning before its latest
  // CAP notice reaches WMO. Query only original government GIS geometry,
  // and preserve the original newest-CAP match whenever that CAP exists.
  const gisProducts=[...new Set([...latestIssued.keys(),
    ...(qldCurrentIndex?.activeCodes??[])])];
  const gisResults=await Promise.allSettled(gisProducts.map(code=>
   fetchQldBomWfsGeometry(latestIssued.get(code)??{productCode:code},{
    nowMs:now,officialIndexActive:qldCurrentIndex?.verified===true&&
      qldCurrentIndex.activeCodes.includes(code)
   })));
  let gisFailures=0;
  const indexOnly=[];
  gisProducts.forEach((code,i)=>{
   const result=gisResults[i];
   if(result.status==="rejected"){gisFailures++;return;}
   for(const geometry of result.value){
    if(geometry.capBulletinStatus==="pending-current-source"){
     indexOnly.push(geometry);continue;
    }
    const notice=latestIssued.get(code);
    const row=messageRecords.find(r=>r?.notice?.productCode===code&&
      r.notice.issuedUtc===notice?.issuedUtc);
    if(row)row.warnings=[...(row.warnings??[]),geometry];
   }
  });
  const reconciled=reconcileLatestBoMWarnings(messageRecords,{
    complete:sourceFailures===0&&!indexPossiblyTruncated,nowMs:now,
    qldCurrentIndex
  });
  const resolved=reconcileIndexVerifiedWarningGeometry(
   reconciled,qldCurrentIndex,indexOnly,{nowMs:now});
  // NSW clipping against the TRUE installed radar coverage union is required
  // before independently publishing NSW warnings. Do not approximate it.
  const qld=resolved.warnings.filter(x=>x.state==="QLD");
  const enriched=await Promise.all(qld.slice(0,14).map(enrichWarningBoundaries));
  const products=resolved.products;
  // IDQ65652 is the separate detailed storm-LOCATION product. A published
  // IDQ65650 threat-area polygon must never be treated as an individual cell.
  // A source outage or no available cell geometries never implies "no storms".
  let stormCells=[],stormCellSourceStatus="not-active";
  const detailedNotice=latestIssued.get("IDQ21035");
  if(detailedNotice&&products.IDQ21035?.status!=="cancelled"&&
    products.IDQ21035?.status!=="no-active"){
   try{
    stormCells=await fetchQldBomStormLocations(detailedNotice,{nowMs:now});
    stormCellSourceStatus=stormCells.length?"source-verified":"no-verified-cell-geometry";
   }catch{
    stormCellSourceStatus="unavailable";
   }
  }
  // Never label incomplete CAP source scans as confirmed "no warnings".
  const partial=sourceFailures>0||gisFailures>0||indexPossiblyTruncated||
   resolved.indexOnlyCount>0||Object.values(products).some(p=>
    p.status==="unavailable"||p.status==="geometry-unavailable");
  payload={schema:NAME,checkedAt:new Date(now).toISOString(),
   status:partial?"partial-source-unavailable":
     enriched.length?"active":"no-verified-current-polygons",
   source:"WMO registered Australian Bureau of Meteorology CAP authority",
   sourceUrl:BOM_CAP_RSS,sourceFailures,gisFailures,
   qldCurrentIndexStatus:qldCurrentIndex?"verified-current-products":"unavailable",
   qldCurrentIndexCheckedAt:qldCurrentIndex?.checkedUtc??null,
   geospatialSource:"Queensland emergency-management WFS-derived Bureau GIS2Web warnings",
   products,sourceComplete:resolved.sourceComplete,
   currentIndexAndGisCapPendingCount:resolved.indexOnlyCount,
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
