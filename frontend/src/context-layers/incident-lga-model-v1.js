// Lookup against Queensland Government published locality + LGA attributes.
// AdministrativeBoundaries/MapServer/2 (not scraped or inferred from suburb text).
export const OFFICIAL_QLD_LOCALITIES="https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Boundaries/AdministrativeBoundaries/MapServer/2/query";
export const UNKNOWN_LGA="LGA not verified";
export const lgaName=value=>String(value??"").replace(/\s+/g," ").trim();
export const localityKey=value=>lgaName(value).toLocaleUpperCase("en-AU");
export function officialLocalityUrl(names){
 const clean=[...new Set(names.map(localityKey).filter(x=>x.length&&x.length<=38))].slice(0,24);
 if(!clean.length)return "";
 const url=new URL(OFFICIAL_QLD_LOCALITIES);
 url.searchParams.set("f","json");
 // ArcGIS locality values are Title Case, while provider suburbs and our keys
 // are normalised to uppercase. Exact locality IN (...) is case sensitive on
 // this service and silently returned zero matches for genuine localities.
 url.searchParams.set("where","UPPER(locality) IN ("+clean.map(x=>"'"+x.replace(/'/g,"''")+"'").join(",")+")");
 url.searchParams.set("outFields","locality,lga");
 url.searchParams.set("returnGeometry","false");
 url.searchParams.set("resultRecordCount","200");
 return url.href;
}
export function parseOfficialLocalities(payload,requested){
 if(payload?.error||payload?.exceededTransferLimit||!Array.isArray(payload?.features))
  throw new Error("Incomplete official locality/LGA query");
 const want=new Set(requested.map(localityKey)),seen=new Map();
 for(const feature of payload.features){
  const a=feature?.attributes||{},key=localityKey(a.locality),lga=lgaName(a.lga);
  if(!want.has(key)||!lga)continue;
  if(!seen.has(key))seen.set(key,new Set());
  seen.get(key).add(lga);
 }
 const result=new Map();
 for(const key of want){
   const names=[...(seen.get(key)||[])];
   result.set(key,names.length===1?names[0]:UNKNOWN_LGA);
 }
 return result;
}
export async function resolveQueenslandLocalityLgas(names,{
 fetchImpl=globalThis.fetch,timeoutMs=12000
}={}){
 const clean=[...new Set(names.map(localityKey).filter(x=>x.length&&x.length<=38))];
 if(!clean.length)return new Map();
 if(typeof fetchImpl!=="function")throw Error("Official locality fetch unavailable");
 const output=new Map();
 // Keep batches small to avoid ArcGIS URL/server size limits; do not assume a
 // missing lookup means the locality belongs to a guessed adjacent council.
 for(let offset=0;offset<clean.length;offset+=24){
  const batch=clean.slice(offset,offset+24);
  const controller=typeof AbortController==="function"?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
  try{
   const response=await fetchImpl(officialLocalityUrl(batch),{
    headers:{Accept:"application/json"},signal:controller?.signal
   });
   if(!response.ok)throw Error("Official locality/LGA HTTP "+response.status);
   const parsed=parseOfficialLocalities(await response.json(),batch);
   for(const [key,value] of parsed)output.set(key,value);
  }finally{if(timer!==null)clearTimeout(timer);}
 }
 return output;
}
// Keep a single event in each LGA, but retain the provider's list of suburbs.
// Does not apportion customer totals between multiple councils.
export function groupOutagesByLga(suburbGroups,lookup=new Map()){
 const groups=new Map();
 for(const suburb of suburbGroups||[]){
  const council=lookup.get(localityKey(suburb.name))||UNKNOWN_LGA;
  const key=localityKey(council);
  if(!groups.has(key))groups.set(key,{key,name:council,suburbs:[],items:[],shared:false});
  const group=groups.get(key);
  group.suburbs.push(suburb);
  for(const item of suburb.items) {
   if(!group.items.some(previous=>previous.id===item.id))group.items.push(item);
   if(item.shared)group.shared=true;
  }
 }
 return [...groups.values()].sort((a,b)=>
  a.name===UNKNOWN_LGA?1:b.name===UNKNOWN_LGA?-1:
   a.name.localeCompare(b.name,"en-AU",{sensitivity:"base"}));
}
export function filterLgaGroups(groups,query){
 const term=lgaName(query).toLocaleLowerCase("en-AU");
 if(!term)return groups;
 return groups.map(group=>{
   if(group.name.toLocaleLowerCase("en-AU").includes(term))return group;
   const suburbs=group.suburbs.map(suburb=>{
    if(suburb.name.toLocaleLowerCase("en-AU").includes(term))return suburb;
    const items=suburb.items.filter(item=>[
     item.summary.roadName,item.summary.streets,item.summary.provider,
     item.summary.reason,item.summary.eventId,item.summary.locality
    ].some(value=>String(value??"").toLocaleLowerCase("en-AU").includes(term)));
    return items.length?{...suburb,items}:null;
   }).filter(Boolean);
   return suburbs.length?{...group,suburbs,
    items:[...new Map(suburbs.flatMap(s=>s.items).map(i=>[i.id,i])).values()]}:null;
 }).filter(Boolean);
}

// Distinct-event council reconciliation. ArcGIS CUSTOMER_AFFECTED is the
// complete incident count, NOT an LGA allocation. For events mapped into more
// than one council, do not pretend each council owns all those customers.
// Report single-council customer totals separately and show the upper bound
// that includes unallocated shared events. Never invent shares by polygon
// area, centroid, suburb count, or arbitrary division.
export function councilOutageCustomerSummary(council,allCouncils=[]){
 const unique=new Map();
 for(const item of council?.items??[]){
   const id=String(item?.id??"");
   if(id&&!unique.has(id))unique.set(id,item);
 }
 const sharedIds=new Set();
 for(const other of allCouncils??[]){
   if(other.key===council?.key)continue;
   for(const item of other.items??[]){
     const id=String(item?.id??"");
     if(unique.has(id))sharedIds.add(id);
   }
 }
 let customers=0,sharedCustomers=0;
 for(const [id,item] of unique){
   const value=Number(item?.summary?.customersAffected);
   // Missing/malformed counts must not be treated as authoritative zero.
   const valid=Number.isFinite(value)&&value>=0?value:0;
   if(sharedIds.has(id))sharedCustomers+=valid;
   else customers+=valid;
 }
 return {
  outages:unique.size,
  // Verified single-council customer count is a lower bound where events
  // cross LGA boundaries. For a single-council event it is the exact
  // customer count reported by the provider's source event.
  customers,
  sharedCustomers,
  customerUpperBound:customers+sharedCustomers,
  crossCouncilEvents:sharedIds.size,
  exactCustomerTotal:sharedIds.size===0
 };
}
