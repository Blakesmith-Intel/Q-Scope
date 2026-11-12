import {validatePublishedProviderLga} from "../frontend/src/context-layers/power-outage-published-lga-v1.js";
// One-time read-only test of the independently published provider-verified
// council snapshot. No polling job; browser CORS is mandatory before adoption.
const origins=[
 ["pages","https://gowlettluke.github.io/qldpoweroutages/data/"],
 ["github-raw","https://raw.githubusercontent.com/gowlettluke/qldpoweroutages/main/data/"]
];
for(const [name,base] of origins){
 try{
  const values={};
  for(const filename of ["run_manifest.json","current_outages.geojson"]){
   const r=await fetch(base+filename,{headers:{Origin:"https://blakesmith-intel.github.io",Accept:"application/json"},signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw Error("HTTP "+r.status+" "+filename);
   const data=await r.json();
   values[filename]=data;
   console.log("EXTERNAL_LGA_SOURCE_HTTP",JSON.stringify({mirror:name,file:filename,status:r.status,
    cors:r.headers.get("access-control-allow-origin"),lastModified:r.headers.get("last-modified"),
    cache:r.headers.get("cache-control"),type:r.headers.get("content-type")}));
  }
  const manifest=values["run_manifest.json"],geo=values["current_outages.geojson"];
  const ref=manifest.provider_council_counts;
  const rows=geo.features??[];
  const audit=[];
  for(const [provider,pCode] of [["ergon","au.qld.ergon"],["energex","au.qld.energex"]]){
   const official=ref?.[provider];
   const listed=new Map();
   let eventSum=0,individual=0,unverified=0;
   for(const f of rows.filter(f=>f.properties?.provider_code===pCode)){
    const p=f.properties??{};
    if(p.lga_assignment_source!=="provider")unverified++;
    const alloc=p.lga_allocations??[];
    const sum=alloc.reduce((total,a)=>total+a.affected_customers,0);
    if(sum!==p.affected_customers)throw Error("Event allocation mismatch "+p.outage_id);
    eventSum+=sum;
    for(const a of alloc){const key=a.lga_name.toLowerCase();
     listed.set(key,(listed.get(key)??0)+a.affected_customers);
     individual++;
    }
   }
   const officialList=new Map((official.rows??[]).map(x=>[x.lga_name.toLowerCase(),x.affected_customers]));
   if(listed.size!==officialList.size)throw Error(provider+" LGA list length mismatch");
   for(const [lga,num] of listed)if(officialList.get(lga)!==num)
    throw Error(provider+" LGA mismatch "+lga+": "+num+" vs "+officialList.get(lga));
   if(eventSum!==official.total_customers)
    throw Error(provider+" event total mismatch "+eventSum+" vs "+official.total_customers);
   audit.push({provider,snapshot:ref.snapshot_utc,sourceUpdated:official.source_updated_utc,
     total:official.total_customers,lgaCount:listed.size,individual,unverified,
     southBurnett:listed.get("south burnett regional"),events:rows.filter(f=>f.properties?.provider_code===pCode).length});
  }
  const verified=validatePublishedProviderLga(manifest,geo,{nowMs:Date.now()});
  if(verified.verifiedProviders.size!==2)
    throw Error("Both live official provider sources must be verified: "+JSON.stringify(verified.errors));
  console.log("EXTERNAL_LGA_SOURCE_MODEL_PASS",JSON.stringify({
   source:name,snapshot:verified.snapshotUtc,
   providers:[...verified.verifiedProviders.keys()],
   lgas:verified.byLga.size,
   southBurnett:verified.byLga.get("SOUTHBURNETT")?.customers??0,
   exactErgonSplit:verified.byEventLga.get("Ergon:26FN11158|CARPENTARIA")??null
  }));
  console.log("EXTERNAL_LGA_SOURCE_RECONCILIATION",JSON.stringify({source:name,generated:manifest.generated_utc,audit}));
 }catch(e){console.log("EXTERNAL_LGA_SOURCE_FAILURE",JSON.stringify({source:name,error:e.message}));}
}
