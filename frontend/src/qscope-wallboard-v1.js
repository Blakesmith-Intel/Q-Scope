import {loadPowerOutages,DEFAULT_POWER_OUTAGE_REFRESH_MS} from "./context-layers/power-outages-v1.js";
import {loadFloodRoadClosures} from "./context-layers/flood-road-closures-v1.js";
import {ROAD_OWNERSHIP_SCHEMA} from "./context-layers/road-ownership-report-v1.js";
import {createRiverGaugeLayer} from "./context-layers/river-gauge-wallboard-v1.js?v=20261120-v1";
import {DEFAULT_RIVER_GAUGE_REFRESH_MS} from "./context-layers/river-gauges-v1.js";
import {loadPersistedIfdCells} from "./context-layers/rainfall-ifd-aep-v1.js";
import {SIGNIFICANT_RAINFALL_RELAY,SIGNIFICANT_RAINFALL_REFRESH_MS} from "./context-layers/significant-rainfall-operational-v1.js";
import {WIND_OBSERVATION_RELAY} from "./context-layers/qscope-bom-wind-observations-operational-v1.js";
import {WIND_OBS_REFRESH_MS} from "./context-layers/qscope-bom-wind-observation-model-v1.js";
import {isVerifiedActiveBomWarning,isSourceMatchedOfficialWarningPolygon,officialWarningRefreshInterval,hasNewOfficialBoMWarningEdition,WARNING_EDITION_POLL_MS,WARNING_EDITION_RETRY_MS} from "./context-layers/bom-warning-operational-v1.js";
import {validateInternalCycloneSnapshot} from "./internal-cyclone-feed-v1.js";
import {summarisePower,summariseRoads,summariseFloods,summariseRain,summariseWind,formatCountdown} from "./qscope-wallboard-model-v1.js?v=20261120-v1";

const relay="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev";
const $=id=>document.getElementById(id),now=()=>Date.now(),fmt=n=>Number(n).toLocaleString("en-AU");
const time=ms=>new Date(ms).toLocaleTimeString("en-AU",{timeZone:"Australia/Brisbane",hour:"2-digit",minute:"2-digit",hour12:false})+" AEST";
const stamp=ms=>new Date(ms).toLocaleString("en-AU",{timeZone:"Australia/Brisbane",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",hour12:false})+" AEST";
const el=(tag,value,cls)=>{const x=document.createElement(tag);if(value!=null)x.textContent=value;if(cls)x.className=cls;return x;};
const set=(id,value)=>{$(id).textContent=value;};
const json=async(url,ms=25000)=>{const r=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(ms)});if(!r.ok)throw Error("HTTP "+r.status);return r.json();};
const statusIds=["powerStatus","warningStatus","cycloneStatus","windStatus","floodStatus","rainStatus","aepStatus","roadStatus"];
const statusMap=new Map();
for(const id of statusIds){
 const footer=$(id),health=el("span",footer.textContent,"health"),timer=el("span",null,"countdown");
 const value=el("b","—");timer.append(el("small",id==="warningStatus"?"Next check":"Next refresh"),value);
 footer.replaceChildren(health,timer);statusMap.set(id,{health,timer:value,footer});
}
function health(id,kind,message,at=0){
 const x=statusMap.get(id);x.health.dataset.kind=kind;
 x.health.textContent=message+(at?" · checked "+stamp(at):"");
 x.footer.closest(".panel").dataset.stale=String(kind==="error");
}
function metrics(id,rows){$(id).replaceChildren(...rows.map(([k,v])=>{const d=el("div");d.append(el("span",k),el("b",v));return d;}));}
function bars(id,rows){
 const max=Math.max(1,...rows.map(x=>x.count??0));
 $(id).replaceChildren(...rows.map(x=>{
  const d=el("div",null,"barline"),track=el("div",null,"track"),i=el("i");
  i.style.width=(100*(x.count??0)/max)+"%";track.append(i);
  d.append(el("span",x.name),el("b",x.count==null?"—":fmt(x.count),""),track);return d;
 }));
}
function pie(id,legendId,rows){
 const total=rows.reduce((s,x)=>s+x.count,0),node=$(id);
 let offset=0;const stops=[];
 for(const r of rows){if(!r.count)continue;const end=offset+100*r.count/total;stops.push(r.color+" "+offset+"% "+end+"%");offset=end;}
 node.style.background=total?"conic-gradient("+stops.join(",")+")":"#294450";
 node.classList.toggle("empty",!total);
 node.setAttribute("aria-label",total?rows.map(r=>r.label+": "+r.count).join("; "):"No verified chart observations");
 $(legendId).replaceChildren(...rows.map(r=>{
  const d=el("div"),swatch=el("i");swatch.style.background=r.color;
  d.append(swatch,el("span",r.label),el("b",fmt(r.count)+(total?" ("+Math.round(r.count*100/total)+"%)":"")));return d;
 }));
}
function unavailable(ids,clear,message){clear();for(const id of ids)health(id,"error",message);}

