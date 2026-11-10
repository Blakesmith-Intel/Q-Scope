// StormTracker operational flood signals, not BoM-issued flash-flood warnings.
// Severe classifications are authoritative. Rise-rate flags are deliberately
// conservative heuristics and require real successive observed timestamps.
import {gaugeRiseScreeningZone} from "./river-gauge-coastal-screen-v1.js?v=inland-coast-screen-20261018";
import {stationFloodLevels,observedFloodClass}
  from "./river-flood-thresholds-v1.js?v=20261020-new-beith-ahd-v2";

export const FLOOD_SIGNAL_STORAGE_KEY = "stormtracker.qld-flood-observations.v1";
export const FLOOD_SIGNAL_HISTORY_MS = 48 * 60 * 60 * 1000;
export const FLOOD_SIGNAL_MAX_AGE_MS = 90 * 60 * 1000;
// Maximum age for a flood marker supported only by the last BoM observation.
// Manual/event-only gauges may stop publishing after a flood recedes. Expired
// evidence removes the icon, but NEVER establishes that the water is safe.
export const FLOOD_STAGE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Manually read BoM river gauges can publish less frequently than telemetry.
// Extend ONLY an explicitly BoM-identified, same-station, same-datum,
 // ABOVE-minor *reported* flood observation to 48h, visibly stale.
// This never extends rapid-rise evidence, below-minor status, or a conflicting
// stage: it is last-reported flood context, NOT current water-level assurance.
export const MANUAL_FLOOD_STAGE_MAX_AGE_MS = 48 * 60 * 60 * 1000;
export function floodStageEvidenceMaxAge(feature){
  const p=feature?.properties??{};
  if(p.STORMTRACKER_REPORTING_MODE!=="manual" ||
     !/^IDQ602(?:8[5-9]|9[0-6])$/.test(String(p.STORMTRACKER_SOURCE_PRODUCT??"")) ||
     p.STORMTRACKER_IDENTITY_WARNING ||
     p.STORMTRACKER_STATION_TABLE_CONFLICT) return FLOOD_STAGE_MAX_AGE_MS;
  const id=String(feature?.id??"");
  const native=String(p.bom_stn_num??"");
  if(!/^bom:\d{6}$/.test(id)||!/^\d{1,6}$/.test(native)||
     native.padStart(6,"0")!==id.slice(4))return FLOOD_STAGE_MAX_AGE_MS;
  const measured=observedFloodClass(
    p.STORMTRACKER_HEIGHT_METRES,stationFloodLevels(feature));
  const reported=String(p.STORMTRACKER_FLOOD_CLASS??"").toLowerCase().trim();
  return measured===reported && ["minor","moderate","major"].includes(reported)
    ?MANUAL_FLOOD_STAGE_MAX_AGE_MS:FLOOD_STAGE_MAX_AGE_MS;
}

// Compare genuine readings separated by 30–120 minutes. The actual elapsed
// time determines the hourly rate; never invent or interpolate observations.
export const FLOOD_SIGNAL_MIN_INTERVAL_MS = 30 * 60 * 1000;
export const FLOOD_SIGNAL_MAX_INTERVAL_MS = 120 * 60 * 1000;
// MSQ 2026 tidal planes describe COASTAL reference rates, not inland floods.
// Preserve conservative screening for *coastal-uncertain* and unlocated sites.
// Far-inland stations are demonstrably outside the mapped 125 km tidal-risk
// buffer, and must regain the previous sensitive 0.30 m/h rise screening.
// This remains an inferred screening indicator, NOT a BoM flash flood warning.
export const QLD_TIDAL_REFERENCE_MEAN_PEAK_M_PER_H = 0.63;
export const QLD_TIDAL_REFERENCE_UPPER_PEAK_M_PER_H = 1.23;
export const NON_TIDAL_RAPID_RISE_M_PER_H = 0.30;
export const COASTAL_UNCERTAIN_RAPID_RISE_M_PER_H = 1.40;
export const TIDAL_MIN_ANOMALOUS_RISE_M_PER_H = 0.25;
export const TIDAL_ANOMALY_FACTOR = 1.75;
const QLD_UTC_OFFSET_MS = 10 * 60 * 60 * 1000;
const WEEKDAYS = ["sun","mon","tue","wed","thu","fri","sat"];

