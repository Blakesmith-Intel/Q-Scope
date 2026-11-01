import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const page=await browser.newPage({viewport:{width:1440,height:850}});
const errors=[],failedModules=[];
page.on("pageerror",e=>errors.push(String(e)));
page.on("response",r=>{if(r.status()>=400&&/\.js(?:\?|$)/.test(r.url()))
 failedModules.push({status:r.status(),url:r.url()})});
await page.route("https://blakesmith-intel.github.io/StormTracker/**",async route=>{
 const url=new URL(route.request().url());
 const local="http://127.0.0.1:8137"+url.pathname.replace("/StormTracker","")+url.search;
 try{
  const res=await fetch(local);
  await route.fulfill({status:res.status,body:Buffer.from(await res.arrayBuffer()),
   contentType:res.headers.get("content-type")||"application/octet-stream"});
 }catch(e){await route.abort("failed")}
});
await page.route(/\/StormTracker\/src\/live3d-operational-v9\.js/,async route=>{
 const resp=await route.fetch(),text=(await resp.text());
 if(!text.includes("const scene = viewer.scene;")||
    !text.includes("// The verified browser-source QA viewer must never call Cesium.camera.flyTo;"))
  throw Error("Cesium camera/controller instrumentation drift");
 await route.fulfill({response:resp,
  body:text.replace("const scene = viewer.scene;",
    "const scene = viewer.scene; globalThis.__STORMTRACKER_QA_VIEWER=viewer;")
   .replace("// The verified browser-source QA viewer must never call Cesium.camera.flyTo;",
    "globalThis.__STORMTRACKER_QA_CAMERA=mapCamera;\n// The verified browser-source QA viewer must never call Cesium.camera.flyTo;"),
  contentType:"application/javascript"});
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
 await page.goto("https://blakesmith-intel.github.io/StormTracker/live3d-operational-v9.html?qaFtpAep=20261019",
  {waitUntil:"domcontentloaded",timeout:45000});
 await page.waitForSelector("#cesiumContainer .cesium-widget canvas",{state:"attached",timeout:45000});
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
 // A real map gesture cancels StormTracker camera handover/navigation before
 // following a station away from the currently selected radar location.
 await page.mouse.click(1210,430);
 await page.waitForTimeout(250);
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
 await page.waitForFunction(()=>{
  const v=window.__STORMTRACKER_QA_VIEWER,C=window.Cesium;
  const marker=v.dataSources._dataSources
    .filter(s=>String(s.name).startsWith("rainfall-severity-"))
    .flatMap(s=>s.entities.values)
    .find(e=>e.stormTrackerRainGaugeId==="QA19501");
  if(!marker)return false;
  const p=v.scene.cartesianToCanvasCoordinates(marker.position.getValue(C.JulianDate.now()));
  const b=v.scene.canvas.getBoundingClientRect();
  if(!p||p.x<25||p.y<25||p.x>b.width-25||p.y>b.height-25)return false;
  return v.scene.drillPick(new C.Cartesian2(p.x,p.y),24,42,42)
   .some(hit=>hit?.id?.stormTrackerRainGaugeId==="QA19501");
 },null,{timeout:30000});
 const pos=await page.evaluate(()=>{
  const v=window.__STORMTRACKER_QA_VIEWER,C=window.Cesium;
  const e=v.dataSources._dataSources
    .filter(s=>String(s.name).startsWith("rainfall-severity-"))
    .flatMap(s=>s.entities.values)
    .find(e=>e.stormTrackerRainGaugeId==="QA19501");
  const p=v.scene.cartesianToCanvasCoordinates(e.position.getValue(C.JulianDate.now()));
  const b=v.scene.canvas.getBoundingClientRect();
  return p?{x:b.left+p.x,y:b.top+p.y,localX:p.x,localY:p.y,
   hits:v.scene.drillPick(new C.Cartesian2(p.x,p.y),24,42,42).map(z=>z?.id?.id??z?.id??"").slice(0,9),
   canvas:{left:b.left,top:b.top,right:b.right,bottom:b.bottom}}:null;
 });
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
 await page.screenshot({path:"/tmp/v10-ftp-aep-cesium-qa.png"}).catch(()=>{});
}catch(error){
 console.log("FTP_AEP_ACTUAL_V10_CESIUM_MAP_FAIL",JSON.stringify({error:String(error),errors:errors.slice(0,8),failedModules}));
 await page.screenshot({path:"/tmp/v10-ftp-aep-cesium-qa.png"}).catch(()=>{});
 throw error;
}finally{await browser.close()}
