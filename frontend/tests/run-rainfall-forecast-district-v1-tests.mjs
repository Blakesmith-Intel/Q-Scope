import assert from "node:assert/strict";
import {
 FORECAST_DISTRICT_SCHEMA,validForecastDistrictRegistry,
 forecastDistrictForStation,groupRainfallByForecastDistrict
} from "../src/context-layers/rainfall-forecast-district-v1.js";
import {buildSignificantRainfallReport} from
 "../src/context-layers/significant-rainfall-report-v1.js";
const districts=Array.from({length:15},(_,i)=>({
 code:"QLD_PW"+String(i+1).padStart(3,"0"),
 name:"District "+String(i+1).padStart(2,"0")
}));
const registry={schema:FORECAST_DISTRICT_SCHEMA,sourceProduct:"IDM00001",
 districts,stations:{
  "532001":{latitude:-27.45,longitude:153.03,code:"QLD_PW015",name:"Southeast Coast"},
  "532002":{latitude:-25.3,longitude:152.8,code:"QLD_PW014",name:"Wide Bay and Burnett"},
  "532003":{latitude:-27.46,longitude:153.02,code:"QLD_PW015",name:"Southeast Coast"}
 }};
assert.equal(validForecastDistrictRegistry(registry),true);
assert.equal(validForecastDistrictRegistry({...registry,sourceProduct:"IDM00004"}),false,
 "Rainfall districts must never be accepted");
const row=(id,lat,lon,mm,aep,classification="meets-ifd-design-depth")=>({
 id,name:"Station "+id,latitude:lat,longitude:lon,mm,
 aep:{aepDesignThreshold:aep,classification}});
const records=[
 row("532001",-27.45,153.03,151,1),
 row("532002",-25.3,152.8,76,20),
 row("532003",-27.46,153.02,129,null,"below-20pct-aep"),
 row("532004",-27.46,153.02,89,5)
];
assert.equal(forecastDistrictForStation(records[0],registry)?.name,"Southeast Coast");
assert.equal(forecastDistrictForStation({...records[0],latitude:-19},registry),null,
 "A reused station ID at a distant coordinate must remain unverified");
assert.equal(forecastDistrictForStation(records[3],registry),null,
 "Missing ID must never be matched by nearby station or inferred code");
assert.equal(forecastDistrictForStation(records[0],{...registry,sourceProduct:"IDM00004"}),null);
const amount=groupRainfallByForecastDistrict(
 buildSignificantRainfallReport(records,"amount"),
 r=>forecastDistrictForStation(r,registry));
assert.equal(amount.total,4);
assert.deepEqual(amount.groups.map(g=>[g.title,g.rows.length]),[
 ["Southeast Coast",2],["Wide Bay and Burnett",1],["District unavailable",1]
]);
assert(amount.groups[0].rows.some(x=>x.aep.classification==="below-20pct-aep"),
 "Amount grouping must preserve below-20% AEP stations");
const aep=groupRainfallByForecastDistrict(
 buildSignificantRainfallReport(records,"aep"),
 r=>forecastDistrictForStation(r,registry));
assert.equal(aep.total,3,"AEP classifications and exclusions must remain intact");
assert.equal(aep.groups.every(g=>g.rows.every(r=>r.reportingTier)),true,
 "Rarity tier remains identified within district group");
const filtered=groupRainfallByForecastDistrict(
 buildSignificantRainfallReport(records,"amount"),
 r=>forecastDistrictForStation(r,registry),"QLD_PW015");
assert.equal(filtered.total,2);
assert.equal(filtered.groups.length,1);
assert.equal(groupRainfallByForecastDistrict(
 buildSignificantRainfallReport(records,"aep"),
 r=>forecastDistrictForStation(r,registry),"unavailable").total,1);
console.log("PASS official BoM forecast district station identity, geographic validation, totals/AEP preservation and district filtering");
