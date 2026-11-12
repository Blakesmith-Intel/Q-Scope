// Lightweight, source-exact BoM GIS warning edition probe for LIVE clients.
// NO geometry or synthetic warning shapes. This endpoint only indicates that
// a verified source has changed; the original full relay remains the authority
// for map objects and LGA/DDMG intersections.
import {fetchCurrentQldBoMWarningsIndex} from "./bom-warning-qld-current-index-v1.js";
import {fetchOriginalBoMFtpWarning} from "./bom-warning-ftp-v1.js";
import {QLD_BOM_GIS_WARNING_REPLICA} from "./bom-warning-gis2web-replica-v1.js";

export const BOM_WARNING_EDITIONS_SCHEMA="QScopeBoMWarningEditionsV1";
export const WATCHED_WARNING_AXF=Object.freeze({
 IDQ21033:"IDQ65654",IDQ21035:"IDQ65650",
 IDQ21037:"IDQ65272",IDQ21038:"IDQ65277",
 "IDQ21035:cells":"IDQ65652"
});
const WATCH_CODES=Object.freeze(["IDQ21033","IDQ21035","IDQ21037","IDQ21038"]);
const asMs=value=>typeof value==="number"?value:Date.parse(value);
const date=value=>Number.isFinite(value)?new Date(value).toISOString():null;

// Strictly retain original AXF identity, original time and current features.
// A future-dated, expired, malformed or extra source row is never evidence
// that a BoM warning polygon is currently active.
export function extractOfficialBoMEditionSignals(collection,nowMs=Date.now()){
 if(!Array.isArray(collection?.features)||collection.error||
    collection.exceededTransferLimit===true||collection.features.length>500)
   throw Error("Unverified or incomplete BoM GIS edition metadata");
 const groups=new Map();
 for(const f of collection.features){
  const p=f?.attributes??f?.properties??{};
  const code=Object.keys(WATCHED_WARNING_AXF).find(k=>
    WATCHED_WARNING_AXF[k]===p.product);
  if(!code)continue;
  const issued=asMs(p.validfrom_utc),expires=asMs(p.validto_utc);
  if(!Number.isFinite(issued)||!Number.isFinite(expires)||
    issued>nowMs+300000||issued>nowMs||expires<=nowMs)continue;
  if(!groups.has(code))groups.set(code,[]);
  groups.get(code).push({issued,id:String(p.gml_id??p.OBJECTID??f.id??"").slice(0,110)});
 }
 const result={};
 for(const code of Object.keys(WATCHED_WARNING_AXF)){
  const found=groups.get(code)??[];
  if(!found.length){result[code]={status:"verified",issuedUtc:null,count:0,sourceIds:[]};continue;}
  const latest=Math.max(...found.map(x=>x.issued));
  const current=found.filter(x=>Math.abs(x.issued-latest)<=120000);
  result[code]={status:"verified",issuedUtc:date(latest),count:current.length,
   sourceIds:current.map(x=>x.id).filter(Boolean).sort()};
 }
 return result;
}

async function fetchEditionLayer(layer,products,{fetchImpl=fetch,nowMs=Date.now()}={}){
 const url=new URL(QLD_BOM_GIS_WARNING_REPLICA+"/"+layer+"/query");
 url.searchParams.set("f","json");
 url.searchParams.set("where","product IN ("+
  products.map(x=>"'"+x+"'").join(",")+")");
 url.searchParams.set("outFields","product,validfrom_utc,validto_utc,gml_id");
 url.searchParams.set("returnGeometry","false");
 url.searchParams.set("resultRecordCount","500");
 const response=await fetchImpl(url.toString(),{
  headers:{Accept:"application/json"},
  signal:AbortSignal.timeout(10000),
  cf:{cacheEverything:true,cacheTtl:60}
 });
 if(!response.ok)throw Error("BoM GIS editions HTTP "+response.status);
 const data=await response.json();
 return extractOfficialBoMEditionSignals(data,nowMs);
}

export async function produceOfficialBoMWarningEditionSignal({
 fetchImpl=fetch,nowMs=Date.now(),ftpCapFetcher=fetchOriginalBoMFtpWarning
}={}){
 const [idx,thunder,weather]=await Promise.allSettled([
  fetchCurrentQldBoMWarningsIndex({fetchImpl,nowMs}),
  fetchEditionLayer(3,["IDQ65654","IDQ65650","IDQ65652"],{fetchImpl,nowMs}),
  fetchEditionLayer(2,["IDQ65272","IDQ65277"],{fetchImpl,nowMs})
 ]);
 const index=idx.status==="fulfilled"&&idx.value?.verified===true?idx.value:null;
 const products={};
 for(const [code,layer] of Object.entries(WATCHED_WARNING_AXF)){
  const result=["IDQ21033","IDQ21035","IDQ21035:cells"].includes(code)?thunder:weather;
  products[code]=result.status==="fulfilled"?
    result.value[code]:{status:"unavailable",issuedUtc:null,count:null,sourceIds:[]};
 }
 // Direct original BoM FTP issue metadata supplements GIS edition metadata.
 // Active-code check prevents FTP lookups during quiet periods. Source failures
 // are unverified, not cancellations, and never suppress real GIS detections.
 if(index){
  const active=WATCH_CODES.filter(code=>index.activeCodes.includes(code));
  const results=await Promise.allSettled(active.map(code=>
    ftpCapFetcher(code,{nowMs})));
  for(const [i,row] of results.entries()){
   const code=active[i];
   if(row.status!=="fulfilled"||row.value?.notice?.productCode!==code)continue;
   const notice=row.value.notice;
   if(products[code])products[code].bulletinIssuedUtc=notice.issuedUtc;
  }
 }
 return {schema:BOM_WARNING_EDITIONS_SCHEMA,
  checkedAt:new Date(nowMs).toISOString(),
  indexStatus:index?"verified":"unavailable",
  activeCodes:index?WATCH_CODES.filter(c=>index.activeCodes.includes(c)):null,
  products};
}

export async function relayOfficialBoMWarningEditions(request,origin,corsHeaders){
 const headers=corsHeaders(origin);
 headers.set("Content-Type","application/json; charset=utf-8");
 headers.set("Cache-Control","public,max-age=45");
 let body;
 try{body=await produceOfficialBoMWarningEditionSignal();}
 catch{body={schema:BOM_WARNING_EDITIONS_SCHEMA,checkedAt:new Date().toISOString(),
   indexStatus:"unavailable",activeCodes:null,products:{}};}
 return new Response(request.method==="HEAD"?null:JSON.stringify(body),
  {status:200,headers});
}