function finite(v) { return typeof v === "number" && Number.isFinite(v); }

export function parseQueenslandObservationTime(value, nowMs = Date.now()) {
  const text = String(value ?? "").trim();
  const time = text.match(/\b(\d{1,2})[.:](\d{2})\s*(am|pm)?\b/i);
  if (!time || !finite(nowMs)) return null;
  let hour = Number(time[1]);
  const minute = Number(time[2]);
  if (hour > 23 || minute > 59) return null;
  const meridiem = String(time[3] ?? "").toLowerCase();
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12 + (meridiem === "pm" ? 12 : 0);
  }
  const local = new Date(nowMs + QLD_UTC_OFFSET_MS);
  let year = local.getUTCFullYear();
  let month = local.getUTCMonth();
  let day = local.getUTCDate();
  const dated = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (dated) {
    day = Number(dated[1]);
    month = Number(dated[2]) - 1;
    year = Number(dated[3]);
    if (year < 100) year += 2000;
    const verify = new Date(Date.UTC(year,month,day));
    if (verify.getUTCFullYear() !== year || verify.getUTCMonth() !== month
       || verify.getUTCDate() !== day) return null;
  } else {
    const weekday = text.match(/\b(sun|mon|tue|wed|thu|fri|sat)(?:day)?\b/i);
    if (!weekday) return null;
    const target = WEEKDAYS.indexOf(weekday[1].toLowerCase());
    const age = (local.getUTCDay() - target + 7) % 7;
    const date = new Date(Date.UTC(year,month,day - age));
    year = date.getUTCFullYear();
    month = date.getUTCMonth();
    day = date.getUTCDate();
  }
  let ms = Date.UTC(year,month,day,hour-10,minute);
  if (!dated && ms > nowMs + 5 * 60000) ms -= 7 * 86400000;
  if (ms > nowMs + 5 * 60000 || nowMs-ms > FLOOD_SIGNAL_HISTORY_MS) return null;
  return ms;
}

export function appendGaugeObservation(history, feature, nowMs = Date.now()) {
  const id = String(feature?.id ?? "");
  const p = feature?.properties ?? {};
  const height = p.STORMTRACKER_HEIGHT_METRES;
  const observedAt = parseQueenslandObservationTime(p.STORMTRACKER_OBSERVED_TEXT,nowMs);
  if (!id || !finite(height) || !finite(observedAt)) return false;
  const list = Array.isArray(history[id]) ? history[id] : [];
  if (!list.some(s => s.time === observedAt)) {
    list.push({time:observedAt,height});
    list.sort((a,b)=>a.time-b.time);
  }
  history[id] = list.filter(s=>finite(s.time) && finite(s.height) &&
    s.time <= nowMs + 5*60000 && s.time >= nowMs-FLOOD_SIGNAL_HISTORY_MS)
    .slice(-225);
  return true;
}

export function cleanFloodSignalHistory(data,nowMs=Date.now()) {
  const history={};
  if (!data || typeof data!=="object" || Array.isArray(data)) return history;
  for(const [id,items] of Object.entries(data).slice(0,1800)){
    if (!/^(bom|awrc):[a-z0-9_-]+$/i.test(id) || !Array.isArray(items))continue;
    const seen = new Set();
    const filtered=[];
    for(const item of items.slice(-250)){
      if(!finite(item?.time)||!finite(item?.height)||
        item.time < nowMs-FLOOD_SIGNAL_HISTORY_MS || item.time > nowMs+5*60000 ||
        seen.has(item.time))continue;
      seen.add(item.time);
      filtered.push({time:item.time,height:item.height});
    }
    if(filtered.length)history[id]=filtered.sort((a,b)=>a.time-b.time).slice(-225);
  }
  return history;
}