const tasks=[];
function task(name,interval,ids,run,onError){const t={name,interval,ids,run,onError,next:0,busy:false};tasks.push(t);return t;}
async function execute(t){
 if(t.busy)return;t.busy=true;t.next=now()+t.interval;
 try{await t.run(t);}catch(e){t.onError(e);}finally{t.busy=false;}
}
function tick(){
 const at=now();set("boardClock",new Date(at).toLocaleTimeString("en-AU",{timeZone:"Australia/Brisbane",hour12:false}));
 set("boardDate",new Date(at).toLocaleDateString("en-AU",{timeZone:"Australia/Brisbane",weekday:"short",day:"numeric",month:"short",year:"numeric"})+" AEST");
 for(const t of tasks){
  if(!document.hidden&&!t.busy&&at>=t.next)void execute(t);
  for(const id of t.ids)statusMap.get(id).timer.textContent=t.busy?"Updating…":formatCountdown(t.next,at);
 }
}
function clearPower(){set("powerTotal","—");set("powerEvents","");bars("powerRows",[]);}
task("power",DEFAULT_POWER_OUTAGE_REFRESH_MS,["powerStatus"],async()=>{
 const report=summarisePower(await loadPowerOutages());
 set("powerTotal",fmt(report.total.customers));set("powerEvents",fmt(report.total.outages)+" distinct unplanned incidents"+(report.partial?" · partial coverage":""));
 bars("powerRows",report.rows.map(r=>({name:r.provider+(r.state==="ok"?"":" · "+r.state),count:r.state==="unavailable"?null:r.customers})));
 health("powerStatus",report.partial?"warning":"ok",report.partial?"Partial provider coverage · verified subtotal only":"Provider-published incidents",now());
},()=>unavailable(["powerStatus"],clearPower,"Provider data unavailable"));

let roadOwnership=null,ownershipAt=0;
function clearRoads(){set("roadTotal","—");set("roadUnverified","");bars("roadRows",[]);}
task("roads",5*60000,["roadStatus"],async()=>{
 const due=!ownershipAt||now()-ownershipAt>=10*60000;
 const requests=[loadFloodRoadClosures(),due?json(relay+"/road-ownership-report"):Promise.resolve(roadOwnership)];
 const [closures,ownership]=await Promise.allSettled(requests);
 if(due){
  const v=ownership.status==="fulfilled"?ownership.value:null;
  roadOwnership=v?.schema===ROAD_OWNERSHIP_SCHEMA&&v.entries&&typeof v.entries==="object"&&!Array.isArray(v.entries)&&Object.keys(v.entries).length?v:null;
  ownershipAt=now();
 }
 if(closures.status!=="fulfilled")throw closures.reason;
 const s=summariseRoads(closures.value.payload.features,roadOwnership);
 set("roadTotal",roadOwnership?fmt(s.total):"—");
 bars("roadRows",roadOwnership?s.rows:[]);
 set("roadUnverified",fmt(s.unverified)+" unverified ownership · excluded from state total");
 health("roadStatus",!roadOwnership||s.unverified?"warning":"ok",roadOwnership?"QLDTraffic · ownership checked "+time(ownershipAt):"Road ownership unavailable · no state total",now());
},()=>unavailable(["roadStatus"],clearRoads,"Road closure feed unavailable"));

