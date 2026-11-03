#!/usr/bin/env node
// Operator screenshot regression: initially hide one genuine INTERIOR BoM
// timestamp from the source capabilities, reproducing the visible 5/5 loop.
// Then expose the original unmodified BoM metadata and prove automatic
// recovery to 6/6 without a new source scan or document navigation.
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
// QA-only playback transition trace: the source-verified 5->6 backfill is
// currently successful, but WebKit sometimes exits Play unexpectedly.
// Capture the ACTUAL call stack changing the button, not a guessed cause.
// No modification to the packaged radar code or production behaviour.
await page.addInitScript(()=>{
  window.__qaPlaybackTransitions=[];
  // Browser-only evidence: identify where a genuine recovered frame stalls,
  // without changing any BoM pixels, radar science or production application.
  window.__qaRadarStages=[];
  window.__qaRadarStage=(stage,details={})=>{
    window.__qaRadarStages.push({at:Math.round(performance.now()),stage,...details});
    if(window.__qaRadarStages.length>100)window.__qaRadarStages.shift();
  };
  const descriptor=Object.getOwnPropertyDescriptor(Node.prototype,"textContent");
  if(!descriptor?.set || !descriptor?.get)return;
  Object.defineProperty(Node.prototype,"textContent",{
    configurable:true,enumerable:descriptor.enumerable,
    get(){return descriptor.get.call(this);},
    set(value){
      if(this?.id==="hybridPlayButton"){
        window.__qaPlaybackTransitions.push({
          time:Date.now(),value:String(value),
          stack:(new Error("playback state transition")).stack?.slice(0,1700)
        });
        if(window.__qaPlaybackTransitions.length>20)
          window.__qaPlaybackTransitions.shift();
      }
      return descriptor.set.call(this,value);
    }
  });
});
let phase="initial",heldBackUtc=null,metadataRequests=0;
let authenticCapabilitySnapshot=null;
const navigations=[],errors=[],requestFailures=[],consoleErrors=[],httpFailures=[];
page.on("requestfailed",request=>{
  if(requestFailures.length<24)requestFailures.push({
    url:request.url().slice(0,240),reason:request.failure()?.errorText??"unknown"
  });
});
page.on("response",response=>{
  if(response.status()>=400 && httpFailures.length<24)
    httpFailures.push({url:response.url().slice(0,240),status:response.status()});
});
page.on("console",message=>{
  if(message.type()==="error" && consoleErrors.length<24)
    consoleErrors.push(message.text().slice(0,450));
});
page.on("framenavigated",frame=>navigations.push(frame.url()));
page.on("pageerror",error=>errors.push(String(error)));
await page.route("https://blakesmith-intel.github.io/StormTracker/**",async route=>{
 const uri=new URL(route.request().url());
 const local="http://127.0.0.1:8137"+uri.pathname.replace("/StormTracker","")+uri.search;
 try{
  const res=await fetch(local);
  let body=Buffer.from(await res.arrayBuffer());
  if(uri.pathname.endsWith("/src/live3d-operational-v9.js")){
    let code=body.toString("utf8");
    const add=(needle,replacement)=>{
      assert.equal(code.split(needle).length,2,
        "QA-only missing-frame rendering probe drift: "+needle.slice(0,80));
      code=code.replace(needle,replacement);
    };
    add('async function showHybridFrame(index) {',
      'async function showHybridFrame(index) {\n  window.__qaRadarStage?.("present-start",{index});');
    add('  const frame=hybridFrames[requestedIndex];',
      '  const frame=hybridFrames[requestedIndex];\n  window.__qaRadarStage?.("present-frame",{utc:frame?.observedUtc,index:requestedIndex});');
    add('  await extraPreparation;',
      '  window.__qaRadarStage?.("supplemental-await");\n  await extraPreparation;\n  window.__qaRadarStage?.("supplemental-ready");');
    add('  const provider=await prepareRadarSurfaceProvider(frame);',
      '  window.__qaRadarStage?.("provider-await",{utc:frame?.observedUtc});\n  const provider=await prepareRadarSurfaceProvider(frame);\n  window.__qaRadarStage?.("provider-ready",{utc:frame?.observedUtc});');
    add('  const committed = await radarImageryHandover.replace(',
      '  window.__qaRadarStage?.("cesium-handover-await",{utc:frame?.observedUtc});\n  const committed = await radarImageryHandover.replace(');
    add('  if (!committed) return false;',
      '  window.__qaRadarStage?.("cesium-handover-result",{committed});\n  if (!committed) return false;');
    add('    renderInferredVolume(frame);',
      '    window.__qaRadarStage?.("geometry-begin");\n    renderInferredVolume(frame);\n    window.__qaRadarStage?.("geometry-done");');
    add('  syncFrameSlider($("hybridFrameSlider"),hybridFrames.length,hybridFrameIndex);',
      '  window.__qaRadarStage?.("playback-label-commit",{count:hybridFrames.length});\n  syncFrameSlider($("hybridFrameSlider"),hybridFrames.length,hybridFrameIndex);');
    body=Buffer.from(code,"utf8");
  }
  await route.fulfill({status:res.status,body,
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
  const withheld=times.at(-2);
  if(heldBackUtc===null)heldBackUtc=withheld;
  assert.equal(withheld,heldBackUtc,
    "Source publication changed mid-initialisation");
  const found=[...xml.matchAll(/<Layer\b[^>]*>[\s\S]*?<\/Layer\s*>/gi)]
    .find(match=>match[0].includes(REFLECTIVITY_WMTS_LAYER));
  assert(found,"Source reflectivity layer absent");
  // ISO UTC timestamp is safe inside this regex; its punctuation is literal.
  const value=new RegExp("<Value\\s*>\\s*"+heldBackUtc+"\\s*</Value\\s*>","i");
  const replacement=found[0].replace(value,"");
  assert.notEqual(replacement,found[0],"Cannot delay the genuine interior UTC");
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
  canvases:document.querySelectorAll("#cesiumContainer canvas").length,
  qaHook:typeof window.__stormtrackerRadarQaCheck,
  status:document.querySelector("#status")?.textContent?.trim(),
  playbackTransitions:window.__qaPlaybackTransitions?.slice(-12),
  renderStages:window.__qaRadarStages?.slice(-80)
 }));
}
try{
 await page.goto(
  "https://blakesmith-intel.github.io/StormTracker/preview/radar-refresh-review/live3d-operational-v9.html?qaIncrementalRadar=1",
  {waitUntil:"domcontentloaded",timeout:60000}
 );
 await page.locator("#cesiumContainer .cesium-widget canvas").waitFor({state:"attached",timeout:90000});
 await page.waitForFunction(()=>
   typeof window.__stormtrackerRadarQaCheck==="function" &&
   /\b\d+\/5\b/.test(document.querySelector("#hybridFrameLabel")?.textContent??"") &&
   window.__stormtrackerRadarDiagnostics()?.automatic?.newestAcceptedUtc,
  null,{timeout:300000,polling:250});
 const before=await snapshot();
 assert.equal(before.site,"66");
 assert(await page.evaluate(()=>typeof window.__stormtrackerMemoryDiagnostics==="function"),
  "Operator QA route did not enable the production radar recovery/memory path");
 assert.equal(before.diagnostics.incremental.appendUpdates,0);
 assert(heldBackUtc,"No genuine source observation withheld");
 assert(Date.parse(before.diagnostics.automatic.newestAcceptedUtc)>Date.parse(heldBackUtc),
  "The unavailable observation must be INTERIOR to the current loop");
 assert.equal(before.diagnostics.lifecycle.bootCount,1);
 assert.equal(before.diagnostics.lifecycle.webglLossCount,0);
 assert.equal(before.button,"Pause","Active playback required");
 assert.equal(before.label.split("/")[1],"5",
  "Did not reproduce the operator's exact five-of-five symptom");
 console.log("REAL_SOURCE_MISSING_FRAME_START",JSON.stringify({platform:isDesktop?"desktop Chromium":"mobile WebKit",
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
  return data?.incremental?.fullRebuildUpdates>=1 &&
    /\b\d+\/6\b/.test(document.querySelector("#hybridFrameLabel")?.textContent??"") &&
    Date.parse(data.automatic.newestAcceptedUtc)>Date.parse(expected);
 },heldBackUtc,{timeout:180000,polling:250});
 const after=await snapshot();
 assert.equal(after.diagnostics.incremental.appendUpdates,0,
  "An interior source gap must not be treated as a forward append");
 assert.equal(after.diagnostics.incremental.fullRebuildUpdates,1,
  "The engine failed to recover an old genuine source scan");
 assert.equal(after.diagnostics.lifecycle.bootCount,1);
 assert.equal(after.diagnostics.lifecycle.webglLossCount,0);
 assert.equal(after.canvases,before.canvases);
 assert.equal(after.button,"Pause","Continuous playback timer interrupted");
 assert.equal(after.site,"66");
 assert.equal(navigations.length,1,"Unexpected navigation");
 assert(metadataRequests>=2,"New genuine metadata was not fetched");
 assert.equal(after.label.split("/")[1],"6");
 // Completion of a source backfill is not the same as a healthy playback
 // loop. Prove the actual displayed index advances without operator input,
 // page restart, inferred replacement pixels or playback timer reset.
 await page.waitForFunction(previous=>{
  const displayed=document.querySelector("#hybridFrameLabel")?.textContent?.trim();
  return document.querySelector("#hybridPlayButton")?.textContent?.trim()==="Pause" &&
    String(displayed??"").includes("/6") && displayed!==previous;
 },after.label,{timeout:90000,polling:250});
 const progressed=await snapshot();
 assert.equal(progressed.button,"Pause","Visible frame advanced but playback stopped");
 console.log("REAL_SOURCE_VISIBLE_BACKFILL_PLAYBACK_PASS",JSON.stringify({
  platform:isDesktop?"desktop Chromium":"mobile WebKit",
  previousFrame:after.label,displayedFrame:progressed.label
 }));
 console.log("REAL_SOURCE_MISSING_FRAME_RECOVERY_PASS",JSON.stringify({platform:isDesktop?"desktop Chromium":"mobile WebKit",
  beforeUtc:before.diagnostics.automatic.newestAcceptedUtc,
  afterUtc:after.diagnostics.automatic.newestAcceptedUtc,heldBackUtc,
  append:after.diagnostics.incremental,frames:after.label,
  metadataRequests
 }));
}catch(error){
 console.log("REAL_SOURCE_MISSING_FRAME_RECOVERY_FAIL",
  JSON.stringify({platform:isDesktop?"desktop Chromium":"mobile WebKit",error:String(error),heldBackUtc,phase,metadataRequests,
   navigations,errors:errors.slice(-8),requestFailures,
   httpFailures,consoleErrors,
   startup:await page.evaluate(()=>({
     readyState:document.readyState,
     cesium:typeof window.Cesium,
     scripts:[...document.scripts].slice(-4).map(script=>({
       src:script.src.slice(0,220),type:script.type
     }))
   })).catch(()=>null),
   state:await snapshot().catch(()=>null)}));
 await page.screenshot({path:isDesktop?"/tmp/radar-desktop-missing-frame-failure.png":"/tmp/radar-mobile-missing-frame-failure.png"}).catch(()=>{});
 throw error;
}finally{await browser.close();}
