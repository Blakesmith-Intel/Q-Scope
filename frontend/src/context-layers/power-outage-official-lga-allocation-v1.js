// Authoritative, release-safe contract for future provider *event-by-council*
// customer allocations. This is not a source adapter and does not guess counts.
// No fetch or Cloudflare work is performed. Never promote this to the live UI
// without a verified, accessible official Ergon/Energex feed of such rows.
export const OFFICIAL_OUTAGE_LGA_SCHEMA="QscopeProviderOfficialLgaAllocationsV1";

const normal=v=>String(v??"").replace(/\s+/g," ").trim();
const key=v=>normal(v).toLocaleUpperCase("en-AU");
const whole=n=>Number.isSafeInteger(n)&&n>=0;

export function normaliseOfficialLgaAllocations(payload,{
  sourceAgeLimitMs=20*60*1000,
  nowMs=Date.now()
}={}){
 if(payload?.schema!==OFFICIAL_OUTAGE_LGA_SCHEMA ||
    !["Ergon","Energex","Essential Energy"].includes(payload.provider) ||
    payload.verifiedOfficialSource!==true ||
    !Array.isArray(payload.rows) ||
    !Number.isFinite(Date.parse(payload.capturedAt)) ||
    Math.abs(nowMs-Date.parse(payload.capturedAt))>sourceAgeLimitMs)
   throw Error("Official LGA source unavailable, unverified or stale");
 const byLga=new Map(),byEvent=new Map(),byEventLga=new Map();
 for(const row of payload.rows){
  const id=normal(row.eventId),council=normal(row.lga),
    type=key(row.type),count=row.customersAffected;
  if(!id||!council||type!=="UNPLANNED"||!whole(count))
   throw Error("Official LGA entry incomplete or invalid");
  const compound=key(payload.provider)+"|"+id+"|"+key(council);
  const previous=byEventLga.get(compound);
  if(previous!==undefined){
   if(previous!==count)throw Error("Conflicting official council count for "+compound);
   continue; // Repeated locality rows must not inflate council totals.
  }
  byEventLga.set(compound,count);
  const lk=key(council);
  if(!byLga.has(lk))byLga.set(lk,{name:council,customers:0,events:new Set()});
  const lga=byLga.get(lk);
  lga.customers+=count;
  lga.events.add(id);
  if(!byEvent.has(id))byEvent.set(id,{customers:0,councils:new Set()});
  const event=byEvent.get(id);
  event.customers+=count;
  event.councils.add(lk);
 }
 return {
  provider:payload.provider,
  capturedAt:payload.capturedAt,
  byLga,byEvent,
  source:normal(payload.sourceUrl)
 };
}

// Only present an exact council number if:
//   1. it came from the authenticated provider's per-LGA publication;
//   2. its snapshot is fresh; and
//   3. the provider's allocations for overlapping event IDs reconcile with
//      the current event-wide ArcGIS snapshot for those same IDs.
// Never replace with 0, an arbitrary point's LGA or area percentages.
export function reconcileOfficialLgaAllocations(official,providerEvents,{
  requireAllEvents=true
}={}){
 const expected=new Map();
 for(const item of providerEvents??[]){
  const id=normal(item.eventId),count=item.customersAffected;
  if(!id||!whole(count))throw Error("Invalid event count in spatial provider feed");
  if(expected.has(id)&&expected.get(id)!==count)
   throw Error("Contradictory provider event customers: "+id);
  expected.set(id,count);
 }
 const unmatched=[],disagree=[],missing=[];
 for(const [id,event] of official.byEvent){
  if(!expected.has(id))unmatched.push(id);
  else if(expected.get(id)!==event.customers)
   disagree.push({eventId:id,arcgisCustomers:expected.get(id),
     councilCustomers:event.customers});
 }
 if(requireAllEvents)
  for(const id of expected.keys())
   if(!official.byEvent.has(id))missing.push(id);
 const valid=unmatched.length===0&&disagree.length===0&&missing.length===0;
 return {valid,unmatched,disagree,missing,
  byLga:valid?new Map([...official.byLga].map(([lga,row])=>[
   lga,{name:row.name,customers:row.customers,outages:row.events.size,
        provider:official.provider,capturedAt:official.capturedAt}
  ])):null};
}