let grid={schema:"StormTrackerBoM2016IFDCellsV1",source:"BoM verified IFD",cells:loadPersistedIfdCells()},gridAt=0,rainData=null,rainAt=0;
function clearRain(){set("rainPeak","—");set("rainStation","");metrics("rainRows",[]);pie("aepPie","aepLegend",[]);set("aepTotal","50+ mm gauges · since 9 am AEST");}
async function getGrid(){
 if(gridAt&&now()-gridAt<15*60000)return;
 gridAt=now();
 try{
  const g=await json("https://raw.githubusercontent.com/Blakesmith-Intel/StormTracker/radar-ftp-feed/ifd.json",15000);
  if(g?.schema!=="StormTrackerBoM2016IFDCellsV1"||!g.source?.includes("BoM IFD")||!g.cells)throw Error("Invalid IFD");
  for(const [key,node] of Object.entries(g.cells)){
   const old=grid.cells[key];
   if(!old||Date.parse(node?.verifiedUtc??"")>Date.parse(old?.verifiedUtc??""))grid.cells[key]=node;
  }
  grid.source=g.source;
 }catch{/* Existing verified exact-cell cache is retained; no fabricated rarity. */}
}
function renderRain(){
 if(!rainData)return;
 const s=summariseRain(rainData,grid);
 set("rainPeak",s.peak?s.peak.mm.toFixed(1)+" mm":"—");set("rainStation",s.peak?s.peak.name+" · "+stamp(Date.parse(s.peak.sourceCreatedAt)):"No verified observations");
 metrics("rainRows",[["Gauges reporting",fmt(s.total)],["50+ mm gauges",fmt(s.notable)],["100+ mm gauges",fmt(s.heavy)],["Highest 24h to 9 am",s.peak24?s.peak24.mm.toFixed(1)+" mm":"—"]]);
 pie("aepPie","aepLegend",s.aep);
 set("aepTotal",fmt(s.notable)+" gauges at 50+ mm · "+fmt(s.unknown)+" IFD unverified");
 const partial=s.failed||s.stale||!s.total;
 health("rainStatus",partial?"warning":"ok",partial?"Partial coverage / stale values excluded":"BoM network · includes border gauges",rainAt);
 health("aepStatus",partial||s.unknown?"warning":"ok",s.unknown?"Exact-cell IFD unavailable for some gauges":"BoM design depths · since 9 am AEST",rainAt);
}
task("rain",SIGNIFICANT_RAINFALL_REFRESH_MS,["rainStatus","aepStatus"],async()=>{
 const [data]=await Promise.all([json(SIGNIFICANT_RAINFALL_RELAY),getGrid()]);
 if(data?.format!=="StormTrackerSignificantRainfallV1"||!["since9am","last24Hours","lastHour"].every(k=>Array.isArray(data.observations?.[k])))throw Error("Invalid rainfall source");
 rainData=data;rainAt=now();renderRain();
},()=>{rainData=null;unavailable(["rainStatus","aepStatus"],clearRain,"BoM rainfall source unavailable");});

let windData=null,windAt=0;
function clearWind(){set("windPeak","—");set("windStation","");metrics("windRows",[]);}
function renderWind(){
 if(!windData)return;const s=summariseWind(windData);
 set("windPeak",s.peak?Math.round(s.peak.todayMaximumGustKmh)+" km/h":"—");
 set("windStation",s.peak?s.peak.name+" · latest observation "+stamp(Date.parse(s.peak.observedUtc)):"No verified peak reported");
 metrics("windRows",[["Qualifying stations",fmt(s.qualifying)],["Destructive",fmt(s.counts.destructive)],["Damaging",fmt(s.counts.damaging)],["Sustained gale",fmt(s.counts.gale)]]);
 health("windStatus",s.total?"ok":"warning",s.total?fmt(s.total)+" current stations · measured values, not forecasts":"No current station measurements",windAt);
}
task("winds",WIND_OBS_REFRESH_MS,["windStatus"],async()=>{
 const data=await json(WIND_OBSERVATION_RELAY,24000);
 if(data?.format!=="QScopeBoMWindObservationsV1"||!Array.isArray(data.observations))throw Error("Invalid wind product");
 windData=data.observations;windAt=now();renderWind();
},()=>{windData=null;unavailable(["windStatus"],clearWind,"BoM observed winds unavailable");});

