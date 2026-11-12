// Official BoM IDM00001 forecast-district assignments, precomputed at build time.
// This is a read-only station attribute. Never derive it from flood-map regions
// or station-number rainfall districts, and never fetch boundaries in the browser.
export const FORECAST_DISTRICT_REGISTRY_URL="./data/qld-rainfall-forecast-districts-v1.json";
export const FORECAST_DISTRICT_SCHEMA="QscopeBomForecastDistrictStationRegistryV1";
const UNKNOWN_DISTRICT=Object.freeze({code:"unavailable",name:"District unavailable"});
const distanceKm=(latA,lonA,latB,lonB)=>{
 const rad=Math.PI/180,p1=latA*rad,p2=latB*rad;
 const h=Math.sin((p2-p1)/2)**2+Math.cos(p1)*Math.cos(p2)*
   Math.sin((lonB-lonA)*rad/2)**2;
 return 12742*Math.asin(Math.min(1,Math.sqrt(h)));
};
export function validForecastDistrictRegistry(registry){
 return registry?.schema===FORECAST_DISTRICT_SCHEMA &&
  registry.sourceProduct==="IDM00001" &&
  Array.isArray(registry.districts) &&
  registry.districts.length>=10 &&
  !!registry.stations && typeof registry.stations==="object";
}
export function forecastDistrictForStation(record,registry,{maxSeparationKm=2}={}){
 if(!validForecastDistrictRegistry(registry))return null;
 const station=registry.stations[String(record?.id??"")];
 if(!station || !Number.isFinite(record?.latitude) ||
   !Number.isFinite(record?.longitude) ||
   !Number.isFinite(station.latitude) || !Number.isFinite(station.longitude) ||
   !/^[A-Z]{3}_PW\d+$/i.test(station.code??"") ||
   typeof station.name!=="string" || !station.name.trim())return null;
 if(distanceKm(record.latitude,record.longitude,station.latitude,station.longitude)>maxSeparationKm)
  return null;
 return {code:station.code,name:station.name};
}
// Reuse the existing totals/AEP report's fully classified rows, without
// modifying their thresholds, counts, source rows, or eligibility decisions.
export function groupRainfallByForecastDistrict(report,resolveDistrict,selected="all"){
 const byCode=new Map();
 for(const tier of report?.groups??[]){
  for(const station of tier.rows??[]){
   const district=resolveDistrict(station)??UNKNOWN_DISTRICT;
   if(selected!=="all" && selected!==district.code)continue;
   if(!byCode.has(district.code))
    byCode.set(district.code,{key:district.code,title:district.name,rows:[]});
   byCode.get(district.code).rows.push({...station,reportingTier:tier.title});
  }
 }
 const groups=[...byCode.values()].sort((a,b)=>
  (a.key==="unavailable")-(b.key==="unavailable") ||
  a.title.localeCompare(b.title));
 for(const group of groups)
  group.rows.sort((a,b)=>b.mm-a.mm||String(a.name).localeCompare(String(b.name)));
 return {groups,total:groups.reduce((sum,g)=>sum+g.rows.length,0)};
}
