import {createWarningImageryProvider,warningContainsPoint} from "./bom-warning-terrain-imagery-v1.js?v=20261030-compact-vd-hazard-v1";
import {formatAgencyTimestamp} from "./agency-source-time-v1.js?v=20261027-agency-panels-v1";
const SOURCE="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/bom-official-warning-polygons";
const SCHEMA="StormTrackerOfficialBoMWarningPolygonsV1",INTERVAL_MS=15*60*1000;
export const PRODUCT_FILTERS=Object.freeze(["all","IDQ21035","IDQ21033","IDQ21037","IDQ21038"]);
export function filterOfficialWarnings(warnings,productCode="all"){
 if(!PRODUCT_FILTERS.includes(productCode))return [];
 return (Array.isArray(warnings)?warnings:[]).filter(w=>
   productCode==="all"||w?.productCode===productCode);
}
export function warningProductAffectedGroups(warnings,productCode="all"){
 const visible=filterOfficialWarnings(warnings,productCode);
 const ldmgs=new Set(),ddmgs=new Set();
 let ldmgComplete=true,ddmgComplete=true;
 for(const w of visible){
  if(w.ldmgStatus!=="verified")ldmgComplete=false;
  if(w.ddmgStatus!=="verified")ddmgComplete=false;
  for(const name of w.ldmgs??w.lgas??[])if(String(name).trim())ldmgs.add(String(name).trim());
  for(const name of w.ddmgs??[])if(String(name).trim())ddmgs.add(String(name).trim());
 }
 return {count:visible.length,ldmgs:[...ldmgs].sort((a,b)=>a.localeCompare(b,"en-AU")),
  ddmgs:[...ddmgs].sort((a,b)=>a.localeCompare(b,"en-AU")),
  ldmgComplete,ddmgComplete};
}
// Exact source geometry envelope for the optional "Locate" action.
// This NEVER creates a warning polygon or guesses an affected district.
export function insertOfficialWarningImageryAboveBasemap(layers,layer,getRadarLayer=()=>null){
 // ADD to top rather than index 1: opaque DEA and local satellite occupy
 // indices 1-3, so an index-1 warning can NEVER be seen.
 layers.add(layer);
 const radar=getRadarLayer?.();
 if(radar&&layers.indexOf(radar)>=0)layers.raiseToTop(radar);
 return layer;
}
export function officialWarningBounds(warnings){
 let west=Infinity,east=-Infinity,south=Infinity,north=-Infinity,points=0;
 for(const warning of warnings??[]){
  const g=warning?.geometry;
  const polygons=g?.type==="Polygon"?[g.coordinates]:
    g?.type==="MultiPolygon"?g.coordinates:[];
  for(const poly of polygons)for(const ring of poly??[])for(const p of ring??[]){
   const lon=p?.[0],lat=p?.[1];
   if(!Number.isFinite(lon)||!Number.isFinite(lat)||
      lon<136||lon>155||lat< -38||lat> -9)continue;
   west=Math.min(west,lon);east=Math.max(east,lon);
   south=Math.min(south,lat);north=Math.max(north,lat);points++;
  }
 }
 if(points<3||!(east>west&&north>south))return null;
 return {west,east,south,north};
}
// Fits only the verified, source-published polygon envelope using the
// accepted stateful map camera (not Cesium flyTo, which camera watchdog undoes).
export function officialWarningCameraTarget(bounds,{width=430,height=700,fovy=Math.PI/3}={}){
 if(!bounds||!Number.isFinite(bounds.west)||!Number.isFinite(bounds.east)||
  !Number.isFinite(bounds.south)||!Number.isFinite(bounds.north)||
  bounds.east<=bounds.west||bounds.north<=bounds.south)return null;
 const latitude=(bounds.south+bounds.north)/2;
 const longitude=(bounds.west+bounds.east)/2;
 const latMetres=(bounds.north-bounds.south)*111195;
 const lonMetres=(bounds.east-bounds.west)*111195*Math.cos(latitude*Math.PI/180);
 const vertical=Math.min(Math.max(Number(fovy)||Math.PI/3,.35),1.8);
 const aspect=Math.min(5,Math.max(.25,(Number(width)||430)/(Number(height)||700)));
 const horizontal=2*Math.atan(Math.tan(vertical/2)*aspect);
 const needed=Math.max(latMetres/(2*Math.tan(vertical/2)),lonMetres/(2*Math.tan(horizontal/2)));
 return {
  longitude,latitude,targetHeight:0,
  range:Math.max(20000,Math.min(4900000,needed*1.45+25000)),
  heading:0,pitch:-Math.PI/2+.01
 };
}
export function officialWarningAtPoint(warnings,longitude,latitude){
 if(!Number.isFinite(longitude)||!Number.isFinite(latitude))return null;
 return (warnings??[]).findLast(w=>warningContainsPoint(w.geometry,longitude,latitude))??null;
}
const WARNING_CODES=Object.freeze(["IDQ21035","IDQ21033","IDQ21037","IDQ21038"]);
// Preserve the operator-approved NORMAL 15-minute warning polling. Only a
// verified *active* warning with temporarily unavailable genuine GIS geometry
// gets a bounded short recovery sequence until the source catches up.
export const WARNING_GEOMETRY_RECOVERY_MS=2*60*1000;
export const WARNING_GEOMETRY_RECOVERY_MAX=9;
export function missingActiveBoMWarningGeometry(products={},warnings=[]){
 const real=Array.isArray(warnings)?warnings:[];
 return WARNING_CODES.filter(code=>{
  const status=products?.[code]?.status;
  return status==="geometry-unavailable"||status==="listed-active"||
   (status==="active"&&!real.some(w=>w?.productCode===code));
 });
}
export function officialWarningRefreshInterval({
 products={},warnings=[],recoveryPolls=0,temporaryFailures=0
}={}){
 if(missingActiveBoMWarningGeometry(products,warnings).length&&
    recoveryPolls<WARNING_GEOMETRY_RECOVERY_MAX)
   return WARNING_GEOMETRY_RECOVERY_MS;
 // A temporary network failure gets two bounded early retries, never a
 // negative warning result and never unbounded request amplification.
 if(temporaryFailures>0&&temporaryFailures<3)
   return WARNING_GEOMETRY_RECOVERY_MS;
 return INTERVAL_MS;
}
const THUNDERSTORM_CODES=Object.freeze(["IDQ21035","IDQ21033"]);
const warningName=code=>code==="IDQ21035"?"IDQ21035 (Detailed SEQ storms)":
 code==="IDQ21033"?"IDQ21033 (Regional QLD storms)":
 code==="IDQ21037"?"IDQ21037 (Severe Weather 1)":
 code==="IDQ21038"?"IDQ21038 (Severe Weather 2)":code;
