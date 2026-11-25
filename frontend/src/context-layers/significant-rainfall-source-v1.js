// Exact BoM flood-map gauge IDs and coordinates; no name approximation.
export const RAINFALL_REGIONS=Object.freeze(["gulf","north","tvl2mck","widebay","seast","west","border"]);
export const RAINFALL_SOURCE_BASE="https://www.bom.gov.au/qld/flood/";
export function rainfallBand(mm){return !Number.isFinite(mm)||mm<50?null:mm>=100?"red":"orange";}
const regexEscape=s=>[...String(s)].map(c=>"\\^$.*+?()[]{}|".includes(c)?"\\"+c:c).join("");
const decode=s=>String(s).replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
  .replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">");
function attr(tag,key){
 const re=new RegExp("\\b"+key+"\\s*=\\s*([\"'])(.*?)\\1","i");
 return tag.match(re)?.[2]??"";
}
export function parseBomRainfallMap(html,period,region="",{minimumMm=50}={}){
 if(!["since9am","lastHour","last24Hours"].includes(period))
   throw RangeError("Unknown BoM rain period");
 const body=String(html||"");
 if(body.length>3_500_000)throw Error("BoM flood page exceeds safe size");
 const image=[...body.matchAll(/<img\b[^>]*>/gi)].map(m=>m[0])
   .find(tag=>{
     const id=attr(tag,"id").toLowerCase();
     if(period==="since9am")return id==="since";
     if(period==="lastHour")return id==="m1hr";
     // Original BoM 24-hour map only: never sum adjacent periods.
     const label=[id,attr(tag,"alt"),attr(tag,"title")].join(" ");
     return /24\s*(?:hour|hr|hrs|h)?|(?:hour|hr|hrs)\s*24/i.test(label);
   });
 if(!image)throw Error("BoM period map not published");
 const mapId=attr(image,"usemap").replace(/^#/,"");
 if(!/^IDQ\d{5}\.html$/i.test(mapId))throw Error("BoM rainfall map identifier invalid");
 const re=new RegExp("<map\\b[^>]*\\bname\\s*=\\s*([\"'])"+
   regexEscape(mapId)+"\\1[^>]*>([\\s\\S]*?)<\\/map>","i");
 const map=body.match(re)?.[2];
 if(!map)throw Error("BoM gauge popup data missing");
 const areas=[...map.matchAll(/<area\b[^>]*>/gi)];
 if(!areas.length)throw Error("Empty BoM rainfall map");
 const rows=[],seen=new Set();
 for(const [area] of areas){
   const handler=decode(attr(area,"onmouseover"));
   const m=handler.match(/(?:PopupRain|Flood\.popupRain)\s*\(\s*"([^"]+)"\s*,\s*'(\d{4,7})'\s*,\s*'(-?[\d.]+)'\s*,\s*'(-?[\d.]+)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'/i);
   if(!m)continue;
   const [,name,id,lat,lon,total]=m;
   if(!/^\d+(?:\.\d+)?$/.test(total))continue;
   const mm=Number(total),latitude=Number(lat),longitude=Number(lon);
   if(mm<minimumMm||mm>3000||!name.trim()||seen.has(id)||
      latitude < -29.8||latitude > -9||longitude<137||longitude>154.6)continue;
   seen.add(id);
   rows.push({id,name:name.trim(),latitude,longitude,mm,
     band:rainfallBand(mm),period,region});
 }
 return rows;
}
export function dedupeSignificantRainfall(records,period,{minimumMm=50}={}){
 const byId=new Map();
 for(const row of records??[]){
  if(row?.period!==period||!row.id||!Number.isFinite(row.mm)||row.mm<minimumMm)continue;
  const old=byId.get(row.id);
  if(!old||Date.parse(row.sourceCreatedAt??"")>Date.parse(old.sourceCreatedAt??""))
    byId.set(row.id,row);
 }
 return [...byId.values()].sort((a,b)=>b.mm-a.mm||String(a.id).localeCompare(String(b.id)));
}
export function qldFloodMapCreatedAt(html){
 const m=String(html).match(/This page was created at\s*(?:<strong[^>]*>)?\s*(\d{1,2}):(\d{2})\s+on\s+\w+\s+(\d{1,2})\s+(\w+)\s+(\d{4})\s*\(UTC\)/i);
 if(!m)return null;
 const month={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11}[m[4].slice(0,3).toLowerCase()];
 if(month===undefined)return null;
 const d=new Date(Date.UTC(+m[5],month,+m[3],+m[1],+m[2]));
 return d.getUTCFullYear()===+m[5]&&d.getUTCMonth()===month?d.toISOString():null;
}
// 09:00 AEST equals 23:00 UTC; Queensland has no DST.
export function rainfallReportingStart(ms){
 return Math.floor((ms+3600000)/86400000)*86400000-3600000;
}
export function rainfallCacheSeconds(ms=Date.now()){
 return Math.max(0,Math.min(300,Math.floor((rainfallReportingStart(ms)+86400000-ms)/1000)));
}
// A genuine first-hour since-9am total cannot exceed the same station's
// last-hour total. Compare only the same regional source edition; missing
// evidence is pending, not zero. No invented station observation timestamp.
export function validateRainfallRollover(since,hours,previous=[]){
 const key=r=>String(r.id)+"|"+String(r.region)+"|"+String(r.sourceCreatedAt);
 const hourly=new Map((hours??[]).map(r=>[key(r),r]));
 const prior=new Map((previous??[]).filter(r=>r.rolloverPending===true).map(r=>[String(r.id),r]));
 return (since??[]).map(r=>{
  const t=Date.parse(r.sourceCreatedAt??"");
  if(!Number.isFinite(t)||!Number.isFinite(r.mm)||r.mm<=0)return r;
  const start=rainfallReportingStart(t),elapsed=t-start;
  const h=hourly.get(key(r));
  const supported=Number.isFinite(h?.mm)&&h.mm>=0&&r.mm<=h.mm+0.01;
  const old=prior.get(String(r.id));
  const held=old&&rainfallReportingStart(Date.parse(old.sourceCreatedAt))===start;
  const decreased=held&&t>Date.parse(old.sourceCreatedAt)&&r.mm<old.mm;
  const pending=r.rolloverPending===true||
   (elapsed<3600000&&(elapsed===0||!supported))||
   (held&&!supported&&!decreased);
  return pending?{...r,rolloverPending:true}:r;
 });
}
export function validatedRainfallPayload(data,previous){
 if(!data?.observations)return data;
 const obs=data.observations;
 return {...data,observations:{...obs,since9am:validateRainfallRollover(
  obs.since9am,obs.lastHour,previous?.observations?.since9am)}};
}

export function qualifiesRainfallSnapshot(row,period,now=Date.now(),maxAgeMs=90*60000,{minimumMm=50}={}){
 if(!row||row.period!==period||!Number.isFinite(row.mm)||row.mm<minimumMm)return false;
 const t=Date.parse(row.sourceCreatedAt??"");
 if(!Number.isFinite(t)||t>now+5*60000||t<now-maxAgeMs)return false;
 if(period==="since9am"){
   if(row.rolloverPending===true)return false;
   // AEST has no daylight-saving switch. Never carry yesterday's 9am total
   // into a new reporting day.
   // The REPORT publication date can be today before 09:00 AEST even
   // though its measured accumulation started at 09:00 yesterday.
   // Compare reporting-day starts rather than publication calendar dates.
   const reportingStart=ms=>{
     const local=new Date(ms+10*3600000); // Queensland AEST, no DST
     const midnight=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate());
     return local.getUTCHours()<9?midnight-86400000:midnight;
   };
   if(reportingStart(t)!==reportingStart(now))return false;
 }
 return true;
}

// AEP grading needs genuine observations below the old 50 mm threshold.
export function qualifiesAepRainfallSnapshot(row,period,now=Date.now(),maxAgeMs=90*60000){
 return qualifiesRainfallSnapshot(row,period,now,maxAgeMs,{minimumMm:1});
}
