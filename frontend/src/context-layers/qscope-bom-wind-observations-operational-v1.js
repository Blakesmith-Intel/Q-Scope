// Independent operational BoM surface-wind observations for Q-SCOPE.
// Never alters radar, Doppler, wind detection events or approved warning data.
import {windStationSeverity,windStationBasis,windDisplay,gustKmh,
 WIND_OBS_REFRESH_MS,WIND_OBS_VALID_AGE_MS,WIND_OBS_SOURCE_URL}
 from "./qscope-bom-wind-observation-model-v1.js";
export const WIND_OBSERVATION_RELAY=
 "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/qld-wind-observations";
const $=id=>document.getElementById(id);
const asTime=v=>v&&Number.isFinite(Date.parse(v))?
 new Date(v).toLocaleString("en-AU",{timeZone:"Australia/Brisbane",
 day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",hour12:false})+" AEST":"Unavailable";
const severityRank=s=>windDisplay[s]?.priority??0;
function markerSvg(record){
 const band=windDisplay[windStationSeverity(record)]??windDisplay.below;
 const basis=windStationBasis(record);
 const sinceMidnight=basis==="today-since-midnight";
 const mean=basis==="verified-10-minute-mean";
 const val=sinceMidnight?record.todayMaximumGustKmh:mean?record.sustainedKmh:record.gustKmh??record.sustainedKmh;
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="100" height="44" viewBox="0 0 100 44">'+
  '<rect x="2" y="3" width="96" height="37" rx="11" fill="#102430" stroke="'+band.colour+'" stroke-width="3"/>'+
  '<path d="M12 17h21q8 0 5-7-2-5-8-2 M12 23h29q12 0 7 9-4 7-11 1 M12 29h16" fill="none" stroke="'+band.colour+'" stroke-width="2.5" stroke-linecap="round"/>'+
  '<text x="72" y="24" font-size="18" font-weight="700" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif">'+
  Math.round(val??0)+'</text>'+
  '<text x="71" y="35" font-size="9" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif">'+(sinceMidnight?"TODAY":mean?"10m mean":"km/hr")+'</text></svg>';
 return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
}
function labelRow(holder,label,value){
 const k=document.createElement("span"),v=document.createElement("strong");
 k.textContent=label;v.textContent=String(value);holder.append(k,v);
}
export function initialiseOperationalBomWindObservations({
 viewer,CesiumRef=globalThis.Cesium,fetchImpl=globalThis.fetch,
 now=()=>Date.now(),refreshMs=WIND_OBS_REFRESH_MS
}={}){
 if(!viewer||!CesiumRef)throw Error("BoM wind observations require map");
 const checkbox=$("showBomWindObservations"),status=$("bomWindObservationsStatus");
 const dialog=$("bomWindGustReport"),reportStatus=$("bomWindGustReportStatus");
 const reportSummary=$("bomWindGustReportSummary"),reportRows=$("bomWindGustReportRows");
 const info=$("bomWindObservationInfo"),infoTitle=$("bomWindObservationInfoTitle"),
  infoRows=$("bomWindObservationInfoRows");
 const source=new CesiumRef.CustomDataSource("qscope-bom-ground-wind-v1");
 source.show=false;viewer.dataSources.add(source);
 let stations=[],qualifying=[],checkedAt=0,loading=null,selected=null,timer=null;
 function say(message){if(status)status.textContent=message;}
 // An explicitly verified 10-minute gale is also a qualifying observation.
 function observed(station){
  return station.current&&now()-Date.parse(station.observedUtc)<=WIND_OBS_VALID_AGE_MS&&
   severityRank(windStationSeverity(station))>=2;
 }
 function render(){
  qualifying=stations.filter(observed).sort((a,b)=>
   severityRank(windStationSeverity(b))-severityRank(windStationSeverity(a))||
   (b.gustKmh??0)-(a.gustKmh??0));
  source.entities.suspendEvents?.();source.entities.removeAll();
  // Add least severe first, so a co-located destructive station is not hidden.
  for(const station of [...qualifying].reverse()){
   const entity=source.entities.add({
    id:"qscope-bom-wind:"+station.wmo,name:station.name,
    position:CesiumRef.Cartesian3.fromDegrees(station.longitude,station.latitude),
    billboard:{image:markerSvg(station),width:100,height:44,
     verticalOrigin:CesiumRef.VerticalOrigin.BOTTOM,
     heightReference:CesiumRef.HeightReference.CLAMP_TO_GROUND,
     disableDepthTestDistance:Number.POSITIVE_INFINITY}
   });
   entity.qscopeBomWindWmo=station.wmo;
  }
  source.entities.resumeEvents?.();viewer.scene.requestRender?.();
  const destructive=qualifying.filter(x=>windStationSeverity(x)==="destructive").length;
  const damaging=qualifying.filter(x=>windStationSeverity(x)==="damaging").length;
  const gale=qualifying.filter(x=>windStationSeverity(x)==="gale").length;
  say((checkedAt?"BoM observed winds · ":"No verified observations · ")+
   qualifying.length+" qualifying observed winds / daily peaks"+
   (destructive?" · "+destructive+" destructive":"")+
   (damaging?" · "+damaging+" damaging":"")+
   (gale?" · "+gale+" sustained gale":"")+
   (checkedAt?" · checked "+asTime(new Date(checkedAt).toISOString()):""));
  if(dialog?.open)renderReport();
  if(selected)showInfo(qualifying.find(x=>x.wmo===selected)??null);
 }
 function showInfo(record){
  if(!info||!infoRows)return;
  if(!record){info.hidden=true;selected=null;return;}
  selected=record.wmo;infoTitle.textContent=record.name;
  infoRows.replaceChildren();
  labelRow(infoRows,"Observed gust",gustKmh(record.gustKmh));
  labelRow(infoRows,"Mean wind speed",gustKmh(record.sustainedKmh));
  labelRow(infoRows,"Averaging period",record.windAveragingMinutes===10?"Verified 10 minutes":"Not verified by source");
  labelRow(infoRows,"Measured wind severity",windDisplay[windStationSeverity(record)].label+
   (windStationBasis(record)==="today-since-midnight"?" · from today\'s peak, not latest gust":
    windStationBasis(record)==="verified-10-minute-mean"?" · verified 10-minute mean":""));
  labelRow(infoRows,"Highest gust today (since midnight)",gustKmh(record.todayMaximumGustKmh));
  labelRow(infoRows,"Observation time",asTime(record.observedUtc));
  labelRow(infoRows,"BoM WMO station",record.wmo);
  labelRow(infoRows,"Source status","Automatic BoM observation, limited quality control");
  const a=document.createElement("a");a.href=WIND_OBS_SOURCE_URL;
  a.rel="noopener noreferrer";a.target="_blank";a.textContent="Official BoM observations";
  infoRows.append(a);info.hidden=false;
 }
 function renderReport(){
  if(!dialog?.open||!reportRows)return;
  const groups=["destructive","damaging","gale"];
  const unverified=Math.max(0,qualifying.length-MAX_STATION_HISTORY);
  reportRows.replaceChildren();
  const loaded=qualifying.filter(s=>history.get(s.wmo)?.peak).length;
  reportStatus.textContent=checkedAt?
   "Official BoM · checked "+asTime(new Date(checkedAt).toISOString())+
   " · "+loaded+"/"+Math.min(MAX_STATION_HISTORY,qualifying.length)+" available 24h station peaks":
   "No verified observations loaded";
  reportSummary.textContent=qualifying.length+" currently qualifying stations"+
   (unverified?" · "+unverified+" station history peaks not yet checked (request cap)":"");
  for(const level of groups){
   const entries=qualifying.filter(s=>windStationSeverity(s)===level);
   const section=document.createElement("section");section.className="rainfall-report-group";
   const h=document.createElement("h3");h.textContent=windDisplay[level].label+
    " · "+entries.length+" station"+(entries.length===1?"":"s");
   section.append(h);
   if(!entries.length){
    const p=document.createElement("p");p.className="rainfall-report-empty";
    p.textContent="No qualifying verified latest wind or current-day gust peaks.";section.append(p);
   }
   const ul=document.createElement("ul");
   for(const station of entries){
    const li=document.createElement("li"),top=document.createElement("div");
    top.className="rainfall-report-entry";
    const name=document.createElement("strong"),value=document.createElement("span");
    name.textContent=station.name;
    value.className="rainfall-report-mm";const basis=windStationBasis(station);
    value.textContent=gustKmh(basis==="today-since-midnight"?station.todayMaximumGustKmh:
     basis==="verified-10-minute-mean"?station.sustainedKmh:station.gustKmh)+
     (basis==="today-since-midnight"?" · today":basis==="verified-10-minute-mean"?" · 10m mean":"");
    top.append(name,value);
    const meta=document.createElement("div");meta.className="rainfall-report-meta";
    const h=history.get(station.wmo);
    meta.textContent="Mean wind "+gustKmh(station.sustainedKmh)+
     " (averaging period unverified) · Today's maximum "+gustKmh(station.todayMaximumGustKmh)+
     " · Rolling 24h observed sample peak: "+(h?.peak?
      gustKmh(h.peak.peakGustKmh)+" at "+asTime(h.peak.peakUtc)+
      " ("+h.peak.sampleCount+" samples)":
      h?"Unavailable":"Not yet checked")+
     " · Latest "+asTime(station.observedUtc)+" · WMO "+station.wmo;
    li.append(top,meta);ul.append(li);
   }
   section.append(ul);reportRows.append(section);
  }
 }
 let batchGeneration=0;
 async function loadReportPeaks(){
  const generation=++batchGeneration;
  // Only on operator request, bounded 3 concurrent, first 36 by severity.
  const list=qualifying.slice(0,MAX_STATION_HISTORY);
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(3,list.length)},async()=>{
   while(cursor<list.length&&generation===batchGeneration&&dialog?.open){
    const item=list[cursor++];
    await fetchHistory(item.wmo);
    if(dialog?.open)renderReport();
   }
  }));
 }
 function openReport(){
  if(!dialog)return;if(!dialog.open)dialog.showModal?.();renderReport();
  if(!checkedAt||now()-checkedAt>refreshMs)
   void refresh().then(()=>loadReportPeaks()).catch(()=>{});
  else void loadReportPeaks();
 }
 async function refresh(force=false){
  if(!source.show&&!dialog?.open&&!force)return stations;
  if(loading)return loading;
  loading=(async()=>{
   say("Checking official BoM Queensland station wind…");
   const response=await fetchImpl(WIND_OBSERVATION_RELAY,
    {mode:"cors",cache:"no-store",signal:AbortSignal.timeout(24000)});
   if(!response.ok)throw Error("BoM wind relay HTTP "+response.status);
   const result=await response.json();
   if(result?.format!=="QScopeBoMWindObservationsV1"||
      !Array.isArray(result.observations))throw Error("Unverified BoM station payload");
   stations=result.observations;
   checkedAt=now();render();
   return stations;
  })();
  try{return await loading;}catch(error){
   if(now()-checkedAt>WIND_OBS_VALID_AGE_MS){stations=[];render();}
   say("BoM wind observations unavailable · "+String(error?.message??error).slice(0,100)+
    " · No all-clear implied");
   if(reportStatus&&dialog?.open)reportStatus.textContent=status?.textContent??"Unavailable";
   throw error;
  }finally{loading=null;}
 }
 function pickAt(position){
  if(!source.show)return false;
  const hit=viewer.scene.drillPick?.(position,20,30,30)??[];
  for(const h of [...hit,viewer.scene.pick?.(position,30,30)]){
   const e=h?.id??h?.primitive?.id;
   const wmo=e?.qscopeBomWindWmo;
   const match=wmo?qualifying.find(x=>x.wmo===wmo):null;
   if(match){showInfo(match);return true;}
  }
  return false;
 }
 const canvas=viewer.scene.canvas;
 let touch=null;
 function down(e){
  if(!source.show||!canvas.getBoundingClientRect)return;
  if(e.target?.closest?.("#controlSidebar,button,a,input,select,textarea,.map-info-card,dialog"))return;
  const r=canvas.getBoundingClientRect();
  if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return;
  touch={id:e.pointerId,x:e.clientX,y:e.clientY};
 }
 function up(e){
  if(!touch||e.pointerId!==touch.id)return;
  const t=touch;touch=null;
  if(Math.hypot(e.clientX-t.x,e.clientY-t.y)>12)return;
  const r=canvas.getBoundingClientRect();
  if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return;
  pickAt(new CesiumRef.Cartesian2(e.clientX-r.left,e.clientY-r.top));
 }
 checkbox?.addEventListener("change",()=>{
  source.show=checkbox.checked;
  if(source.show)void refresh().catch(()=>{});else{info&&(info.hidden=true);say("BoM wind observations off");}
  viewer.scene.requestRender?.();
 });
 $("refreshBomWindObservations")?.addEventListener("click",()=>refresh(true).catch(()=>{}));
 $("openBomWindGustReport")?.addEventListener("click",openReport);
 $("refreshBomWindGustReport")?.addEventListener("click",()=>refresh(true).then(()=>loadReportPeaks()).catch(()=>{}));
 $("closeBomWindGustReport")?.addEventListener("click",()=>dialog?.close());
 $("closeBomWindObservationInfo")?.addEventListener("click",()=>{if(info)info.hidden=true;selected=null;});
 dialog?.addEventListener("close",()=>{batchGeneration++;});
 window.addEventListener("pointerdown",down,{capture:true,passive:true});
 window.addEventListener("pointerup",up,{capture:true,passive:true});
 window.addEventListener("pointercancel",()=>{touch=null;},{capture:true,passive:true});
 timer=setInterval(()=>{if(!document.hidden&&(source.show||dialog?.open))
  void refresh().catch(()=>{});},refreshMs);
 window.addEventListener("pagehide",()=>{clearInterval(timer);batchGeneration++;},{once:true});
 say("Off by default · official BoM station winds");
 return {dataSource:source,refresh,stop(){clearInterval(timer);batchGeneration++;},
  get observations(){return stations.slice();},get qualifying(){return qualifying.slice();}};
}
