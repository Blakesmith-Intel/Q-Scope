import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {rainfallRarityDisplay,significantRainfallDisplay,rainfallMarkerSvg}
 from "../src/context-layers/significant-rainfall-operational-v1.js";
import {rainfallWindowMinutes,classifyRainfallAep,ifdCellKey,IFD_LOOKUP_CONCURRENCY,
 IFD_LOCAL_CACHE_KEY,verifiedPersistentIfdCell,loadPersistedIfdCells,persistVerifiedIfdCell}
 from "../src/context-layers/rainfall-ifd-aep-v1.js";
import {
 rainfallBand,parseBomRainfallMap,dedupeSignificantRainfall,
 qldFloodMapCreatedAt,qualifiesRainfallSnapshot
} from "../src/context-layers/significant-rainfall-source-v1.js";
const a=(id,name,mm)=>'<area coords="6,8,9,10" href="javascript:void(0)" '+
 'onmouseover="javascript:PopupRain(&quot;'+name+'&quot;,\''+id+'\',\'-27.71\',\'152.30\',\''+
 mm+'\',\'1\',\'hour\')" />';
const html='<html><img class="mapimage" src="/fwo/IDQ65149.png" id = "since" '+
 'usemap="#IDQ65349.html"/><img class="mapimage" id="m1hr" usemap="#IDQ65350.html"/>'+
 '<map name="IDQ65349.html">'+a("040908","Tewantin RSL Park","50.0")+
 a("540523","Rockside Mt","99.9")+a("040203","A &amp; B","100.0")+
 a("040204","Below","49.9")+a("040205","Missing","-")+
 a("040206","Zero","0.0")+'</map>'+
 '<img class="mapimage" id="m24hr" usemap="#IDQ65351.html"/>'+
 '<map name="IDQ65351.html">'+a("040908","Tewantin RSL Park","180.7")+
 a("540523","Rockside Mt","49.9")+'</map>'+
 '<map name="IDQ65350.html">'+a("040908","Tewantin RSL Park","100.3")+
 a("540523","Rockside Mt","49.9")+'</map>'+
 '<p>This page was created at 07:06 on Sunday 18 October 2026 (UTC)</p></html>';
assert.equal(rainfallWindowMinutes("last24Hours",issuedTime()),1440);
assert.equal(rainfallWindowMinutes("since9am","2026-10-19T18:00:00Z"),1140,
 "At 04:00 AEST the BoM since-9am accumulation is 19 hours old");
const rainfallCode=readFileSync(new URL("../src/context-layers/significant-rainfall-operational-v1.js",import.meta.url),"utf8");
const rainfallHtml=readFileSync(new URL("../live3d-operational-v9.html",import.meta.url),"utf8");
assert.match(rainfallHtml,/<option value="last24Hours">24hrs to 9am<\/option>/,
 "The 24-hour-to-9am BoM observation window must be labelled precisely");
assert.match(rainfallCode,/period==="last24Hours"\?"24hrs to 9am":"Last 1 hour"/,
 "Station popup must use the same 24-hour-to-9am label");
assert.match(rainfallCode,/period==="last24Hours"\?"24hrs to 9am":"last hour"/,
 "Map status must use the same 24-hour-to-9am label");
assert.match(rainfallCode,/image:marker\(record\),width:98,height:40,/,
 "Full-height billboard keeps the rarity label at its original rendered size");

function issuedTime(){return "2026-10-18T07:06:00.000Z"}
for(const [aep,chance,oneIn,label] of [
 [20,"20%","1 in 5","Notable"],[10,"10%","1 in 10","Unusual"],
 [5,"5%","1 in 20","Rare"],[2,"2%","1 in 50","Very rare"],
 [1,"1%","1 in 100","Exceptional"]
]){
 const info=rainfallRarityDisplay({aepDesignThreshold:aep});
 assert.equal(info.chance,chance);
 assert.equal(info.oneIn,oneIn);
 assert.equal(info.short,label);
}
const normal=significantRainfallDisplay({mm:50,
 aep:{classification:"below-20pct-aep"}});
