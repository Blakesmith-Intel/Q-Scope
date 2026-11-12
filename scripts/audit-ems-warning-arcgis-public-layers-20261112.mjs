// Read-only audit of the EXACT Queensland EMS ArcGIS publication used by Q-Scope.
// Look for alternate public layers and views. Never infer new warning geometry.
const BASE="https://services1.arcgis.com/vkTwD8kHw2woKBqV/arcgis/rest/services/BOM_Land_Warnings_RO/FeatureServer";
const cap=async(url)=>{
 const response=await fetch(url,{signal:AbortSignal.timeout(13000),
  headers:{Accept:"application/json"}});
 if(!response.ok)throw Error("HTTP "+response.status);
 const body=await response.text();
 if(body.length>700000)throw Error("Excessive ArcGIS response");
 const data=JSON.parse(body);
 if(data?.error)throw Error("ArcGIS error "+data.error.code);
 return data;
};
async function main(){
 const meta=await cap(BASE+"?f=json");
 console.log("EMS_WARNING_SERVICE_LAYER_INVENTORY",JSON.stringify({
  item:meta.serviceItemId,view:meta.isView,
  layers:(meta.layers??[]).map(x=>({id:x.id,name:x.name,geometry:x.geometryType})),
  tables:meta.tables??[],capabilities:meta.capabilities
 }));
 const product="IDQ65650";
 const counts=await Promise.allSettled((meta.layers??[]).map(async(layer)=>{
  const url=new URL(BASE+"/"+layer.id+"/query");
  url.searchParams.set("f","json");
  url.searchParams.set("where","product='"+product+"'");
  url.searchParams.set("returnCountOnly","true");
  const d=await cap(url.toString());
  return {id:layer.id,name:layer.name,count:d.count};
 }));
 console.log("EMS_IDQ65650_COUNTS_BY_LAYER",JSON.stringify(counts.map((x,i)=>x.status==="fulfilled"?
  x.value:{layerId:meta.layers[i].id,status:"unavailable",reason:String(x.reason).slice(0,90)})));
 const query="BOM_Land_Warnings";
 const url=new URL("https://www.arcgis.com/sharing/rest/search");
 url.searchParams.set("f","json");
 url.searchParams.set("q","title:\""+query+"\"");
 url.searchParams.set("num","50");
 try{
  const d=await cap(url.toString());
  console.log("EMS_PUBLIC_ARCGIS_ALTERNATE_ITEMS",JSON.stringify({
   total:d.total??null,items:(d.results??[]).map(x=>({
    id:x.id,title:x.title,type:x.type,owner:x.owner,
    url:x.url??null,modified:x.modified??null
   })).slice(0,30)
  }));
 }catch(error){
  console.log("EMS_PUBLIC_ARCGIS_ALTERNATE_SEARCH_UNAVAILABLE",
   JSON.stringify({message:String(error).slice(0,150)}));
 }
}
await main();
