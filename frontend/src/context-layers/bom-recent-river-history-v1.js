import {parseQueenslandObservationTime, FLOOD_SIGNAL_MAX_AGE_MS, latestRiseRate} from "./river-flood-signals-v1.js?v=9.13.0";
import {publishedCrossingForFeature} from "./river-crossing-state-v1.js?v=20261024-crossing-coverage-v1-approaches-v2";
import {gaugeRiseScreeningZone} from "./river-gauge-coastal-screen-v1.js?v=inland-coast-screen-20261018";
import {stationFloodLevels, observedFloodClass} from "./river-flood-thresholds-v1.js?v=20261020-new-beith-ahd-v2";

// BoM publishes recent tabular readings alongside each public .plt.shtml
// gauge plot. Parse only the first date/water-level table; never infer data
// from chart pixels or use undocumented alternative hosts.
export const RECENT_TABLE_PATH_PATTERN =
  /^\/fwo\/(IDQ65\d{3})\/\1\.(\d{5,7})\.plt\.shtml$/i;

export function officialRecentTableTarget(href) {
  const raw=String(href??"");
  const match=RECENT_TABLE_PATH_PATTERN.exec(raw);
  if(!match)return null;
  return {
    product:match[1].toUpperCase(),
    station:match[2],
    url:`https://www.bom.gov.au/fwo/${match[1].toUpperCase()}/${match[1].toUpperCase()}.${match[2]}.tbl.shtml`
  };
}

function cleanCell(text) {
  return String(text??"").replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/gi," ")
    .replace(/\s+/g," ").trim();
}
function parseTableDate(value) {
  // BoM tables can prefix a weekday or suffix AEST / AM/PM to the same
  // Queensland station timestamp. Accept these explicit source notations
  // without guessing dates, stations or time zones.
  const input=String(value??"").trim()
    .replace(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:day|sday|nesday|rsday|urday)?[,]?\s+/i,"")
    .replace(/\s*\(?AEST\)?$/i,"").trim();
  const m=input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i);
  if(!m)return null;
  let [d,mo,y,h,mi]=m.slice(1,6).map(Number);
  const meridiem=String(m[6]??"").toLowerCase();
  if(meridiem){
    if(h<1||h>12)return null;
    h=h%12+(meridiem==="pm"?12:0);
  }
  if(h>23||mi>59)return null;
  const check=new Date(Date.UTC(y,mo-1,d));
  if(check.getUTCDate()!==d||check.getUTCMonth()!==mo-1||check.getUTCFullYear()!==y)return null;
  return Date.UTC(y,mo-1,d,h-10,mi); // BoM Queensland river tables use AEST.
}

