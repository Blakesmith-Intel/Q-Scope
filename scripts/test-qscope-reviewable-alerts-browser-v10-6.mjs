import assert from "node:assert/strict";
import {chromium,webkit} from "playwright";

const mobile=process.env.STORMTRACKER_BROWSER==="mobile";
const browser=await (mobile?webkit:chromium).launch({headless:true});
const context=await browser.newContext(mobile?
  {viewport:{width:390,height:844},isMobile:true,hasTouch:true}:
  {viewport:{width:1280,height:800}});
const page=await context.newPage();
const root="http://127.0.0.1:8137/";
const modulePath="/preview/wind-hook-v10-6/src/qscope-reviewable-event-inbox-v10-6.js";
const cssPath="/preview/wind-hook-v10-6/src/qscope-reviewable-event-inbox-v10-6.css";
const fixture=root+"qscope-v10-6-captured-alerts.html";
await page.route(fixture,route=>route.fulfill({
  contentType:"text/html",status:200,
  body:'<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="'+cssPath+'"></head><body style="margin:0;background:#05131c"><main id="mapPanel" style="position:relative;overflow:hidden;width:100vw;height:100vh"><div class="storm-severe-alert-dock" style="display:block">OLD FRAME-BASED UI</div></main></body></html>'
}));
try {
  const runtime=await (await page.request.get(root+
    "preview/wind-hook-v10-6/src/live3d-operational-v9.js")).text();
  assert(runtime.includes("onNewEvent:pauseForGenuineNewResearchEvent"));
  assert(runtime.includes("captureResearchSourceThumbnail"));
  assert(runtime.includes("shouldPauseForNewResearchEvent"));
  assert(!runtime.includes("enableWindHookResearch"));
  const load=async()=>page.goto(fixture,{waitUntil:"load"});
  const setup=async reset=>page.evaluate(async ({modulePath,reset})=>{
    const mod=await import(modulePath);
    if(reset){
      localStorage.removeItem(mod.Q_SCOPE_EVENT_STORAGE_KEY);
      localStorage.removeItem(mod.Q_SCOPE_PAUSE_PREFERENCE_KEY);
    }
    window.newEvents=[];
    window.framesVisited=[];
    window.ui=mod.createPassiveWindEventInbox({
      container:document.querySelector("#mapPanel"),
      storage:localStorage,
      onNewEvent:(event,context)=>window.newEvents.push({event,context}),
      onNavigate:async(event,evidence)=>{
        window.framesVisited.push({event,evidence});
        return {ok:false,message:"Original frame expired; retained source crop available."};
      }
    });
    window.addCase=()=>{
      const now=Date.now()-600000;
      const t1=new Date(now).toISOString();
      const t2=new Date(now+300000).toISOString();
      const crop={
        dataUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Yd3XngAAAAASUVORK5CYII=",
        label:"Retained genuine BoM decoded reflectivity categories, not source artwork.",
        observedUtc:t1,mode:"rain"
      };
      const common={latitude:-27.45,longitude:153.1,radar_id:"66",
        track_id:"ST0001",caveat:"Experimental radar, not a BoM warning"};
      window.ui.observe([{
        ...common,category:"hook_shape_only",observed_utc:t1,
        source_utc:t1,snapshot:crop
      }],{mode:"rain",frameUtc:t1});
      window.ui.observe([{
        ...common,category:"tornadic_candidate",observed_utc:t2,source_utc:t2
      }],{mode:"rain",frameUtc:t2});
      return {t1,t2};
    };
  },{modulePath,reset});
  await load();
  await setup(true);
  assert.equal(await page.locator(".qscope-wind-event-inbox").isHidden(),true,
    "No pending or historical event means no map-obstructing radar-event window");
  assert.equal(await page.locator(".storm-severe-alert-dock").evaluate(x=>
    getComputedStyle(x).display),"none","Old frame-based alert UI must never flash");
  const pref=page.locator(".qscope-wind-event-pause-setting input");
  assert.equal(await pref.isChecked(),false);
  // Preference can still be stored before the first event, even though its
  // empty monitoring window is deliberately hidden.
  await page.evaluate(()=>window.ui.setPauseOnNewEvent(true));
  await page.evaluate(()=>window.addCase());
  assert.equal(await page.locator(".qscope-wind-event-inbox").isVisible(),true,
    "A new source-verified event must reveal its persistent notification");
  assert.equal(await page.locator(".qscope-wind-event-card").count(),1,
    "One event window rather than two transient frame alerts");
  assert.equal(await page.locator(".qscope-wind-event-card").getAttribute("data-severity"),
    "couplet","Combined hook/couplet case uses highest radar review priority");
  assert.match(await page.locator(".qscope-wind-event-open").innerText(),
    /HOOK \+ VELOCITY COUPLET.*HIGH-PRIORITY REVIEW/);
  assert.equal(await page.evaluate(()=>window.newEvents.length),1,
    "Multiple alert types in same event cannot pause playback repeatedly");
  assert.equal(await page.evaluate(()=>window.framesVisited.length),0,
    "No jump until the operator interacts");
  const box=await page.locator(".qscope-wind-event-inbox").boundingBox();
  assert(box && box.x>=0 && box.y>=0 &&
    box.x+box.width <= (mobile?390:1280)+1 &&
    box.y+box.height <= (mobile?844:800)+1,
    "Persistent event notification cannot overflow viewport");

  await page.evaluate(()=>window.ui.destroy());
  await load();await setup(false);
  assert.equal(await page.locator(".qscope-wind-event-card").count(),1,
    "Unopened event survives app reload and no longer flashes between frames");
  assert.equal(await page.locator(".qscope-wind-event-pause-setting input").isChecked(),true,
    "Operator pause preference must persist between sessions");
  assert.equal(await page.evaluate(()=>window.newEvents.length),0,
    "Restored event is not a new alert that pauses playback");
  await page.locator(".qscope-wind-event-open").click();
  assert.equal(await page.locator(".qscope-wind-event-evidence-row").count(),2);
  assert.equal(await page.locator(".qscope-wind-event-detail").getAttribute("data-severity"),
    "couplet","Opened review retains experimental red coupled-signature priority");
  assert.equal(await page.locator(
    '.qscope-wind-event-evidence-row[data-severity="hook"]').count(),1);
  assert.equal(await page.locator(
    '.qscope-wind-event-evidence-row[data-severity="couplet"]').count(),1);
  assert.equal(await page.locator(".qscope-wind-event-detail:not([hidden])").count(),1);
  assert.equal(await page.locator(".qscope-wind-evidence-snapshot img").count(),1,
    "Actual source crop stays available after frame expires");
  assert.match(await page.locator(".qscope-wind-evidence-snapshot").innerText(),
    /genuine BoM decoded reflectivity categories/);
  assert.equal(await page.evaluate(()=>window.framesVisited.length),1,
    "Only opening event requests exact frame/camera navigation");
  assert.equal(await page.evaluate(()=>window.framesVisited[0].evidence.category),
    "tornadic_candidate","Most informative signature opens first");
  assert.match(await page.locator(".qscope-wind-event-location-status").innerText(),
    /Original frame expired/);
  await page.locator(".qscope-wind-event-evidence-row button").last().click();
  assert.equal(await page.evaluate(()=>window.framesVisited.length),2,
    "Each retained source UTC can be reviewed from one window");
  await page.locator(".qscope-wind-event-detail-title button").click();
  await page.locator(".qscope-wind-event-controls button").click();
  assert.equal(await page.locator(".qscope-wind-event-card").count(),1,
    "History remains visible after acknowledgement");
  await page.locator(".qscope-wind-event-dismiss").click();
  assert.equal(await page.evaluate(()=>window.ui.events.length),0);
  assert.equal(await page.locator(".qscope-wind-event-inbox").isHidden(),true,
    "Clearing final historical event hides Radar Events again");
  // Verify an independent radial-wind signature is not labelled as a hook.
  await page.evaluate(()=>{
    const time=new Date(Date.now()-180000).toISOString();
    window.ui.observe([{
      category:"strong_radial_signature",observed_utc:time,
      source_utc:time,radar_id:"66",track_id:"WIND",
      latitude:-26.6,longitude:152.8,
      caveat:"Research only; radial velocity is not a measured surface gust"
    }],{mode:"doppler",frameUtc:time});
  });
  assert.equal(await page.locator(".qscope-wind-event-card").getAttribute("data-severity"),
    "wind");
  assert.match(await page.locator(".qscope-wind-event-open").innerText(),
    /POSSIBLE STRAIGHT-LINE WIND/);
  assert(!/HOOK ECHO/.test(await page.locator(".qscope-wind-event-open").innerText()),
    "Wind-only category must not claim a hook echo");
  await page.evaluate(()=>window.ui.clearEvent(window.ui.events[0].id));
  assert.equal(await page.locator(".qscope-wind-event-inbox").isHidden(),true);
  // Orange hook-only evidence is distinct from yellow wind and red combination.
  await page.evaluate(()=>{
    const time=new Date(Date.now()-120000).toISOString();
    window.ui.observe([{
      category:"hook_shape_only",observed_utc:time,
      source_utc:time,radar_id:"66",track_id:"HOOK",
      latitude:-28.3,longitude:153.3,
      caveat:"Research only; hook echo does not confirm a tornado"
    }],{mode:"rain",frameUtc:time});
  });
  assert.equal(await page.locator(".qscope-wind-event-card").getAttribute("data-severity"),
    "hook");
  assert.match(await page.locator(".qscope-wind-event-open").innerText(),
    /HOOK ECHO.*ELEVATED REVIEW/);
  await page.evaluate(()=>window.ui.clearEvent(window.ui.events[0].id));
  assert.equal(await page.locator(".qscope-wind-event-inbox").isHidden(),true);
  console.log("PASS "+(mobile?"mobile WebKit":"desktop Chromium")+
    ": persistent source crops, fresh-alert pause preference, grouped evidence, exact timestamp review, no frame-flicker UI");
} finally {await context.close();await browser.close();}
