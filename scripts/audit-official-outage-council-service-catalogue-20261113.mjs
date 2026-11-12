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


const accounts=[
 ["Ergon","https://services.arcgis.com/33eHbTVqo7gtiCE8/ArcGIS/rest/services"],
 ["Energex","https://services.arcgis.com/bfVzktoY0OhzQCDj/ArcGIS/rest/services"],
];
for(const [provider,base] of accounts){
 for(const service of [
  ...(provider==="Ergon"?["VwNSOutagesUDMS","VwTestNSOutagesUDMS","VwTestErgonOutages"]:["VwTestSEOutagesUDMS","VwTestEnergexOutages"])
 ]){
  const u=base+"/"+service+"/FeatureServer?f=json";
  try{
   const response=await fetch(u,{signal:AbortSignal.timeout(10000)});
   const data=await response.json();
   console.log("ENERGYQLD_ADDITIONAL_SERVICE",JSON.stringify({
    provider,service,http:response.status,error:data.error,
    layers:data.layers?.map(x=>({id:x.id,name:x.name})),
    tables:data.tables?.map(x=>({id:x.id,name:x.name})),
    description:String(data.description??"").slice(0,220)
   }));
   const layers=[...(data.layers??[]),...(data.tables??[])];
   for(const layer of layers.slice(0,8)){
    const v=base+"/"+service+"/FeatureServer/"+layer.id+"?f=json";
    const resp=await fetch(v,{signal:AbortSignal.timeout(10000)});
    const j=await resp.json();
    console.log("ENERGYQLD_ADDITIONAL_LAYER",JSON.stringify({
     provider,service,layer:layer.name,id:layer.id,error:j.error,
     fields:j.fields?.map(x=>x.name),countEstimate:j.maxRecordCount,
     description:String(j.description??"").slice(0,150)
    }).slice(0,3800));
   }
  }catch(e){console.log("ENERGYQLD_ADDITIONAL_SERVICE_ERROR",provider,service,e.message)}
 }
}
