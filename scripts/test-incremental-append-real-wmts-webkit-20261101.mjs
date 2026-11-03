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
// Browser QA only: trace the actual frame-presentation await which stalls
// Chromium even when the genuine BoM UTC was appended. These probes are
// injected into the LOCAL preview response, not application/production files.
await page.addInitScript(()=>{
 window.__qaRadarStages=[];
 window.__qaRadarStage=(stage,details={})=>{
   const trail=window.__qaRadarStages;
   trail.push({at:Math.round(performance.now()),stage,...details});
   if(trail.length>100)trail.shift();
 };
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
        "QA-only playback stage probe drift: "+needle.slice(0,60));
      code=code.replace(needle,replacement);
    };
    add('async function showHybridFrame(index) {',
      'async function showHybridFrame(index) {\n  window.__qaRadarStage?.("present-start",{index});');
    add('  const frame=hybridFrames[requestedIndex];',
      '  const frame=hybridFrames[requestedIndex];\n  window.__qaRadarStage?.("present-frame",{index:requestedIndex,utc:frame?.observedUtc});');
    add('  let preparedWind=null;',
      '  window.__qaRadarStage?.("wind-preparation-start");\n  let preparedWind=null;');
    add('  await extraPreparation;',
      '  window.__qaRadarStage?.("supplemental-await");\n  await extraPreparation;\n  window.__qaRadarStage?.("supplemental-ready");');
    add('const scene = viewer.scene;',
      'const scene = viewer.scene;\n  // QA-only: distinguish the start/end of a Cesium GPU render.\n  scene.preRender.addEventListener(()=>{if(window.__qaRadarPresenting)window.__qaRadarStage?.("scene-prerender")});\n  scene.postRender.addEventListener(()=>{if(window.__qaRadarPresenting)window.__qaRadarStage?.("scene-postrender")});');
    add('  const radarStart=performance.now();',
      '  window.__qaRadarStage?.("surface-call");\n  const radarStart=performance.now();');
    // Instrument ONLY this intercepted QA module to localise long SwiftShader
    // stalls. The production source, BoM tiles and science are not patched.
    add('  const commitMeasuredGeometry=()=>{',
      '  const commitMeasuredGeometry=()=>{\n    window.__qaRadarStage?.("geometry-begin");');
    add('    renderInferredVolume(frame);',
      '    renderInferredVolume(frame);\n    window.__qaRadarStage?.("inferred-volume-done");');
    add('    updateTrackDisplayControls(liveMeasuredIndex);',
      '    updateTrackDisplayControls(liveMeasuredIndex);\n    window.__qaRadarStage?.("track-controls-done");');
    add('    renderHybridTracks(liveMeasuredIndex);',
      '    renderHybridTracks(liveMeasuredIndex);\n    window.__qaRadarStage?.("track-geometry-done");');
    add('    geometryCommitted=true;',
      '    geometryCommitted=true;\n    window.__qaRadarStage?.("geometry-committed");');
    add('  await new Promise(resolve=>{',
      '  window.__qaRadarStage?.("ui-postrender-wait");\n  await new Promise(resolve=>{');
    add('  syncFrameSlider($("hybridFrameSlider"),hybridFrames.length,hybridFrameIndex);',
      '  window.__qaRadarStage?.("ui-postrender-ready");\n  syncFrameSlider($("hybridFrameSlider"),hybridFrames.length,hybridFrameIndex);');

    add('  radarPresentationMs=performance.now()-radarStart;',
      '  radarPresentationMs=performance.now()-radarStart;\n  window.__qaRadarStage?.("surface-return",{applied:surfaceApplied});');
    add('  const provider=await prepareRadarSurfaceProvider(frame);',
      '  window.__qaRadarStage?.("provider-await",{utc:frame?.observedUtc});\n  const provider=await prepareRadarSurfaceProvider(frame);\n  window.__qaRadarStage?.("provider-ready",{utc:frame?.observedUtc});');
    add('  const committed = await radarImageryHandover.replace(',
      '  window.__qaRadarPresenting=true;\n  window.__qaRadarStage?.("cesium-handover-await",{utc:frame?.observedUtc});\n  const committed = await radarImageryHandover.replace(');
    add('  if (!committed) return false;',
      '  window.__qaRadarPresenting=false;\n  window.__qaRadarStage?.("cesium-handover-result",{committed});\n  if (!committed) return false;');
    body=Buffer.from(code,"utf8");
  }
  if(uri.pathname.endsWith("/src/imagery-layer-retirement-v1.js")){
    let code=body.toString("utf8");
    const inject=(needle,replacement)=>{
      assert.equal(code.split(needle).length,2,
        "QA-only imagery retirement probe drift: "+needle.slice(0,70));
      code=code.replace(needle,replacement);
    };
    inject('  function safelyDestroy(layer){',
      '  function safelyDestroy(layer){\n    window.__qaRadarStage?.("retirement-destroy-begin",{id:layer?.imageryProvider?.url??null});');
    inject('    counts.destroyed++;',
      '    counts.destroyed++;\n    window.__qaRadarStage?.("retirement-destroy-end");');
    inject('  const detach=scene.postRender.addEventListener(()=>{',
      '  const detach=scene.postRender.addEventListener(()=>{\n    if(window.__qaRadarPresenting)window.__qaRadarStage?.("retirement-postrender-enter");');
    inject('    sweep();\n  // Timer requests',
      '    sweep();\n    if(window.__qaRadarPresenting)window.__qaRadarStage?.("retirement-postrender-exit");\n  // Timer requests');
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
  canvases:document.querySelectorAll("#cesiumContainer canvas").length,
  renderStages:window.__qaRadarStages?.slice(-65),
  graphics:window.__stormtrackerGraphicsDiagnostics?.()??null
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
   /\b\d+\/6\b/.test(document.querySelector("#hybridFrameLabel")?.textContent??"") &&
   window.__stormtrackerRadarDiagnostics()?.automatic?.newestAcceptedUtc,
  null,{timeout:300000,polling:250});
 const before=await snapshot();
 assert.equal(before.site,"66");
 assert(await page.evaluate(()=>typeof window.__stormtrackerMemoryDiagnostics==="function"),
  "Operator QA route did not enable the production radar recovery/memory path");
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
 },heldBackUtc,{timeout:180000,polling:250});
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
 // "Pause" on a button is NOT evidence of advancing images: this exact
 // desktop defect previously returned a green source append but 1/6 stayed
 // on screen. Require a new rendered frame index in the same running tab.
 await page.waitForFunction(previous=>{
  const now=document.querySelector("#hybridFrameLabel")?.textContent?.trim();
  return document.querySelector("#hybridPlayButton")?.textContent?.trim()==="Pause" &&
    String(now??"").includes("/6") && now!==previous;
 },after.label,{timeout:90000,polling:250});
 const progressed=await snapshot();
 assert.equal(progressed.button,"Pause","Visible frame advanced but playback stopped");
 console.log("REAL_SOURCE_VISIBLE_PLAYBACK_PROGRESS_PASS",JSON.stringify({
  platform:isDesktop?"desktop Chromium":"mobile WebKit",
  originalFrame:after.label,displayedFrame:progressed.label
 }));
 console.log("REAL_SOURCE_INCREMENTAL_APPEND_PASS",JSON.stringify({platform:isDesktop?"desktop Chromium":"mobile WebKit",
  beforeUtc:before.diagnostics.automatic.newestAcceptedUtc,
  afterUtc:after.diagnostics.automatic.newestAcceptedUtc,heldBackUtc,
  append:after.diagnostics.incremental,frames:after.label,
  metadataRequests
 }));
}catch(error){
 console.log("REAL_SOURCE_INCREMENTAL_APPEND_FAIL",
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
 await page.screenshot({path:isDesktop?"/tmp/radar-incremental-desktop-append-failure.png":"/tmp/radar-incremental-real-append-failure.png"}).catch(()=>{});
 throw error;
}finally{await browser.close();}
