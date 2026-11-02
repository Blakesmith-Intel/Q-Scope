import assert from "node:assert/strict";
import {sourceExactQldBomWfsFeatures}
 from "../../relay/bom-warning-gis2web-replica-v1.js";
import {reconcileLatestBoMWarnings}
 from "../../relay/bom-warning-product-reconcile-v1.js";

const now=Date.parse("2026-11-02T04:12:00Z");
const issue=(productCode,when)=>({
 productCode,status:"issued",issuedUtc:when,
 expiresUtc:"2026-11-02T05:00:00Z",
 headline:"Original Bureau warning",description:"Official warning",
 instruction:"Check BoM",areaDescription:"Queensland",
 bulletinUrl:"https://www.bom.gov.au/warning/severe-thunderstorm-warning/"+productCode
});
const newer=issue("IDQ21033","2026-11-02T04:00:00Z");
const older=issue("IDQ21033","2026-11-02T03:35:00Z");
const separate=issue("IDQ21035","2026-11-02T04:00:00Z");
const ring=[[[152,-26],[152.2,-26],[152.2,-26.2],[152,-26]]];
const feature=(id,product,from,until="2026-11-02T04:45:00Z")=>({
 type:"Feature",properties:{
  product,gml_id:id,validfrom_utc:from,validto_utc:until
 },geometry:{type:"Polygon",coordinates:ring}
});
const collection={type:"FeatureCollection",features:[
 feature("first","IDQ65654",newer.issuedUtc),
 feature("second","IDQ65654",newer.issuedUtc),
 feature("third","IDQ65654",older.issuedUtc),
 feature("unrelated","IDQ65650",newer.issuedUtc),
 feature("expired","IDQ65654",older.issuedUtc,"2026-11-02T04:01:00Z"),
 feature("mismatch","IDQ65654","2026-11-02T03:10:00Z")
]};
const two=sourceExactQldBomWfsFeatures(collection,newer,{nowMs:now});
assert.equal(two.length,2,"Single latest issue alone must never claim all GIS warnings");
const three=sourceExactQldBomWfsFeatures(collection,[newer,older],{nowMs:now});
assert.equal(three.length,3,"All three CAP-authenticated active regions must be retained");
assert(three.every(w=>w.productCode==="IDQ21033"&&w.sourceProduct==="IDQ65654"));
assert.equal(sourceExactQldBomWfsFeatures(collection,[separate],{nowMs:now}).length,1,
 "Detailed source stays isolated from regional source");
const olderRow={notice:older,warnings:three.filter(w=>Date.parse(w.issuedUtc)===Date.parse(older.issuedUtc))};
const latestRow={notice:newer,warnings:three.filter(w=>Date.parse(w.issuedUtc)===Date.parse(newer.issuedUtc))};
const index={verified:true,activeCodes:["IDQ21033"],
 checkedUtc:"2026-11-02T04:10:00Z"};
const current=reconcileLatestBoMWarnings([olderRow,latestRow],{
 nowMs:now,qldCurrentIndex:index
});
assert.equal(current.products.IDQ21033.status,"active");
assert.equal(current.products.IDQ21033.count,3);
assert.equal(current.warnings.length,3);
const noIndex=reconcileLatestBoMWarnings([olderRow,latestRow],{nowMs:now});
assert.equal(noIndex.products.IDQ21033.count,2,
 "Without a verified active-product index do not retain older issuance");
const cancelled=reconcileLatestBoMWarnings([olderRow,latestRow,{
 notice:{productCode:"IDQ21033",status:"cancelled",
 issuedUtc:"2026-11-02T04:11:00Z"},warnings:[]
}],{nowMs:now,qldCurrentIndex:index});
assert.equal(cancelled.warnings.length,0,"Current cancellation removes every area");
assert.equal(cancelled.products.IDQ21033.status,"cancelled");
const revisedOldCAP={...olderRow,warnings:[{
 ...three[2],sourceProduct:undefined,warningGeometrySource:undefined
}]};
const safe=reconcileLatestBoMWarnings([revisedOldCAP,latestRow],{
 nowMs:now,qldCurrentIndex:index
});
assert.equal(safe.warnings.length,2,
 "Superseded standalone CAP polygon cannot be republished as current");
console.log("PASS 3/3 concurrently active source-matched regional polygons, IDQ21035 separation, original validity, cancellation and no superseded CAP resurrection.");