// Source station ID remains the ONLY join key. Tidal identification is a
// separate HYDROLOGICAL screening decision using source metadata and actual
// height observations. No station or locality name-based matches.
export function observedTidalOscillation(samples, nowMs=Date.now()) {
  const data=(Array.isArray(samples)?samples:[]).filter(p=>
    finite(p?.time)&&finite(p?.height) &&
    p.time>=nowMs-FLOOD_SIGNAL_HISTORY_MS &&
    p.time<=nowMs+5*60000).sort((a,b)=>a.time-b.time);
  if(data.length<12 || data.at(-1).time-data[0].time<16*3600000)return false;
  const runs=[];
  for(let i=1;i<data.length;i++){
    const dt=data[i].time-data[i-1].time;
    if(dt<10*60000 || dt>120*60000)continue;
    const delta=data[i].height-data[i-1].height;
    // Ignore sensor jitter: a normal tide has sustained material limbs.
    if(Math.abs(delta)<0.035)continue;
    const sign=Math.sign(delta);
    const prev=runs.at(-1);
    if(prev && prev.sign===sign){
      prev.finish=data[i].time;
      prev.change+=Math.abs(delta);
    }else{
      runs.push({sign,start:data[i-1].time,finish:data[i].time,change:Math.abs(delta)});
    }
  }
  const limbs=runs.filter(r=>
    r.finish-r.start>=60*60000 && r.change>=0.18);
  if(limbs.length<4)return false;
  // At least three alternating significant tidal-like reversals, over a
  // sensible time window. A single flash-flood wave cannot establish this.
  for(let i=3;i<limbs.length;i++){
    const tail=limbs.slice(i-3,i+1);
    if(tail.some((r,j)=>j>0 && (r.sign===tail[j-1].sign ||
        r.start-tail[j-1].finish>120*60000)))continue;
    if(tail[3].finish-tail[0].start>=12*3600000)return true;
  }
  return false;
}

function recentTidalReversal(samples,nowMs=Date.now()){
  const pts=(Array.isArray(samples)?samples:[]).filter(p=>finite(p?.time)&&finite(p?.height)&&
    p.time>=nowMs-6*3600000 && p.time<=nowMs+5*60000).sort((a,b)=>a.time-b.time);
  if(pts.length<4)return false;
  let up=false,down=false;
  for(let i=1;i<pts.length;i++){
    const dt=pts[i].time-pts[i-1].time;
    if(dt<10*60000||dt>120*60000)continue;
    const delta=pts[i].height-pts[i-1].height;
    if(delta>0.12)up=true;
    if(delta< -0.12)down=true;
  }
  return up&&down;
}

// Positive, exact-station-ID non-tidal evidence. Never infer non-tidal from
// the absence of a 'tide gauge' label or from proximity to the coastline.
// 540529: BoM 14-day Laidley Creek at Warrego Highway plot inspected
// 26 Oct 2026, showing a stable non-cyclic pre-event level and distinct
// rainfall/flood waves; operator-supplied source screenshot and matching
// exact BoM station ID. Review an entry if new BoM evidence disputes it.
// Add new stations ONLY after individual official-source/long-history review.
export const REVIEWED_NON_TIDAL_BOM_STATIONS=Object.freeze({
  "bom:540529":"Laidley Creek at Warrego Highway — 26 Oct 2026 BoM 14-day plot"
});
// Use explicit BoM station metadata for ALL gauges, not a blanket coastal
// classification. Missing metadata remains unverified, not "non-tidal".
function sourceStationMatches(feature){
  const id=String(feature?.id??"");
  const p=feature?.properties??{};
  if(!/^bom:\d{6}$/.test(id)||p.STORMTRACKER_IDENTITY_WARNING)return false;
  const station=String(p.bom_stn_num??"").trim();
  return !station || (/^\d{1,6}$/.test(station)&&station.padStart(6,"0")===id.slice(4));
}
function tidalTags(feature){
  // Strip explicit "non-tidal" before matching "tidal"; if BOTH separate
  // labels appear, treat tidal as authoritative and suppress false alerts.
  const types=String(feature?.properties?.location_types??"").toLowerCase();
  return /tide gauge|\btidal\b|estuar(?:y|ine)|sea level/.test(
    types.replace(/\bnon[\s-]?tidal\b/g,""));
}
function nonTidalTags(feature){
  return /\bnon[\s-]?tidal\b/i.test(String(feature?.properties?.location_types??""));
}
export function isVerifiedNonTidalGauge(feature){
  if(!sourceStationMatches(feature)||tidalTags(feature))return false;
  return nonTidalTags(feature)||
    Object.hasOwn(REVIEWED_NON_TIDAL_BOM_STATIONS,String(feature.id));
}
export function isObservedTidalGauge(feature,samples=[],nowMs=Date.now()){
  if(tidalTags(feature))return true;
  if(isVerifiedNonTidalGauge(feature))return false;
  return observedTidalOscillation(samples,nowMs);
}

