import assert from "node:assert/strict";
import {parseCurrentQldBoMWarningsIndex} from "../../relay/bom-warning-qld-current-index-v1.js";
import {reconcileLatestBoMWarnings} from "../../relay/bom-warning-product-reconcile-v1.js";
import {classifyPublishedBoMThunderstormHazards} from "../src/context-layers/bom-warning-hazard-terms-v1.js";
import {describeOfficialBomWarningState} from "../src/context-layers/bom-warning-operational-v1.js";

const now=Date.parse("2026-10-30T09:48:00Z");
const fakePage=({indexLinks="",created="09:46",complete=true}={})=>
  "<!doctype html><html><title>Queensland Warnings Summary</title>"+
  "x".repeat(1200)+"<ul><li>Warnings current:</li>"+
  '<li><a href="/products/IDQ21033.shtml">Severe Thunderstorm Warning</a></li>'+
  indexLinks+"</ul>"+
  (complete?'<p id="timestamp">This page was created at <strong>'+created+'\n on Friday 30 October 2026 (UTC)</strong></p>':"")+
  "</html>";
const index=parseCurrentQldBoMWarningsIndex(fakePage(),{nowMs:now});
assert(index?.verified);
assert.deepEqual(index.activeCodes,["IDQ21033"]);
assert.equal(index.checkedUtc,"2026-10-30T09:46:00.000Z");
const productStates=reconcileLatestBoMWarnings([],{
 complete:false,nowMs:now,qldCurrentIndex:index
});
assert.equal(productStates.products.IDQ21033.status,"listed-active");
for(const code of ["IDQ21035","IDQ21037","IDQ21038"])
 assert.equal(productStates.products[code].status,"no-active",code);
const detailed=describeOfficialBomWarningState({
 products:productStates.products,selected:"IDQ21035"
});
assert.match(detailed.message,/No current warnings/);
assert.equal(detailed.kind,"normal");
const all=describeOfficialBomWarningState({products:productStates.products,selected:"all"});
assert.match(all.message,/current in BoM listing/);
assert.match(all.message,/IDQ21035: none current/);
assert.doesNotMatch(all.message,/Other products not verified/);

assert.equal(parseCurrentQldBoMWarningsIndex(fakePage({created:"08:00"}),{nowMs:now}),null,
 "Stale BoM listing must not prove an all-clear");
assert.equal(parseCurrentQldBoMWarningsIndex(fakePage({complete:false}),{nowMs:now}),null,
 "Missing official generation timestamp must not prove an all-clear");
assert.equal(parseCurrentQldBoMWarningsIndex("<html>bad</html>",{nowMs:now}),null);
const unknown=reconcileLatestBoMWarnings([],{complete:false,nowMs:now,qldCurrentIndex:null});
assert.equal(unknown.products.IDQ21035.status,"unavailable",
 "An unverified source outage must not masquerade as clear");

const officialNew=parseCurrentQldBoMWarningsIndex(fakePage({
 indexLinks:'<li><a href="/products/IDQ21035.shtml">Detailed warning</a></li>'
}),{nowMs:now});
const listed=reconcileLatestBoMWarnings([],{complete:false,nowMs:now,qldCurrentIndex:officialNew});
assert.equal(listed.products.IDQ21035.status,"listed-active");

const latestNotice={productCode:"IDQ21033",status:"issued",
 issuedUtc:"2026-10-30T09:38:54Z",expiresUtc:"2026-10-30T14:38:48Z",
 headline:"Severe Thunderstorm Warning",
 description:"Severe thunderstorms are likely to produce heavy rainfall that may lead to flash flooding in the warning area over the next several hours.\nHeavy to locally intense rainfall has been reported east of Charleville this afternoon.\n65 mm recorded at Joylands.",
 bulletinUrl:"https://www.bom.gov.au/warning/severe-thunderstorm-warning/IDQ21033"};
const value=reconcileLatestBoMWarnings([{notice:latestNotice,warnings:[]}],
 {complete:false,nowMs:now,qldCurrentIndex:index});
assert.equal(value.products.IDQ21033.status,"geometry-unavailable",
 "Real issued bulletin remains active even if its new GIS polygons are delayed");
assert.equal(value.products.IDQ21035.status,"no-active");
assert.equal(value.products.IDQ21033.hazardAssessment.level,"severe");
assert.deepEqual(value.products.IDQ21033.hazardAssessment.highEnd,[],
 "Already-reported locally intense rain MUST NOT upgrade forecast HEAVY RAINFALL warning");
