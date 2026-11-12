// One-off read-only discovery of other published first-party Energy Queensland
// ArcGIS layer services that might expose authoritative event x council totals.
const hosts=[
 "https://services.arcgis.com/33eHbTVqo7gtiCE8/arcgis/rest/services?f=json",
 "https://services.arcgis.com/bfVzktoY0OhzQCDj/arcgis/rest/services?f=json"
];
for(const [i,u] of hosts.entries()){
 try{
  const res=await fetch(u,{signal:AbortSignal.timeout(18000),
   headers:{Accept:"application/json"}});
  const obj=await res.json();
  const items=(obj.services??[]).map(x=>({name:x.name,type:x.type}));
  console.log("ENERGYQLD_ARCGIS_CATALOG",JSON.stringify({
   provider:i===0?"Ergon":"Energex",http:res.status,
   count:items.length,error:obj.error,
   candidates:items.filter(x=>/outage|affected|council|customer|service area|lga|incident|fault|network/i.test(x.name)),
   allNames:items.map(x=>x.name).slice(0,100)
  }).slice(0,15000));
 }catch(e){console.log("ENERGYQLD_ARCGIS_CATALOG_ERROR",i,e.message)}
}
