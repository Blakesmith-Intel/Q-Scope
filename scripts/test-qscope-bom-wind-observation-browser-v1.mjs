// Actual Chromium/WebKit layout and interactions against the assembled root.
// Only third-party heavyweight rendering is stubbed; all wind UI, listeners,
// severe-weather DOM hierarchy and CSS come from the generated Pages artifact.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {chromium,webkit} from "playwright";

const mobile=process.env.STORMTRACKER_BROWSER==="mobile";
const browser=await (mobile?webkit:chromium).launch({headless:true});
const context=await browser.newContext(mobile?
  {viewport:{width:390,height:844},isMobile:true,hasTouch:true}:
  {viewport:{width:1280,height:800}});
const page=await context.newPage();
const root="http://127.0.0.1:8137/";
try {
 const compiled=readFileSync("_site/live3d-operational-v9.html","utf8");
 const runtime=readFileSync("_site/src/live3d-operational-v9.js","utf8");
 assert(runtime.includes("initialiseOperationalBomWindObservations({viewer})"));
 assert(runtime.includes("qscopeOperationalWindEvents.queueWindow(mode,frames.length)"));
 assert(runtime.includes("initialiseOperationalSignificantRainfall({viewer})"));
 assert(runtime.includes("PUBLISHED_PRODUCTION_RUNTIME"));
 assert(compiled.includes('id="showBomWindObservations"'));
 assert(compiled.includes('id="bomWindGustReport"'));
 assert(compiled.includes('id="resetButton"'));
 assert(compiled.includes('id="officialBomWarningProduct"'));
 assert(compiled.includes('id="showRiverGauges"'));
 assert(compiled.includes('id="showSignificantRainfall"'));
 // The full operational script depends on genuine radar and Cesium sources;
 // remove scripts ONLY in this headless DOM test, not in the built artifact.
 await page.route("**/live3d-operational-v9.html*",route=>route.fulfill({
  status:200,contentType:"text/html",
  body:compiled.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
 }));
 await page.route("https://unpkg.com/**",route=>route.abort());
 await page.goto(root+"live3d-operational-v9.html?wind-observation-ui-qa",
  {waitUntil:"domcontentloaded"});
 const rootIds=["severeWeatherDetails","showBomWindObservations",
  "bomWindGustReport","bomWindGustReportRows","bomWindObservationInfo",
  "showOfficialBomWarnings","showRiverGauges","showSignificantRainfall",
  "resetButton","officialBomWarningProduct"];
 for(const id of rootIds)
  assert.equal(await page.locator("#"+id).count(),1,"Existing and new DOM IDs must remain unique: "+id);
 const section=page.locator("#severeWeatherDetails");
 assert.equal(await section.locator("#showBomWindObservations").count(),1,
  "Observed wind must be within Severe Weather, not Rainfall or Community Impacts");
 await section.locator("summary").first().click();
 assert.equal(await section.locator("#showBomWindObservations").count(),1);
 await page.evaluate(async()=>{
  class MockSource{
   constructor(name){
    this.name=name;this.show=false;
    const items=[];
    this.entities={values:items,suspendEvents(){},resumeEvents(){},
     removeAll(){items.length=0;},
     add(obj){const entity={...obj};items.push(entity);return entity;}};
   }
  }
  const container=document.getElementById("mapPanel")??document.body;
  const canvas=document.createElement("canvas");
  canvas.style.cssText="position:fixed;left:0;top:0;width:100px;height:100px;pointer-events:none";
  container.append(canvas);
  const scene={canvas,requestRender(){},
   drillPick:()=>[],pick:()=>({id:window._windSource?.entities.values[0]})};
  const viewer={scene,container,dataSources:{add(s){window._windSource=s;}}};
  const CesiumRef={CustomDataSource:MockSource,
   Cartesian3:{fromDegrees:(lon,lat)=>({lon,lat})},
   Cartesian2:class{constructor(x,y){this.x=x;this.y=y}},
   VerticalOrigin:{BOTTOM:1},HeightReference:{CLAMP_TO_GROUND:1}};
  const now=Date.now();
  const iso=new Date(now-300000).toISOString();
  const observations=[
   {wmo:"94576",stationId:"040913",name:"Brisbane",latitude:-27.48,longitude:153.04,
    observedUtc:iso,gustKmh:130,todayMaximumGustKmh:140,sustainedKmh:75,windAveragingMinutes:10,current:true},
   {wmo:"94578",stationId:"040842",name:"Brisbane Airport",latitude:-27.39,longitude:153.13,
    observedUtc:iso,gustKmh:96,todayMaximumGustKmh:100,sustainedKmh:38,windAveragingMinutes:10,current:true},
   {wmo:"94579",stationId:"040100",name:"Gale Station",latitude:-27.1,longitude:152.7,
    observedUtc:iso,gustKmh:60,todayMaximumGustKmh:60,sustainedKmh:70,windAveragingMinutes:10,current:true},
   {wmo:"94580",stationId:"040101",name:"Below Threshold",latitude:-27.2,longitude:152.8,
    observedUtc:iso,gustKmh:25,todayMaximumGustKmh:null,sustainedKmh:18,windAveragingMinutes:10,current:true}
  ];
  window._windRequests=[];
  const fetchImpl=async url=>{
   window._windRequests.push(String(url));
   if(String(url).includes("?wmo="))throw Error("Unexpected per-station history request");
   return {ok:true,status:200,async json(){
    return {format:"QScopeBoMWindObservationsV1",
     highestGustPeriod:"since-midnight-aest",observations,
     checkedAt:new Date().toISOString()};
   }};
  };
  const mod=await import("/src/context-layers/qscope-bom-wind-observations-operational-v1.js");
  window.qscopeWindUI=mod.initialiseOperationalBomWindObservations({
   viewer,CesiumRef,fetchImpl,refreshMs:600000
  });
 });
 await page.locator("#showBomWindObservations").check();
 await page.waitForFunction(()=>window.qscopeWindUI?.qualifying.length===3);
 assert.equal(await page.locator("#bomWindObservationsStatus").isVisible(),true);
 assert.match(await page.locator("#bomWindObservationsStatus").innerText(),/3 qualifying/);
 assert.equal(await page.evaluate(()=>window._windSource.entities.values.length),3);
 assert.equal(await page.locator("#showOfficialBomWarnings").count(),1);
 await page.locator("#openBomWindGustReport").click();
 const dialog=page.locator("#bomWindGustReport");
 assert.equal(await dialog.evaluate(el=>el.open),true);
 assert.match(await dialog.innerText(),/Highest wind gust today|highest gust today/i);
 assert.equal(await page.locator("#bomWindGustReportRows li").count(),4,
  "Report must include ALL original BoM observations, even below map thresholds");
 assert.match(await dialog.innerText(),/Below Threshold/);
 assert.match(await dialog.innerText(),/Unavailable/);
 assert.doesNotMatch(await dialog.innerText(),/rolling 24h|sample peak|samples/i);
 assert.equal(await page.evaluate(()=>window._windRequests.length),1,
  "Opening report must not trigger per-station history fetches");
 const gusts=await page.locator("#bomWindGustReportRows .rainfall-report-mm").allInnerTexts();
 assert.deepEqual(gusts.slice(0,3),["140 km/hr","100 km/hr","60 km/hr"]);
 const box=await dialog.boundingBox();
 assert(box,"Wind report must render");
 const viewport=page.viewportSize();
 assert(box.x>=-2&&box.y>=-2&&
  box.x+box.width<=viewport.width+3&&box.y+box.height<=viewport.height+3,
  "Wind report must fit mobile WebKit and desktop Chromium viewport");
 await page.locator("#closeBomWindGustReport").click();
 assert.equal(await dialog.evaluate(el=>el.open),false);
 // Simulate an actual stationary map tap routed to Cesium's picked station.
 await page.evaluate(()=>{
  window.dispatchEvent(new PointerEvent("pointerdown",{
   bubbles:true,pointerId:7,clientX:30,clientY:30,button:0}));
  window.dispatchEvent(new PointerEvent("pointerup",{
   bubbles:true,pointerId:7,clientX:30,clientY:30,button:0}));
 });
 assert.equal(await page.locator("#bomWindObservationInfo").isVisible(),true,
  "Tapping a measured ground station should reveal source-labelled details");
 assert.match(await page.locator("#bomWindObservationInfo").innerText(),/BoM WMO station/);
 await page.locator("#closeBomWindObservationInfo").click();
 await page.locator("#showBomWindObservations").uncheck();
 assert.equal(await page.evaluate(()=>window._windSource.show),false);
 console.log("PASS real "+(mobile?"WebKit iPhone":"Chromium desktop")+
  " assembled severe-weather controls, preserved warning/rain/flood/nav,"+
  " station map interaction, BoM direct maxima (all stations), no history fanout and viewport");
}finally{
 await page.evaluate(()=>window.qscopeWindUI?.stop?.()).catch(()=>{});
 await browser.close();
}