// Assess EVERY valid gauge inside the existing 125 km coastal screening
// buffer using already-loaded official metadata and same-station history.
// Unknown remains conservative, never silently counted as verified tidal.
export function coastalGaugeTidalCoverage(features,history={},nowMs=Date.now()){
  const count={coastal:0,verifiedNonTidal:0,verifiedTidal:0,
    observedTidalPattern:0,unverified:0};
  for(const f of features??[]){
    if(gaugeRiseScreeningZone(f).zone!=="coastal-uncertain")continue;
    count.coastal++;
    const samples=history[String(f?.id??"")]??[];
    if(!sourceStationMatches(f))count.unverified++;
    else if(tidalTags(f))count.verifiedTidal++;
    else if(isVerifiedNonTidalGauge(f))count.verifiedNonTidal++;
    else if(observedTidalOscillation(samples,nowMs))count.observedTidalPattern++;
    else count.unverified++;
  }
  return count;
}

// Retain longer history only for officially tidal gauges or gauged water
// levels showing source-observed tidal behaviour. Another river stays bounded
// to four hours to preserve mobile storage (1,000+ QLD sites).
// Missing stations preserve their recent history through a partial bulletin.
export function compactFloodHistory(history, features=[], nowMs=Date.now()) {
  const types=new Map((features??[]).map(f=>[
    String(f?.id??""),
    f
  ]));
  const stored={};
  for(const [id,samples] of Object.entries(history??{})) {
    const f=types.get(id);
    const keepTidal=Boolean(f && (isObservedTidalGauge(f,samples,nowMs) ||
      recentTidalReversal(samples,nowMs)));
    const age=keepTidal?FLOOD_SIGNAL_HISTORY_MS:4*3600000;
    const current=Array.isArray(samples) ? samples.filter(p=>
      finite(p?.time) && finite(p?.height) &&
      p.time >= nowMs-age && p.time <= nowMs+5*60000
    ).slice(-225):[];
    if(current.length)stored[id]=current;
  }
  return stored;
}

export function latestRiseRate(samples, nowMs=Date.now()) {
  const sorted=(Array.isArray(samples)?samples:[]).filter(p=>
    finite(p?.time) && finite(p?.height)).sort((a,b)=>a.time-b.time);
  if(sorted.length<2)return null;
  const latest=sorted.at(-1);
  if(latest.time>nowMs+5*60000 || nowMs-latest.time>FLOOD_SIGNAL_MAX_AGE_MS)return null;
  // Choose the closest actual older reading within 30–120 minutes.
  // Reporting cadence differs by station; a 60-minute gap is not missing data.
  const earlier=[...sorted].reverse().find(p=>{
    const elapsed=latest.time-p.time;
    return elapsed>=FLOOD_SIGNAL_MIN_INTERVAL_MS &&
      elapsed<=FLOOD_SIGNAL_MAX_INTERVAL_MS;
  });
  if(!earlier)return null;
  const intervalMinutes=(latest.time-earlier.time)/60000;
  const changeMetres=latest.height-earlier.height;
  return {rateMetresPerHour:changeMetres/(intervalMinutes/60),
    changeMetres,intervalMinutes,observedAt:latest.time,
    baselineHeight:earlier.height};
}