let catalogue=null,catalogueAt=0,floodStatus=null,floodLayer;
function renderFlood(){
 if(!floodLayer?.lastLoadedAt)return;
 const s=summariseFloods(floodLayer.sourceFeatures,floodLayer.features,catalogue);
 pie("floodPie","floodLegend",s.rows);
 set("floodTotal",fmt(s.notable)+" current flood signals · "+fmt(s.crossings)+" crossings reached"+(s.staleSignals?" · "+fmt(s.staleSignals)+" stale signals":""));
 const cov=floodLayer.crossingCoverage;
 const issue=floodStatus?.kind==="error"?"Latest check failed; retained observations are not a current all-clear":
  floodStatus?.partial?"Partial BoM coverage":
  cov?.pending?"Crossing / rise references incomplete":
  floodStatus?.screeningIncomplete?"Rise checks incomplete":"BoM observations · screening only";
 health("floodStatus",floodStatus?.kind==="error"?"error":floodStatus?.partial||cov?.pending||floodStatus?.screeningIncomplete?"warning":"ok",issue,floodLayer.lastLoadedAt);
}
floodLayer=createRiverGaugeLayer({onUpdate:()=>renderFlood(),onStatus:s=>{if(s.kind!=="loading"){floodStatus=s;renderFlood();}}});
async function getCrossings(){
 if(catalogue||now()-catalogueAt<15*60000&&catalogueAt)return;
 catalogueAt=now();
 try{const data=await json(relay+"/river-crossing-heights",20000);
  if(data?.schema!=="StormTrackerBoMQldCrossingHeightsV1"||Object.keys(data.entries??{}).length<40||data.sourceDate!=="2022-01-05")throw Error("Invalid crossings");
  catalogue=data;floodLayer.setCrossingCatalogue(data);
 }catch{/* No invented crossing thresholds. */}
}
task("flood",DEFAULT_RIVER_GAUGE_REFRESH_MS,["floodStatus"],async()=>{
 // Same existing flood engine, history budget and persistent station caches.
 await Promise.all([floodLayer.refresh(),getCrossings()]);renderFlood();
},()=>{if(!floodLayer.lastLoadedAt){pie("floodPie","floodLegend",[]);set("floodTotal","No verified flood data");}health("floodStatus","error","BoM river observations unavailable",floodLayer.lastLoadedAt);});

const codes=[["IDQ21033","Regional thunderstorms"],["IDQ21035","Detailed SEQ thunderstorms"],["IDQ21037","Severe weather 1"],["IDQ21038","Severe weather 2"]];
const active=p=>["active","geometry-unavailable","listed-active"].includes(p?.status);
const clear=p=>["no-active","cancelled"].includes(p?.status);
let warnings=[],cells=[],products={},warningAt=0,fullDue=0,recoveryPolls=0,temporaryFailures=0,editionKey="",editionAt=0;
function clearWarnings(){set("thunderCount","—");set("weatherCount","—");$("warningRows").replaceChildren(el("div","Official warning status unavailable · no all-clear implied"));}
function renderWarnings(){
 const at=now(),current=Object.fromEntries(Object.entries(products).map(([k,p])=>[k,active(p)&&p.expiresUtc&&Date.parse(p.expiresUtc)<=at?{status:"unavailable"}:p]));
 const count=range=>{const p=range.map(([k])=>current[k]);const n=p.filter(active).length;return p.every(x=>active(x)||clear(x))?String(n):n?n+"+":"—";};
 set("thunderCount",count(codes.slice(0,2)));set("weatherCount",count(codes.slice(2)));
 $("thunderCount").parentElement.dataset.active=String(codes.slice(0,2).some(([k])=>active(current[k])));
 $("weatherCount").parentElement.dataset.active=String(codes.slice(2).some(([k])=>active(current[k])));
 const list=[];
 for(const [k,name] of codes){
  const p=current[k];if(clear(p))continue;
  const d=el("div"),line=el("b",name+" · "+k);d.append(line);
  if(active(p)){
   const w=warnings.filter(x=>x.productCode===k&&isVerifiedActiveBomWarning(x,at));
   const hazards=Array.isArray(p.hazardAssessment?.highEnd)?p.hazardAssessment.highEnd.join(" · "):"";
   d.append(el("span",p.headline||"Current warning"+(w.length?" · "+w.length+" verified polygons":" · polygon awaiting verification")));
   if(hazards)d.append(el("b",hazards));
   if(k==="IDQ21035"){const dangerous=cells.filter(x=>x.veryDangerous===true&&Date.parse(x.expiresUtc)>at).length;if(dangerous)d.append(el("b",dangerous+" VERY DANGEROUS storm cells"));}
  }else d.append(el("span","Status unverified"));
  list.push(d);
 }
 const allClear=codes.every(([k])=>clear(current[k]));
 $("warningRows").replaceChildren(...(list.length?list:[el("div",allClear?"No current severe weather or thunderstorm warnings":"Awaiting official verification")]));
 health("warningStatus",codes.every(([k])=>active(current[k])||clear(current[k]))?"ok":"warning",allClear?"BoM confirmed no current products":"BoM products · not polygon counts",warningAt);
}
async function fullWarnings(){
 try{
  const d=await json(relay+"/bom-official-warning-polygons",27000);
  if(d?.schema!=="StormTrackerOfficialBoMWarningPolygonsV1"||!Array.isArray(d.warnings)||!["active","no-verified-current-polygons","partial-source-unavailable"].includes(d.status))throw Error("Invalid warning source");
  warnings=d.warnings.filter(w=>isVerifiedActiveBomWarning(w,now())&&isSourceMatchedOfficialWarningPolygon(w));
  cells=(d.stormCells??[]).filter(c=>c.official===true&&c.issuer==="Bureau of Meteorology"&&c.sourceProduct==="IDQ65652"&&Date.parse(c.expiresUtc)>now());
  products=d.products??{};warningAt=now();temporaryFailures=0;
  const interval=officialWarningRefreshInterval({products,warnings,recoveryPolls,temporaryFailures});
  recoveryPolls=interval===120000?recoveryPolls+1:0;fullDue=now()+interval;renderWarnings();
 }catch(e){
  products={};warnings=[];cells=[];temporaryFailures=Math.min(3,temporaryFailures+1);
  fullDue=now()+officialWarningRefreshInterval({products,warnings,recoveryPolls,temporaryFailures});
  unavailable(["warningStatus"],clearWarnings,"BoM warnings unavailable");
 }
}
task("warnings",WARNING_EDITION_POLL_MS,["warningStatus"],async()=>{
 if(now()>=fullDue){await fullWarnings();return;}
 try{
  const d=await json(relay+"/bom-official-warning-editions",14000);
  if(hasNewOfficialBoMWarningEdition(d,products,warnings,cells)){
   const key=JSON.stringify({active:d.activeCodes,products:d.products});
   if(key!==editionKey||now()-editionAt>=WARNING_EDITION_RETRY_MS){editionKey=key;editionAt=now();await fullWarnings();return;}
  }
 }catch{/* Failed metadata-only probe is not a cancellation. */}
 renderWarnings();
},()=>unavailable(["warningStatus"],clearWarnings,"BoM warnings unavailable"));

