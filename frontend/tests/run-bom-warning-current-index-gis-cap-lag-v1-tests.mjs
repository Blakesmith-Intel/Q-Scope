import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {sourceExactQldBomWfsFeatures}
 from "../../relay/bom-warning-gis2web-replica-v1.js";
import {reconcileLatestBoMWarnings}
 from "../../relay/bom-warning-product-reconcile-v1.js";
import {reconcileIndexVerifiedWarningGeometry}
 from "../../relay/bom-warning-polygons-v1.js";
import {describeOfficialBomWarningState,isVerifiedActiveBomWarning}
 from "../src/context-layers/bom-warning-operational-v1.js";

// Incident reproduction from 2026-11-02 live authoritative source audit:
// active official Queensland IDQ21035 listing, two original source geometries,
// but latest distributed WMO CAP record still yesterday's cancellation.
const now=Date.parse("2026-11-02T05:00:00Z");
const index={verified:true,activeCodes:["IDQ21033","IDQ21035"],
 checkedUtc:"2026-11-02T05:00:00.000Z"};
const cancelled={notice:{
 productCode:"IDQ21035",status:"cancelled",
 issuedUtc:"2026-11-01T10:13:02Z",
 expiresUtc:"2026-11-01T13:12:58Z",
 headline:"Cancellation of previous severe thunderstorm warning",
 description:"Old cancelled notice",bulletinUrl:"https://www.bom.gov.au/warning/severe-thunderstorm-warning/IDQ21035"
},warnings:[]};
const ring=[[[152.5,-26.0],[152.7,-26.0],[152.65,-26.2],[152.5,-26.0]]];
const f=id=>({type:"Feature",properties:{
 product:"IDQ65650",gml_id:id,
 validfrom_utc:"2026-11-02T04:37:32Z",
 validto_utc:"2026-11-02T05:37:32Z"
},geometry:{type:"Polygon",coordinates:ring}});
const live={type:"FeatureCollection",features:[f("IDZ20006.98371"),f("IDZ20006.98372")]};
assert.equal(sourceExactQldBomWfsFeatures(live,{productCode:"IDQ21035"},{nowMs:now}).length,0,
 "No CAP and no verified current index must not bypass source authenticity");
const currentGeometries=sourceExactQldBomWfsFeatures(
 live,{productCode:"IDQ21035"},{nowMs:now,officialIndexActive:true});
assert.equal(currentGeometries.length,2);
for(const w of currentGeometries){
 assert.equal(w.sourceProduct,"IDQ65650");
 assert.equal(w.capBulletinStatus,"pending-current-source");
 assert.equal(w.bulletinExpiresUtc,null);
 assert(isVerifiedActiveBomWarning(w,now));
 assert.match(w.headline,/CAP bulletin pending/i);
}
const capReconciled=reconcileLatestBoMWarnings([cancelled],{
 nowMs:now,qldCurrentIndex:index});
assert.equal(capReconciled.products.IDQ21035.status,"listed-active");
const merged=reconcileIndexVerifiedWarningGeometry(
 capReconciled,index,currentGeometries,{nowMs:now});
assert.equal(merged.products.IDQ21035.status,"active");
assert.equal(merged.products.IDQ21035.count,2);
assert.equal(merged.products.IDQ21035.bulletinVerification,"pending-current-source");
assert.equal(merged.warnings.length,2);
assert.equal(merged.products.IDQ21035.headline,"",
 "Yesterday's cancellation must not masquerade as today's bulletin");
assert.equal(merged.sourceComplete,false,"CAP is still pending despite verified GIS");
assert.equal(merged.indexOnlyCount,2);
assert.match(describeOfficialBomWarningState({
 products:merged.products,warnings:merged.warnings,selected:"IDQ21035"
}).message,/2 polygons.*GIS polygons verified.*CAP bulletin pending/i);
assert.equal(describeOfficialBomWarningState({
 products:merged.products,warnings:merged.warnings,selected:"IDQ21035"
}).kind,"warning","Incomplete CAP bulletin remains operator-visible");

const noIndex=reconcileIndexVerifiedWarningGeometry(capReconciled,
 {verified:true,activeCodes:[],checkedUtc:index.checkedUtc},
 currentGeometries,{nowMs:now});
assert.equal(noIndex.indexOnlyCount,0,"Official current-list cancellation removes source-only warnings");
const staleIndex=reconcileIndexVerifiedWarningGeometry(capReconciled,
 {...index,checkedUtc:"2026-11-02T04:00:00Z"},
 currentGeometries,{nowMs:now});
assert.equal(staleIndex.indexOnlyCount,0,"Stale current-list verification cannot authorise GIS-only geometry");
const latestCancel=reconcileLatestBoMWarnings([
 cancelled,{notice:{...cancelled.notice,issuedUtc:"2026-11-02T05:01:00Z"},warnings:[]}
],{nowMs:now,qldCurrentIndex:index});
assert.equal(latestCancel.products.IDQ21035.status,"cancelled",
 "Newer CAP cancellation must override older product index");
assert.equal(reconcileIndexVerifiedWarningGeometry(
 latestCancel,index,currentGeometries,{nowMs:now}).indexOnlyCount,0);
const expired={type:"FeatureCollection",features:[{
 ...f("expired"),properties:{...f("expired").properties,validto_utc:"2026-11-02T04:58:00Z"}
}]};
assert.equal(sourceExactQldBomWfsFeatures(expired,{productCode:"IDQ21035"},
 {nowMs:now,officialIndexActive:true}).length,0);
assert.equal(sourceExactQldBomWfsFeatures(live,{productCode:"IDQ21037"},
 {nowMs:now,officialIndexActive:true}).length,0,
 "Index+GIS without CAP only allowed for selected thunderstorm products");

const relay=readFileSync(new URL("../../relay/bom-warning-polygons-v1.js",import.meta.url),"utf8");
assert(relay.includes("qldCurrentIndex.activeCodes")&&
 relay.includes("reconcileIndexVerifiedWarningGeometry(")&&
 relay.includes("officialIndexActive:"),"Live relay must invoke the strict index+GIS recovery");
console.log("PASS 2 real IDQ21035 source features recovered despite stale WMO cancellation, separate IDQ21033, current-index freshness, accurate source reporting, authoritative cancellation and no fake CAP bulletin.");
