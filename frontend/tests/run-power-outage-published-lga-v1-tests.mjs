import assert from "node:assert/strict";
import {validatePublishedProviderLga,publishedLgaKey}
 from "../src/context-layers/power-outage-published-lga-v1.js";
const now=Date.parse("2026-11-13T06:00:00+10:00");
const utc=ms=>new Date(ms).toISOString();
const generated=utc(now-4*60000),ergonTime=utc(now-5*60000),
 energexTime=utc(now-14*60000);
const names={
 ergon:{name:"Ergon",url:"https://www.ergon.com.au/network/outages/outage-finder/outage-finder-text-view",updated:ergonTime,total:16,events:1},
 energex:{name:"Energex",url:"https://www.energex.com.au/api/outages-text/v1.0.ex/",updated:energexTime,total:33,events:1}
};
const manifest={generated_utc:generated,
 provider_council_counts:{schema_version:1,snapshot_utc:generated},
 council_allocation_status:{}};
for(const [key,p] of Object.entries(names)){
 manifest.provider_council_counts[key]={status:"ok",scope:"all_councils",
  outage_type:"unplanned",source_url:p.url,source_updated_utc:p.updated,
  total_customers:p.total,rows:key==="ergon"?
   [{lga_name:"Burke Shire",affected_customers:6},
    {lga_name:"Carpentaria Shire",affected_customers:10}]:
   [{lga_name:"Brisbane City",affected_customers:33}]};
 manifest.council_allocation_status[p.name]={status:"provider",source_url:p.url,
  source_updated_utc:p.updated,published_customers:p.total,event_count:p.events};
}
const make=(provider,id,num,allocations)=>{
 const source=names[provider];
 return {type:"Feature",geometry:null,properties:{
  provider_code:provider==="ergon"?"au.qld.ergon":"au.qld.energex",
  outage_id:id,outage_type:"unplanned",
  snapshot_utc:generated,council_source_url:source.url,
  provider_data_as_of_utc:source.updated,lga_assignment_source:"provider",
  affected_customers:num,lga_allocations:allocations
 }};
};
const geo={type:"FeatureCollection",features:[
 make("ergon","26FN11158",16,[
  {lga_name:"Carpentaria Shire",affected_customers:10},
  {lga_name:"Burke Shire",affected_customers:6}]),
 make("energex","INCD-100",33,[{lga_name:"Brisbane City",affected_customers:33}])
]};
const result=validatePublishedProviderLga(manifest,geo,{nowMs:now});
assert.deepEqual([...result.verifiedProviders.keys()],["Ergon","Energex"]);
assert.equal(result.byLga.get("CARPENTARIA").customers,10);
assert.equal(result.byLga.get("BURKE").customers,6);
assert.equal(result.byLga.get("BRISBANE").customers,33);
assert.equal(result.byEventLga.get("Ergon:26FN11158|CARPENTARIA"),10);
assert.equal(result.byEventLga.get("Ergon:26FN11158|BURKE"),6);
assert.equal(publishedLgaKey("South Burnett Regional Council"),
 publishedLgaKey("South Burnett Regional"));
assert.equal(publishedLgaKey("Moreton Bay City"),
 publishedLgaKey("Moreton Bay Regional"));
assert.equal(result.verifiedProviders.get("Ergon").customers,16);
const corrupt=structuredClone(geo);
corrupt.features[0].properties.lga_allocations[0].affected_customers=16;
const part=validatePublishedProviderLga(manifest,corrupt,{nowMs:now});
assert.equal(part.verifiedProviders.has("Ergon"),false);
assert.equal(part.verifiedProviders.has("Energex"),true);
assert.match(part.errors.Ergon,/event total/);
assert.throws(()=>validatePublishedProviderLga(manifest,geo,{nowMs:now+50*60000}),/stale/);
const wrongCouncil=structuredClone(manifest);
wrongCouncil.provider_council_counts.ergon.rows[0].affected_customers=99;
const fail=validatePublishedProviderLga(wrongCouncil,geo,{nowMs:now});
assert.equal(fail.verifiedProviders.has("Ergon"),false);
const missing=structuredClone(geo);missing.features.pop();
const recover=validatePublishedProviderLga(manifest,missing,{nowMs:now});
assert.equal(recover.verifiedProviders.has("Energex"),false);
assert.equal(recover.verifiedProviders.has("Ergon"),true);
console.log("PASS published official Ergon 10/6 council split, Energex exact LGA, duplicate/mismatch/stale fail closed");
