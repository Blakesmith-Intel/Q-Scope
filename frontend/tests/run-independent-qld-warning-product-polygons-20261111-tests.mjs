import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {relayBomWarningPolygons} from "../../relay/bom-warning-polygons-v1.js";
import {indexVerifiedQldBomWfsFeatures}
 from "../../relay/bom-warning-gis2web-replica-v1.js";
import {reconcileLatestBoMWarnings}
 from "../../relay/bom-warning-product-reconcile-v1.js";
import {filterOfficialWarnings,warningProductAffectedGroups,sourceQualifiedOfficialWarnings}
 from "../src/context-layers/bom-warning-operational-v1.js";

const now=Date.parse("2026-11-11T05:34:00Z");
const issued=now-6*60000,expires=now+54*60000;
const originalFetch=globalThis.fetch,originalDateNow=Date.now;
const calls={regional:0,detailed:0,intersections:0};
const indexedCodes=["IDQ21033","IDQ21035"];
let originalFwo=null;
const feature=(code,i,issue=issued,expiry=expires)=>({
 type:"Feature",id:code+":"+i,
 properties:{gml_id:code+":"+i,product:code==="IDQ21033"?"IDQ65654":"IDQ65650",
  validfrom_utc:issue,validto_utc:expiry,phenomena:"Damaging Winds"},
 geometry:{type:"Polygon",coordinates:[[
  [151+i*.005,-27],[151.002+i*.005,-27],
  [151.002+i*.005,-27.002],[151+i*.005,-27.002],[151+i*.005,-27]
 ]]}
});
const regional=Array.from({length:16},(_,i)=>feature("IDQ21033",i));
const detailed=Array.from({length:5},(_,i)=>feature("IDQ21035",i));
const collection=(rows)=>({type:"FeatureCollection",features:rows});
const listing=()=>(
 "<!doctype html><html><title>Queensland Warnings Summary</title>"+
 "x".repeat(1200)+"<ul><li>Warnings current:</li>"+
 indexedCodes.map(code=>'<li><a href="/products/'+code+'.shtml">Severe Thunderstorm Warning</a></li>').join("")+
 "</ul><p id=\"timestamp\">This page was created at <strong>05:33 on Wednesday 11 November 2026 (UTC)</strong></p></html>"
);
const text=(body)=>({ok:true,async text(){return body}});
const json=(body)=>({ok:true,async json(){return body}});
Date.now=()=>now;
globalThis.fetch=async (input,options={})=>{
 const url=String(input);
 if(url.includes("au-bom-en/rss.xml"))
   return text("<rss><channel><title>CAP</title><description>National CAP index with zero matching items</description></channel></rss>");
 if(url.includes("/qld/warnings.shtml"))return text(listing());
 if(url.includes("/fwo/IDQ21033.cap.xml")&&originalFwo)return new Response(originalFwo,{status:200});
 if(url.includes("BOM_Land_Warnings_RO")){
  const q=new URL(url),code=q.searchParams.get("where");
  if(code==="product='IDQ65654'"){calls.regional++;return text(JSON.stringify(collection(regional)));}
  if(code==="product='IDQ65650'"){calls.detailed++;return text(JSON.stringify(collection(detailed)));}
  return text(JSON.stringify(collection([])));
 }
 if(url.includes("/arcgis/rest/services/Boundaries/")){
  calls.intersections++;
  const params=new URLSearchParams(options.body);
  const coords=JSON.parse(params.get("geometry")).rings;
  const lon=coords[0][0][0];
  const key=Math.round((lon-151)*1000);
  if(url.includes("AdministrativeBoundaries")){
   return json({features:[{attributes:{lga:"LGA "+key}}]});
  }
  return json({features:[{attributes:{District:"DDMG "+key}}]});
 }
 throw Error("Unexpected network "+url);
};
try{
 const result=await relayBomWarningPolygons(new Request("https://example.test/bom-official-warning-polygons"),
  "https://blakesmith-intel.github.io",()=>new Headers());
 const payload=await result.json();
 assert.equal(payload.status,"active");
 assert.equal(payload.products.IDQ21033.status,"active");
 assert.equal(payload.products.IDQ21035.status,"active");
 assert.equal(payload.products.IDQ21033.count,16,"All regional features, not first 14");
 assert.equal(payload.products.IDQ21035.count,5,"Detailed product count stays separate");
 assert.equal(payload.warnings.length,21);
 assert.equal(calls.regional,1,"Regional GIS must be queried without its CAP being sampled");
 assert.equal(calls.detailed,1,"Detailed GIS must be queried independently");
 assert.equal(calls.intersections,42,"All 21 polygons get their own LGA+DDMG check");
 assert.equal(payload.qldCurrentIndexStatus,"verified-current-products");
 assert.equal(filterOfficialWarnings(payload.warnings,"IDQ21033").length,16);
 assert.equal(filterOfficialWarnings(payload.warnings,"IDQ21035").length,5);
 assert.equal(sourceQualifiedOfficialWarnings(payload.warnings,"IDQ21033").length,16);
 assert.equal(sourceQualifiedOfficialWarnings(payload.warnings,"IDQ21035").length,5);
 const regionalReport=warningProductAffectedGroups(filterOfficialWarnings(payload.warnings,"IDQ21033"));
 assert.equal(regionalReport.count,16);
 assert.equal(regionalReport.ldmgComplete,true);
 assert.equal(regionalReport.ddmgComplete,true);
 assert.equal(regionalReport.ldmgs.length,16);
 assert.equal(regionalReport.ddmgs.length,16);
 const detailedReport=warningProductAffectedGroups(filterOfficialWarnings(payload.warnings,"IDQ21035"));
 assert.equal(detailedReport.count,5);
 const indexed={verified:true,checkedUtc:new Date(now-60000).toISOString(),
  activeCodes:["IDQ21033"]};
 assert.equal(indexVerifiedQldBomWfsFeatures(collection(regional),
  "IDQ21035",indexed,{nowMs:now}),null,"No cross-product pollution");
 assert.equal(indexVerifiedQldBomWfsFeatures(collection(regional),
  "IDQ21033",{...indexed,activeCodes:[]},{nowMs:now}),null,"Cancelled/absent current product is forbidden");
 assert.equal(indexVerifiedQldBomWfsFeatures(collection(regional),
  "IDQ21033",{...indexed,checkedUtc:new Date(now-30*60000).toISOString()},
  {nowMs:now}),null,"Stale index cannot authenticate fresh GIS");
 assert.equal(indexVerifiedQldBomWfsFeatures(collection(
  [feature("IDQ21033",0,issued,now-1)]),
  "IDQ21033",indexed,{nowMs:now}),null,"Expired original geometry forbidden");
 const cap={productCode:"IDQ21033",status:"issued",
  issuedUtc:new Date(issued+4000).toISOString(),expiresUtc:new Date(expires).toISOString(),
  headline:"Severe Thunderstorm Warning for parts of Queensland"};
 const gis=indexVerifiedQldBomWfsFeatures(collection(regional),"IDQ21033",indexed,{nowMs:now});
 const merged=reconcileLatestBoMWarnings([
  {notice:cap,warnings:[]},gis
 ],{nowMs:now,qldCurrentIndex:indexed});
 assert.equal(merged.products.IDQ21033.count,16,
  "Four-second CAP/GIS2Web issue drift must not erase active regional polygon count");
 assert.equal(merged.warnings.length,16);
 assert.equal(merged.products.IDQ21033.headline,cap.headline,
  "Preserve authenticated CAP bulletin wording alongside GIS geometry");
 // 20 November regression: independent original GIS and FWO issue clocks.
 const oldIssue=now-15*60000,newIssue=now-3*60000;
 const older=indexVerifiedQldBomWfsFeatures(collection([
  feature("IDQ21033",0,oldIssue,expires)
 ]),"IDQ21033",indexed,{nowMs:now});
 const newNotice={...cap,issuedUtc:new Date(newIssue).toISOString()};
 const update={notice:newNotice,warnings:[]};
 const transition=reconcileLatestBoMWarnings([older,update],{nowMs:now,qldCurrentIndex:indexed});
 assert.equal(transition.products.IDQ21033.status,"active");
 assert.equal(transition.products.IDQ21033.geometryUpdatePending,true);
 assert.equal(transition.products.IDQ21033.count,1);
 assert.equal(transition.products.IDQ21033.issuedUtc,newNotice.issuedUtc);
 assert.equal(transition.products.IDQ21033.geometryIssuedUtc,older.notice.issuedUtc);
 assert.equal(transition.warnings[0].geometryUpdatePending,true);
 assert.deepEqual(transition.warnings[0].geometry,older.warnings[0].geometry);
 assert.equal(Date.parse(transition.warnings[0].expiresUtc),expires);
 const newer=indexVerifiedQldBomWfsFeatures(collection([
  feature("IDQ21033",1,newIssue,expires),feature("IDQ21033",2,newIssue,expires)
 ]),"IDQ21033",indexed,{nowMs:now});
 const caughtUp=reconcileLatestBoMWarnings([older,update,newer],{nowMs:now,qldCurrentIndex:indexed});
 assert.equal(caughtUp.products.IDQ21033.count,2);
 assert.equal(Boolean(caughtUp.products.IDQ21033.geometryUpdatePending),false);
 assert.deepEqual(caughtUp.warnings.map(w=>w.id),newer.warnings.map(w=>w.id));
 for(const badIndex of [null,{...indexed,checkedUtc:new Date(newIssue-60000).toISOString()},
  {...indexed,checkedUtc:new Date(now-21*60000).toISOString()}]){
  assert.equal(reconcileLatestBoMWarnings([older,update],{nowMs:now,qldCurrentIndex:badIndex}).warnings.length,0);
 }
 assert.equal(reconcileLatestBoMWarnings([older,update],{nowMs:now,qldCurrentIndex:{...indexed,activeCodes:[]}}).warnings.length,0);
 const cancelled={notice:{...newNotice,status:"cancelled",issuedUtc:new Date(newIssue-60000).toISOString()},warnings:[]};
 assert.equal(reconcileLatestBoMWarnings([older,cancelled,update],{nowMs:now,qldCurrentIndex:indexed}).warnings.length,0,
  "A reactivation cannot retain geometry from a cancelled edition");
 const expired={...older,warnings:older.warnings.map(w=>({...w,geometryExpiresUtc:new Date(now-1).toISOString()}))};
 assert.equal(reconcileLatestBoMWarnings([expired,update],{nowMs:now,qldCurrentIndex:indexed}).warnings.length,0);
 const capOnly={...older,warnings:older.warnings.map(w=>({...w,geometryVerification:undefined}))};
 assert.equal(reconcileLatestBoMWarnings([capOnly,update],{nowMs:now,qldCurrentIndex:indexed}).warnings.length,0,
  "Previously published CAP shapes are not independently current geometry");
 // Exercise the full relay (not merely the reconciler), including actual
 // FWO CAP parsing, independent GIS retrieval and boundary intersections.
 indexedCodes.splice(0,indexedCodes.length,"IDQ21033");
 originalFwo='<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">'+
  '<identifier>AusBoM-IDQ21033-update</identifier><sender>CAP.Message@bom.gov.au</sender>'+
  '<sent>'+newNotice.issuedUtc+'</sent><status>Actual</status><msgType>Update</msgType>'+
  '<info><language>en-AU</language><category>Met</category><event>Severe Thunderstorm Warning</event>'+
  '<headline>Revised regional severe thunderstorm warning</headline>'+
  '<expires>'+newNotice.expiresUtc+'</expires><area><areaDesc>Queensland</areaDesc></area></info></alert>';
 function setRegional(...rows){regional.splice(0,regional.length,...rows);}
 async function refreshFixture(){
  return (await relayBomWarningPolygons(new Request("https://example.test/bom-official-warning-polygons?force=1"),
   "https://blakesmith-intel.github.io",()=>new Headers())).json();
 }
 setRegional(feature("IDQ21033",0,oldIssue,expires));
 const relayLag=await refreshFixture();
 assert.equal(relayLag.products.IDQ21033.geometryUpdatePending,true,"Full relay must not discard a freshly authenticated still-valid GIS edition");
 assert.equal(relayLag.products.IDQ21033.bulletinIssuedUtc,newNotice.issuedUtc);
 assert.equal(relayLag.warnings.length,1);
 assert.equal(relayLag.warnings[0].ldmgStatus,"verified");
 assert.equal(relayLag.warnings[0].ddmgStatus,"verified");
 setRegional(feature("IDQ21033",1,newIssue,expires),feature("IDQ21033",2,newIssue,expires));
 const relayNew=await refreshFixture();
 assert.equal(Boolean(relayNew.products.IDQ21033.geometryUpdatePending),false);
 assert.equal(relayNew.warnings.length,2);
 assert(relayNew.warnings.every(w=>Date.parse(w.issuedUtc)===newIssue&&w.ldmgStatus==="verified"&&w.ddmgStatus==="verified"));
 setRegional();
 const withdrawn=await refreshFixture();
 assert.equal(withdrawn.warnings.length,0,"Previously verified geometry disappears if the current GIS source withdraws it");
 assert.equal(withdrawn.products.IDQ21033.status,"geometry-unavailable");
 const worker=readFileSync(new URL("../../relay/bom-warning-polygons-v1.js",import.meta.url),"utf8");
 assert(!worker.includes("qld.slice(0,14)"),"No silent truncation of LGA/DDMG reporting");
 assert(worker.includes("fetchQldBomWfsCurrentIndexGeometry"));
 console.log("PASS independent active IDQ21033 (16 polygons) and IDQ21035 (5 polygons), complete independent boundary reports, no truncated counts, absent/stale source guards, four-second CAP issue drift, no cross-product contamination");
}finally{
 globalThis.fetch=originalFetch;Date.now=originalDateNow;
}