assert.equal(normal.amountBand,"50–99.9 mm");
assert.equal(normal.rarity.short,"Less rare");
const unknown=significantRainfallDisplay({mm:100,
 aep:{classification:"unclassified"}});
assert.equal(unknown.amountBand,"100 mm or more");
assert.equal(unknown.rarity.short,"Unrated");
for(const [mm,expectedColour] of [[99.9,"#ed871b"],[100,"#d92d35"]]){
 const svg=rainfallMarkerSvg({mm,aep:{aepDesignThreshold:5}});
 assert.match(svg,/viewBox="0 0 98 40"/,"Reduced droplet with full-size text tag");
 assert.match(svg,/transform="translate\(0 8\) scale\(0\.666667\)"/,
  "Only rainfall droplet shrinks to two-thirds");
 assert.match(svg,/<rect x="23" y="9" width="74" height="26"/,
  "Rarity label backing remains original 74 by 26 pixels");
 assert.match(svg,/font-size="10">Rare<\/text>/,
  "Original rarity text size remains unchanged");
 assert(svg.includes('fill="'+expectedColour+'"'),"Measured rain bands remain orange/red");
 assert(svg.includes('fill="#a45c1a"'),"IFD rarity tag separately coloured");
 assert(!svg.includes(">"+mm+"</text>"),"No number printed inside droplet");
 assert(svg.includes(">Rare</text>"),"Plain-language rarity remains visible");
}
assert(rainfallMarkerSvg({mm:100,aep:{classification:"unclassified"}}).includes('fill="#66717b"'),
 "Only missing IFD references should use neutral grey rarity");

assert.equal(rainfallBand(49.9),null);
assert.equal(rainfallBand(50),"orange");
assert.equal(rainfallBand(99.9),"orange");
assert.equal(rainfallBand(100),"red");
assert.equal(rainfallBand(-1),null);
const since=parseBomRainfallMap(html,"since9am","seast");
const hour=parseBomRainfallMap(html,"lastHour","seast");
const fullDay=parseBomRainfallMap(html,"last24Hours","seast");
assert.deepEqual(since.map(x=>[x.id,x.name,x.mm,x.band]),[
 ["040908","Tewantin RSL Park",50,"orange"],
 ["540523","Rockside Mt",99.9,"orange"],
 ["040203","A & B",100,"red"]]);
assert.deepEqual(hour.map(x=>[x.id,x.mm]),[["040908",100.3]]);
assert.deepEqual(fullDay.map(x=>[x.id,x.mm]),[["040908",180.7]]);
assert.equal(fullDay[0].period,"last24Hours");
const issued=qldFloodMapCreatedAt(html);
assert.equal(issued,"2026-10-18T07:06:00.000Z");
assert.equal(qldFloodMapCreatedAt(html.replace(
  "This page was created at 07:06",
  "This page was created at <strong>07:06")),
  "2026-10-18T07:06:00.000Z",
  "Live BoM regional flood pages wrap generated UTC in a strong element");
assert.deepEqual(dedupeSignificantRainfall(since.map(x=>({...x,sourceCreatedAt:issued})),"since9am")
 .map(x=>x.mm),[100,99.9,50]);
assert.equal(parseBomRainfallMap(html.replace("IDQ65350.html","IDQ65359.html"),"since9am").length,3);
assert.throws(()=>parseBomRainfallMap("<html>404</html>","since9am"),/map not published/);
assert.throws(()=>parseBomRainfallMap(html,"unknown"),RangeError);
const observed={...since[0],sourceCreatedAt:issued};
const now=Date.parse("2026-10-18T07:50:00Z");
assert.equal(qualifiesRainfallSnapshot(observed,"since9am",now),true);
assert.equal(qualifiesRainfallSnapshot(observed,"since9am",now+100*60000),false);
assert.equal(qualifiesRainfallSnapshot(observed,"since9am",Date.parse("2026-10-19T00:00:00Z")),false);
// Regression: Mountain Creek (BoM 540220) still belongs to yesterday's
// 09:00 reporting DAY after AEST midnight, even when the actual BoM
// map was published on today's calendar date.
const mountainCreek={id:"540220",name:"Mountain Creek Alert",
 mm:101,period:"since9am",sourceCreatedAt:"2026-10-19T18:00:00Z"};
