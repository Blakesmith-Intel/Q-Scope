// Nondeploying verification against LIVE Queensland current-index and
// source-exact ArcGIS metadata, not mocked test fixtures or synthetic shapes.
import assert from "node:assert/strict";
import {produceOfficialBoMWarningEditionSignal,BOM_WARNING_EDITIONS_SCHEMA}
 from "../relay/bom-warning-editions-v1.js";
import {fetchCurrentQldBoMWarningsIndex}
 from "../relay/bom-warning-qld-current-index-v1.js";
import {fetchQldBomWfsCurrentIndexGeometry}
 from "../relay/bom-warning-gis2web-replica-v1.js";

const now=Date.now();
const editions=await produceOfficialBoMWarningEditionSignal({nowMs:now});
console.log("LIVE_QSCOPE_WARNING_EDITION_SIGNAL",JSON.stringify(editions));
assert.equal(editions.schema,BOM_WARNING_EDITIONS_SCHEMA);
assert.equal(editions.indexStatus,"verified",
 "Queensland CURRENT index must be independently verified, not inferred");
assert(Array.isArray(editions.activeCodes));
for(const code of ["IDQ21033","IDQ21035","IDQ21037","IDQ21038"])
 assert.equal(editions.products[code].status,"verified",
   code+" source-exact GIS metadata endpoint must respond successfully");
const index=await fetchCurrentQldBoMWarningsIndex({nowMs:Date.now()});
for(const code of ["IDQ21033","IDQ21035"]){
 if(!index.activeCodes.includes(code))continue;
 const geometry=await fetchQldBomWfsCurrentIndexGeometry(code,index,{nowMs:Date.now()});
 const meta=editions.products[code];
 if(geometry?.warnings?.length){
   assert(meta.count>0,code+" current source polygons must be discoverable by watcher");
   const ms=Date.parse(meta.issuedUtc);
   assert(Number.isFinite(ms),code+" watcher needs real GIS issue timestamp");
   const issue=Date.parse(geometry.notice.issuedUtc);
   assert(Math.abs(ms-issue)<120000,
     code+" latest source issue must correspond to genuine current polygons");
 }
}
console.log("PASS_LIVE_QSCOPE_WARNING_EDITION_WATCH",
 JSON.stringify({activeCodes:editions.activeCodes,metadataProducts:editions.products,
 sourceCheck:"original source issues, counts, no geometry and no national CAP crawl"}));
