import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const page=await browser.newPage({viewport:{width:1440,height:850}});
const errors=[],failedModules=[];
page.on("pageerror",e=>errors.push(String(e)));
page.on("response",r=>{if(r.status()>=400&&/\.js(?:\?|$)/.test(r.url()))
 failedModules.push({status:r.status(),url:r.url()})});
// Serve and instrument the SAME staged Q-Scope build, not the obsolete
// /StormTracker/ public origin. The original real Cesium and marker checks remain.
let instrumented=false;
const localErrors=[];
await page.route("https://blakesmith-intel.github.io/Q-Scope/**",async route=>{
 const url=new URL(route.request().url());
 const local="http://127.0.0.1:8137"+url.pathname.replace("/Q-Scope","")+url.search;
 try{
  const res=await fetch(local);
  let body=Buffer.from(await res.arrayBuffer());
  if(url.pathname.endsWith("/src/live3d-operational-v9.js")){
   const text=body.toString("utf8");
   const scene="const scene = viewer.scene;";
   const camera="// The verified browser-source QA viewer must never call Cesium.camera.flyTo;";
   if(!res.ok||!text.includes(scene)||!text.includes(camera))
    throw Error("Staged Cesium camera/controller instrumentation drift");
   body=Buffer.from(text.replace(scene,scene+" globalThis.__STORMTRACKER_QA_VIEWER=viewer;")
    .replace(camera,"globalThis.__STORMTRACKER_QA_CAMERA=mapCamera;\n"+camera));
   instrumented=true;
  }
  await route.fulfill({status:res.status,body,
   contentType:res.headers.get("content-type")||"application/octet-stream"});
 }catch(e){localErrors.push(String(e));await route.abort("failed")}
});
// Exercise the production saved-camera restoration path so asynchronous
// startup cannot overwrite the operator-selected viewport.
await page.addInitScript(()=>{
 sessionStorage.setItem("StormTracker.operatorRadarViewport.v1",JSON.stringify({
  radarSiteId:"66",savedAt:Date.now(),
  camera:{longitude:144.6,latitude:-25.91,targetHeight:0,range:115000,
   heading:0,pitch:-Math.PI/2+0.01}
 }));
});
const at=new Date().toISOString();
const station=(id,name,latitude,longitude,period)=>({
 id,name,latitude,longitude,region:"seast",period,mm:50,band:"orange",sourceCreatedAt:at});
const source={format:"StormTrackerSignificantRainfallV1",checkedAt:at,regional:[],failed:[],
 observations:{since9am:[],last24Hours:[],lastHour:[
 station("QA19501","QA Adavale rainfall station",-25.91,144.6,"lastHour"),
 station("QA19502","QA Gold Coast rainfall station",-28.002,153.424,"lastHour")]}};
await page.route("**/qld-significant-rainfall",route=>route.fulfill({status:200,
 contentType:"application/json",headers:{"Access-Control-Allow-Origin":"*"},
 body:JSON.stringify(source)}));