// Display-only measured trend. The BoM may stop reporting for >90 minutes
// while leaving a valid timestamped history (Laidley Creek 540158).
// A historical rate is still informative, but NEVER authorises a live blue
// rapid-rise modifier. Its actual observation interval is always preserved.
export function latestMeasuredRiseRate(samples,nowMs=Date.now()) {
  const sorted=(Array.isArray(samples)?samples:[]).filter(p=>
    finite(p?.time)&&finite(p?.height)&&p.time<=nowMs+5*60000&&
    p.time>=nowMs-FLOOD_SIGNAL_HISTORY_MS).sort((a,b)=>a.time-b.time);
  if(sorted.length<2)return null;
  const latest=sorted.at(-1);
  // Prefer the previously approved 30–120-minute reference interval.
  // If telemetry falls just outside it, report the real measured interval
  // instead of claiming "insufficient observations" (but do not alert on it).
  const eligible=[...sorted].reverse().find(p=>{
    const elapsed=latest.time-p.time;
    return elapsed>=FLOOD_SIGNAL_MIN_INTERVAL_MS &&
      elapsed<=FLOOD_SIGNAL_MAX_INTERVAL_MS;
  });
  const earlier=eligible??[...sorted].reverse().find(p=>p.time<latest.time);
  if(!earlier)return null;
  const intervalMinutes=(latest.time-earlier.time)/60000;
  if(intervalMinutes<=0)return null;
  const changeMetres=latest.height-earlier.height;
  return {rateMetresPerHour:changeMetres/(intervalMinutes/60),
    changeMetres,intervalMinutes,observedAt:latest.time,
    baselineHeight:earlier.height};
}

function percentile(values,fraction) {
  const s=[...values].sort((a,b)=>a-b);
  if(!s.length)return null;
  return s[Math.min(s.length-1,Math.ceil(s.length*fraction)-1)];
}

// Compare a recent tidal rise only with historical RISING limbs at the same
// station. A single absolute rate cannot distinguish tide from floodwater.
export function tidalRiseBaseline(samples,nowMs=Date.now()){
  const older=(Array.isArray(samples)?samples:[]).filter(p=>
    finite(p?.time)&&finite(p?.height) &&
    p.time>=nowMs-FLOOD_SIGNAL_HISTORY_MS &&
    p.time<=nowMs-3*3600000).sort((a,b)=>a.time-b.time);
  if(older.length<8 || older.at(-1).time-older[0].time<12*3600000)return null;
  const rising=[];
  for(let i=1;i<older.length;i++){
    const deltaMinutes=(older[i].time-older[i-1].time)/60000;
    if(deltaMinutes<10 || deltaMinutes>90)continue;
    const rate=(older[i].height-older[i-1].height)/(deltaMinutes/60);
    if(rate>0 && finite(rate))rising.push(rate);
  }
  if(rising.length<6)return null;
  return percentile(rising,0.90);
}