assert.equal(qualifiesRainfallSnapshot(mountainCreek,"since9am",
 Date.parse("2026-10-19T18:02:00Z")),true,
 "04:02 AEST must retain 101 mm for 19-hour since-9am rainfall");
assert.equal(qualifiesRainfallSnapshot(mountainCreek,"since9am",
 Date.parse("2026-10-19T22:58:00Z")),false,
 "A station publication more than 90 minutes old must still be rejected");
const pre9={...mountainCreek,sourceCreatedAt:"2026-10-19T22:50:00Z"};
assert.equal(qualifiesRainfallSnapshot(pre9,"since9am",
 Date.parse("2026-10-19T22:55:00Z")),true,
 "08:55 AEST retains accumulation started at 9am previous day");
assert.equal(qualifiesRainfallSnapshot(pre9,"since9am",
 Date.parse("2026-10-19T23:05:00Z")),false,
 "09:05 AEST must not carry yesterday's total into today's 9am period");
assert.equal(qualifiesRainfallSnapshot({...pre9,sourceCreatedAt:"2026-10-19T23:03:00Z"},
 "since9am",Date.parse("2026-10-19T23:05:00Z")),true,
 "BoM source issued after 9am must be eligible for the new reporting day");
assert.equal(qualifiesRainfallSnapshot({...mountainCreek,sourceCreatedAt:"2026-10-19T16:55:00Z"},
 "since9am",Date.parse("2026-10-19T17:00:00Z")),true,
 "AEST day rollover at 3am preserves pre-9am BoM report");
assert.equal(qualifiesRainfallSnapshot({...hour[0],sourceCreatedAt:issued},"lastHour",now),true);
assert.equal(qualifiesRainfallSnapshot({...fullDay[0],sourceCreatedAt:issued},"last24Hours",now),true);
assert.equal(qualifiesRainfallSnapshot({...fullDay[0],sourceCreatedAt:issued},"last24Hours",now+100*60000),false);
assert.equal(qualifiesRainfallSnapshot({...fullDay[0],sourceCreatedAt:issued},"since9am",now),false);
assert.equal(qualifiesRainfallSnapshot({...hour[0],sourceCreatedAt:issued},"since9am",now),false);
// Browser-local IFD persistence: only source-verified EXACT matching coordinates
// survive page reloads. Never turn corrupt, neighbour or invented values into AEP.
assert.equal(IFD_LOOKUP_CONCURRENCY,6,"A modest six-wide lookup pipe replaces three");
const cell=ifdCellKey(-27.71,152.30);
const storageMap=new Map();
const storage={getItem:key=>storageMap.get(key)??null,
 setItem:(key,value)=>storageMap.set(key,value)};
const verified={verifiedUtc:"2026-10-22T01:00:00Z",
 sourceBaseline:"Bureau of Meteorology 2016 Design Rainfall Data System",
 depthsMmByMinutes:{
  "60":{"20":40,"10":50,"5":60,"2":70,"1":80},
  "1440":{"20":100,"10":120,"5":140,"2":160,"1":180}
 }};