export function parseBomRecentWaterLevels(html,{nowMs=Date.now(),maxAgeHours=48}={}) {
  const source=String(html??"");
  const table=source.match(/<table\b[^>]*\bid\s*=\s*["']tableStyle1["'][^>]*>([\s\S]*?)<\/table>/i);
  if(!table)return [];
  const rows=[...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  if(!rows.length || !/Date\/Time/i.test(cleanCell(rows[0][1])) ||
    !/Water\s*Level\s*\(m\)/i.test(cleanCell(rows[0][1])))return [];
  const good=new Map(),bad=new Set();
  for(const row of rows.slice(1,3000)){
    const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
    if(cells.length!==2)continue;
    const time=parseTableDate(cleanCell(cells[0][1]));
    const level=cleanCell(cells[1][1]);
    if(!/^[-+]?\d+(?:\.\d+)?$/.test(level))continue;
    const height=Number(level);
    if(time===null||!Number.isFinite(height)||time>nowMs+5*60000||
      time<nowMs-maxAgeHours*3600000)continue;
    if(good.has(time)&&Math.abs(good.get(time)-height)>0.001)bad.add(time);
    else good.set(time,height);
  }
  return [...good].filter(([time])=>!bad.has(time))
    .sort((a,b)=>a[0]-b[0])
    .slice(-225).map(([time,height])=>({time,height}));
}

// Keep genuine missing observations separate from a changed HTML format.
// No-date/no-level rows are normal for some BoM stations; numeric water levels
// with unparseable date strings indicate a source contract change instead.
export function inspectBomRecentWaterLevelTable(html,options={}) {
  const source=String(html??"");
  const table=source.match(/<table\b[^>]*\bid\s*=\s*["']tableStyle1["'][^>]*>([\s\S]*?)<\/table>/i);
  if(!table)return {formatRecognised:false,samples:[],dataRows:0};
  const rows=[...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  if(!rows.length || !/Date\/Time/i.test(cleanCell(rows[0][1])) ||
    !/Water\s*Level\s*\(m\)/i.test(cleanCell(rows[0][1])))
    return {formatRecognised:false,samples:[],dataRows:Math.max(0,rows.length-1)};
  let numericRows=0,parseableNumericRows=0;
  for(const row of rows.slice(1,3000)){
    const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
    if(cells.length!==2)continue;
    const height=cleanCell(cells[1][1]);
    if(!/^[-+]?\d+(?:\.\d+)?$/.test(height))continue;
    numericRows++;
    if(parseTableDate(cleanCell(cells[0][1]))!==null)parseableNumericRows++;
  }
  if(numericRows>0 && parseableNumericRows===0)
    return {formatRecognised:false,samples:[],dataRows:rows.length-1};
  return {formatRecognised:true,
    samples:parseBomRecentWaterLevels(source,options),
    dataRows:Math.max(0,rows.length-1)};
}

// The same verified station table also carries the latest measured HEIGHT.
// Previously it was used only for the rate/bridge lookup, leaving a stale or
// contradictory bulletin height visible even after newer source data arrived.
// Never promote another station, a future timestamp, or an older table reading.
export function reconcileOfficialBoMTableHeight(
  feature,samples,nowMs=Date.now(),publishedFeature=null
){
  const id=String(feature?.id??""),p=feature?.properties??{};
  if(!/^bom:\d{6}$/.test(id)||String(p.bom_stn_num??"").padStart(6,"0")!==id.slice(4)||
      !Array.isArray(samples)||!samples.length)return feature;
  const latest=samples.filter(x=>Number.isFinite(x?.time)&&Number.isFinite(x?.height)&&
      x.time<=nowMs+5*60000&&x.time>=nowMs-48*3600000)
    .sort((a,b)=>a.time-b.time).at(-1);
  if(!latest)return feature;
  const stored=Number(p.STORMTRACKER_OFFICIAL_OBSERVED_AT);
  const fromBulletin=parseQueenslandObservationTime(p.STORMTRACKER_OBSERVED_TEXT,nowMs);
  const prior=Number.isFinite(stored)&&stored>0 ? stored:fromBulletin;
  const levels=stationFloodLevels(feature);
  const priorFlood=levels?observedFloodClass(p.STORMTRACKER_HEIGHT_METRES,levels):undefined;
  const tableFlood=levels?observedFloodClass(latest.height,levels):undefined;
  const published=publishedFeature?.id===id?publishedFeature.properties??{}:null;
  const publishedAt=published?parseQueenslandObservationTime(
    published.STORMTRACKER_OBSERVED_TEXT,nowMs):null;
  // A prior bulletin from a previous Monday can be wrongly interpreted as
  // THIS Monday when BoM's bulletin lacks a full date. Do not roll back a
  // valid newer reading on one older source alone. Require BOTH live bulletin
  // and independent same-station table to agree on date and height, a stale
  // contradictory cached observation, and a discrepancy across minor stage.
  const confirmedCacheConflict=Number.isFinite(prior)&&
    nowMs-prior>FLOOD_SIGNAL_MAX_AGE_MS&&latest.time<prior&&
    latest.time===publishedAt &&
    Math.abs(Number(published?.STORMTRACKER_HEIGHT_METRES)-latest.height)<0.011 &&
    ["minor","moderate","major"].includes(priorFlood)&&tableFlood===null;
  if(Number.isFinite(prior)&&latest.time<prior&&!confirmedCacheConflict)return feature;
  if(latest.time===prior&&latest.height===p.STORMTRACKER_HEIGHT_METRES)return feature;
  const local=new Date(latest.time+10*3600000);
  const pad=v=>String(v).padStart(2,"0");
  const hour=local.getUTCHours();
  const observedText=pad(hour%12||12)+":"+pad(local.getUTCMinutes())+
    (hour>=12?"pm ":"am ")+
    ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][local.getUTCDay()]+" "+
    pad(local.getUTCDate())+"/"+pad(local.getUTCMonth()+1)+"/"+
    local.getUTCFullYear();
  const calculated=tableFlood;
  return {...feature,properties:{...p,
    STORMTRACKER_HEIGHT_METRES:latest.height,
    STORMTRACKER_OBSERVED_TEXT:observedText,
    STORMTRACKER_OFFICIAL_OBSERVED_AT:latest.time,
    // Recalculate classification only against published exact-station levels.
    // Without those levels, never preserve an obsolete major claim as current.
    STORMTRACKER_FLOOD_CLASS:calculated===undefined?"":(calculated??"below-minor"),
    ...(confirmedCacheConflict?{
      STORMTRACKER_STATION_TABLE_CONFLICT:
        "Unverified: discarded an uncorroborated cached flood reading ("+
        Number(p.STORMTRACKER_HEIGHT_METRES).toFixed(2)+
        " m). BoM's current bulletin and exact-station history both last "+
        "confirm "+latest.height.toFixed(2)+" m at "+observedText+
        "; the present level is not verified."
    }:{})
  }};
}

// A gap also exists when BoM supplies no valid table link. Do not silently
// treat an unscreenable rising gauge as a negative rapid-rise result.
// Only recover OPTIONAL history when it can affect the displayed flash-rise
// screening. BoM tendency is not required for a measured rise-rate check. Official BoM flood classes are rendered immediately regardless.
// Source-identified tide gauges can NEVER produce a rate-only arrow, so
// downloading their often huge history tables consumes relay capacity for no
// operational gain. Do recover inland below-minor rivers: a modest rise here
// is precisely the Adavale-type signal previously missed by the old filter.
export function recentFloodHistoryGap(feature,history={},nowMs=Date.now(),crossingCatalogue=null) {
  const p=feature?.properties??{};
  const types=String(p.location_types??"").toLowerCase();
  const explicitlyTidal=/tide gauge|tidal|estuar(?:y|ine)|sea level/.test(types);
  const flood=String(p.STORMTRACKER_FLOOD_CLASS??"").toLowerCase();
  const inland=gaugeRiseScreeningZone(feature).zone==="inland";
  const classified=["minor","moderate","major"].includes(flood);
  const lastConfirmed=["minor","moderate","major"].includes(
    String(p.STORMTRACKER_LAST_CONFIRMED_FLOOD_CLASS??"").toLowerCase());
  const crossing=publishedCrossingForFeature(feature,crossingCatalogue);
  const crossingReached=Boolean(crossing&&
    typeof p.STORMTRACKER_HEIGHT_METRES==="number"&&
    Number.isFinite(p.STORMTRACKER_HEIGHT_METRES)&&
    p.STORMTRACKER_HEIGHT_METRES>=crossing.heightMetres);
  // Visible coastal crossing markers need their own station history as much
  // as flood-classified gauges do; don't download ordinary coastal stations.
  if(!classified && !lastConfirmed && !inland && !crossingReached)return null;
  // Tide gauges still need historic RISE/FALL information if they have a
  // classified/crossing marker; tidal rapid-rise alerts remain forbidden.
  if(explicitlyTidal && !classified && !lastConfirmed && !crossingReached)return null;
  const observed=parseQueenslandObservationTime(p.STORMTRACKER_OBSERVED_TEXT,nowMs);
  // A stale classified/crossing gauge especially needs a fresh BoM table:
  // previously this early return prevented recovery from stale major readings.
  // Keep ordinary below-minor inland probes fresh-only to bound source traffic.
  if(observed!==null && observed>nowMs+5*60000)return null;
  if((observed===null || nowMs-observed>FLOOD_SIGNAL_MAX_AGE_MS) &&
      !classified && !lastConfirmed && !crossingReached)return null;
  const sample=history[String(feature?.id??"")]??[];
  const valid=Array.isArray(sample)?sample.filter(x=>
    Number.isFinite(x?.time)&&Number.isFinite(x?.height)):[];
  const rate=latestRiseRate(valid,nowMs);
  const aligned=rate!==null&&Math.abs(rate.observedAt-observed)<=10*60000;
  if(aligned)return null;
  return {
    id:String(feature?.id??""),
    tidal:false,
    inland,
    target:officialRecentTableTarget(p.STORMTRACKER_RECENT_DATA_HREF)
  };
}

export function recentFloodHistoryCandidate(feature,history={},nowMs=Date.now()) {
  const gap=recentFloodHistoryGap(feature,history,nowMs);
  return gap?.target?{id:gap.id,...gap.target,tidal:gap.tidal,
    inland:gap.inland}:null;
}

// Distinguish an individual unavailable history table from a shared service
// failure. Unknown/network/timeout errors use service-level backoff.
export function classifyBoMRecentHistoryFailure(error) {
  const status=Number(error?.status)||0;
  const code=String(error?.code??"");
  if(["no_usable_observations","station_history_not_published",
      "invalid_station","source_response_too_large"].includes(code)||
      [400,404,410,422].includes(status))return "station";
  return "service";
}

export const RECENT_HISTORY_RELAY_URL =
  "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/river-recent-history";


// Schedule verified SAME-station table lookups for every operational BoM
// gauge with an observed height. The published crossing test is independent
// of flood stage and tendency; steady and falling gauges can remain dangerous.
// Reuse BoM source URLs and never match stations by name.
export function planBoMStationTableLookups(features,{
  history={},plotCrossings={},crossingCatalogue=null,nowMs=Date.now()
}={}){
  const planned=[];
  const knownSection5=crossingCatalogue?.schema==="StormTrackerBoMQldCrossingHeightsV1"
    ?crossingCatalogue.entries??{}:{};
  for(const feature of features??[]){
    const id=String(feature?.id??""),p=feature?.properties??{};
    if(!/^bom:\d{6}$/.test(id)||p.STORMTRACKER_IDENTITY_WARNING)continue;
    const native=String(p.bom_stn_num??"").trim();
    if(native&&(!/^\d{1,6}$/.test(native)||native.padStart(6,"0")!==id.slice(4)))continue;
    if(typeof p.STORMTRACKER_HEIGHT_METRES!=="number"||
       !Number.isFinite(p.STORMTRACKER_HEIGHT_METRES))continue;
    const target=officialRecentTableTarget(p.STORMTRACKER_RECENT_DATA_HREF);
    if(!target||target.station!==id.slice(4))continue;
    const historyGap=recentFloodHistoryGap(feature,history,nowMs,crossingCatalogue);
    const needsHistory=Boolean(historyGap?.target);
    const needsCrossing=!Object.hasOwn(plotCrossings,id);
    if(!needsHistory&&!needsCrossing)continue;
    const observed=Number(p.STORMTRACKER_OFFICIAL_OBSERVED_AT);
    const observation=Number.isFinite(observed)&&observed>0
      ?observed:parseQueenslandObservationTime(p.STORMTRACKER_OBSERVED_TEXT,nowMs);
    const fresh=observation!==null&&Number.isFinite(observation)&&
      observation<=nowMs+5*60000&&nowMs-observation<=FLOOD_SIGNAL_MAX_AGE_MS;
    const tendency=String(p.STORMTRACKER_TENDENCY??"").toLowerCase();
    const noStage=p.STORMTRACKER_MINOR_FLOOD_METRES==null;
    const noPublishedCrossing=!knownSection5[id];
    // Priority is ONLY the order in which to CHECK an official source.
    // A high current height cannot invent a bridge or flood classification.
    // Recover stale classified gauges first: their previously displayed
    // flood stage is unverified until current station history corroborates it.
    const staleFlood=needsHistory&&!fresh&&
      ["minor","moderate","major"].includes(
        String(p.STORMTRACKER_FLOOD_CLASS??"").toLowerCase());
    // Source-verified ABOVE-minor stations and reached published crossings
    // must receive optional history FIRST. Lower-height inland rate checks
    // and reference discovery remain eligible but cannot crowd them out.
    const measuredStage=observedFloodClass(p.STORMTRACKER_HEIGHT_METRES,
      stationFloodLevels(feature));
    const reportedStage=String(p.STORMTRACKER_FLOOD_CLASS??"").toLowerCase();
    const alreadyFlooding=["minor","moderate","major"].includes(measuredStage)||
      ["minor","moderate","major"].includes(reportedStage);
    const crossingReached=Boolean(publishedCrossingForFeature(feature,crossingCatalogue)&&
      p.STORMTRACKER_HEIGHT_METRES>=
        publishedCrossingForFeature(feature,crossingCatalogue).heightMetres);
    const priority=alreadyFlooding?-4:crossingReached?-3:
      staleFlood?-2:needsHistory&&fresh?0:
      needsCrossing&&fresh&&noStage&&noPublishedCrossing&&tendency==="rising"?1:
      needsCrossing&&fresh&&noStage&&noPublishedCrossing&&
        p.STORMTRACKER_HEIGHT_METRES>=1.5?2:
      needsCrossing&&fresh&&noStage&&noPublishedCrossing?3:
      needsCrossing&&fresh&&!knownSection5[id]?4:
      needsCrossing&&fresh?5:6;
    planned.push({...target,id,inland:historyGap?.inland??false,
      needsHistory,needsCrossing,priority,
      observedAt:observation??0,heightMetres:p.STORMTRACKER_HEIGHT_METRES});
  }
  return planned.sort((a,b)=>a.priority-b.priority||
    (a.priority===2?b.heightMetres-a.heightMetres:0)||
    b.observedAt-a.observedAt||a.id.localeCompare(b.id));
}

export async function fetchBoMRecentHistoryDetail(target,{
  fetchImpl=globalThis.fetch,endpoint=RECENT_HISTORY_RELAY_URL,timeoutMs=15000
}={}) {
  if(!target?.station||!target?.product||!officialRecentTableTarget(
    "/fwo/"+target.product+"/"+target.product+"."+target.station+".plt.shtml"
  ))throw new Error("Invalid station in requested BoM history");
  const url=new URL(endpoint);
  url.searchParams.set("product",target.product);
  url.searchParams.set("station",target.station);
  const abort=new AbortController();
  const timer=setTimeout(()=>abort.abort(),timeoutMs);
  try {
    const response=await fetchImpl(url.toString(),{
      headers:{Accept:"application/json"},signal:abort.signal
    });
    if(!response.ok){
      // The Worker returns typed JSON; legacy plain-text failures still fall
      // back to their HTTP status without discarding the failure.
      let failure=null;
      try{failure=await response.json();}catch{}
      const code=String(failure?.code??"").slice(0,80);
      const error=new Error("BoM recent data HTTP "+response.status+
        (code?" ("+code+")":""));
      error.status=response.status;
      error.code=code;
      error.upstreamStatus=Number(failure?.upstreamStatus)||null;
      error.scope=classifyBoMRecentHistoryFailure(error);
      throw error;
    }
    const payload=await response.json();
    if(payload.format!=="StormTrackerBomRecentRiverHistoryV1"||
      payload.station!==target.station||payload.product!==target.product||
      !Array.isArray(payload.samples)||
      (payload.availability!==undefined &&
        !["available","no_recent_observations","not_published"].includes(payload.availability))||
      (["no_recent_observations","not_published"].includes(payload.availability) &&
        payload.samples.length!==0))
      throw new Error("BoM station history response mismatch");
    const samples=payload.samples.filter(x=>Number.isFinite(x?.time)&&Number.isFinite(x?.height))
      .slice(-225);
    const crossing=payload.crossing;
    const validCrossing=crossing&&["B","C","X","R","A"].includes(crossing.type)&&
      typeof crossing.heightMetres==="number"&&Number.isFinite(crossing.heightMetres)&&
      crossing.heightMetres>=-10&&crossing.heightMetres<=300;
    return {samples,crossing:validCrossing?crossing:null};
  }catch(error){
    if(abort.signal.aborted){
      // A scheduled optional query timing out is not an unexplained Cesium
      // or flood bulletin failure. Retain explicit source unavailability
      // and shared-service backoff rather than the browser's vague AbortError.
      const timeout=new Error("Optional BoM station-history lookup timed out");
      timeout.code="source_timeout";
      timeout.scope="service";
      throw timeout;
    }
    throw error;
  }finally {
    clearTimeout(timer);
  }
}

// Existing callers keep the historical samples-only contract.
export async function fetchBoMRecentHistory(target,options={}){
  const result=await fetchBoMRecentHistoryDetail(target,options);
  return result.samples;
}
