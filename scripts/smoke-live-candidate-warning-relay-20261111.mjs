// One-off non-production real-source acceptance of candidate relay.
// Runs in GitHub-hosted runner with outbound access. No deployment or mutations.
import assert from "node:assert/strict";
import {fetchCurrentQldBoMWarningsIndex}
 from "../relay/bom-warning-qld-current-index-v1.js";
import {fetchQldBomWfsCurrentIndexGeometry}
 from "../relay/bom-warning-gis2web-replica-v1.js";
import {relayBomWarningPolygons}
 from "../relay/bom-warning-polygons-v1.js";

const started=Date.now();
const index=await fetchCurrentQldBoMWarningsIndex({nowMs:started});
const active=["IDQ21033","IDQ21035"].filter(x=>index.activeCodes.includes(x));
const expected=new Map();
for(const code of active){
 const result=await fetchQldBomWfsCurrentIndexGeometry(code,index,{nowMs:started});
 if(result?.warnings?.length)expected.set(code,result.warnings.length);
}
console.log("CANDIDATE_SOURCE_GEOMETRY",JSON.stringify({
 checkedUtc:index.checkedUtc,active,expected:Object.fromEntries(expected)
}));
if(!expected.size){
 console.log("CANDIDATE_LIVE_NOT_TESTABLE: no current original source geometry; negative reporting preserved");
 process.exit(0);
}
const response=await relayBomWarningPolygons(
 new Request("https://qscope.example/bom-official-warning-polygons"),
 "https://blakesmith-intel.github.io",()=>new Headers()
);
assert.equal(response.status,200);
const data=await response.json();
for(const [code,count] of expected){
 const items=data.warnings?.filter(w=>w.productCode===code)??[];
 assert.equal(items.length,count,code+" original GIS features must all be counted and returned");
 assert.equal(data.products?.[code]?.count,count,code+" product count must match source");
 assert.equal(data.products?.[code]?.status,"active",code+" active source must be displayed");
 assert(items.every(w=>w.ldmgStatus==="verified"&&w.ddmgStatus==="verified"),
   code+" LGA and DDMG intersections must all be verified, not silently empty");
}
console.log("PASS_LIVE_CANDIDATE_QSCOPE_WARNINGS",JSON.stringify({
 sourceExpected:Object.fromEntries(expected),
 currentIndex:index.activeCodes,
 actual:Object.fromEntries(active.map(c=>[c,data.products?.[c]?.count??null])),
 boundaryVerification:"all-current-warning-polygons",
 elapsedMs:Date.now()-started,
 status:data.status
}));
