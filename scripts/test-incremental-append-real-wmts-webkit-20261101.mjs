#!/usr/bin/env node
// Integration proof: reveal one REAL BoM-published UTC on the next source poll.
// Initially delay publication of the genuine latest WMTS Value; never generate
// a synthetic scan, replace its PNG, or modify production polling.
import assert from "node:assert/strict";
import {webkit,chromium} from "playwright";
import {parsePublishedReflectivityTimes,REFLECTIVITY_WMTS_LAYER}
  from "../frontend/src/bom-wmts-published-times-v1.js";

// Same exact genuine-frame append contract on iPhone Safari and desktop
// Chromium; only browser viewport/engine differ. No platform-specific patch.
const isDesktop=process.env.STORMTRACKER_BROWSER==="desktop";
const browser=isDesktop
 ? await chromium.launch({headless:true,args:[
   "--no-sandbox","--disable-dev-shm-usage",
   "--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"
  ]})
 : await webkit.launch({headless:true});
const page=await browser.newPage(isDesktop
 ? {viewport:{width:1440,height:900},deviceScaleFactor:1,isMobile:false,hasTouch:false}
 : {viewport:{width:390,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true});
page.setDefaultTimeout(180000);
let phase="initial",heldBackUtc=null,metadataRequests=0;
let authenticCapabilitySnapshot=null;
const navigations=[],errors=[];
page.on("framenavigated",frame=>navigations.push(frame.url()));
page.on("pageerror",error=>errors.push(String(error)));
await page.route("https://blakesmith-intel.github.io/StormTracker/**",async route=>{
 const uri=new URL(route.request().url());
 const local="http://127.0.0.1:8137"+uri.pathname.replace("/StormTracker","")+uri.search;
 try{
  const res=await fetch(local);
  await route.fulfill({status:res.status,body:Buffer.from(await res.arrayBuffer()),
   contentType:res.headers.get("content-type")||"application/octet-stream"});
 }catch{await route.abort("failed");}
});
await page.route(/\/wmts-native-capabilities(?:\?|$)/,async route=>{
 metadataRequests++;
 // This is the SAME BoM-issued XML captured live exactly once. First hide
 // one already-published real UTC from the QA browser; then expose the
 // unmodified authentic snapshot on the next poll. Do not depend on a
 // second live HTTP round-trip, which can time out in Chromium CI and does
 // not test the incremental renderer. Every PNG tile is still fetched live.
 if(authenticCapabilitySnapshot===null){
  const response=await route.fetch();
  assert(response.ok(),"Authoritative BoM capabilities XML unavailable");
  authenticCapabilitySnapshot=await response.text();
 }
 let xml=authenticCapabilitySnapshot;
 if(phase==="initial"){
  const times=parsePublishedReflectivityTimes(xml);
  assert(times.length>=7,"Seven genuine published scans required for append QA");
  const newest=times.at(-1);
  if(heldBackUtc===null)heldBackUtc=newest;
  assert.equal(newest,heldBackUtc,
    "Source publication changed mid-initialisation");
  const found=[...xml.matchAll(/<Layer\b[^>]*>[\s\S]*?<\/Layer\s*>/gi)]
    .find(match=>match[0].includes(REFLECTIVITY_WMTS_LAYER));
  assert(found,"Source reflectivity layer absent");
  // ISO UTC timestamp is safe inside this regex; its punctuation is literal.
  const value=new RegExp("<Value\\s*>\\s*"+heldBackUtc+"\\s*</Value\\s*>","i");
  const replacement=found[0].replace(value,"");
  assert.notEqual(replacement,found[0],"Cannot delay the genuine latest UTC");
  xml=xml.replace(found[0],replacement);
  assert(!parsePublishedReflectivityTimes(xml).includes(heldBackUtc));
 }
 await route.fulfill({status:200,body:xml,contentType:"application/xml",
   headers:{"Access-Control-Allow-Origin":"*"}});
});
async function snapshot(){
 return page.evaluate(()=>({
  label:document.querySelector("#hybridFrameLabel")?.textContent?.trim(),
  site:document.querySelector("#radarSite")?.value,
  button:document.querySelector("#hybridPlayButton")?.textContent?.trim(),
  diagnostics:window.__stormtrackerRadarDiagnostics?.(),
  canvases:document.querySelectorAll("#cesiumContainer canvas").length
 }));
}
try{
 await page.goto(
  "https://blakesmith-intel.github.io/StormTracker/live3d-operational-v9.html?qaIncrementalRadar=1",
  {waitUntil:"domcontentloaded",timeout:60000}
 );
 await page.locator("#cesiumContainer .cesium-widget canvas").waitFor({state:"attached",timeout:90000});
 await page.waitForFunction(()=>
   typeof window.__stormtrackerRadarQaCheck==="function" &&
   /\b\d+\/6\b/.test(document.querySelector("#hybridFrameLabel")?.textContent??"") &&
   window.__stormtrackerRadarDiagnostics()?.automatic?.newestAcceptedUtc,
  null,{timeout:180000});
 const before=await snapshot();
 assert.equal(before.site,"66");
 assert.equal(before.diagnostics.incremental.appendUpdates,0);
 assert(heldBackUtc,"No genuine source observation withheld");
 assert.notEqual(before.diagnostics.automatic.newestAcceptedUtc,heldBackUtc);
 assert.equal(before.diagnostics.lifecycle.bootCount,1);
 assert.equal(before.diagnostics.lifecycle.webglLossCount,0);
 assert.equal(before.button,"Pause","Active playback required");
 assert.equal(before.label.split("/")[1],"6");
 console.log("REAL_SOURCE_INCREMENTAL_START",JSON.stringify({platform:isDesktop?"desktop Chromium":"mobile WebKit",
  heldBackUtc,previousUtc:before.diagnostics.automatic.newestAcceptedUtc,
  state:before.diagnostics.incremental,frames:before.label
 }));

 phase="release";
 // Expire the 120-second metadata cache in this QA-only browser with a
 // controlled clock jump; no source or production timer is modified.
 await page.evaluate(()=>{
  const original=Date.now,anchor=original();
  Date.now=()=>anchor+135000+(original()-anchor);
 });
 await page.evaluate(async()=>window.__stormtrackerRadarQaCheck());
 await page.waitForFunction(expected=>{
  const data=window.__stormtrackerRadarDiagnostics?.();
  return data?.incremental?.appendUpdates>=1 &&
    Date.parse(data.automatic.newestAcceptedUtc)>=Date.parse(expected);
 },heldBackUtc,{timeout:120000});
 const after=await snapshot();
 assert(after.diagnostics.incremental.lastAppendedCount>=1);
 assert.equal(after.diagnostics.incremental.lastRetiredCount,1);
 assert.equal(after.diagnostics.incremental.fullRebuildUpdates,0);
 assert.equal(after.diagnostics.lifecycle.bootCount,1);
 assert.equal(after.diagnostics.lifecycle.webglLossCount,0);
 assert.equal(after.canvases,before.canvases);
 assert.equal(after.button,"Pause","Continuous playback timer interrupted");
 assert.equal(after.site,"66");
 assert.equal(navigations.length,1,"Unexpected navigation");
 assert(metadataRequests>=2,"New genuine metadata was not fetched");
 assert.equal(after.label.split("/")[1],"6");
 console.log("REAL_SOURCE_INCREMENTAL_APPEND_PASS",JSON.stringify({platform:isDesktop?"desktop Chromium":"mobile WebKit",
  beforeUtc:before.diagnostics.automatic.newestAcceptedUtc,
  afterUtc:after.diagnostics.automatic.newestAcceptedUtc,heldBackUtc,
  append:after.diagnostics.incremental,frames:after.label,
  metadataRequests
 }));
}catch(error){
 console.log("REAL_SOURCE_INCREMENTAL_APPEND_FAIL",
  JSON.stringify({platform:isDesktop?"desktop Chromium":"mobile WebKit",error:String(error),heldBackUtc,phase,metadataRequests,
   navigations,errors:errors.slice(-8),state:await snapshot().catch(()=>null)}));
 await page.screenshot({path:isDesktop?"/tmp/radar-incremental-desktop-append-failure.png":"/tmp/radar-incremental-real-append-failure.png"}).catch(()=>{});
 throw error;
}finally{await browser.close();}
