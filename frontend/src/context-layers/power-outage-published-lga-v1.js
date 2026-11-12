// Q-Scope read-only view of a public, provider-verified Queensland outage
// snapshot. Its source collector reads the Ergon/Energex OFFICIAL text view
// and checks each council allocation against publisher event totals.
// This is a transparent THIRD-PARTY mirror, NOT a claim of direct provider API
// access. No Cloudflare Worker requests, no additional polling timer.
export const PUBLISHED_PROVIDER_LGA_DATA_BASE=
 "https://gowlettluke.github.io/qldpoweroutages/data/";
export const PUBLISHED_LGA_REFRESH_MS=15*60*1000;
export const PUBLISHED_LGA_MAX_SNAPSHOT_AGE_MS=35*60*1000;
export const PUBLISHED_LGA_MAX_PROVIDER_AGE_MS=45*60*1000;
const CHECKED_PROVIDERS=Object.freeze({
 ergon:{code:"au.qld.ergon",name:"Ergon",domain:"www.ergon.com.au"},
 energex:{code:"au.qld.energex",name:"Energex",domain:"www.energex.com.au"}
});
const validCount=v=>Number.isSafeInteger(v)&&v>=0;
export function publishedLgaKey(value){
 return String(value??"").trim().replace(/\s+/g," ").toLocaleUpperCase("en-AU")
   .replace(/\s+COUNCIL$/,"")
   .replace(/\s+ABORIGINAL SHIRE$/,"")
   .replace(/\s+(REGIONAL|CITY|SHIRE)$/,"")
   .replace(/[^A-Z0-9]/g,"");
}
const dateValue=x=>{
 const ms=Date.parse(String(x??""));
 return Number.isFinite(ms)?ms:null;
};
const sourceFresh=(value,now,maxAge)=>{
 const ms=dateValue(value);
 return ms!==null&&ms<=now+5*60*1000&&now-ms<=maxAge;
};
const sourceHost=(url)=>{
 try{return new URL(url).hostname.toLowerCase()}catch{return ""}
};
// Reject provider mismatch, truncated snapshots, duplicate event IDs,
// publisher time mismatches and implausible fabricated council sums.
export function validatePublishedProviderLga(manifest,geo,{
 nowMs=Date.now()
}={}){
 if(!manifest||!geo||!Array.isArray(geo.features) ||
    manifest.provider_council_counts?.schema_version!==1 ||
    manifest.generated_utc!==manifest.provider_council_counts.snapshot_utc ||
    !sourceFresh(manifest.generated_utc,nowMs,PUBLISHED_LGA_MAX_SNAPSHOT_AGE_MS))
  throw Error("Published provider outage snapshot unavailable or stale");
 const verifiedProviders=new Map(),byLga=new Map(),byEventLga=new Map(),errors={};
 for(const [key,meta] of Object.entries(CHECKED_PROVIDERS)){
  try{
   const source=manifest.provider_council_counts[key];
   const allocation=manifest.council_allocation_status?.[meta.name];
   if(source?.status!=="ok"||source.scope!=="all_councils"||
      source.outage_type!=="unplanned" ||
      !Array.isArray(source.rows)||!validCount(source.total_customers) ||
      sourceHost(source.source_url)!==meta.domain ||
      allocation?.status!=="provider" && allocation?.status!=="provider_cache" ||
      !sourceFresh(source.source_updated_utc,nowMs,PUBLISHED_LGA_MAX_PROVIDER_AGE_MS) ||
      !sourceFresh(allocation.source_updated_utc,nowMs,PUBLISHED_LGA_MAX_PROVIDER_AGE_MS) ||
      dateValue(source.source_updated_utc)!==dateValue(allocation.source_updated_utc) ||
      allocation.published_customers!==source.total_customers)
    throw Error("Source council totals unavailable, unverified or outdated");
   const listed=new Map(),detail=new Map(),ids=new Set(),events=new Map();
   let eventTotal=0;
   for(const feature of geo.features){
    const p=feature?.properties??{};
    if(p.provider_code!==meta.code)continue;
    const id=String(p.outage_id??"").trim();
    if(!id||ids.has(id) || p.outage_type!=="unplanned" ||
       p.snapshot_utc!==manifest.generated_utc ||
       p.council_source_url!==allocation.source_url ||
       dateValue(p.provider_data_as_of_utc)!==dateValue(source.source_updated_utc) ||
       !["provider","provider_cache"].includes(p.lga_assignment_source) ||
       !validCount(p.affected_customers) ||
       !Array.isArray(p.lga_allocations)||!p.lga_allocations.length)
      throw Error("Source event missing, duplicated or not provider-attributed");
    ids.add(id);
    let localTotal=0;
    const within=new Set();
    for(const row of p.lga_allocations){
     const name=String(row.lga_name??"").trim();
     const lga=publishedLgaKey(name),count=row.affected_customers;
     if(!lga||!validCount(count)||within.has(lga))
      throw Error("Invalid or duplicate council allocation for "+id);
     within.add(lga);localTotal+=count;
     listed.set(lga,(listed.get(lga)??0)+count);
     if(!detail.has(lga))detail.set(lga,{name,customers:0,events:new Set()});
     const council=detail.get(lga);
     council.customers+=count;council.events.add(id);
     events.set(id+"|"+lga,count);
    }
    if(localTotal!==p.affected_customers)
     throw Error("Provider council split does not sum to its event total: "+id);
    eventTotal+=localTotal;
   }
   if(ids.size!==allocation.event_count||eventTotal!==source.total_customers)
    throw Error("Missing website-only events or unbalanced provider incident total");
   const reported=new Map();
   for(const row of source.rows){
    const lga=publishedLgaKey(row.lga_name);
    if(!lga||reported.has(lga)||!validCount(row.affected_customers))
     throw Error("Official council list has duplicate or invalid counts");
    reported.set(lga,row.affected_customers);
   }
   const rowSum=[...reported.values()].reduce((a,b)=>a+b,0);
   if(rowSum!==source.total_customers||listed.size!==reported.size)
    throw Error("Official council totals do not reconcile");
   for(const [lga,customers] of reported)
    if(listed.get(lga)!==customers)
     throw Error("Official council total differs from published event allocations: "+lga);
   verifiedProviders.set(meta.name,{
    name:meta.name,customers:source.total_customers,
    sourceUpdatedUtc:source.source_updated_utc,
    sourceUrl:source.source_url,retained:source.retained===true,
    eventCount:ids.size
   });
   for(const [lga,row] of detail){
    if(!byLga.has(lga))
     byLga.set(lga,{name:row.name,customers:0,providers:new Map(),events:new Set()});
    const council=byLga.get(lga);
    council.customers+=row.customers;
    council.providers.set(meta.name,row.customers);
    for(const id of row.events)council.events.add(meta.name+":"+id);
   }
   for(const [key2,count] of events)byEventLga.set(meta.name+":"+key2,count);
  }catch(error){errors[meta.name]=error?.message??String(error)}
 }
 if(!verifiedProviders.size)
  throw Error("Neither provider's council allocations are currently verified");
 return {snapshotUtc:manifest.generated_utc,verifiedProviders,byLga,
  byEventLga,errors,mirror:"gowlettluke/qldpoweroutages"};
}
export async function fetchPublishedProviderLga({
 fetchImpl=globalThis.fetch,nowMs=Date.now(),
 base=PUBLISHED_PROVIDER_LGA_DATA_BASE
}={}){
 if(typeof fetchImpl!=="function")throw Error("No fetch available for verified council data");
 const [manifest,geo]=await Promise.all(
  ["run_manifest.json","current_outages.geojson"].map(async name=>{
   const controller=typeof AbortController==="function"?new AbortController():null;
   const timer=controller?setTimeout(()=>controller.abort(),12000):null;
   try{
    const res=await fetchImpl(base+name,{headers:{Accept:"application/json"},
     ...(controller?{signal:controller.signal}:{})});
    if(!res.ok)throw Error("Provider council snapshot "+name+" HTTP "+res.status);
    return await res.json();
   }finally{if(timer!==null)clearTimeout(timer)}
  }));
 return validatePublishedProviderLga(manifest,geo,{nowMs});
}