const isConfirmedClear=status=>status==="cancelled"||status==="no-active";
// Pure operational-state presentation. A source failure must NEVER be
// translated into "No current warnings"; a confirmed cancellation IS useful
// negative reporting, even when unrelated products have not been verified.
export function describeOfficialBomWarningState({products={},warnings=[],selected="all"}={}){
 const codes=selected==="all"?WARNING_CODES:
   PRODUCT_FILTERS.includes(selected)?[selected]:[];
 const status=code=>products?.[code]?.status??"unavailable";
 const total=filterOfficialWarnings(warnings,selected).length;
 const confirmedActiveStatus=["active","geometry-unavailable","listed-active"];
 const active=codes.filter(code=>confirmedActiveStatus.includes(status(code)));
 const uncertain=codes.filter(code=>!isConfirmedClear(status(code))&&
   !confirmedActiveStatus.includes(status(code)));
 const clear=codes.filter(code=>isConfirmedClear(status(code)));
 const countFor=code=>filterOfficialWarnings(warnings,code).length;
 if(!codes.length)return {message:"Warning product unavailable",kind:"warning"};
 if(active.length){
  const parts=active.map(code=>{
   const count=countFor(code);
   const hazards=products?.[code]?.hazardAssessment?.highEnd??[];
   const compact=hazards.length?" · HIGH-END: "+hazards.slice(0,2).join(" + ")+
    (hazards.length>2?" +"+(hazards.length-2):""):"";
   // Regional IDQ21033 has only a warning AREA, not individually tracked cells.
   const spatial=status(code)==="listed-active"?
     " — current in BoM listing; polygon awaiting verification":
     status(code)==="geometry-unavailable"||!count?
     " — active; awaiting updated BoM polygon":
     " — active ("+count+" polygon"+(count===1?"":"s")+")";
   const sourceNote=products?.[code]?.bulletinVerification==="pending-current-source"?
     " — original GIS polygons verified; current CAP bulletin pending":"";
   return warningName(code)+spatial+sourceNote+compact;
  });
  const message="Active BoM warnings: "+parts.join(" · ")+
    (selected==="all"&&clear.length?
     " · "+clear.map(code=>code+": none current").join(" · "):"")+
    (uncertain.length?" · Other products not verified":"");
  return {message,kind:uncertain.length||
    active.some(code=>["geometry-unavailable","listed-active"].includes(status(code))||
      !countFor(code)||products?.[code]?.bulletinVerification==="pending-current-source")?
      "warning":"normal"};
 }
 if(selected!=="all"&&clear.length)
  return {message:"No current warnings — "+warningName(selected),kind:"normal"};
 if(selected==="all"&&clear.length===codes.length)
  return {message:"No current warnings",kind:"normal"};
 if(selected==="all"&&THUNDERSTORM_CODES.every(code=>isConfirmedClear(status(code))))
  return {message:"No current thunderstorm warnings (IDQ21033 / IDQ21035)"+
    (uncertain.length?" · Other severe weather not verified":""),kind:uncertain.length?"warning":"normal"};
 if(uncertain.length)
  return {message:selected==="all"?
    "Unable to confirm current BoM warnings — tap refresh to retry":
    warningName(selected)+" — unable to confirm current warnings",kind:"warning"};
 // A reported active status with missing mapped polygons was handled above.
 return {message:"Unable to verify current warnings",kind:"warning"};
}
const $=id=>document.getElementById(id);
const fmt=iso=>iso?formatAgencyTimestamp(iso,"bom-issued"):"Not supplied";
const officialUrl=x=>{
 try{const u=new URL(x);return u.protocol==="https:"&&/(^|\.)bom\.gov\.au$/.test(u.hostname)?u.href:""}
 catch{return ""}
};
export function isVerifiedActiveBomWarning(warning,nowMs=Date.now()){
 return warning?.official===true&&warning.issuer==="Bureau of Meteorology"&&
  ["severe-thunderstorm","severe-weather"].includes(warning.type)&&
  ["Polygon","MultiPolygon"].includes(warning.geometry?.type)&&
  officialUrl(warning.bulletinUrl)&&
  Number.isFinite(Date.parse(warning.issuedUtc))&&
  Number.isFinite(Date.parse(warning.expiresUtc))&&
  Date.parse(warning.issuedUtc)<=nowMs&&Date.parse(warning.expiresUtc)>nowMs;
}
const textRow=(node,label,value)=>{
 const s=String(value??"").trim();
 if(!s)return;
 const k=document.createElement("dt"),v=document.createElement("dd");
 k.textContent=label;v.textContent=s;node.append(k,v);
};
export function initialiseOfficialBomWarningPolygons({viewer,CesiumRef=globalThis.Cesium,
 fetchImpl=globalThis.fetch,now=()=>Date.now(),getRadarLayer=()=>null,cameraController=null}={}){
 const toggle=$("showOfficialBomWarnings"),state=$("officialBomWarningsStatus"),
   panel=$("officialBomWarningInfo"),content=$("officialBomWarningInfoRows"),
   title=$("officialBomWarningInfoTitle"),dismiss=$("closeOfficialBomWarningInfo"),
   refreshBtn=$("refreshOfficialBomWarnings"),locateBtn=$("locateOfficialBomWarnings"),filter=$("officialBomWarningProduct"),
   reportButton=$("openOfficialBomWarningGroups"),reportDialog=$("officialBomWarningGroupsReport"),
   reportClose=$("closeOfficialBomWarningGroupsReport"),reportBody=$("officialBomWarningGroupsBody");
 if(!viewer||!CesiumRef||![toggle,state,panel,content,title,dismiss,refreshBtn,locateBtn,filter,reportButton,reportDialog,reportClose,reportBody].every(Boolean))
  return {destroy(){}};
 let warnings=[],stormCells=[],stormCellSourceStatus="unavailable",imagery=null,lastAttemptAt=0,pending=null,timer=null,activeId="",destroyed=false,sourceStatus="unavailable",productStatuses={};
 let geometryRecoveryPolls=0,geometryRecoverySignature="",temporaryFailures=0;
 const currentRefreshMs=()=>officialWarningRefreshInterval({
   products:productStatuses,warnings,recoveryPolls:geometryRecoveryPolls,
   temporaryFailures
 });
 const recordRecoveryState=()=>{
  const missing=missingActiveBoMWarningGeometry(productStatuses,warnings);
  const signature=missing.map(code=>code+":"+
   (productStatuses[code]?.issuedUtc??"current-index")).join("|");
  if(!signature){geometryRecoverySignature="";geometryRecoveryPolls=0;return;}
  if(signature!==geometryRecoverySignature){
   geometryRecoverySignature=signature;geometryRecoveryPolls=0;
  }else geometryRecoveryPolls=Math.min(WARNING_GEOMETRY_RECOVERY_MAX,
   geometryRecoveryPolls+1);
 };
 const canvas=viewer.scene.canvas;
 const report=(message,kind="normal")=>{
  state.textContent=message;state.dataset.kind=kind;
 };
 function showProductStatus(){
  locateBtn.hidden=!toggle.checked||!officialWarningBounds([
   ...filterOfficialWarnings(warnings,filter.value),
   ...(filter.value==="all"||filter.value==="IDQ21035"?stormCells:[])
  ]);
  if(!toggle.checked){report("BoM warning polygons off");return;}
  const result=describeOfficialBomWarningState({
    products:productStatuses,warnings,selected:filter.value
  });
  report(result.message,result.kind);
 }
 const discard=()=>{
  if(imagery){
   viewer.imageryLayers.remove(imagery,true);imagery=null;
  }
  viewer.scene.requestRender();
 };
 function display(){
  discard();
  const visible=[...filterOfficialWarnings(warnings,filter.value),
   ...(filter.value==="all"||filter.value==="IDQ21035"?stormCells:[])];
  if(!toggle.checked||!visible.length)return;
  imagery=new CesiumRef.ImageryLayer(createWarningImageryProvider(CesiumRef,visible),{
   alpha:1,show:true
  });
  // First terrain basemap is below us; radar surfaces dynamically rise to TOP.
  // This never changes the existing radar handover or opacity logic.
  // Satellite has FOUR base layers (global fallback, DEA, NSW and QLD).
  // At index 1 this warning was hidden by opaque DEA/QLD layers, even though
  // the verified polygon count was one. Insert ABOVE every basemap, but
  // restore the current primary radar to the top of the imagery stack.
  insertOfficialWarningImageryAboveBasemap(viewer.imageryLayers,imagery,getRadarLayer);
  viewer.scene.requestRender();
 }
 function openInfo(warning){
  if(!warning){panel.hidden=true;activeId="";return;}
  activeId=warning.id;
  title.textContent=warning.headline||warning.event;
  content.replaceChildren();
  if(warning.capBulletinStatus==="pending-current-source")
   textRow(content,"Source verification",
    "Polygon coordinates and validity independently verified against the current BoM Queensland warning listing and original GIS2Web-derived data. Current CAP bulletin details not verified; check the official BoM warning.");
  textRow(content,"Official warning",warning.event);
  textRow(content,"BoM product",warning.productCode||"Not verified");
  textRow(content,"Product",warning.productType==="detailed"?
   "Detailed SEQ thunderstorm (IDQ21035)":warning.productType==="regional"?
   "Regional QLD thunderstorm (IDQ21033)":"BoM severe weather");
  textRow(content,warning.capBulletinStatus==="pending-current-source"?
   "GIS polygon issued":"Issued",fmt(warning.issuedUtc));
  textRow(content,warning.capBulletinStatus==="pending-current-source"?
   "GIS polygon expires":"Expires",fmt(warning.expiresUtc));
  textRow(content,"Severity / certainty",[warning.severity,warning.certainty].filter(Boolean).join(" · "));
  textRow(content,"Warning area",warning.areaDescription);
  if(warning.hazardAssessment?.highEnd?.length)
   textRow(content,"HIGH-END hazards named in BoM warning",
    warning.hazardAssessment.highEnd.join(" · ")+(warning.productCode==="IDQ21033"?
     " — regional warning area; individual cells are not identified":""));
  textRow(content,"BoM warning details",warning.description);
  textRow(content,"Safety advice",warning.instruction);
  textRow(content,"Affected LDMGs (by LGA)",warning.ldmgStatus==="verified"?
   (warning.ldmgs??warning.lgas??[]).length?(warning.ldmgs??warning.lgas).join(" · "):
    "None intersect the published polygon":
   "Official boundary verification unavailable — not an all-clear");
  textRow(content,"Affected Queensland LGAs",warning.lgaStatus==="verified"?
   warning.lgas.length?warning.lgas.join(" · "):"None intersect the published polygon":
   "Official boundary verification unavailable — not an all-clear");
  textRow(content,"Affected disaster districts (DDMGs)",warning.ddmgStatus==="verified"?
   warning.ddmgs.length?warning.ddmgs.join(" · "):"None intersect the published polygon":
   "Official boundary verification unavailable — not an all-clear");
  textRow(content,"Intersection rule","Every genuine intersecting LDMG/LGA and DDMG, regardless of overlap size.");
  const link=document.createElement("a");
  link.href=officialUrl(warning.bulletinUrl);
  link.textContent="Read official BoM warning";link.target="_blank";link.rel="noopener noreferrer";
  content.append(link);
  panel.hidden=false;
 }
 function trimExpired(){
  const valid=warnings.filter(w=>isVerifiedActiveBomWarning(w,now()));
  const liveCells=stormCells.filter(c=>c?.official===true&&
   c.sourceProduct==="IDQ65652"&&c.productCode==="IDQ21035"&&
   Date.parse(c.expiresUtc)>now());
  if(valid.length!==warnings.length||liveCells.length!==stormCells.length){
   stormCells=liveCells;
   warnings=valid;display();renderGroupsReport();
   if(activeId&&!warnings.some(w=>w.id===activeId))openInfo(null);
   // Expiry is a source-published fact, not an inconclusive network check.
   for(const [code,p] of Object.entries(productStatuses)){
    if(p?.status==="active"&&p.expiresUtc&&Date.parse(p.expiresUtc)<=now())
      productStatuses[code]={...p,status:"no-active",count:0};
   }
   showProductStatus();
  }
 }
 async function refresh({force=false}={}){
  if(!toggle.checked||destroyed)return;
  if(pending)return pending;
  if(!force&&lastAttemptAt&&now()-lastAttemptAt<currentRefreshMs()){
   trimExpired();return;
  }
  report("Checking issued Bureau of Meteorology warning polygons…","loading");
  lastAttemptAt=now(); // Respect 15-minute cadence after timeouts as well.
  pending=(async()=>{
   try{
    const retrieve=async()=>{
     const res=await fetchImpl(SOURCE,{cache:"no-store",signal:AbortSignal.timeout(27000)});
     if(!res.ok)throw Error("Official warning transport HTTP "+res.status);
     return res.json();
    };
    let data;
    try{data=await retrieve();}
    catch(firstError){
     // iOS Safari can transiently return "Load failed" on mobile networks.
     // Retry once, without changing the 15-minute automatic cadence.
     if(!/load failed|failed to fetch|network|abort|timeout/i.test(String(
       firstError?.message??firstError)))throw firstError;
     data=await retrieve();
    }
    if(data?.schema!==SCHEMA||!Array.isArray(data.warnings)||
      !["active","no-verified-current-polygons","partial-source-unavailable"].includes(data.status))
      throw Error(data?.message||"Official CAP source unavailable");
    warnings=data.warnings.filter(w=>isVerifiedActiveBomWarning(w,now()));
    stormCells=(Array.isArray(data.stormCells)?data.stormCells:[]).filter(c=>
      c?.official===true&&c.issuer==="Bureau of Meteorology"&&
      c.productCode==="IDQ21035"&&c.sourceProduct==="IDQ65652"&&
      ["Polygon","MultiPolygon"].includes(c.geometry?.type)&&
      Number.isFinite(Date.parse(c.issuedUtc))&&Date.parse(c.issuedUtc)<=now()&&
      Number.isFinite(Date.parse(c.expiresUtc))&&Date.parse(c.expiresUtc)>now());
    stormCellSourceStatus=data.stormCellSourceStatus??"unavailable";
    sourceStatus=data.status;
    productStatuses=data.products??{};
    temporaryFailures=0;
    recordRecoveryState();
    display();renderGroupsReport();
    if(activeId)openInfo(warnings.find(w=>w.id===activeId)??null);
    showProductStatus();
   }catch(error){
    // Fail closed: no stale polygons linger under radar as current warnings.
    warnings=[];stormCells=[];stormCellSourceStatus="unavailable";sourceStatus="unavailable";productStatuses={};
    temporaryFailures=Math.min(3,temporaryFailures+1);
    locateBtn.hidden=true;display();renderGroupsReport();openInfo(null);
    // An unverified check is NOT a confirmed no-warning report.
    // Keep a neutral operational advisory, rather than an alarming red error.
    report("Unable to confirm current BoM warnings — try refresh or check BoM","warning");
   }finally{pending=null;}
  })();
  return pending;
 }
 const groupLabel=code=>code==="IDQ21035"?
    "IDQ21035 — Detailed SEQ thunderstorms":code==="IDQ21033"?
    "IDQ21033 — Regional QLD thunderstorms":code==="IDQ21037"?
    "IDQ21037 — Queensland Severe Weather Warning 1":code==="IDQ21038"?
    "IDQ21038 — Queensland Severe Weather Warning 2":code;
 function renderGroupsReport(){
  reportBody.replaceChildren();
  if(!reportDialog.open)return;
  // Every monitored official product has its own row, including a VERIFIED
  // no-current result. Never hide a clear product just because its map has
  // zero polygons, and never combine 21037 and 21038 into a generic "other".
  const codes=filter.value==="all"?WARNING_CODES:[filter.value];
  for(const code of codes){
   const subset=filterOfficialWarnings(warnings,code);
   const result=warningProductAffectedGroups(subset);
   const productStatus=productStatuses[code]?.status??"unavailable";
   const section=document.createElement("section");
   const heading=document.createElement("h3");heading.textContent=groupLabel(code);
   section.append(heading);
   const count=document.createElement("p");
   count.textContent=sourceStatus==="unavailable"||productStatus==="unavailable"?
     "Warning verification unavailable — not an all-clear":
     productStatus==="listed-active"?
       "CURRENT warning in official Queensland list — bulletin and original polygon awaiting verification":
     productStatus==="geometry-unavailable"?
       "CURRENT BoM warning — updated source polygon not yet available; LDMG/DDMG intersections cannot be calculated":
     productStatus==="no-active"?
       "No current warnings for this product — confirmed by the BoM current warnings index or latest official notice":
     productStatus==="cancelled"?
       "Cancelled by BoM · 0 active polygons":
       result.count+" active verified polygon"+(result.count===1?"":"s");
   section.append(count);
   if(productStatuses[code]?.bulletinVerification==="pending-current-source"){
    const sourceNote=document.createElement("p");
    sourceNote.textContent="Original BoM GIS warning area verified against the current Queensland warning index; current international CAP bulletin details not yet verified. Open the current BoM warning for full text.";
    section.append(sourceNote);
   }
   const highEnd=productStatuses[code]?.hazardAssessment?.highEnd??[];
   if(highEnd.length){
    const severity=document.createElement("p");
    severity.textContent="HIGH-END THUNDERSTORM HAZARDS: "+highEnd.join(" · ")+
     (code==="IDQ21033"?" — warning-area language only, no identified individual storm cells":"");
    section.append(severity);
   }
   if(code==="IDQ21035"){
    const cellLine=document.createElement("p");
    const vds=stormCells.filter(c=>c.veryDangerous===true);
    cellLine.textContent=stormCellSourceStatus==="source-verified"?
      stormCells.length+" original BoM storm-location feature(s) (IDQ65652); "+
       vds.length+" explicitly tagged VERY DANGEROUS by the cell source":
      "Individual BoM storm-cell locations (IDQ65652) not verified in this feed — "+
       "the IDQ65650 threat area is NOT a cell track";
    section.append(cellLine);
   }
   const official=productStatuses[code];
   if(official?.headline){
    const text=document.createElement("section");
    text.className="official-bom-source-details";
    const h=document.createElement("h4");h.textContent="Verified BoM warning bulletin";
    text.append(h);
    const issued=document.createElement("p");
    issued.textContent="Issued "+fmt(official.issuedUtc)+
      (official.expiresUtc?" · Expires "+fmt(official.expiresUtc):"");
    text.append(issued);
    if(code==="IDQ21035"&&/\bvery\s+dangerous\b/i.test(
       [official.headline,official.description,official.instruction].join(" ")) ){
     const caution=document.createElement("p");
     caution.textContent="BoM bulletin mentions a VERY DANGEROUS thunderstorm. "+
      "This bulletin text alone does not identify which individual cell is affected. "+
      "Only an explicit IDQ65652 cell-source designation will appear as an on-map callout.";
     text.append(caution);
    }
    for(const body of [official.headline,official.description,official.instruction]){
     if(!String(body??"").trim())continue;
     const p=document.createElement("p");p.textContent=body;
     text.append(p);
    }
    const link=officialUrl(official.bulletinUrl);
    if(link){
     const a=document.createElement("a");
     a.href=link;a.target="_blank";a.rel="noopener noreferrer";
     a.textContent="Open this official BoM warning";
     text.append(a);
    }
    section.append(text);
   }
   for(const [label,items,complete] of [
     ["LDMGs — local council disaster-management groups",result.ldmgs,result.ldmgComplete],
     ["DDMGs — district disaster-management groups",result.ddmgs,result.ddmgComplete]]){
    const title=document.createElement("h4");title.textContent=label;
    section.append(title);
    const info=document.createElement("p");
    info.textContent=productStatus==="geometry-unavailable"||productStatus==="listed-active"?
      "Current warning awaiting genuine polygon — affected LDMG/DDMG boundaries not yet available":
      productStatus==="no-active"||productStatus==="cancelled"?
      "No affected groups to list — no current warning in this product":
      !complete?"Boundary verification incomplete — affected groups may be missing":
      !result.count?"No currently verified polygon in this product":
      !items.length?"No intersecting Queensland groups reported":"";
    section.append(info);
    if(items.length){
     const list=document.createElement("ul");
     for(const name of items){
      const li=document.createElement("li");li.textContent=name;list.append(li);
     }
     section.append(list);
    }
   }
   reportBody.append(section);
  }
 }
 const onProductChange=()=>{
  display();renderGroupsReport();showProductStatus();
  if(activeId){
   const match=filterOfficialWarnings(warnings,filter.value).find(w=>w.id===activeId);
   openInfo(match??null);
  }
 };
 const openGroups=()=>{
  if(!reportDialog.open)reportDialog.showModal();
  renderGroupsReport();
 };
 const closeGroups=()=>reportDialog.close();
 const onToggle=()=>{
  if(!toggle.checked){warnings=[];stormCells=[];stormCellSourceStatus="unavailable";productStatuses={};sourceStatus="unavailable";
   geometryRecoveryPolls=0;geometryRecoverySignature="";temporaryFailures=0;
   locateBtn.hidden=true;discard();openInfo(null);renderGroupsReport();
   report("BoM warning polygons off");return;}
  void refresh({force:true});
 };
 const onLocate=()=>{
  const bounds=officialWarningBounds([
   ...filterOfficialWarnings(warnings,filter.value),
   ...(filter.value==="all"||filter.value==="IDQ21035"?stormCells:[])
  ]);
  if(!toggle.checked||!bounds||!cameraController?.setView)return;
  const target=officialWarningCameraTarget(bounds,{
   width:canvas.clientWidth||canvas.width||430,
   height:canvas.clientHeight||canvas.height||700,
   fovy:viewer.camera.frustum?.fovy
  });
  // The guardian deliberately cancels bare Cesium flyTo() calls and restores
  // its prior state. Keep the authoritative navigation state in sync.
  if(target)cameraController.setView(target);
 };
 const onRefresh=()=>{void refresh({force:true});};
 const onClose=()=>openInfo(null);
 // Map camera captures and stops canvas pointer events. Window capture,
 // matching the proven flood/outage handler, works on Safari and desktop.
 const mapContainer=$("cesiumContainer");
 let pointerStart=null;
 const blocked=e=>e.target?.closest?.("#nav,#controlSidebar,#officialBomWarningInfo,#officialBomWarningGroupsReport,#floodRoadClosureInfo,#powerOutageInfo,#riverGaugeInfo,#qfdTechnicalRescueInfo");
 const down=e=>{
  if(!toggle.checked||!warnings.length||!mapContainer?.contains(e.target)||
   blocked(e)||(e.button!==undefined&&e.button!==0))return;
  pointerStart={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now(),moved:false};
 };
 const move=e=>{
  if(pointerStart?.id!==e.pointerId)return;
  if(Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>12)
   pointerStart.moved=true;
 };
 const clearPointer=e=>{if(pointerStart?.id===e.pointerId)pointerStart=null;};
 const up=e=>{
  if(!pointerStart||pointerStart.id!==e.pointerId)return;
  const p=pointerStart;pointerStart=null;
  if(!toggle.checked||!warnings.length||p.moved||
   Math.hypot(p.x-e.clientX,p.y-e.clientY)>12||
   performance.now()-p.time>700||blocked(e)||reportDialog.open)return;
  const rect=canvas.getBoundingClientRect();
  if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)return;
  const xy=new CesiumRef.Cartesian2(e.clientX-rect.left,e.clientY-rect.top);
  // Existing operational incident markers take selection priority.
  const picked=viewer.scene.drillPick(xy,8,18,18)||[];
  if(picked.some(x=>{const entity=x.id??x.primitive?.id;
   return entity?.stormTrackerRoadClosureId||entity?.stormTrackerPowerOutageId||
    entity?.stormTrackerRiverGaugeId||entity?.stormTrackerRainGaugeId||
    entity?.stormTrackerQfdRescueId;}))return;
  const ray=viewer.camera.getPickRay(xy);
  const hit=ray?viewer.scene.globe.pick(ray,viewer.scene):null;
  if(!hit)return;
  const loc=CesiumRef.Cartographic.fromCartesian(hit);
  const longitude=CesiumRef.Math.toDegrees(loc.longitude);
  const latitude=CesiumRef.Math.toDegrees(loc.latitude);
  const selected=[...filterOfficialWarnings(warnings,filter.value),
    ...(filter.value==="all"||filter.value==="IDQ21035"?stormCells:[])];
  if(officialWarningAtPoint(selected,longitude,latitude)){
   // Identical report and selected-product scope as the existing button.
   openGroups();
  }
 };
 toggle.addEventListener("change",onToggle);
 filter.addEventListener("change",onProductChange);
 reportButton.addEventListener("click",openGroups);
 reportClose.addEventListener("click",closeGroups);
 refreshBtn.addEventListener("click",onRefresh);
 locateBtn.addEventListener("click",onLocate);
 dismiss.addEventListener("click",onClose);
 window.addEventListener("pointerdown",down,{capture:true,passive:true});
 window.addEventListener("pointermove",move,{capture:true,passive:true});
 window.addEventListener("pointerup",up,{capture:true,passive:true});
 window.addEventListener("pointercancel",clearPointer,{capture:true,passive:true});
 timer=setInterval(()=>{
  trimExpired();
  if(toggle.checked&&now()-lastAttemptAt>=currentRefreshMs())void refresh();
 },60000);
 locateBtn.hidden=true;
 report("BoM warning polygons off");
 return {refresh,destroy(){
  destroyed=true;if(timer)clearInterval(timer);discard();warnings=[];stormCells=[];openInfo(null);
  toggle.removeEventListener("change",onToggle);
  filter.removeEventListener("change",onProductChange);
  reportButton.removeEventListener("click",openGroups);
  reportClose.removeEventListener("click",closeGroups);
  if(reportDialog.open)reportDialog.close();
  refreshBtn.removeEventListener("click",onRefresh);
 locateBtn.removeEventListener("click",onLocate);
  dismiss.removeEventListener("click",onClose);
  window.removeEventListener("pointerdown",down,true);
  window.removeEventListener("pointermove",move,true);
  window.removeEventListener("pointerup",up,true);
  window.removeEventListener("pointercancel",clearPointer,true);
 }};
}
