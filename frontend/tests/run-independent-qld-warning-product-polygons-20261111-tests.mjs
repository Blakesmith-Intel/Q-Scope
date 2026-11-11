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
 const worker=readFileSync(new URL("../../relay/bom-warning-polygons-v1.js",import.meta.url),"utf8");
 assert(!worker.includes("qld.slice(0,14)"),"No silent truncation of LGA/DDMG reporting");
 assert(worker.includes("fetchQldBomWfsCurrentIndexGeometry"));
 console.log("PASS independent active IDQ21033 (16 polygons) and IDQ21035 (5 polygons), complete independent boundary reports, no truncated counts, absent/stale source guards, four-second CAP issue drift, no cross-product contamination");
}finally{
 globalThis.fetch=originalFetch;Date.now=originalDateNow;
}
