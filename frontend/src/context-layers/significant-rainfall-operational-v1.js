import {formatAgencyTimestamp} from "./agency-source-time-v1.js?v=20261027-agency-panels-v1";
import {qualifiesAepRainfallSnapshot,rainfallBand,rainfallReportingStart,validatedRainfallPayload} from "./significant-rainfall-source-v1.js?v=20261126-rollover-v1";
import {createSeverityMarkerLayers,rainfallIconPriority} from "./severity-marker-layer-v1.js?v=20261024-flood-recovery-severity-v1-single-flood-path-v10.2.21-final-pixel-size";
import {classifyRainfallAep,ifdCellKey,ifdCellSupportsDuration,
 rainfallWindowMinutes,IFD_LOOKUP_CONCURRENCY,
 loadPersistedIfdCells,persistVerifiedIfdCell,verifiedPersistentIfdCell} from "./rainfall-ifd-aep-v1.js?v=20261022-v10-2-8-verified-ifd-persistence-short-v10.2.18";
import {catchmentForStation,RAINFALL_BASIN_REGISTRY_URL} from "./rainfall-catchment-v1.js";
import {buildSignificantRainfallReport} from "./significant-rainfall-report-v1.js?v=20261022-report-v1";
export const SIGNIFICANT_RAINFALL_RELAY="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/qld-significant-rainfall";
export const SIGNIFICANT_RAINFALL_REFRESH_MS=300000;
const $=id=>document.getElementById(id);
// Each droplet is coloured by MEASURED millimetres, independent of how
// unusual that amount is for the station and observation period.
export function rainfallRarityDisplay(aep){
 const levels={
  20:["Notable","#39734e","Notable for this area","20%","1 in 5"],
  10:["Unusual","#93751b","Unusual for this area","10%","1 in 10"],
  5:["Rare","#a45c1a","Rare for this area","5%","1 in 20"],
  2:["Very rare","#ad3540","Very rare for this area","2%","1 in 50"],
  1:["Exceptional","#7e399c","Exceptionally rare for this area","1%","1 in 100"]
 };
 if(aep?.pending)return {short:"Checking",color:"#66717b",description:"Calculating local rarity",explanation:"Retrieving the official local BoM rainfall-frequency reference."};
 const entry=levels[aep?.aepDesignThreshold];
 if(entry){
  const [short,color,description,chance,oneIn]=entry;
  return {short,color,description,chance,oneIn,
   explanation:"At least as rare as the "+chance+
    " design rainfall benchmark ("+oneIn+
    " annual chance) for this location and the selected duration."};
 }
 if(aep?.classification==="below-20pct-aep")
  return {short:"Less rare",color:"#647986",
   description:"Below the local notable-rainfall rarity threshold",
   explanation:"Below the 20% (1 in 5) annual-chance benchmark for the selected duration. Even less rare rainfall may cause flooding."};
 return {short:"Unrated",color:"#66717b",
  description:"Local rarity unavailable",
  explanation:"No verified local rainfall-frequency comparison is available for this station."};
}
export function significantRainfallDisplay(record){
 return {amountColor:record.mm>=100?"#d92d35":"#ed871b",
  amountBand:record.mm>=100?"100 mm or more":"50–99.9 mm",
  rarity:rainfallRarityDisplay(record.aep)};
}
// Shrink ONLY the droplet to two-thirds; keep the AEP badge and lettering at their original sizes.
// Station names, precise rainfall totals and references stay in the popup.
export function rainfallMarkerSvg(record){
 const {amountColor,rarity}=significantRainfallDisplay(record);
 const fontSize=rarity.short.length>9?9:10;
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 98 40">'+
 '<path transform="translate(0 8) scale(0.666667)" d="M18 3C13 11 5 20 5 26a13 13 0 0 0 26 0C31 20 23 11 18 3Z" '+
 'fill="'+amountColor+'" stroke="#17242d" stroke-width="1.8"/>'+
 '<rect x="23" y="9" width="74" height="26" rx="6" fill="'+rarity.color+'" '+
 'stroke="#17242d" stroke-width="1.4"/>'+
 '<text x="60" y="26" text-anchor="middle" fill="#fff" '+
 'font-family="Arial,sans-serif" font-weight="700" font-size="'+fontSize+'">'+
 rarity.short+'</text></svg>';
}
const marker=record=>"data:image/svg+xml;charset=utf-8,"+
 encodeURIComponent(rainfallMarkerSvg(record));

