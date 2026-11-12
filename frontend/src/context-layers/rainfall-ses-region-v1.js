// Official SES Regions layer (Queensland Emergency Services QFES_Boundaries/8).
// Static publication-time station mapping, never new requests on rainfall refresh.
export const SES_REGION_REGISTRY_URL="./data/qld-rainfall-ses-regions-v1.json";
export const SES_REGION_SCHEMA="QscopeQldSESRegionStationRegistryV1";
export const SES_REGION_NAMES=Object.freeze([
 "Brisbane Region","Central Region","Far Northern Region","North Coast Region",
 "Northern Region","South Eastern Region","South Western Region"
]);
export function validSESRegionRegistry(registry){
 return registry?.schema===SES_REGION_SCHEMA &&
  registry.sourceLayer==="SES Regions (layer 8)" &&
  Array.isArray(registry.regions) &&
  registry.regions.length===7 &&
  SES_REGION_NAMES.every(name=>registry.regions.includes(name)) &&
  registry.stations && typeof registry.stations==="object";
}
const separationKm=(a,b,c,d)=>{
 const R=Math.PI/180;
 const h=Math.sin((c-a)*R/2)**2+Math.cos(a*R)*Math.cos(c*R)*
  Math.sin((d-b)*R/2)**2;
 return 12742*Math.asin(Math.min(1,Math.sqrt(h)));
};
export function sesRegionForStation(record,registry,{maxSeparationKm=2}={}){
 if(!validSESRegionRegistry(registry))return null;
 const station=registry.stations[String(record?.id??"")];
 if(!station ||
    !Number.isFinite(record?.latitude)||!Number.isFinite(record?.longitude)||
    !Number.isFinite(station.latitude)||!Number.isFinite(station.longitude)||
    !SES_REGION_NAMES.includes(station.region)||
    separationKm(record.latitude,record.longitude,station.latitude,station.longitude)>maxSeparationKm)
  return null;
 const assignment=station.assignment??"within";
 if(!["within","nearest"].includes(assignment))return null;
 if(assignment==="nearest" &&
    (!["NSW","QLD"].includes(station.state) ||
     station.crossBorder!==(station.state==="NSW") ||
     !Number.isFinite(station.distanceKm) || station.distanceKm<0))
  return null;
 if(assignment==="within" && station.crossBorder===true)return null;
 return {code:station.region,name:station.region,assignment,
  state:station.state??"QLD",crossBorder:station.crossBorder===true,
  distanceKm:assignment==="nearest"?station.distanceKm:0};
}
export function groupRainfallBySESRegion(report,resolve,selected="all"){
 const groups=new Map();
 for(const tier of report?.groups??[]){
  for(const row of tier.rows??[]){
   const region=resolve(row)??{code:"unavailable",name:"SES region unavailable"};
   if(selected!=="all"&&region.code!==selected)continue;
   if(!groups.has(region.code))
    groups.set(region.code,{key:region.code,title:region.name,rows:[]});
   groups.get(region.code).rows.push({...row,reportingTier:tier.title});
  }
 }
 const result=[...groups.values()].sort((a,b)=>
  (a.key==="unavailable")-(b.key==="unavailable")||
  SES_REGION_NAMES.indexOf(a.title)-SES_REGION_NAMES.indexOf(b.title));
 for(const group of result)
  group.rows.sort((a,b)=>b.mm-a.mm||
   String(a.name??"").localeCompare(String(b.name??""))||
   String(a.id??"").localeCompare(String(b.id??"")));
 return {groups:result,total:result.reduce((sum,g)=>sum+g.rows.length,0)};
}
