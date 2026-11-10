import assert from "node:assert/strict";
import {
  BOM_RESEARCH_WIND_RULES,readBoMStationGusts,
  matchObservedBoMGusts,createBoMWindGustResearchLookup
} from "../src/qscope-bom-wind-evidence-v10-6.js";
const first="20261110113000",second="20261110114000";
function raw(wmo=94576,gust=101,utc=first,lat=-27.5,lon=153){
 return {observations:{data:[{
   wmo,name:"BRISBANE",history_product:"IDQ60901",
   aifstime_utc:utc,gust_kmh:gust,wind_spd_kmh:38,
   lat,lon,wind_dir:"WSW"
 }]}};
}
const parsed=readBoMStationGusts(raw());
assert.equal(parsed.length,1);
assert.equal(parsed[0].observedUtc,"2026-11-10T11:30:00.000Z");
assert.equal(parsed[0].gustKmh,101);
assert.equal(parsed[0].meanWindKmh,38);
assert.equal(parsed[0].windDir,"WSW");
assert.equal(parsed[0].provisional,true);
assert.equal(readBoMStationGusts(raw(),{expectedWmo:94578}),null);
assert.equal(readBoMStationGusts(raw(94576,99,"20261301999999")),null);
assert.equal(readBoMStationGusts(raw(94576,-12)),null);
assert.equal(readBoMStationGusts(raw(94576,451)),null);
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
match=matchObservedBoMGusts(event,readBoMStationGusts(raw(94576,125)));
assert.equal(match.gustClassification,"destructive-threshold");
match=matchObservedBoMGusts(event,readBoMStationGusts(raw(94576,60)));
assert.equal(match.evidenceClass,"nearby-station-reading");
assert.equal(match.gustClassification,"below-damaging-threshold",
  "A sub-severe gust MUST NOT be mislabelled as confirmed damaging wind");
const distant=readBoMStationGusts(raw(94576,130,first,-27.7,153.16));
assert.equal(matchObservedBoMGusts(event,distant).evidenceClass,"regional-context",
 "A strong distant gust is context, not confirmed attribution");
const empty=matchObservedBoMGusts(event,[]);
assert.equal(empty,null,"No observations is unknown, not evidence that no wind occurred");
const stations=[
 {product:"IDQ60901",wmo:"94576",latitude:-27.5,longitude:153},
 {product:"IDQ60901",wmo:"94578",latitude:-27.39,longitude:153.13},
 {product:"IDQ60901",wmo:"94592",latitude:-28.17,longitude:153.51},
 {product:"IDQ60901",wmo:"94560",latitude:-26.2,longitude:152.9}
];
let fetches=0,time=0;
const lookup=createBoMWindGustResearchLookup({
 stations,now:()=>time,
 fetchStation:async station=>{
   fetches++;
   return raw(Number(station.wmo),station.wmo==="94578"?130:101,
     first,station.latitude,station.longitude);
 }
});
const [a,b]=await Promise.all([lookup.lookup(event),lookup.lookup(event)]);
assert(a&&b,"Two nearby stations support research corroboration");
assert.equal(fetches,2,"Two concurrent event reviews coalesce per station");
assert.equal(lookup.stationCacheCount,2);
await lookup.lookup(event);
assert.equal(fetches,2,"Short-lived 10-minute cache prevents repeated BoM reads");
time=BOM_RESEARCH_WIND_RULES.stationCacheMs+1;
await lookup.lookup(event);
assert.equal(fetches,4,"Expired cache refetches only two nearby stations");
assert.equal((await lookup.lookup({...event,latitude:-19,longitude:146})),null,
  "No configured station in range = unavailable, never invented gust");
console.log("PASS Q-SCOPE BoM 72h AWS source matching, timestamps, proximity, strict damage levels, 2-station cap and cache");