function formatted(iso){
  return iso&&Number.isFinite(Date.parse(iso))
    ?formatAgencyTimestamp(iso,"bom-issued"):"Unverified";
}
function detailRow(holder,label,value){
 const key=document.createElement("span"),val=document.createElement("strong");
 key.textContent=label;val.textContent=String(value);
 holder.append(key,val);
}
export function initialiseOperationalSignificantRainfall({
 viewer,CesiumRef=globalThis.Cesium,fetchImpl=globalThis.fetch,
 now=()=>Date.now(),refreshMs=SIGNIFICANT_RAINFALL_REFRESH_MS
}={}){
 if(!viewer||!CesiumRef)throw Error("Rainfall layer requires Cesium viewer");
 const checkbox=$("showSignificantRainfall"),select=$("significantRainfallPeriod");
 const status=$("significantRainfallStatus"),info=$("significantRainfallInfo");
 const rows=$("significantRainfallInfoRows"),title=$("significantRainfallInfoTitle");
 const reportDialog=$("significantRainfallReport"),reportTitle=$("significantRainfallReportTitle");
 const reportPeriod=$("significantRainfallReportPeriod"),reportStatus=$("significantRainfallReportStatus");
 const reportSummary=$("significantRainfallReportSummary"),reportRows=$("significantRainfallReportRows");
 let reportMode="amount";
 const reportPeriodName=()=>period==="since9am"?"Since 9 am AEST":
   period==="last24Hours"?"24hrs to 9am":"Last 1 hour";
 const severityLayers=createSeverityMarkerLayers({viewer,CesiumRef,owner:"rainfall",priorities:[0,1,2,3,4,5,6],visible:false});
 const collection=severityLayers.dataSource;
 let lastLoadedAt=0,lastError=null,waiting=null,timer=null,selectedId="";
 let source=null,visibleRows=[],period="since9am",started=false;
 let rolloverTimer=null;
 function scheduleRollover(){
  if(rolloverTimer!==null)clearTimeout(rolloverTimer);
  const at=now();
  rolloverTimer=setTimeout(()=>{
   if(period==="since9am"&&(collection.show||reportDialog?.open))render();
   scheduleRollover();
  },Math.max(1,rainfallReportingStart(at)+86400000-at));
 }
 let ifdGrid={schema:"StormTrackerBoM2016IFDCellsV1",
  source:"Official BoM IFD verified saved point references",cells:loadPersistedIfdCells()};
 let ifdLoadedAt=0,catalogueLoading=null,renderTimer=null;
 let basinRegistry=null,basinLoading=null;
 function loadCatchments(){
  if(basinRegistry||basinLoading)return basinLoading??Promise.resolve();
  basinLoading=(async()=>{
   try{
    const response=await fetchImpl(RAINFALL_BASIN_REGISTRY_URL,{cache:"no-store",
      signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error("BoM basin register HTTP "+response.status);
    const registry=await response.json();
    if(registry?.schema!=="StormTrackerBoMQldRainfallBasinsV1"||
       !registry.stations||!registry.source?.includes("bom.gov.au/qld/flood/networks/section1.shtml"))
      throw Error("Unverified BoM station basin register");
    basinRegistry=registry;
    if(selectedId)showInfo(visibleRows.find(x=>x.id===selectedId)??null);
    if(reportDialog?.open)renderReport();
   }catch(error){
    console.warn("Official BoM rainfall basin list unavailable",error);
   }finally{basinLoading=null}
  })();
  return basinLoading;
 }
 const pendingCells=new Set(),attempts=new Map(),queue=[];
 let running=0;
 function queueIfdLookups(){
  if((!collection.show&&!reportDialog?.open)||catalogueLoading)return;
  // Reprioritise only QUEUED (not already running) work when the operator
  // switches periods. Never keep draining obsolete low-priority requests.
  for(const obsolete of queue.splice(0))pendingCells.delete(obsolete.cell);
  const records=(source?.observations?.[period]??[]).filter(rec=>
   qualifiesAepRainfallSnapshot(rec,period,now())&&rec.mm>=50&&
   Number.isFinite(rec.latitude)&&Number.isFinite(rec.longitude))
   .sort((a,b)=>b.mm-a.mm||String(a.id).localeCompare(String(b.id)));
  for(const rec of records){
   const cell=ifdCellKey(rec.latitude,rec.longitude);
   const duration=rainfallWindowMinutes(period,rec.sourceCreatedAt);
   if(!duration||ifdCellSupportsDuration(ifdGrid.cells[cell],duration)||
      pendingCells.has(cell)||now()<(attempts.get(cell)??0))continue;
   pendingCells.add(cell);
   queue.push({cell,latitude:rec.latitude,longitude:rec.longitude});
  }
  drainIfdQueue();
 }
 function scheduleAepRender(){
  // Painting every Cesium marker after every response causes mobile stalls.
  // Coalesce completions without ever moving a gauge or its attached label.
  if(renderTimer!==null)return;
  renderTimer=setTimeout(()=>{
   renderTimer=null;
   if(collection.show||reportDialog?.open)render();
  },250);
 }
 function drainIfdQueue(){
  while(running<IFD_LOOKUP_CONCURRENCY&&queue.length){
   const item=queue.shift();running++;
   (async()=>{
    try{
     const url="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/qld-ifd-point?"+
       new URLSearchParams({lat:String(item.latitude),lon:String(item.longitude)});
     const response=await fetchImpl(url,{cache:"no-store",signal:AbortSignal.timeout(22000)});
     if(!response.ok)throw Error("IFD HTTP "+response.status);
     const point=await response.json();
     if(point?.schema!=="StormTrackerBoM2016IFDPointV1"||point.cell!==item.cell||
       !point.depthsMmByMinutes?.["60"]||!point.depthsMmByMinutes?.["1440"])
       throw Error("Invalid IFD source response");
     const node={depthsMmByMinutes:point.depthsMmByMinutes,
       verifiedUtc:point.verifiedUtc,sourceBaseline:point.source};
     if(!verifiedPersistentIfdCell(item.cell,node))throw Error("Unverified IFD point payload");
     // Cache persistence is best-effort: inaccessible localStorage is not a data failure.
     persistVerifiedIfdCell(item.cell,node);
     ifdGrid.cells[item.cell]=node;
     attempts.delete(item.cell);
    }catch(error){
     console.warn("Official IFD point retry scheduled",item.cell,error);
     attempts.set(item.cell,now()+5*60000);
    }finally{
     pendingCells.delete(item.cell);running--;
     scheduleAepRender();
     drainIfdQueue();
    }
   })();
  }
 }
 const say=(text,kind="normal")=>{
  if(!status)return;status.textContent=text;status.dataset.kind=kind;
 };
 function hideInfo(){
  selectedId="";if(info)info.hidden=true;
 }
 function showInfo(record){
  if(!record){hideInfo();return;}
  selectedId=record.id;
  if(!info||!rows)return;
  title.textContent=record.name;
  rows.replaceChildren();
  const display=significantRainfallDisplay(record);
  detailRow(rows,"Rainfall measured",record.mm.toFixed(1)+" mm");
  detailRow(rows,"Period",period==="since9am"?"Since 9 am AEST":
   period==="last24Hours"?"24hrs to 9am":"Last 1 hour");
  detailRow(rows,"Rainfall amount",display.amountBand);
  detailRow(rows,"How unusual here?",display.rarity.description);
  detailRow(rows,"In everyday terms",display.rarity.chance?
   display.rarity.chance+" annual chance · "+display.rarity.oneIn+
   " in any given year":display.rarity.explanation);
  if(record.aep?.aepDesignThreshold)
   detailRow(rows,"Technical rainfall rating",
    record.aep.aepDesignThreshold+"% AEP (annual exceedance probability)");
  if(record.aep?.classification==="unclassified")
   detailRow(rows,"Local reference missing",record.aep?.reason??
    "Verified local rainfall-frequency reference unavailable.");
  detailRow(rows,"IFD duration",record.aep?.durationMinutes
    ?Number(record.aep.durationMinutes.toFixed(1))+" minutes":"Unverified");
  if(record.aep?.designDepthMm)
    detailRow(rows,"Local design rainfall",record.aep.designDepthMm.toFixed(1)+" mm");
  if(record.aep?.ifdCell)detailRow(rows,"IFD grid cell",record.aep.ifdCell);
  if(record.aep?.interpolatedDuration)
    detailRow(rows,"Duration estimation","Logarithmic interpolation between official IFD durations");
  detailRow(rows,"Interpretation","An annual chance is not a fixed repeat interval, and rainfall rarity is NOT flood severity.");
  detailRow(rows,"BoM station number",record.id);
  detailRow(rows,"Source map issued",formatted(record.sourceCreatedAt));
  const catchment=catchmentForStation(record,basinRegistry);
  detailRow(rows,"Catchment",catchment?catchment+" (BoM river basin)":
    basinRegistry?"Unavailable in BoM station register":"Checking BoM basin register…");
  detailRow(rows,"Caution","BoM automatic observations; limited quality control. These are station totals, not radar estimates.");
  const link=document.createElement("a");
  link.href="https://www.bom.gov.au/qld/flood/"+record.region+".shtml";
  link.target="_blank";link.rel="noopener noreferrer";
  link.textContent="Official BoM rainfall map";
  rows.append(link);
  for(const other of ["riverGaugeInfo","qfdTechnicalRescueInfo","powerOutageInfo","floodRoadClosureInfo"]){
    $(other)?.setAttribute("hidden","");
  }
  info.hidden=false;
 }
 function renderReport(){
  if(!reportDialog?.open||!reportRows)return;
  const model=buildSignificantRainfallReport(visibleRows,reportMode);
  reportTitle.textContent=reportMode==="aep"?"Notable+ rainfall locations":"Significant rainfall totals";
  reportPeriod.textContent=reportPeriodName()+" · individual source issue times below";
  reportRows.replaceChildren();
  const failed=source?.failed?.length??0;
  const pending=visibleRows.filter(x=>x.aep?.pending).length;
  reportStatus.textContent=!source?"No observations loaded":
   "Last checked "+formatted(source.checkedAt)+
   (failed?" · "+failed+" regional sources unavailable":"")+
   (reportMode==="aep"&&pending?" · "+pending+" IFD lookups pending":"");
  reportSummary.textContent=reportMode==="aep"?
   model.total+" stations Notable or rarer, from "+model.observedCount+" stations with 50+ mm"+
   (model.unknownCount?" · "+model.unknownCount+" unrated/checking":""):
   model.total+" stations reporting 50+ mm across two categories";
  if(!source){
   const note=document.createElement("p");
   note.className="rainfall-report-empty";
   note.textContent="No verified observations loaded. Select Refresh to check BoM.";
   reportRows.append(note);return;
  }
  for(const group of model.groups){
   const section=document.createElement("section");section.className="rainfall-report-group";
   const h=document.createElement("h3"),heading=document.createElement("span"),
     count=document.createElement("span");
   heading.textContent=group.title;
   count.className="rainfall-report-count";
   count.textContent=group.rows.length+" station"+(group.rows.length===1?"":"s");
   h.append(heading,count);section.append(h);
   if(!group.rows.length){
    const empty=document.createElement("p");empty.className="rainfall-report-empty";
    empty.textContent="No qualifying stations in this category.";section.append(empty);
   }else{
    const list=document.createElement("ul");
    for(const station of group.rows){
     const item=document.createElement("li"),top=document.createElement("div"),
      name=document.createElement("strong"),value=document.createElement("span"),
      meta=document.createElement("div");
     top.className="rainfall-report-entry";name.textContent=station.name;
     value.className="rainfall-report-mm";value.textContent=station.mm.toFixed(1)+" mm";
     top.append(name,value);
     const basin=catchmentForStation(station,basinRegistry);
     meta.className="rainfall-report-meta";
     meta.textContent="BoM "+station.id+" · "+rainfallRarityDisplay(station.aep).short+
      (basin?" · "+basin+" catchment":"")+" · "+formatted(station.sourceCreatedAt);
     item.append(top,meta);list.append(item);
    }
    section.append(list);
   }
   reportRows.append(section);
  }
 }
 function openReport(mode){
  if(!reportDialog||!["amount","aep"].includes(mode))return;
  reportMode=mode;
  if(!reportDialog.open)reportDialog.showModal();
  renderReport();
  if(!lastLoadedAt||now()-lastLoadedAt>=refreshMs)
   refresh(true).catch(error=>{
    reportStatus.textContent="BoM refresh unavailable: "+String(error?.message??error).slice(0,120);
   });
  else if(reportMode==="aep"){queueIfdLookups();void loadCatchments();}
 }
 function render(){
  const records=source?.observations?.[period]??[];
  // ALL stations recording 50+ mm are visible, even if that amount is
  // less rare for the area or a verified local IFD cell is unavailable.
  visibleRows=records.filter(record=>
   qualifiesAepRainfallSnapshot(record,period,now())&&
   rainfallBand(record.mm)!==null).map(record=>{
    const aep=classifyRainfallAep({...record,grid:ifdGrid});
    if(["Authoritative IFD grid cell unavailable",
         "IFD has no matching duration/probability"].includes(aep.reason)&&
       (catalogueLoading||pendingCells.has(aep.ifdCell)||!attempts.has(aep.ifdCell)))
      aep.pending=true;
    return {...record,aep,band:rainfallBand(record.mm)};
   }).sort((a,b)=>rainfallIconPriority(a.aep)-rainfallIconPriority(b.aep)||
     a.mm-b.mm||String(a.id).localeCompare(String(b.id)));
  severityLayers.clear();
  for(const record of visibleRows){
   const entity=severityLayers.sourceFor(rainfallIconPriority(record.aep)).entities.add({
    id:"significant-rain:"+period+":"+record.id,
    name:record.name+" · "+record.mm.toFixed(1)+" mm · "+
      rainfallRarityDisplay(record.aep).description,
    position:CesiumRef.Cartesian3.fromDegrees(record.longitude,record.latitude),
    billboard:{
      image:marker(record),width:98,height:40,
      verticalOrigin:CesiumRef.VerticalOrigin?.BOTTOM,
      heightReference:CesiumRef.HeightReference?.CLAMP_TO_GROUND,
      disableDepthTestDistance:Number.POSITIVE_INFINITY
    }
   });
   entity.stormTrackerRainGaugeId=record.id;
   entity.stormTrackerRainGaugeMm=record.mm;
  }
  severityLayers.finish();
  queueIfdLookups();
  if(reportDialog?.open)renderReport();
  viewer.scene.requestRender();
  if(selectedId)showInfo(visibleRows.find(x=>x.id===selectedId)??null);
  const failed=source?.failed?.length??0;
  const label=period==="since9am"?"since 9 am":
   period==="last24Hours"?"24hrs to 9am":"last hour";
  const stale=records.filter(record=>!qualifiesAepRainfallSnapshot(record,period,now())).length;
  const high=visibleRows.filter(x=>x.mm>=100).length;
  const rarer=visibleRows.filter(x=>[1,2,5,10].includes(x.aep?.aepDesignThreshold)).length;
  const unknown=visibleRows.filter(x=>x.aep?.classification==="unclassified").length;
  say("Rainfall "+label+": "+visibleRows.length+" stations at 50+ mm"+
   (high?" · "+high+" at 100+ mm":"")+
   (rarer?" · "+rarer+" unusual or rarer locally":"")+
   (unknown?" · "+unknown+" local rarity unavailable":"")+
   (failed?" · "+failed+" regional/period BoM source(s) unavailable":"")+
   (stale?" · "+stale+" stale readings excluded":"")+
   " · checked "+formatted(source?.checkedAt),
    failed||stale?"warning":"ok");
 }
 function updateIfdCatalogue(){
  if(catalogueLoading)return catalogueLoading;
  if(ifdLoadedAt&&now()-ifdLoadedAt<=15*60000)return Promise.resolve();
  ifdLoadedAt=now();
  catalogueLoading=(async()=>{
   try{
    const response=await fetchImpl("https://raw.githubusercontent.com/Blakesmith-Intel/StormTracker/radar-ftp-feed/ifd.json",{
     cache:"no-store",signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error("BoM IFD grid data HTTP "+response.status);
    const grid=await response.json();
    if(grid?.schema!=="StormTrackerBoM2016IFDCellsV1"||!grid.cells||
       !grid.source?.includes("BoM IFD"))
      throw Error("Invalid verified IFD grid dataset");
    for(const [cell,node] of Object.entries(grid.cells)){
     const previous=ifdGrid.cells[cell];
     // An older shared snapshot must never overwrite a newly verified
     // exact-cell value retained from this browser's successful lookup.
     if(!previous||Date.parse(node?.verifiedUtc??"")>Date.parse(previous?.verifiedUtc??""))
      ifdGrid.cells[cell]=node;
    }
    ifdGrid.source=grid.source;
   }catch(error){
    console.warn("Published IFD catalogue unavailable; retained verified local cells",error);
   }finally{
    catalogueLoading=null;
    if(collection.show||reportDialog?.open)render();
   }
  })();
  return catalogueLoading;
 }
 async function refresh(force=false){
  if(!collection.show&&!force)return visibleRows.slice();
  if(period==="since9am"&&visibleRows.some(r=>!qualifiesAepRainfallSnapshot(r,period,now())))render();
  if(waiting)return waiting;
  say("Checking BoM significant rainfall…");
  waiting=(async()=>{
   const response=await fetchImpl(SIGNIFICANT_RAINFALL_RELAY,{
     mode:"cors",cache:"no-store",signal:AbortSignal.timeout(25000)
   });
   if(!response.ok)throw Error("BoM rainfall relay HTTP "+response.status);
   const incoming=await response.json();
   if(incoming?.format!=="StormTrackerSignificantRainfallV1"||
     !Array.isArray(incoming?.observations?.since9am)||
     !Array.isArray(incoming?.observations?.lastHour)||
     !Array.isArray(incoming?.observations?.last24Hours))
      throw Error("Unexpected BoM rainfall source response");
   source=validatedRainfallPayload(incoming,source);lastLoadedAt=now();lastError=null;
   void loadCatchments();
   // Show persisted classifications immediately; the shared catalogue loads
   // independently and is never a prerequisite for the first map paint.
   void updateIfdCatalogue();
   render();
   return visibleRows.slice();
  })();
  try{return await waiting;}
  catch(error){
   lastError=error;
   // Do not leave old qualifying rainfall markers indefinitely visible.
   if(lastLoadedAt && now()-lastLoadedAt>=90*60000){
     source=null;render();
   }else if(period==="since9am")render();
   say("Significant rainfall unavailable · "+String(error?.message??error).slice(0,125)+
     (lastLoadedAt?" · previous valid observations retained until stale":""),
     "warning");
   throw error;
  }finally{waiting=null;}
 }
 function setVisible(yes){
  severityLayers.setVisible(yes);
  if(!collection.show){hideInfo();say("Significant rainfall off");}
  else if(!lastLoadedAt||now()-lastLoadedAt>=refreshMs)refresh().catch(()=>{});
  else render();
  viewer.scene.requestRender();
 }
 function setPeriod(value){
  period=["lastHour","last24Hours"].includes(value)?value:"since9am";
  if(collection.show||reportDialog?.open)render();
 }
 function stationIdFromPick(hit){
  const candidates=[hit?.id,hit?.primitive?.id];
  for(const candidate of candidates){
   if(candidate?.stormTrackerRainGaugeId)
    return String(candidate.stormTrackerRainGaugeId);
   const entityId=typeof candidate==="string"?candidate:candidate?.id;
   const match=typeof entityId==="string"?
     /^significant-rain:(?:since9am|lastHour|last24Hours):([0-9]{4,7})$/.exec(entityId):null;
   if(match)return match[1];
  }
  return "";
 }
 function pickAt(position,{width=28,height=28}={}){
  if(!collection.show||!visibleRows.length)return false;
  const hits=viewer.scene.drillPick?.(position,24,width,height)??[];
  // In real Cesium multiple layers can overlap one billboard; a single
  // scene.pick is a fallback if the requested drill size returned nothing.
  const primary=viewer.scene.pick?.(position,width,height);
  for(const hit of [...hits,primary]){
   const id=stationIdFromPick(hit);
   const found=id?visibleRows.find(x=>String(x.id)===id):null;
   if(found){showInfo(found);return true;}
  }
  return false;
 }
 const canvas=viewer.scene.canvas;
 const mapContainer=viewer.container??canvas.parentElement;
 const pointerTap={id:null,x:0,y:0,started:0,moved:false};
 const interactiveControls=
   "button,a,input,select,textarea,[role=button],.map-info-card,"+
   "#controlSidebar,#legendDock,#sidebarToggle,#cesiumCredits";
 function clearTap(){pointerTap.id=null;}
 function pointerDown(event){
  if(!collection.show||!mapContainer?.contains(event.target)||
      event.target?.closest?.(interactiveControls))return;
  if(event.button!==undefined&&event.button!==0)return;
  pointerTap.id=event.pointerId;
  pointerTap.x=event.clientX;pointerTap.y=event.clientY;
  pointerTap.started=Date.now();pointerTap.moved=false;
 }
 function pointerMove(event){
  if(pointerTap.id!==event.pointerId)return;
  if(Math.hypot(event.clientX-pointerTap.x,event.clientY-pointerTap.y)>12)
    pointerTap.moved=true;
 }
 function pointerUp(event){
  if(pointerTap.id!==event.pointerId)return;
  // Never reject a stationary map tap by elapsed wall time. Cesium terrain,
  // radar decoding and WebGL can delay pointerup by seconds on slower devices;
  // the old 800 ms cutoff made otherwise valid gauge clicks disappear.
  // Movement, pointer identity and canvas bounds remain the touch/drag guards.
  const isTap=!pointerTap.moved&&
    Math.hypot(event.clientX-pointerTap.x,event.clientY-pointerTap.y)<12;
  clearTap();
  if(!isTap||!collection.show)return;
  const rect=canvas.getBoundingClientRect();
  if(event.clientX<rect.left||event.clientX>rect.right||
     event.clientY<rect.top||event.clientY>rect.bottom)return;
  const position=new CesiumRef.Cartesian2(event.clientX-rect.left,event.clientY-rect.top);
  const width=event.pointerType==="touch"?42:28;
  pickAt(position,{width,height:width});
 }
 function start(){
  if(started)return;started=true;
  checkbox?.addEventListener("change",e=>setVisible(e.target.checked));
  select?.addEventListener("change",e=>setPeriod(e.target.value));
  $("refreshSignificantRainfallButton")?.addEventListener("click",()=>refresh(true).catch(()=>{}));
  $("closeSignificantRainfallInfo")?.addEventListener("click",hideInfo);
  $("openRainfallTotalsReport")?.addEventListener("click",()=>openReport("amount"));
  $("openRainfallAepReport")?.addEventListener("click",()=>openReport("aep"));
  $("closeSignificantRainfallReport")?.addEventListener("click",()=>reportDialog?.close());
  $("refreshSignificantRainfallReport")?.addEventListener("click",()=>refresh(true).catch(error=>{
   reportStatus.textContent="BoM refresh unavailable: "+String(error?.message??error).slice(0,120);
  }));
  // Cesium map gestures may retarget pointerup away from the canvas.
  // Capture at window level like the proven flood-gauge layer, but only
  // process taps that began within the actual map (never sidebar UI).
  window.addEventListener("pointerdown",pointerDown,{capture:true,passive:true});
  window.addEventListener("pointermove",pointerMove,{capture:true,passive:true});
  window.addEventListener("pointerup",pointerUp,{capture:true,passive:true});
  window.addEventListener("pointercancel",clearTap,{capture:true,passive:true});
  scheduleRollover();
  timer=setInterval(()=>{
   if(!document.hidden&&collection.show)refresh().catch(()=>{});
  },refreshMs);
  say("Significant rainfall off · BoM station measurements");
 }
 function stop(){
  if(timer!==null)clearInterval(timer);timer=null;
  if(rolloverTimer!==null)clearTimeout(rolloverTimer);rolloverTimer=null;
  if(renderTimer!==null)clearTimeout(renderTimer);renderTimer=null;
  queue.length=0;
  window.removeEventListener("pointerdown",pointerDown,true);
  window.removeEventListener("pointermove",pointerMove,true);
  window.removeEventListener("pointerup",pointerUp,true);
  window.removeEventListener("pointercancel",clearTap,true);
 }
 window.addEventListener("pagehide",stop,{once:true});
 start();
 return {dataSource:collection,severityDataSources:severityLayers.dataSources,refresh,setVisible,setPeriod,stop,pickAt,
  get features(){return visibleRows.slice();},get period(){return period;},
  get lastLoadedAt(){return lastLoadedAt;},get error(){return lastError;}};
}
