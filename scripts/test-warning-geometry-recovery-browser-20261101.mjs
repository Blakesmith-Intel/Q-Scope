#!/usr/bin/env node
// Public-root-equivalent browser test of the operator's observed failure.
// Do NOT alter or invent any source warning coordinates. The first response
// models a temporary authoritative geometry publication delay; the second
// restores byte-authentic currently published BoM relay features.
import assert from "node:assert/strict";
import {chromium,webkit} from "playwright";

const isDesktop=process.env.STORMTRACKER_BROWSER==="desktop";
const browser=isDesktop
 ?await chromium.launch({headless:true,args:[
  "--no-sandbox","--disable-dev-shm-usage",
  "--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"
 ]})
 :await webkit.launch({headless:true});
const page=await browser.newPage(isDesktop?
 {viewport:{width:1440,height:900},deviceScaleFactor:1,isMobile:false,hasTouch:false}:
 {viewport:{width:390,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true});
page.setDefaultTimeout(180000);
const errors=[],nav=[];
page.on("framenavigated",frame=>nav.push(frame.url()));
page.on("pageerror",error=>errors.push(String(error)));
const SOURCE="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/bom-official-warning-polygons";
let requests=0,authentic=null;
const sourceRes=await fetch(SOURCE,{cache:"no-store",signal:AbortSignal.timeout(42000)});
assert(sourceRes.ok,"Cannot verify live original BoM warning relay");
authentic=await sourceRes.json();
assert.equal(authentic.schema,"StormTrackerOfficialBoMWarningPolygonsV1");
assert(Array.isArray(authentic.warnings));
for(const code of ["IDQ21033","IDQ21035"]){
 assert(authentic.products?.[code]?.status==="active",
  "Current source does not have active "+code+"; do not fake it");
 assert(authentic.warnings.some(w=>w.productCode===code),
  "Source "+code+" has no genuine current polygon; cannot test return from outage");
}
const sourceCounts=Object.fromEntries(["IDQ21033","IDQ21035"].map(code=>[
 code,authentic.warnings.filter(w=>w.productCode===code).length
]));
await page.route("https://blakesmith-intel.github.io/StormTracker/**",async route=>{
 const uri=new URL(route.request().url());
 const local="http://127.0.0.1:8137"+uri.pathname.replace("/StormTracker","")+uri.search;
 try{
  const res=await fetch(local);
  await route.fulfill({status:res.status,body:Buffer.from(await res.arrayBuffer()),
   contentType:res.headers.get("content-type")||"application/octet-stream"});
 }catch{await route.abort("failed");}
});
await page.route("**/bom-official-warning-polygons",async route=>{
 requests++;
 const payload=structuredClone(authentic);
 if(requests===1){
  payload.status="partial-source-unavailable";
  payload.warnings=[];
  payload.stormCells=[];
  for(const code of ["IDQ21033","IDQ21035"])
    payload.products[code]={...payload.products[code],status:"geometry-unavailable",count:0};
 }
 await route.fulfill({status:200,contentType:"application/json",
  headers:{"access-control-allow-origin":"*","cache-control":"no-store"},
  body:JSON.stringify(payload)});
});
const stat=()=>page.evaluate(()=>({
 sourceStatus:document.getElementById("officialBomWarningsStatus")?.textContent?.trim(),
 selected:document.getElementById("officialBomWarningProduct")?.value,
 canLocate:!document.getElementById("locateOfficialBomWarnings")?.hidden,
 shown:document.getElementById("showOfficialBomWarnings")?.checked,
 canvas:document.querySelectorAll("#cesiumContainer canvas").length,
 site:document.getElementById("radarSite")?.value
}));
try{
 await page.clock.install();
 await page.goto("https://blakesmith-intel.github.io/StormTracker/live3d-operational-v9.html",
  {waitUntil:"domcontentloaded",timeout:60000});
 await page.locator("#cesiumContainer .cesium-widget canvas").waitFor({state:"attached",timeout:120000});
 await page.evaluate(()=>{
  const checkbox=document.getElementById("showOfficialBomWarnings");
  if(!checkbox)throw Error("Approved warning toggle absent");
  checkbox.checked=true;
  checkbox.dispatchEvent(new Event("change",{bubbles:true}));
 });
 await page.waitForFunction(()=>
  document.querySelector("#officialBomWarningsStatus")?.textContent?.includes("awaiting updated BoM polygon"),
  null,{timeout:110000,polling:200});
 const prior=await stat();
 assert.equal(requests,1);
 assert.equal(prior.canLocate,false,
  "Source-unverified geometry must not permit locating fabricated polygon");
 console.log("WARNING_MISSING_LIVE_GEOMETRY_REPRODUCED",JSON.stringify({
  platform:isDesktop?"desktop Chromium":"mobile WebKit",prior,sourceCounts
 }));

 // Actual source catch-up scheduler: advance browser Date+timers without
 // waiting two minutes wall time. No manual refresh and no source swap on
 // the public application. Its minute timer must notice the 2-minute expiry.
 await page.clock.fastForward(140000);
 await page.waitForFunction(()=>{
  const s=document.querySelector("#officialBomWarningsStatus")?.textContent??"";
  return s.includes("IDQ21033")&&s.includes("active (")&&
   document.querySelector("#locateOfficialBomWarnings")?.hidden===false;
 },null,{timeout:130000,polling:250});
 const after=await stat();
 assert.equal(requests,2,"One automatic recovery request required, not busy polling");
 assert.equal(after.shown,true);
 assert.equal(after.canLocate,true,"Recovered genuine polygon not available for Locate");
 assert.equal(after.canvas,prior.canvas,"Cesium canvas rebuilt on warning recovery");
 assert.equal(after.site,prior.site,"Primary radar changed during warning recovery");
 assert.equal(nav.length,1,"Browser navigated during warning feed recovery");
 assert(!errors.length,"Browser errors: "+errors.slice(0,3).join(" | "));
 // Switching products must show the original source counts, not the same
 // guessed boundary shown for both product IDs.
 for(const [code,count] of Object.entries(sourceCounts)){
  await page.locator("#officialBomWarningProduct").selectOption(code);
  const status=(await stat()).sourceStatus;
  assert(status.includes(code)&&status.includes("("+count+" polygon"),
   "Original BoM source polygon count not restored for "+code+": "+status);
 }
 console.log("WARNING_LIVE_POLYGON_CATCHUP_PASS",JSON.stringify({
  platform:isDesktop?"desktop Chromium":"mobile WebKit",
  recoveredCounts:sourceCounts,requests,after,navigations:nav.length
 }));
}catch(error){
 console.log("WARNING_LIVE_POLYGON_CATCHUP_FAIL",JSON.stringify({
  platform:isDesktop?"desktop Chromium":"mobile WebKit",
  error:String(error),requests,state:await stat().catch(()=>null),errors,nav
 }));
 await page.screenshot({path:isDesktop?
  "/tmp/warning-desktop-catchup-fail.png":"/tmp/warning-mobile-catchup-fail.png"}).catch(()=>{});
 throw error;
}finally{await browser.close();}
