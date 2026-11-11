// One-off READ ONLY source-provenance audit: one shared-cached official BoM
// WMTS capabilities GET. Never guesses tiles or fans out historical requests.
import {parsePublishedReflectivityTimes} from
 "../frontend/src/bom-wmts-published-times-v1.js";
import {resolveRainHistoryWindow} from
 "../frontend/src/rain-history-recovery-v1.js";
import {normaliseRadarHistoryTimes,radarHistorySpanMinutes} from
 "../frontend/src/radar-history-window-v1.js";
import {buildBomReflectivityTileUrl,reflectivityWindowForRegion} from
 "../frontend/src/bom-wmts-loop-v2.js";
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

const previewOrigin=new URL(url).origin;
const window=reflectivityWindowForRegion("66");
const centerCol=Math.floor((window.colStart+window.colEnd)/2);
const centerRow=Math.floor((window.rowStart+window.rowEnd)/2);
async function inspectTile(col,row,time){
 const officialUrl=new URL(buildBomReflectivityTileUrl(col,row,time));
 const resultUrl=previewOrigin+officialUrl.pathname+officialUrl.search;
 try{
  const r=await fetch(resultUrl,{signal:AbortSignal.timeout(12000)});
  const arr=new Uint8Array(await r.arrayBuffer());
  const validPng=arr.length>=8 && [137,80,78,71,13,10,26,10]
    .every((x,i)=>x===arr[i]);
  return {time,col,row,http:r.status,bytes:arr.length,
    png:validPng,contentType:r.headers.get("content-type")};
 }catch(e){return {time,col,row,error:String(e).slice(0,180)}}
}
// Only 7 center-tile checks and the oldest frame's actual Stapylton window;
// never scan all nine sources or all radar sites. One-time QA, no new poller.
const center=[];
for(const time of span30)
 center.push(await inspectTile(centerCol,centerRow,time));
const oldest=span30[0],footprint=[];
for(let row=window.rowStart;row<=window.rowEnd;row++)
 for(let col=window.colStart;col<=window.colEnd;col++){
  if(row===centerRow&&col===centerCol)continue;
  footprint.push(await inspectTile(col,row,oldest));
 }
console.log("QSCOPE_BOM_SEVENTH_FRAME_TILES",JSON.stringify({
 region:"66",window,checkedUtc:new Date().toISOString(),oldest,
 sampledSeven: center,oldestGenuineFullFootprint:footprint,
 note:"QA only, source-published timestamps; no guessed scans or background checks"}));