assert(verifiedPersistentIfdCell(cell,verified));
assert.equal(verifiedPersistentIfdCell(cell,{...verified,sourceBaseline:"Unknown"}),false);
assert.equal(persistVerifiedIfdCell(cell,verified,storage),true);
assert(storageMap.has(IFD_LOCAL_CACHE_KEY));
assert.deepEqual(loadPersistedIfdCells(storage)[cell],verified);
assert.equal(classifyRainfallAep({
 mm:150,period:"last24Hours",latitude:-27.71,longitude:152.30,
 sourceCreatedAt:issuedTime(),grid:{cells:loadPersistedIfdCells(storage)}
}).aepDesignThreshold,5,"A 24-hour period reuses saved 1440-minute thresholds directly");
assert.equal(persistVerifiedIfdCell(cell,{...verified,sourceBaseline:"unverified"},storage),false);
assert.equal(persistVerifiedIfdCell(cell,{...verified,
 depthsMmByMinutes:{"60":verified.depthsMmByMinutes["60"]}},storage),false);
assert.deepEqual(Object.keys(loadPersistedIfdCells(storage)),[cell]);
storageMap.set(IFD_LOCAL_CACHE_KEY,"not json");
assert.deepEqual(loadPersistedIfdCells(storage),{});
assert.equal(persistVerifiedIfdCell(cell,verified,{
 getItem:()=>null,setItem:()=>{throw Error("Storage unavailable")}
}),false,"Storage errors must not block live classification");
assert.match(rainfallCode,/sort\(\(a,b\)=>b\.mm-a\.mm/,
 "Highest recorded rainfall must be prioritised for missing IFD cells");
assert.match(rainfallCode,/scheduleAepRender\(\)/,
 "Each request should not trigger an immediate full Cesium rebuild");
assert.match(rainfallCode,/void updateIfdCatalogue\(\)/,
 "The remote catalogue must not block the first map render");
console.log("PASS BoM separate 1hr, since9am and 24hr original station maps, threshold and freshness controls.");

import {validateRainfallRollover,validatedRainfallPayload,rainfallReportingStart,rainfallCacheSeconds}
 from "../src/context-layers/significant-rainfall-source-v1.js";
const rolloverAt=Date.parse("2026-11-25T23:00:00Z");
const rolloverGauge={id:"529090",name:"Four Ways",period:"since9am",region:"gulf",mm:65,
 sourceCreatedAt:"2026-11-25T23:05:00Z"};
const hourGauge={...rolloverGauge,period:"lastHour",mm:0};
const bad=validateRainfallRollover([rolloverGauge],[hourGauge])[0];
assert.equal(bad.rolloverPending,true);
assert.equal(qualifiesRainfallSnapshot(bad,"since9am",rolloverAt+6*60000),false);
assert.equal(validateRainfallRollover([rolloverGauge],[])[0].rolloverPending,true);
assert.equal(validateRainfallRollover([rolloverGauge],[{...hourGauge,mm:65,region:"other"}])[0].rolloverPending,true);
assert.equal(validateRainfallRollover([rolloverGauge],[{...hourGauge,mm:65}])[0].rolloverPending,undefined);
assert.equal(qualifiesRainfallSnapshot({...hourGauge,mm:65},"lastHour",rolloverAt+6*60000),true);
assert.equal(qualifiesRainfallSnapshot({...rolloverGauge,period:"last24Hours"},"last24Hours",rolloverAt+6*60000),true);
const late={...rolloverGauge,sourceCreatedAt:"2026-11-26T00:05:00Z"};
assert.equal(validateRainfallRollover([late],[],[bad])[0].rolloverPending,true);
assert.equal(validateRainfallRollover([{...late,mm:4}],[],[bad])[0].rolloverPending,undefined);
assert.equal(validatedRainfallPayload({observations:{since9am:[rolloverGauge],lastHour:[hourGauge]}}).observations.since9am[0].rolloverPending,true);
assert.equal(rainfallReportingStart(rolloverAt-1),rolloverAt-86400000);
assert.equal(rainfallReportingStart(rolloverAt),rolloverAt);
assert.equal(rainfallCacheSeconds(rolloverAt-30000),30);
assert.equal(rainfallCacheSeconds(rolloverAt),300);
console.log("PASS 529090 rollover regression, genuine short-duration rain, delayed reset and cache boundary.");
