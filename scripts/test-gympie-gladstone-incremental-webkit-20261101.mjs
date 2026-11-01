import assert from "node:assert/strict";
import {webkit} from "playwright";
// Run against the exact packaged runtime, on an iPhone-sized WebKit engine,
// using the real BoM sources and existing production-origin relay permissions.
const browser=await webkit.launch({headless:true});
const page=await browser.newPage({
 viewport:{width:390,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true
});
page.setDefaultTimeout(180000);
const errors=[],navigations=[];
page.on("pageerror",error=>errors.push(String(error)));
page.on("framenavigated",frame=>navigations.push(frame.url()));
page.on("console",msg=>{
 if(/incomplete BoM|WMTS.*unavailable|webglcontextlost/i.test(msg.text()))
   errors.push(msg.text().slice(0,500));
});
await page.route("https://blakesmith-intel.github.io/StormTracker/**",async route=>{
 const uri=new URL(route.request().url());
 const local="http://127.0.0.1:8137"+uri.pathname.replace("/StormTracker","")+uri.search;
 try{
  const res=await fetch(local);
  await route.fulfill({status:res.status,body:Buffer.from(await res.arrayBuffer()),
    contentType:res.headers.get("content-type")||"application/octet-stream"});
 }catch{await route.abort("failed");}
});
async function stable(region){
 await page.waitForFunction(region=>{
  const id=x=>document.getElementById(x);
  const label=id("hybridFrameLabel")?.textContent??"";
  return id("radarSite")?.value===region&&!id("radarSite").disabled &&
    /\b\d+\/\d+/.test(label) && typeof window.__stormtrackerRadarQaCheck==="function";
 },region,{timeout:180000});
 return await page.evaluate(()=>{
  const id=x=>document.getElementById(x);
  return {region:id("radarSite")?.value,label:id("hybridFrameLabel")?.textContent,
   status:id("status")?.textContent,diagnostic:window.__stormtrackerRadarDiagnostics?.(),
   pressure:window.__stormtrackerRelayPressureDiagnostics?.(),
   graphics:window.__stormtrackerGraphicsDiagnostics?.()};
 });
}
try{
 await page.goto("https://blakesmith-intel.github.io/StormTracker/live3d-operational-v9.html?qaIncrementalRadar=1",
  {waitUntil:"domcontentloaded",timeout:60000});
 await page.locator("#cesiumContainer .cesium-widget canvas").waitFor({state:"attached"});
 // Two previously failing locations plus five geographically and operationally
 // different radars exercise the same system-wide renderer and scheduler.
 for(const region of ["08","23","66","106","56","107","36"]){
  await page.locator("#radarSite").selectOption(region);
  const baseline=await stable(region);
  const baselineCount=Number((baseline.label||"").split("/")[1]);
  assert(baselineCount>=1,"No real BoM frame at "+region);
  assert(baseline.pressure?.peakActive>0 && baseline.pressure.peakActive<=2,
    "Radar WMTS source not protected by shared two-request limit in review path");
  // The immediately preceding authoritative source audit verifies six fully
  // readable tilesets for these sites; 5/5 in the browser is then a real
  // application defect, not a missing BoM source observation.
  if(["08","23","66"].includes(region))
    assert.equal(baselineCount,6,
      "BoM publishes six source-complete frames but UI loaded "+baseline.label+
      " at radar "+region);
  assert.equal(baseline.diagnostic?.lifecycle?.bootCount,1,
    "An unexpected page restart occurred before refresh checks");
  const initialCanvas=await page.locator("#cesiumContainer canvas").count();
  const repeatChecks=(region==="08"||region==="23")?4:2;
  for(let check=0;check<repeatChecks;check++){
   await page.evaluate(async()=>window.__stormtrackerRadarQaCheck());
   const snapshot=await stable(region);
   assert.equal(snapshot.diagnostic?.lifecycle?.bootCount,1,
     "Full application reload during radar auto-poll at "+region);
   assert.equal(snapshot.diagnostic?.lifecycle?.webglLossCount,0,
     "WebGL context loss during radar auto-poll at "+region);
   assert.equal(await page.locator("#cesiumContainer canvas").count(),initialCanvas,
     "Canvas was replaced during radar auto-poll at "+region);
   assert(snapshot.diagnostic?.lifecycle?.events.length<=48,
     "Unbounded lifecycle-memory audit growth");
   if(snapshot.graphics&&baseline.graphics)
    assert(snapshot.graphics.imageryLayers<=baseline.graphics.imageryLayers+8,
      "Cesium imagery layers grew without a bound at "+region);
   const count=Number((snapshot.label||"").split("/")[1]);
   assert(count<=36 && count>=1,
     "Radar replay count unbounded or empty during repeated refreshes");
   console.log("INCREMENTAL_REAL_MOBILE_CHECK",
    JSON.stringify({region,check,frames:snapshot.label,
      refresh:snapshot.diagnostic?.automatic,
      incremental:snapshot.diagnostic?.incremental,
      memory:snapshot.diagnostic?.lifecycle?.memory,
      sourcePressure:snapshot.pressure,
      tileFailures:snapshot.diagnostic?.tileFailures?.slice(-4),
      imageryLayers:snapshot.graphics?.imageryLayers}));
  }
 }
 assert(navigations.length===1,
  "Unexpected browser document navigations during source polls: "+navigations.join(","));
 console.log("INCREMENTAL_MULTI_REGION_WEBKIT_PASS");
}catch(error){
 console.log("INCREMENTAL_MULTI_REGION_WEBKIT_FAIL",
   JSON.stringify({error:String(error),errors:errors.slice(-12),navigations}));
 await page.screenshot({path:"/tmp/incremental-radar-webkit-failure.png"}).catch(()=>{});
 throw error;
}finally{await browser.close();}
