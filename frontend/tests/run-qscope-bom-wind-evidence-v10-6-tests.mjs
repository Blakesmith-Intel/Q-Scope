import assert from "node:assert/strict";
import {
  BOM_RESEARCH_WIND_RULES,BOM_QUEENSLAND_OBSERVATIONS_URL,
  BOM_MODERN_SURFACE_OBSERVATION_PATH,
  formatWindKmh,readBoMStationGusts,
  matchObservedBoMGusts,createBoMWindGustResearchLookup
} from "../src/qscope-bom-wind-evidence-v10-6.js";

// Fixtures mirror BoM's new Queensland location-page station API structure.
// Only Brisbane 040913 is a source-grounded real station; any other station
// number in this TEST is synthetic and cannot enter published station metadata.
const first="2026-11-10T11:30:00Z";
function raw(stationNum=40913,gustKmh=101,utc=first,lat=-27.48,lon=153.04){
 return {stn:{
   identity:{bom_stn_num:stationNum,bom_stn_name:"BRISBANE",wmo_stn_id:94576},
   location:{lat_dec_deg:lat,long_dec_deg:lon,timezone:"Australia/Brisbane"}
 },obs:{
   datetime_utc:utc,
   wind:{gust_speed_10m_max_mps:gustKmh/3.6,
     speed_10m_mps:38/3.6,dirn_10m_ord:"WSW"}
 }};
}
assert.equal(BOM_QUEENSLAND_OBSERVATIONS_URL,
 "https://www.bom.gov.au/location/australia/queensland#observations");
assert.equal(BOM_MODERN_SURFACE_OBSERVATION_PATH,
 "/observations/latest/{station_id}/atm/surf_air?include_qc_results=false");
assert.equal(formatWindKmh(101.4),"101 km/hr");
assert.equal(formatWindKmh(101.5),"102 km/hr");
assert.equal(formatWindKmh(NaN),"Unavailable");
const parsed=readBoMStationGusts(raw(),{expectedStationId:"040913"});
assert.equal(parsed.length,1);
assert.equal(parsed[0].observedUtc,"2026-11-10T11:30:00.000Z");
assert.equal(parsed[0].stationId,"040913");
assert.equal(parsed[0].wmo,94576,"WMO ID must be preserved separately from the BoM station ID");
assert.equal(parsed[0].sourcePage,BOM_QUEENSLAND_OBSERVATIONS_URL);
assert.equal(parsed[0].gustKmh,101,"Meters/sec converted exactly once to km/hr");
assert.equal(parsed[0].meanWindKmh,38,"Mean speed also converted to km/hr");
assert.equal(parsed[0].windDir,"WSW");
assert.equal(parsed[0].provisional,true);
assert.equal(readBoMStationGusts(raw(),{expectedStationId:"94576"}),null,
 "WMO number is NOT a BoM station number: reject false ID match");
assert.equal(readBoMStationGusts(raw(),{expectedStationId:"040914"}),null);
assert.equal(readBoMStationGusts(raw(40913,99,"2026-13-01T99:99:99Z")),null);
assert.equal(readBoMStationGusts(raw(40913,-12)),null);
assert.equal(readBoMStationGusts(raw(40913,451)),null);
assert.equal(readBoMStationGusts({observations:{data:[{}]}}),null,
 "Legacy QLD observations schema must not masquerade as new location source");
const event={latitude:-27.45,longitude:153.03,
 evidence:[{category:"strong_radial_signature",
   frameUtc:"2026-11-10T11:35:00.000Z"}]};
let match=matchObservedBoMGusts(event,parsed);
assert(match);
assert.equal(match.evidenceClass,"nearby-damaging-gust");
assert.equal(match.gustClassification,"damaging-threshold");
assert(match.distanceKm<15);
assert.equal(match.differenceMinutes,5);
assert(matchObservedBoMGusts({...event,latitude:-26.2},parsed)===null,
 "A distant AWS gust must not be attributed to this radar event");
assert(matchObservedBoMGusts({...event,
 evidence:[{frameUtc:"2026-11-10T08:00:00.000Z"}]},parsed)===null,
 "A gust from another weather period must not corroborate this event");
match=matchObservedBoMGusts(event,readBoMStationGusts(raw(40913,125)));
assert.equal(match.gustClassification,"destructive-threshold");
match=matchObservedBoMGusts(event,readBoMStationGusts(raw(40913,60)));
assert.equal(match.evidenceClass,"nearby-station-reading");
assert.equal(match.gustClassification,"below-damaging-threshold",
 "A sub-severe gust must not be labelled as damaging");
const distant=readBoMStationGusts(raw(40913,130,first,-27.7,153.16));
assert.equal(matchObservedBoMGusts(event,distant).evidenceClass,"regional-context",
 "A distant strong gust is regional context, not confirmed attribution");
assert.equal(matchObservedBoMGusts(event,[]),null,
 "No reading is unknown, not an all-clear");
const stations=[
 {stationId:"040913",latitude:-27.48,longitude:153.04},
 {stationId:"040914",latitude:-27.39,longitude:153.13},
 {stationId:"040915",latitude:-28.17,longitude:153.51},
 {stationId:"040916",latitude:-26.2,longitude:152.9}
];
let fetches=0,time=0;
const lookup=createBoMWindGustResearchLookup({
 stations,now:()=>time,
 fetchStation:async station=>{
   fetches++;
   return raw(Number(station.stationId),
     station.stationId==="040914"?130:101,
     first,station.latitude,station.longitude);
 }
});
const [a,b]=await Promise.all([lookup.lookup(event),lookup.lookup(event)]);
assert(a&&b,"Two source-matched stations support on-demand corroboration");
assert.equal(fetches,2,"Concurrent reviews coalesce to two fetches");
assert.equal(lookup.stationCacheCount,2);
await lookup.lookup(event);
assert.equal(fetches,2,"10-minute cache prevents repeated BoM reads");
time=BOM_RESEARCH_WIND_RULES.stationCacheMs+1;
await lookup.lookup(event);
assert.equal(fetches,4,"Expired cache refetches only nearest two stations");
assert.equal((await lookup.lookup({...event,latitude:-19,longitude:146})),null,
 "No verified stations nearby = unavailable, never invented gust");
const wrongLocation=createBoMWindGustResearchLookup({
 stations:[stations[0]],fetchStation:async()=>raw(40913,151,first,-19,146)
});
assert.equal(await wrongLocation.lookup(event),null,
 "New site station-ID must ALSO match source coordinates");
console.log("PASS Q-SCOPE modern BoM Queensland station API, strict station ID, m/s to km/hr, timestamp, proximity, no-data and 2-station cache");