assert(value.products.IDQ21033.hazardAssessment.hazards.includes("Heavy rainfall"));
assert.equal(classifyPublishedBoMThunderstormHazards({
 description:"Severe thunderstorms are likely to produce intense rainfall."
}).level,"high-end");
assert.equal(classifyPublishedBoMThunderstormHazards({
 phenomena:"R+",description:"Heavy to locally intense rain was recorded."
}).level,"high-end",
 "Explicit original official high-end hazard code is authoritative");

const canceled={...latestNotice,status:"cancelled"};
const statesCancel=reconcileLatestBoMWarnings([{notice:canceled,warnings:[]}],
 {complete:false,nowMs:now,qldCurrentIndex:index});
assert.equal(statesCancel.products.IDQ21033.status,"listed-active",
 "New BoM listing takes precedence over old cancel when not all CAP history included");
const noActiveIndex={...index,activeCodes:[]};
assert.equal(reconcileLatestBoMWarnings([{notice:canceled,warnings:[]}],
 {complete:false,nowMs:now,qldCurrentIndex:noActiveIndex}).products.IDQ21033.status,"cancelled");

// 1 November 2026: a BoM "Warnings current" LIST can contain a cancellation
// link. It is an authoritative *inactive* product, not an active warning.
// This used to show "current in BoM listing; polygon awaiting verification"
// long after IDQ21033 and IDQ21035 had been cancelled.
const cancellationListing=fakePage({
 created:"09:46",
 indexLinks:'<li><a href="/products/IDQ21035.shtml"><span>Cancellation of Detailed Severe Thunderstorm Warning</span></a></li>'
}).replace('>Severe Thunderstorm Warning</a>',
 '>Cancellation of Severe Thunderstorm Warning for Wide Bay and Burnett Forecast District.</a>');
const cancelledIndex=parseCurrentQldBoMWarningsIndex(cancellationListing,{nowMs:now});
assert(cancelledIndex?.verified);
assert.deepEqual(cancelledIndex.activeCodes,[],
 "A cancellation listed under Warnings current is NOT an active warning");
const currentClear=reconcileLatestBoMWarnings([
 {notice:latestNotice,warnings:[{
  id:"old-regional",official:true,productCode:"IDQ21033",state:"QLD",
  issuedUtc:latestNotice.issuedUtc,expiresUtc:latestNotice.expiresUtc
 }]},
 {notice:{...latestNotice,productCode:"IDQ21035"},warnings:[]}
],{complete:false,nowMs:now,qldCurrentIndex:cancelledIndex});
assert.equal(currentClear.products.IDQ21033.status,"no-active",
 "Fresh official index must supersede older 'issued' national CAP history");
assert.equal(currentClear.products.IDQ21035.status,"no-active");
assert.deepEqual(currentClear.warnings,[],
 "No stale polygons after official current-list cancellation");
assert.match(describeOfficialBomWarningState({
 products:currentClear.products,selected:"IDQ21033"
}).message,/No current warnings/);
assert.match(describeOfficialBomWarningState({
 products:currentClear.products,selected:"IDQ21035"
}).message,/No current warnings/);
assert.equal(describeOfficialBomWarningState({
 products:currentClear.products
}).message,"No current warnings");
const issuedAfterIndex={...latestNotice,issuedUtc:"2026-10-30T09:47:00Z"};
const newerActive=reconcileLatestBoMWarnings([
 {notice:issuedAfterIndex,warnings:[]}
],{complete:false,nowMs:now,qldCurrentIndex:cancelledIndex});
assert.equal(newerActive.products.IDQ21033.status,"geometry-unavailable",
 "A real CAP warning issued AFTER the index was generated must stay active");
const newerCancel=reconcileLatestBoMWarnings([
 {notice:{...issuedAfterIndex,status:"cancelled"},warnings:[]}
],{complete:false,nowMs:now,qldCurrentIndex:index});
assert.equal(newerCancel.products.IDQ21033.status,"cancelled",
 "A new CAP cancellation overrides an older index that still lists active");
const bothActiveSameProduct=fakePage({indexLinks:
 '<li><a href="/warning/severe-thunderstorm-warning/IDQ21035">Cancellation of Detailed warning</a></li>'+
 '<li><a href="/warning/severe-thunderstorm-warning/IDQ21035">Severe Thunderstorm Warning for South East Queensland</a></li>'
});
assert.deepEqual(parseCurrentQldBoMWarningsIndex(bothActiveSameProduct,{nowMs:now}).activeCodes,
 ["IDQ21033","IDQ21035"],
 "One cancelled regional event must not hide an independently active event for the same product");

console.log("PASS real 30-Oct BoM source scenario: current regional warning and 2 prospective GIS shapes, detailed product no current, observed intense rain not upgraded, independent index all-clear fail-closed");
