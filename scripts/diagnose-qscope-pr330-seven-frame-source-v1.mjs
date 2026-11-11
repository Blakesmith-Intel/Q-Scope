// One-off READ ONLY source-provenance audit: one shared-cached official BoM
// WMTS capabilities GET. Never guesses tiles or fans out historical requests.
import {parsePublishedReflectivityTimes} from
 "../frontend/src/bom-wmts-published-times-v1.js";
import {resolveRainHistoryWindow} from
 "../frontend/src/rain-history-recovery-v1.js";
import {normaliseRadarHistoryTimes,radarHistorySpanMinutes} from
 "../frontend/src/radar-history-window-v1.js";
const url="https://qscope-ui-seven-pr330-stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/wmts-native-capabilities";
const begin=Date.now();
const res=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{Accept:"application/xml"}});
const response={http:res.status,contentType:res.headers.get("content-type"),source:url,
 checkedUtc:new Date().toISOString(),elapsedMs:Date.now()-begin};
if(!res.ok){console.log("QSCOPE_BOM_SEVENTH_FRAME_SOURCE",JSON.stringify(response));process.exit(1)}
const xml=await res.text();
const advertised=parsePublishedReflectivityTimes(xml);
const now=Date.now(),fresh=advertised.filter(t=>{
 const epoch=Date.parse(t);return epoch>now-180*60000&&epoch<now+5*60000
});
const newest=fresh.at(-1),span30=fresh.filter(t=>Date.parse(t)>=Date.parse(newest)-30*60000);
const latestNine=fresh.slice(-9);
const selected=resolveRainHistoryWindow(normaliseRadarHistoryTimes(fresh),30);
console.log("QSCOPE_BOM_SEVENTH_FRAME_SOURCE",JSON.stringify({
 ...response,publishedCount:advertised.length,latestPublishedUtc:newest,
 latestNine,sourceLast30Minutes:span30,sourceLast30Count:span30.length,
 sourceSpanMinutes:radarHistorySpanMinutes(span30),
 modelSelectedTimes:selected.plan.map(t=>t.observedUtc),
 modelSelectedCount:selected.plan.length,modelPartial:selected.partial,
 codeNotes:"One official Capabilities GET, no tile probes, no Worker metadata fanout"
}));