function clearCyclones(){$("cycloneRows").replaceChildren(el("div","Cyclone forecasts unavailable · check BoM directly","empty"));}
task("cyclone",5*60000,["cycloneStatus"],async()=>{
 // Existing issued-source feed. Never fetch credentials or assume a missing
 // internal feed is a verified absence of a tropical cyclone.
 const data=await json("/internal/cyclones.json",18000);
 const d=validateInternalCycloneSnapshot(data,{nowUtc:new Date().toISOString()});
 if(d.status==="unavailable")throw Error(d.message);
 if(d.status==="no-active-products"){
  $("cycloneRows").replaceChildren(el("div","No current verified cyclone forecast products","empty"));
  health("cycloneStatus","ok","Issued forecast products · warnings separate",now());return;
 }
 const cards=d.storms.map(s=>{
  const c=el("div",null,"storm");
  c.append(el("strong",s.cycloneName),el("span","BoM "+s.productId+" · issued "+stamp(Date.parse(s.issueUtc))));
  const fix=s.features.filter(f=>f.role==="observed_fix").sort((a,b)=>Date.parse(b.validUtc)-Date.parse(a.validUtc))[0];
  if(fix){const [lon,lat]=fix.geometry.coordinates;c.append(el("span",(fix.category?"Category "+fix.category+" · ":"")+Math.abs(lat).toFixed(1)+"° "+(lat<0?"S":"N")+", "+lon.toFixed(1)+"° E"));}
  c.append(el("span","Expires "+stamp(Date.parse(s.expiresUtc))+" · original issued forecast"));return c;
 });
 $("cycloneRows").replaceChildren(...cards);
 health("cycloneStatus",d.status==="active-partial"?"warning":"ok",d.status==="active-partial"?"Partial BoM forecast coverage":"BoM original source · warnings separate",now());
},()=>unavailable(["cycloneStatus"],clearCyclones,"Cyclone source not verified · no all-clear implied"));

document.addEventListener("visibilitychange",()=>{if(!document.hidden)tick();});
const clock=setInterval(tick,1000);
window.addEventListener("pagehide",()=>{clearInterval(clock);floodLayer.stop();},{once:true});
tick();
