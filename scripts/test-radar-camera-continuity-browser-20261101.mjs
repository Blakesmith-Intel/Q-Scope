import assert from "node:assert/strict";
import {chromium} from "playwright";
// End-to-end: an operator positioned at Longreach must remain there while
// loading the latest genuine radar data and when the same Safari tab reloads.
const browser=await chromium.launch({headless:true,args:[
 "--no-sandbox","--disable-dev-shm-usage","--use-gl=angle",
 "--use-angle=swiftshader","--enable-unsafe-swiftshader"
]});
const context=await browser.newContext({
 viewport:{width:390,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true
});
const page=await context.newPage();
const errors=[];
page.on("pageerror",e=>errors.push(String(e)));
await page.route("https://blakesmith-intel.github.io/StormTracker/**",async route=>{
 const url=new URL(route.request().url());
 const local="http://127.0.0.1:8137"+url.pathname.replace("/StormTracker","")+url.search;
 try{
  const result=await fetch(local);
  await route.fulfill({status:result.status,body:Buffer.from(await result.arrayBuffer()),
   contentType:result.headers.get("content-type")||"application/octet-stream"});
 }catch(e){await route.abort("failed");}
});
function near(actual,want,epsilon=0.001){
 assert(Math.abs(actual-want)<epsilon,
  "Camera should remain at "+want+", actually "+actual);
}
async function mapState(){
 return await page.evaluate(()=>({
  radar:document.querySelector("#radarSite")?.value,
  camera:window.__stormtrackerTownLabelDiagnostics?.().controllerTarget,
  frame:document.querySelector("#hybridFrameLabel")?.textContent?.trim(),
  status:document.querySelector("#status")?.textContent?.trim()
 }));
}
async function loadAvailableRadar(region){
 // Camera continuity must NOT depend on BoM publishing six complete scans.
 // A shortened but genuine live loop is independently checked by source QA.
 await page.waitForFunction(region=>{
  const selector=document.querySelector("#radarSite");
  const label=document.querySelector("#hybridFrameLabel")?.textContent||"";
  return selector?.value===region && selector.disabled===false &&
    /[1-9]\d*\/[1-9]\d*/.test(label);
 },region,{timeout:150000});
}
const site="https://blakesmith-intel.github.io/StormTracker/live3d-operational-v9.html?qaTownLabels=1&cameraLockQA=20261101";
try{
 await page.goto(site,{waitUntil:"domcontentloaded",timeout:60000});
 await loadAvailableRadar("66");
 await page.locator("#radarSite").selectOption("56");
 await loadAvailableRadar("56");
 await page.evaluate(()=>{
  window.__stormtrackerTownLabelTestCamera(144.45,-23.41,235000,-43);
 });
 const before=await mapState();
 assert.equal(before.radar,"56");
 near(before.camera.longitude,144.45);
 near(before.camera.latitude,-23.41);
 near(before.camera.range,235000,0.01);
 // This is the actual same-tab foreground refresh handler; it must not
 // re-centre to the application's default radar.
 await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
 await page.waitForTimeout(1500);
 const foreground=await mapState();
 assert.equal(foreground.radar,"56");
 near(foreground.camera.longitude,before.camera.longitude);
 near(foreground.camera.latitude,before.camera.latitude);
 near(foreground.camera.range,before.camera.range,0.01);
 // Force a real latest native BoM observation load, not a simulated frame.
 // The compact mobile menu hides the legacy Latest button. Dispatch
 // its REAL click handler rather than changing approved UI just for QA.
 await page.evaluate(()=>{
  const button=document.querySelector("#jumpLatestButton");
  if(!button || button.disabled)throw Error("Latest action unavailable");
  button.click();
 });
 await page.waitForTimeout(1500);
 const latest=await mapState();
 assert.equal(latest.radar,"56");
 near(latest.camera.longitude,before.camera.longitude);
 near(latest.camera.latitude,before.camera.latitude);
 near(latest.camera.range,before.camera.range,0.01);
 // A browser/iframe restart is the only path which originally reinstalled
 // the Mt Stapylton default. Exact operator camera must survive the restart.
 await page.reload({waitUntil:"domcontentloaded",timeout:60000});
 await page.waitForFunction(()=>window.__stormtrackerTownLabelDiagnostics?.().controllerTarget &&
  document.querySelector("#radarSite")?.value==="56",{},{timeout:60000});
 const restored=await mapState();
 assert.equal(restored.radar,"56");
 near(restored.camera.longitude,before.camera.longitude);
 near(restored.camera.latitude,before.camera.latitude);
 near(restored.camera.range,before.camera.range,0.01);
 near(restored.camera.heading,before.camera.heading,0.00001);
 near(restored.camera.pitch,before.camera.pitch,0.00001);
 await loadAvailableRadar("56");
 const final=await mapState();
 near(final.camera.longitude,before.camera.longitude);
 near(final.camera.latitude,before.camera.latitude);
 console.log("OPERATOR_CAMERA_LONGREACH_REFRESH_RELOAD_PASS",JSON.stringify({
  selectedRadar:final.radar,before:before.camera,
  afterLatest:latest.camera,afterReload:final.camera,
  loadedFrame:final.frame,errors:errors.slice(0,3)
 }));
}catch(error){
 console.log("OPERATOR_CAMERA_LONGREACH_REFRESH_RELOAD_FAIL",JSON.stringify({
  message:String(error),state:await mapState().catch(()=>null),errors:errors.slice(0,10)
 }));
 await page.screenshot({path:"/tmp/radar-camera-lock-failure.png"}).catch(()=>{});
 throw error;
}finally{await browser.close();}