try{
 await page.goto("https://blakesmith-intel.github.io/Q-Scope/live3d-operational-v9.html?qaFtpAep=20261019",
  {waitUntil:"domcontentloaded",timeout:45000});
 await page.waitForSelector("#cesiumContainer .cesium-widget canvas",{state:"attached",timeout:45000});
  assert(instrumented,"Staged Q-Scope entry must be instrumented, never the old public origin");
  await page.waitForFunction(()=>!!window.__STORMTRACKER_QA_VIEWER&&!!window.__STORMTRACKER_QA_CAMERA,null,{timeout:15000});
 // The approved four-section operator layout starts collapsed. Navigate
 // to the existing Rainfall Observations section like an actual operator;
 // never make operational controls permanently visible just for CI.
 const rainfallDisclosure=page.locator("#rainfallObservationsDetails");
 if(!(await rainfallDisclosure.evaluate(element=>element.open))) {
   await page.locator("#rainfallObservationsDetails > summary").click();
 }
 await page.waitForFunction(()=>document.querySelector("#rainfallObservationsDetails")?.open===true);
 await page.locator("#significantRainfallPeriod").selectOption("lastHour");
 await page.locator("#showSignificantRainfall").check();
 await page.waitForFunction(()=>{
  const viewer=window.__STORMTRACKER_QA_VIEWER;
  const markers=(viewer?.dataSources?._dataSources??[])
   .filter(x=>String(x.name).startsWith("rainfall-severity-"))
   .flatMap(x=>x.entities.values);
  return markers.length===2 &&
    markers.some(x=>x.stormTrackerRainGaugeId==="QA19501");
 },null,{timeout:40000});
 // A click does not invoke camera onInteraction. Verify a real pan.
 const bounds=await page.locator("#cesiumContainer .cesium-widget canvas").boundingBox();
 assert(bounds&&bounds.width>100&&bounds.height>100);
 const dragX=bounds.x+bounds.width*0.72,dragY=bounds.y+bounds.height*0.55;
 const beforeDrag=await page.evaluate(()=>window.__STORMTRACKER_QA_CAMERA.getState());
 await page.mouse.move(dragX,dragY);
 await page.mouse.down();
 await page.mouse.move(dragX+36,dragY+12,{steps:5});
 await page.mouse.up();
 await page.waitForFunction(before=>{
  const state=window.__STORMTRACKER_QA_CAMERA.getState();
  return Math.abs(state.longitude-before.longitude)>1e-6||
   Math.abs(state.latitude-before.latitude)>1e-6;
 },beforeDrag,{timeout:15000});
 console.log("AEP_REAL_OPERATOR_DRAG_PASS");
 const atXY=await page.evaluate(()=>{
  const v=window.__STORMTRACKER_QA_VIEWER,C=window.Cesium;
  const controller=window.__STORMTRACKER_QA_CAMERA;
  if(!controller?.setView||!controller?.getState)
   throw Error("StormTracker operator-owned camera controller unavailable");
  const e=v.dataSources._dataSources
    .filter(s=>String(s.name).startsWith("rainfall-severity-"))
    .flatMap(s=>s.entities.values)
    .find(e=>e.stormTrackerRainGaugeId==="QA19501");
  // Native camera.setView is intentionally reverted every 250 ms by
  // StormTracker's camera guardian. Use the exact operator navigation API.
  controller.setView({
   longitude:144.6,latitude:-25.91,targetHeight:0,range:115000,
   heading:0,pitch:-Math.PI/2+0.01
  });
  v.scene.requestRender();
  return e.id;
 });
 assert(/QA19501/.test(atXY));
 // Locate the actual terrain-clamped, bottom-origin billboard using
 // real Cesium drillPick; no injected hits, fake entities or bypassed assertions.
 let pos;
 try{
  const handle=await page.waitForFunction(()=>{
   const v=window.__STORMTRACKER_QA_VIEWER,C=window.Cesium;
   const state=window.__STORMTRACKER_QA_CAMERA.getState();
   if(Math.abs(state.longitude-144.6)>0.01||Math.abs(state.latitude+25.91)>0.01)return false;
   const e=v.dataSources._dataSources
    .filter(s=>String(s.name).startsWith("rainfall-severity-"))
    .flatMap(s=>s.entities.values).find(e=>e.stormTrackerRainGaugeId==="QA19501");
   if(!e)return false;
   const original=e.position.getValue(C.JulianDate.now());
   const carto=C.Cartographic.fromCartesian(original);
   const height=v.scene.globe.getHeight(carto);
   const positions=[original];
   if(Number.isFinite(height))positions.unshift(C.Cartesian3.fromRadians(carto.longitude,carto.latitude,height));
   const b=v.scene.canvas.getBoundingClientRect();
   v.scene.requestRender();
   for(const point of positions){
    const p=v.scene.cartesianToCanvasCoordinates(point);
    if(!p)continue;
    for(const dy of [-20,-10,-30,0,10]){
     const x=p.x,y=p.y+dy;
     if(x<25||y<25||x>b.width-25||y>b.height-25)continue;
     if(document.elementFromPoint(b.left+x,b.top+y)!==v.scene.canvas)continue;
     const hits=v.scene.drillPick(new C.Cartesian2(x,y),24,28,28);
     if(hits.some(hit=>hit?.id?.stormTrackerRainGaugeId==="QA19501"))
      return {x:b.left+x,y:b.top+y,localX:x,localY:y,
       hits:hits.map(z=>z?.id?.id??z?.id??"").slice(0,9),
       canvas:{left:b.left,top:b.top,right:b.right,bottom:b.bottom},terrainHeight:height};
    }
   }
   return false;
  },null,{timeout:45000,polling:250});
  pos=await handle.jsonValue();
  await handle.dispose();
 }catch(error){
  const diagnostic=await page.evaluate(()=>{
   const v=window.__STORMTRACKER_QA_VIEWER,C=window.Cesium;
   const e=v.dataSources._dataSources.flatMap(s=>s.entities.values)
    .find(e=>e.stormTrackerRainGaugeId==="QA19501");
   const original=e?.position.getValue(C.JulianDate.now());
   const carto=original&&C.Cartographic.fromCartesian(original);
   return {controller:window.__STORMTRACKER_QA_CAMERA.getState(),
    camera:C.Cartographic.fromCartesian(v.camera.positionWC),
    projected:original&&v.scene.cartesianToCanvasCoordinates(original),
    terrainHeight:carto&&v.scene.globe.getHeight(carto),
    canvas:v.scene.canvas.getBoundingClientRect().toJSON(),
    rainfallStatus:document.getElementById("significantRainfallStatus")?.textContent,
    markerShow:e?.isShowing,markerName:e?.name,globeTilesLoaded:v.scene.globe.tilesLoaded};
  }).catch(e=>({diagnosticError:String(e)}));
  console.log("AEP_RENDERED_MARKER_PICK_FAIL",JSON.stringify(diagnostic));
  throw error;
 }
 assert(pos);
 assert(pos.x>=pos.canvas.left&&pos.x<pos.canvas.right&&
  pos.y>=pos.canvas.top&&pos.y<pos.canvas.bottom,
  "Rain gauge marker must be inside actual Cesium map canvas before user click");
 console.log("AEP_MARKER_PROJECTED_PICK",JSON.stringify(pos));
 await page.evaluate(()=>{
  window.__STORMTRACKER_QA_POINTER_TRACE=[];
  for(const type of ["pointerdown","pointerup","pointercancel","click"]){
   window.addEventListener(type,event=>{
    window.__STORMTRACKER_QA_POINTER_TRACE.push({
     type,pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY,
     target:event.target?.tagName,defaultPrevented:event.defaultPrevented,
     at:performance.now(),buttons:event.buttons,button:event.button
    });
   },{capture:true,once:false});
  }
 });
 // Deliberately hold down longer than the historical 800 ms cutoff;
 // genuine events are sometimes queued this long when WebGL is saturated.
 await page.mouse.move(pos.x,pos.y);
 await page.mouse.down();
 await page.waitForTimeout(1650);
 await page.mouse.up();
 const pointerTrace=await page.evaluate(()=>window.__STORMTRACKER_QA_POINTER_TRACE||[]);
 console.log("AEP_ACTUAL_USER_POINTER_TRACE",JSON.stringify(pointerTrace));
 try{
  await page.waitForFunction(()=>document.querySelector("#significantRainfallInfo")?.hidden===false,null,{timeout:12000});
 }catch(error){
  const detail=await page.evaluate(p=>{
   const v=window.__STORMTRACKER_QA_VIEWER,C=window.Cesium;
   const hit=v.scene.drillPick(new C.Cartesian2(p.localX,p.localY),24,42,42);
   return {domTarget:document.elementFromPoint(p.x,p.y)?.outerHTML.slice(0,300),
     picked:hit.map(x=>x?.id?.id??x?.id??"").slice(0,9),
     rainfallStatus:document.getElementById("significantRainfallStatus")?.textContent,
     popupHidden:document.getElementById("significantRainfallInfo")?.hidden,
     cameraCartographic:C.Cartographic.fromCartesian(v.camera.position),
     viewerCanvas:v.scene.canvas.getBoundingClientRect().toJSON()};
  },pos);
  console.log("AEP_MAP_PICK_DIAGNOSTIC",JSON.stringify(detail));
  throw error;
 }
 const actual=await page.evaluate(()=>{
  const v=window.__STORMTRACKER_QA_VIEWER;
  return {popup:document.getElementById("significantRainfallInfoRows")?.textContent,
  title:document.getElementById("significantRainfallInfoTitle")?.textContent,
  status:document.getElementById("significantRainfallStatus")?.textContent,
  visibleMarkerCount:v.dataSources._dataSources
    .filter(x=>String(x.name).startsWith("rainfall-severity-"))
    .reduce((total,x)=>total+x.entities.values.length,0),
  nationalPrimary:globalThis.__STORMTRACKER_NATIONAL_MOSAIC_PRIMARY===true,
  noFtpFirst:globalThis.__STORMTRACKER_FTP_FIRST!==true,cesium:!!window.Cesium}
 });
 assert(actual.title.includes("Adavale"));
 assert(actual.popup.includes("50.0 mm"));
 assert(actual.popup.includes("Unusual for this area"),"Plain-English local rarity must appear");
 assert(actual.popup.includes("1 in 10"),"Explain 10% AEP using 1 in 10 annual chance");
 assert(actual.popup.includes("QA19501"));
 assert(actual.nationalPrimary&&actual.noFtpFirst,"Production viewer must use national-first radar policy");
 assert.equal(actual.visibleMarkerCount,2,"Both genuine 50mm gauge amounts must display, even when one is less rare locally");
 assert.deepEqual(failedModules,[],"Missing source module after staged Pages build");
 assert.deepEqual(errors,[],"Uncaught production app JS errors");
 console.log("FTP_AEP_ACTUAL_V10_CESIUM_MAP_PASS",JSON.stringify({actual,position:pos}));
 await page.screenshot({path:"/tmp/v10-ftp-aep-cesium-qa.png",timeout:10000}).catch(()=>{});
}catch(error){
 console.log("FTP_AEP_ACTUAL_V10_CESIUM_MAP_FAIL",JSON.stringify({error:String(error),errors:errors.slice(0,8),failedModules,localErrors,instrumented}));
 await page.screenshot({path:"/tmp/v10-ftp-aep-cesium-qa.png",timeout:10000}).catch(()=>{});
 throw error;
}finally{await browser.close()}
