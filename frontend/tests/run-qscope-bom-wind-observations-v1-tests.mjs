import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {
 windSeverity,windStationSeverity,windDisplay,gustKmh,parseUtc,
 parseQueenslandWindXml,sampledWindPeak24h
} from "../src/context-layers/qscope-bom-wind-observation-model-v1.js";
const NOW=Date.parse("2026-11-11T12:30:00Z");
assert.equal(windSeverity(89,0),"below");
assert.equal(windSeverity(90,null),"damaging");
assert.equal(windSeverity(124,null),"damaging");
assert.equal(windSeverity(125,null),"destructive");
assert.equal(windSeverity(null,63),"gale");
assert.equal(windStationSeverity({gustKmh:0,sustainedKmh:68,windAveragingMinutes:1}),"below");
assert.equal(windStationSeverity({gustKmh:0,sustainedKmh:68,windAveragingMinutes:10}),"gale");
assert.equal(gustKmh(null),"Unavailable");
assert.equal(gustKmh(""),"Unavailable");
assert.equal(parseUtc("20261111122000"),"2026-11-11T12:20:00.000Z");
const fixture=`<?xml version="1.0" encoding="UTF-8"?>
<product><identifier>IDQ60920</identifier><observations>
<station wmo-id="94576" bom-id="040913" name="Brisbane" lat="-27.48" lon="153.04">
<period time-utc="2026-11-11T12:20:00Z" wind-src="metar_10">
<level><element type="wind_spd_kmh">68</element><element type="gust_kmh">125</element>
<element type="maximum_gust_kmh">131</element></level></period></station>
<station wmo-id="94578" bom-id="040120" name="Other" lat="-27.5" lon="153.1">
<period time-utc="2026-11-11T12:20:00Z" wind-src="omd">
<level><element type="wind_spd_kmh">71</element><element type="gust_kmh"></element>
</level></period></station></observations></product>`;
const rows=parseQueenslandWindXml(fixture,{now:NOW});
assert.equal(rows.length,2);
assert.equal(rows[0].gustKmh,125);
assert.equal(rows[0].todayMaximumGustKmh,131);
assert.equal(rows[0].windAveragingMinutes,10);
assert.equal(windStationSeverity(rows[0]),"destructive");
assert.equal(rows[1].windAveragingMinutes,1);
assert.equal(rows[1].gustKmh,null);
assert.equal(windStationSeverity(rows[1]),"below");
assert.throws(()=>parseQueenslandWindXml("<random/>",{now:NOW}),/Unverified/);
const history={observations:{
 header:[{wmo:94576}],
 data:[
 {wmo:94576,aifstime_utc:"20261111120000",gust_kmh:92,wind_spd_kmh:42},
 {wmo:94576,aifstime_utc:"20261110130000",gust_kmh:145,wind_spd_kmh:45},
 {wmo:94576,aifstime_utc:"20261110110000",gust_kmh:188,wind_spd_kmh:44}
 ]}};
const peak=sampledWindPeak24h(history,{wmo:"94576",now:NOW});
assert.equal(peak.peakGustKmh,145,"rolling 24h excludes prior-day older than 24h");
assert.equal(peak.sampleCount,2);
assert.equal(sampledWindPeak24h(history,{wmo:"94577",now:NOW}),null);
assert.equal(windDisplay.destructive.priority>windDisplay.damaging.priority,true);
const html=readFileSync(fileURLToPath(new URL("../live3d-operational-v9.html",import.meta.url)),"utf8");
for(const id of ["showBomWindObservations","refreshBomWindObservations",
 "openBomWindGustReport","bomWindObservationsStatus","bomWindGustReport",
 "bomWindGustReportStatus","bomWindGustReportRows","bomWindObservationInfo"]){
 assert.equal(html.split('id="'+id+'"').length-1,1,"exactly one "+id);
}
const runtime=readFileSync(fileURLToPath(new URL("../src/live3d-operational-v9.js",import.meta.url)),"utf8");
assert.match(runtime,/initialiseOperationalBomWindObservations\(\{viewer\}\)/);
const worker=readFileSync(fileURLToPath(new URL("../../relay/worker.js",import.meta.url)),"utf8");
assert.match(worker,/incoming\.pathname === "\/qld-wind-observations"/);
assert.match(worker,/relayQldWindObservations/);
console.log("Official BoM wind threshold, XML/JSON, 24h, UI and isolated relay contracts PASS");
