import assert from "node:assert/strict";
import {chromium} from "playwright";
// Exercise the actual deployed UI engine, including sequential site changes.
// Source times and complete WMTS imagery remain live/unaltered.
const browser=await chromium.launch({headless:true,args:[
  "--no-sandbox","--disable-dev-shm-usage","--use-gl=angle",
  "--use-angle=swiftshader","--enable-unsafe-swiftshader"
]});
const page=await browser.newPage({viewport:{width:390,height:780},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const errors=[];
page.on("pageerror",e=>errors.push(String(e)));
page.on("console",m=>{if(/Incomplete BoM|WMTS source|radar.*unavailable/i.test(m.text())) errors.push(m.text().slice(0,450));});
await page.route("https://blakesmith-intel.github.io/StormTracker/**",async route=>{
  const url=new URL(route.request().url());
  const local="http://127.0.0.1:8137"+url.pathname.replace("/StormTracker","")+url.search;
  try{
    const res=await fetch(local);
    await route.fulfill({status:res.status,body:Buffer.from(await res.arrayBuffer()),
      contentType:res.headers.get("content-type")||"application/octet-stream"});
  }catch(e){await route.abort("failed");}
});
async function snapshot(region,timeout=150000){
 await page.waitForFunction(({region})=>{
   const el=document.querySelector("#radarSite");
   const label=document.querySelector("#hybridFrameLabel")?.textContent?.trim()||"";
   const status=document.querySelector("#status")?.textContent||"";
   return el?.value===region && el.disabled===false &&
      /\b[1-9]\d*\/[1-9]\d*\b/.test(label) &&
      !/Loading frame|Checking available|Checking history/i.test(status);
 },{region},{timeout});
 const state=await page.evaluate(()=>{
  const id=x=>document.querySelector("#"+x);
  return {region:id("radarSite")?.value,frames:id("hybridFrameLabel")?.textContent,
    status:id("status")?.textContent,source:id("sourceTime")?.textContent,
    available:id("sharedHistoryNote")?.textContent,auto:id("autoRefreshNote")?.textContent,
    window:id("loopDurationMinutes")?.value};
 });
 console.log("RADAR_OPERATIONAL_SITE_CHECK",JSON.stringify(state));
 assert(/\b[1-9]\d*\/6\b/.test(state.frames),"30-minute six measured scans missing at "+region+"; "+JSON.stringify(state));
 return state;
}
try{
 await page.goto("https://blakesmith-intel.github.io/StormTracker/live3d-operational-v9.html?qaRegionLoop=20261101",
  {waitUntil:"domcontentloaded",timeout:60000});
 await page.locator("#cesiumContainer .cesium-widget canvas").waitFor({state:"attached",timeout:60000});
 await snapshot("66");
 for(const region of ["23","08","19"]){
   await page.locator("#radarSite").selectOption(region,{timeout:60000});
   await snapshot(region);
 }
 console.log("RADAR_OPERATIONAL_CROSS_SITE_30MIN_PASS");
}catch(error){
 console.log("RADAR_OPERATIONAL_CROSS_SITE_30MIN_FAIL",JSON.stringify({error:String(error),errors:errors.slice(-12)}));
 await page.screenshot({path:"/tmp/radar-region-qa-failure.png"}).catch(()=>{});
 throw error;
}finally{await browser.close();}
