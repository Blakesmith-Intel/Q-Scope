import assert from "node:assert/strict";
import {OFFICIAL_OUTAGE_LGA_SCHEMA,normaliseOfficialLgaAllocations,
 reconcileOfficialLgaAllocations}
 from "../src/context-layers/power-outage-official-lga-allocation-v1.js";
const now=Date.parse("2026-11-13T05:20:00+10:00");
const fixture={
 schema:OFFICIAL_OUTAGE_LGA_SCHEMA,provider:"Ergon",
 verifiedOfficialSource:true,sourceUrl:"https://www.ergon.com.au/network/outages/outage-finder/outage-finder-text-view",
 capturedAt:new Date(now).toISOString(),
 rows:[
  {eventId:"26SW14789",lga:"Toowoomba Regional Council",type:"UNPLANNED",customersAffected:3},
  {eventId:"26SW14789",lga:"Western Downs Regional Council",type:"UNPLANNED",customersAffected:90},
  {eventId:"26WB11216",lga:"South Burnett Regional Council",type:"UNPLANNED",customersAffected:116},
  // Repeated locality entry from same event/LGA cannot double-count.
  {eventId:"26WB11216",lga:"South Burnett Regional Council",type:"UNPLANNED",customersAffected:116}
 ]};
const allocations=normaliseOfficialLgaAllocations(fixture,{nowMs:now});
assert.equal(allocations.byLga.get("TOOWOOMBA REGIONAL COUNCIL").customers,3);
assert.equal(allocations.byLga.get("WESTERN DOWNS REGIONAL COUNCIL").customers,90);
assert.equal(allocations.byLga.get("SOUTH BURNETT REGIONAL COUNCIL").customers,116);
let reconciled=reconcileOfficialLgaAllocations(allocations,[
 {eventId:"26SW14789",customersAffected:93},
 {eventId:"26WB11216",customersAffected:116}
]);
assert.equal(reconciled.valid,true);
assert.equal(reconciled.byLga.get("TOOWOOMBA REGIONAL COUNCIL").customers,3);
assert.equal(reconciled.byLga.get("WESTERN DOWNS REGIONAL COUNCIL").customers,90);
assert.equal(reconciled.byLga.get("SOUTH BURNETT REGIONAL COUNCIL").customers,116);
assert.equal(reconcileOfficialLgaAllocations(allocations,[
 {eventId:"26SW14789",customersAffected:94},
 {eventId:"26WB11216",customersAffected:116}
]).valid,false);
assert.equal(reconcileOfficialLgaAllocations(allocations,[
 {eventId:"26SW14789",customersAffected:93},
 {eventId:"26WB11216",customersAffected:116},
 {eventId:"MISSING",customersAffected:23}
]).valid,false);
assert.throws(()=>normaliseOfficialLgaAllocations({...fixture,verifiedOfficialSource:false},
 {nowMs:now}));
assert.throws(()=>normaliseOfficialLgaAllocations(fixture,{nowMs:now+30*60*1000}));
assert.throws(()=>normaliseOfficialLgaAllocations({...fixture,rows:[...fixture.rows,
 {...fixture.rows[0],customersAffected:6}]},{nowMs:now}));
console.log("PASS official per-LGA 3/90 split vs 93 event; exact audit; stale/missing/conflicting data blocked");