// Severity is the fresh, explicitly BoM-reported flood classification.
// The original measured rate independently controls ONE blue upward-arrow
// modifier. A rise alone does not prove actual flash flooding.
export function evaluateFloodSignal(feature,history={},nowMs=Date.now()){
  const p=feature?.properties??{};
  let level=String(p.STORMTRACKER_FLOOD_CLASS??"").trim().toLowerCase();
  const samples=history[String(feature?.id??"")]??[];
  const tidal=isObservedTidalGauge(feature,samples,nowMs);
  const recent=latestRiseRate(samples,nowMs);
  const parsed=parseQueenslandObservationTime(p.STORMTRACKER_OBSERVED_TEXT,nowMs);
  const stored=Number(p.STORMTRACKER_OFFICIAL_OBSERVED_AT);
  const observed=Number.isFinite(stored)&&stored>0&&
    stored<=nowMs+5*60000?stored:parsed;
  const timely=observed!==null && Number.isFinite(observed) &&
    nowMs-observed<=FLOOD_SIGNAL_MAX_AGE_MS &&
    observed<=nowMs+5*60000;
  // No persistent flood, bridge or uncertainty marker without a correctly
  // identified station and independently time-bounded source observation.
  // A years-old or days-old "major" is historical context, not a map alert.
  if(p.STORMTRACKER_IDENTITY_WARNING)
    return {show:false,reason:"Conflicting BoM and mapped station IDs"};
  if(!Number.isFinite(observed)||observed<=0||
      observed>nowMs+5*60000||
      nowMs-observed>floodStageEvidenceMaxAge(feature))
    return {show:false,reason:"Flood observation expired; latest level unknown"};
  // Both exact-station BoM sources disproved a cached flood reading.
  // Retire its map marker instead of showing a lingering neutral symbol.
  if(p.STORMTRACKER_STATION_TABLE_CONFLICT)
    return {show:false,reason:"Cached flood observation contradicted by BoM station sources"};
  // A stale apparent flood height contradicted by BOTH the current BoM
  // bulletin and the exact-station history must never remain a red confirmed
  // flood, nor be silently presented as safe after an older 0 m reading.

  const classAt=Number(p.STORMTRACKER_LAST_CONFIRMED_FLOOD_AT)||0;
  // Only a genuine timestamped observation can supersede an older flood
  // bulletin. Missing thresholds keep the last-confirmed caution intact.
  const measured=Number.isFinite(observed)&&observed>0&&observed>=classAt
    ?observedFloodClass(p.STORMTRACKER_HEIGHT_METRES,
      stationFloodLevels(feature)):undefined;
  // Same-source datum guard: current explicitly reported flood class and
  // current 2026 station-ID threshold must agree before colour is asserted.
  const reported=String(p.STORMTRACKER_FLOOD_CLASS??"").trim().toLowerCase();
  const calculated=measured===null?"below-minor":measured;
  if(measured!==undefined &&
      ["2026-station-native","2026-ahd-converted"].includes(
        p.STORMTRACKER_THRESHOLD_STATUS) &&
      ["below-minor","minor","moderate","major"].includes(reported) &&
      calculated!==reported && !(timely && measured===null)){
    return {show:true,state:"unverified",source:"bom-datum-conflict",
      reason:"2026 threshold and current BoM bulletin conflict: reported "+
        reported+", computed "+(measured??"below minor")+
        ". Datum classification unverified; no severity colour assigned.",
      rapidRise:false,tidalScreened:tidal,rise:null,stale:!timely,
      classificationUnverified:true,lastObservedAt:observed};
  }
  // New, fresh, same-datum measured below-minor is positive recovery evidence,
  // even when the bulletin still repeats a prior flood classification.
  // Preserve an unverified conflict for ABOVE-minor disagreeing classes.
  if(measured!==undefined)level=measured??"below-minor";
  const official=["minor","moderate","major"].includes(level);
  // Do not mistake an omitted flood class for an official below-minor reading.
  // Last-confirmed classification remains a clearly labelled precautionary
  // marker, while the CURRENT independent source water height is not replaced.
  const lastClass=String(p.STORMTRACKER_LAST_CONFIRMED_FLOOD_CLASS??"")
    .trim().toLowerCase();
  if(measured===undefined && !official &&
      ["minor","moderate","major"].includes(lastClass)){
    const newerUnknown=timely&&observed>classAt;
    return {show:true,state:newerUnknown?"unverified":lastClass,
      source:"last-confirmed-bom-flood-class",
      reason:(timely?"Latest measured height available":"Measured height stale")+
        "; last confirmed BoM "+lastClass+
        " classification is not verified by the newest bulletin"+
        (newerUnknown?"; official stage threshold unavailable for this station":""),
      rapidRise:false,tidalScreened:tidal,rise:null,
      stale:!timely,classificationUnverified:true,lastObservedAt:observed};
  }
  // A missed/late observation must NOT masquerade as a return below minor.
  // Continue to map its LAST source-verified official stage, visibly flagged
  // stale, without a stale rapid-rise or "flash" modifier.
  if(!timely && official && Number.isFinite(observed) &&
      observed>0 && observed<=nowMs+5*60000){
    return {show:true,state:level,source:"last-confirmed-bom-flood-class",
      reason:"Last confirmed BoM "+level+" classification; observation stale — current level unverified",
      rapidRise:false,tidalScreened:tidal,rise:null,stale:true,
      lastObservedAt:observed};
  }
  if(!timely)return {show:false,reason:"Missing or stale current BoM flood observation"};
  // BoM tendency remains informational; measured height and time govern rise.
  const rateMatches=recent &&
    Math.abs(recent.observedAt-observed)<=10*60000;
  // A flood or flash-flood signature cannot be diagnosed from a normal
  // incoming tide. For source-tagged or observation-confirmed tidal sites,
  // suppress this independent rate-only modifier entirely. Original BoM
  // minor/moderate/major classifications still display without restriction.
  const geographicScreen=gaugeRiseScreeningZone(feature);
  // Station-specific positive non-tidal evidence overrides the coarse
  // 125 km coastal uncertainty buffer. Unknown near-coast stations remain
  // conservative; verified tidal sites remain excluded above.
  const reviewedNonTidal=isVerifiedNonTidalGauge(feature);
  const screeningZone=reviewedNonTidal?"verified-non-tidal":geographicScreen.zone;
  const screeningThresholdMetresPerHour=
    reviewedNonTidal || geographicScreen.zone==="inland"
      ? NON_TIDAL_RAPID_RISE_M_PER_H
      : COASTAL_UNCERTAIN_RAPID_RISE_M_PER_H;
  const rapidlyRising=Boolean(rateMatches && !tidal &&
    recent.rateMetresPerHour>=screeningThresholdMetresPerHour);
  const tidalBaseline=tidal?tidalRiseBaseline(samples,nowMs):null;
  if(["minor","moderate","major"].includes(level)){
    return {show:true,state:level,
      source:measured!==undefined?"bom-station-threshold":"bom-classification",
      stale:false,lastObservedAt:observed,
      reason:(measured!==undefined?
        level+" flooding from latest measured height versus BoM station thresholds":
        level+" flood classification (BoM)")+
        (rapidlyRising?"; measured rapid rise — potential flash-flooding behaviour":""),
      rapidRise:rapidlyRising,tidalScreened:tidal,rise:recent,
      riseScreeningZone:screeningZone,
      screeningThresholdMetresPerHour,
      tidalBaselineMetresPerHour:tidalBaseline};
  }
  if(rapidlyRising){
    return {show:true,state:"rapid-rise",rapidRise:true,
      source:"local-rate-screen",
      reason:"Measured rapid rise below minor; potential flash flooding, not a confirmed BoM flash-flood warning",
      rise:recent,riseScreeningZone:screeningZone,
      screeningThresholdMetresPerHour,
      tidalBaselineMetresPerHour:tidalBaseline};
  }
  return {show:false,reason:"Below minor with no verified rapidly rising water"};
}

