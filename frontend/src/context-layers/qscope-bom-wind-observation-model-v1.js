// Independent official BoM station winds, not Doppler wind estimates or warnings.
// Queensland IDQ60920: latest state observations (10 min issue), IDQ60801:
// per-station 72-hour observations. No forecast/radar inference is used.
export const QLD_BOM_WIND_PRODUCT="IDQ60920";
export const WIND_OBS_SOURCE_URL="https://www.bom.gov.au/location/australia/queensland#observations";
export const WIND_OBS_REFRESH_MS=10*60*1000;
export const WIND_OBS_THRESHOLDS=Object.freeze({sustainedGale:63,damaging:90,destructive:125});
export const WIND_OBS_VALID_AGE_MS=90*60*1000;
const numeric=value=>{
 if(value===null||value===undefined||String(value).trim()==="")return null;
 const n=typeof value==="number"?value:Number(String(value??"").trim());
 return Number.isFinite(n)&&n>=0&&n<=350?n:null;
};
export const windSeverity=(gust,sustained)=>{
 if(numeric(gust)!==null&&gust>=125)return "destructive";
 if(numeric(gust)!==null&&gust>=90)return "damaging";
 if(numeric(sustained)!==null&&sustained>=63)return "gale";
 return "below";
};
export const windDisplay=Object.freeze({
 destructive:{label:"Destructive gust",colour:"#c93b42",priority:4},
 damaging:{label:"Damaging gust",colour:"#e9aa34",priority:3},
 gale:{label:"Sustained gale-force wind",colour:"#367bbb",priority:2},
 below:{label:"Below damaging threshold",colour:"#667d87",priority:1}
});
export function windStationSeverity(record){
 const instant=windSeverity(record?.gustKmh,
   record?.windAveragingMinutes===10?record.sustainedKmh:null);
 // BoM's published current-day maximum is a genuine measured gust, but
 // MUST remain labelled 'since midnight', not as a present-time reading.
 const today=windSeverity(record?.todayMaximumGustKmh,null);
 if(today==="destructive"||instant==="destructive")return "destructive";
 if(today==="damaging"||instant==="damaging")return "damaging";
 return instant;
}
export function windStationBasis(record){
 const latest=windSeverity(record?.gustKmh,
  record?.windAveragingMinutes===10?record.sustainedKmh:null);
 const combined=windStationSeverity(record);
 return combined!==latest?"today-since-midnight":
   combined==="gale"?"verified-10-minute-mean":"latest-observed-gust";
}
export function gustKmh(value){return numeric(value)===null?"Unavailable":Math.round(+value)+" km/hr";}
export function parseUtc(stamp){
 if(typeof stamp!=="string")return null;
 if(/^\d{14}$/.test(stamp)){
  const iso=stamp.slice(0,4)+"-"+stamp.slice(4,6)+"-"+stamp.slice(6,8)+"T"+
   stamp.slice(8,10)+":"+stamp.slice(10,12)+":"+stamp.slice(12,14)+"Z";
  return Number.isFinite(Date.parse(iso))?new Date(iso).toISOString():null;
 }
 return /Z$/.test(stamp)&&Number.isFinite(Date.parse(stamp))?
  new Date(stamp).toISOString():null;
}
function attrs(tag){
 const out={};
 for(const m of String(tag??"").matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g))
  out[m[1].toLowerCase()]=m[2];
 return out;
}
function valueOf(xml,type){
 const re=new RegExp("<element\\b([^>]*)>([^<]*)<\\/element>","gi");
 for(const m of xml.matchAll(re)){
  const a=attrs(m[1]);
  if((a.type??a.name)===(type))return m[2].trim();
 }
 return null;
}
// Strictly require a known product and original station location. If BoM
// changes its XML schema, report unavailable rather than silently zero.
export function parseQueenslandWindXml(xml,{now=Date.now()}={}){
 if(typeof xml!=="string"||xml.length<100||xml.length>4000000||
   !xml.includes(QLD_BOM_WIND_PRODUCT))throw Error("Unverified BoM IDQ60920 product");
 const records=[],seen=new Set();
 for(const m of xml.matchAll(/<station\b([^>]*)>([\s\S]*?)<\/station>/gi)){
  const a=attrs(m[1]),block=m[2];
  const wmo=String(a["wmo-id"]??a.wmo_id??a.wmo??"");
  const bom=String(a["bom-id"]??a["bom-stn-id"]??a.bom_id??"");
  const latitude=Number(a.lat??a.latitude),longitude=Number(a.lon??a.longitude);
  if(!/^\d{5}$/.test(wmo)||!Number.isFinite(latitude)||!Number.isFinite(longitude)||
     latitude> -8||latitude< -30||longitude<137||longitude>156||
     seen.has(wmo))continue;
  const p=/<period\b([^>]*)>([\s\S]*?)<\/period>/i.exec(block);
  if(!p)continue;
  const pa=attrs(p[1]);
  const observedUtc=parseUtc(pa["time-utc"]??pa.time_utc??"");
  const age=Date.parse(observedUtc);
  if(!observedUtc||age>now+5*60000||now-age>30*3600000)continue;
  const sustainedKmh=numeric(valueOf(p[2],"wind_spd_kmh"));
  const gust=numeric(valueOf(p[2],"gust_kmh"));
  const today=numeric(valueOf(p[2],"maximum_gust_kmh"));
  if(gust===null&&sustainedKmh===null&&today===null)continue;
  seen.add(wmo);
  records.push({
   stationId:/^\d{6}$/.test(bom)?bom:null,wmo,name:(a.name??"BoM station").slice(0,110),
   latitude,longitude,observedUtc,
   gustKmh:gust,sustainedKmh,windDirection:valueOf(p[2],"wind_dir"),
   // BoM OMD one-minute and METAR ten-minute mean wind are not equivalent.
   // Until the averaging period is verified, a numeric gale threshold is
   // shown as context only, never as a confirmed ten-minute gale.
   windAveragingMinutes:["metar_10","synop","mdf"].includes(String(pa["wind-src"]??"").toLowerCase())?10:
     String(pa["wind-src"]??"").toLowerCase()==="omd"?1:null,
   todayMaximumGustKmh:today,
   source:"BoM IDQ60920",provisional:true,
   current:now-age<=WIND_OBS_VALID_AGE_MS
  });
 }
 if(!records.length)throw Error("BoM IDQ60920 contained no verifiable wind stations");
 return records.sort((a,b)=>a.wmo.localeCompare(b.wmo));
}
// BoM IDQ60801 publishes up to 72 hours of station observations. A peak
// calculated below is the highest AVAILABLE sample in a rolling 24-hour
// window, not an invented continuous measurement or midnight-day maximum.
export function sampledWindPeak24h(data,{wmo,now=Date.now()}={}){
 const header=data?.observations?.header??[],rows=data?.observations?.data;
 if(!Array.isArray(rows)||!rows.length||rows.length>1200)return null;
 const first=Array.isArray(header)?header[0]:header;
 const suppliedWmo=String(first?.wmo??rows[0]?.wmo??"");
 if(!/^\d{5}$/.test(suppliedWmo)||String(wmo)!==suppliedWmo)return null;
 const samples=rows.map(row=>{
  const observedUtc=parseUtc(row?.aifstime_utc??"");
  const gust=numeric(row?.gust_kmh);
  return {observedUtc,gustKmh:gust,
   sustainedKmh:numeric(row?.wind_spd_kmh),
   windDirection:row?.wind_dir??null};
 }).filter(x=>x.observedUtc&&x.gustKmh!==null&&
   Date.parse(x.observedUtc)<=now+5*60000&&
   now-Date.parse(x.observedUtc)<=24*3600000);
 if(!samples.length)return null;
 samples.sort((a,b)=>b.gustKmh-a.gustKmh||
   b.observedUtc.localeCompare(a.observedUtc));
 const latest=rows.map(x=>parseUtc(x.aifstime_utc??""))
  .filter(Boolean).sort().at(-1)??null;
 return {peakGustKmh:samples[0].gustKmh,peakUtc:samples[0].observedUtc,
  sampleCount:samples.length,lastSampleUtc:latest,windowHours:24,
  method:"highest-available-3-second-gust-sample"};
}