export function filterOperationalFloodGauges(features,history={},nowMs=Date.now()){
  const selected=[];
  const counts={minor:0,moderate:0,major:0,rapidRise:0,tidalAnomaly:0};
  for(const feature of features??[]){
    const result=evaluateFloodSignal(feature,history,nowMs);
    if(!result.show)continue;
    if(["minor","moderate","major"].includes(result.state))counts[result.state]++;
    if(result.rapidRise)counts.rapidRise++;
    // Tidal behaviour cannot cause a flash-rise marker or anomaly count.
    selected.push({...feature,properties:{
      ...feature.properties,
      STORMTRACKER_DISPLAY_STATE:result.state,
      STORMTRACKER_RAPID_RISE:Boolean(result.rapidRise),
      STORMTRACKER_TIDAL_SCREENED:Boolean(result.tidalScreened),
      STORMTRACKER_ALERT_REASON:result.reason,
      STORMTRACKER_ALERT_SOURCE:result.source,
      STORMTRACKER_RATE_SCREENING_ZONE:result.riseScreeningZone??"",
      STORMTRACKER_RATE_THRESHOLD_M_PER_H:result.screeningThresholdMetresPerHour??null,
      STORMTRACKER_RISE_RATE_M_PER_H:result.rise?.rateMetresPerHour??null,
      STORMTRACKER_RATE_INTERVAL_MINUTES:result.rise?.intervalMinutes??null,
      STORMTRACKER_TIDAL_BASELINE_M_PER_H:result.tidalBaselineMetresPerHour??null,
      STORMTRACKER_TIDAL_CONTEXT:feature.properties?.STORMTRACKER_TIDAL_CONTEXT??""
    }});
  }
  return {features:selected,counts,total:features?.length??0};
}
