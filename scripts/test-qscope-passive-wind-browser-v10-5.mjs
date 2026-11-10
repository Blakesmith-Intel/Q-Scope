import assert from "node:assert/strict";
import {chromium,webkit} from "playwright";

const mobile=process.env.STORMTRACKER_BROWSER==="mobile";
const browser=await (mobile?webkit:chromium).launch({headless:true});
const context=await browser.newContext(mobile
  ? {viewport:{width:390,height:844},isMobile:true,hasTouch:true}
  : {viewport:{width:1280,height:800}});
const page=await context.newPage();
const url="http://127.0.0.1:8137/";
const moduleUrl="/preview/wind-hook-v10-5/src/qscope-passive-wind-inbox-v10-5.js";
const cssUrl="/preview/wind-hook-v10-5/src/qscope-passive-wind-inbox-v10-5.css";
const makeDocument=async()=>{
  await page.goto(url+"BUILD.txt",{waitUntil:"domcontentloaded"});
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="'+cssUrl+'"></head>'+
    '<body style="margin:0;background:#0b1f2b"><main id="mapPanel" style="position:relative;height:100vh;width:100vw;overflow:hidden"></main></body></html>');
  await page.locator(cssUrl.replace(".css",".css")).count().catch(()=>{});
};
try{
  const source=await (await page.request.get(url+moduleUrl.slice(1))).text();
  assert(source.includes("createPassiveWindEventInbox"));
  const runtime=await (await page.request.get(
    url+"preview/wind-hook-v10-5/src/live3d-operational-v9.js")).text();
  assert(runtime.includes('queuePassiveResearchPair("rain",i)'));
  assert(!runtime.includes("enableWindHookResearch"),
    "The V10.5 preview must not require research checkbox activation");
  await makeDocument();
  await page.evaluate(async moduleUrl=>{
    const mod=await import(moduleUrl);
    localStorage.removeItem(mod.Q_SCOPE_EVENT_STORAGE_KEY);
    window.startInbox=()=> {
      window.nav=[];
      window.inbox=mod.createPassiveWindEventInbox({
        container:document.querySelector("#mapPanel"),
        storage:localStorage,
        onNavigate:async(event,evidence)=>{
          window.nav.push({event,evidence});
          return {ok:true,message:"Original frame selected in test."};
        }
      });
    };
    window.startInbox();
    window.addTestEvents=()=>{
      const t=["2026-11-10T04:00:00Z","2026-11-10T04:05:00Z","2026-11-10T04:10:00Z"];
      const cat=["strong_radial_signature","hook_shape_only","tornadic_candidate"];
      for(let i=0;i<3;i++){
        window.inbox.observe([{
          category:cat[i],radar_id:"66",track_id:"ST0015",
          observed_utc:t[i],source_utc:t[i],latitude:-27.45,
          longitude:153.1,caveat:"Research only, not an official warning.",
          velocity_kmh:i===0?-65:null,radial_shear_kmh:i===2?105:null
        }],{mode:"rain",frameUtc:t[i]});
      }
    };
  },moduleUrl);
  assert.equal(await page.locator(".qscope-wind-event-inbox").evaluate(el=>el.hidden),true);
  assert.equal(await page.evaluate(()=>window.nav.length),0);
  await page.evaluate(()=>window.addTestEvents());
  assert.equal(await page.locator(".qscope-wind-event-card").count(),1);
  assert.equal(await page.locator(".qscope-wind-event-evidence-row").count(),0);
  assert.equal(await page.evaluate(()=>window.nav.length),0,
    "Passive alerts must not pan or alter the user-owned map");
  assert.match(await page.locator(".qscope-wind-event-card").innerText(),/3 observations/);
  const box=await page.locator(".qscope-wind-event-inbox").boundingBox();
  assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=
    (mobile?390:1280)+1&&box.y+box.height<=(mobile?844:800)+1,
    "Inbox must remain inside actual mobile/desktop viewport");

  // Reconstruct UI after simulated reload: pending notification must survive.
  await page.evaluate(()=>window.inbox.destroy());
  await makeDocument();
  await page.evaluate(async moduleUrl=>{
    const mod=await import(moduleUrl);
    window.nav=[];
    window.inbox=mod.createPassiveWindEventInbox({
      container:document.querySelector("#mapPanel"),storage:localStorage,
      onNavigate:async(event,evidence)=>{
        window.nav.push({event,evidence});
        return {ok:true,message:"Original source frame selected."};
      }
    });
  },moduleUrl);
  assert.equal(await page.locator(".qscope-wind-event-card").count(),1,
    "Pending alerts survive a page reload, not just frame scrubbing");

  await page.locator(".qscope-wind-event-open").click();
  assert.equal(await page.locator(".qscope-wind-event-card").count(),0,
    "Operator interaction acknowledges only one event");
  assert.equal(await page.locator(".qscope-wind-event-evidence-row").count(),3,
    "Multiple alert types share ONE visible event window");
  assert.equal(await page.locator(".qscope-wind-event-detail:not([hidden])").count(),1);
  assert.equal(await page.evaluate(()=>window.nav.length),1,
    "One user click authorises exactly one frame/navigation request");
  assert.equal(await page.evaluate(()=>window.nav[0].evidence.category),
    "tornadic_candidate","Combined hook+couplet evidence opens before weaker candidates");
  assert.equal(await page.evaluate(()=>window.nav[0].evidence.frameUtc),
    "2026-11-10T04:10:00Z");
  await page.locator(".qscope-wind-event-evidence-row button").last().click();
  assert.equal(await page.evaluate(()=>window.nav.length),2,
    "The operator can request another recorded source frame inside same window");

  await page.locator(".qscope-wind-event-detail-title button").click();
  await page.locator(".qscope-wind-event-controls button").click();
  assert.equal(await page.locator(".qscope-wind-event-card").count(),1,
    "Acknowledged event can be reopened from History");
  await page.locator(".qscope-wind-event-card .qscope-wind-event-dismiss").click();
  assert.equal(await page.evaluate(()=>window.inbox.events.length),0,
    "Explicit Clear dismisses the event; it cannot re-notify from the same loop");
  assert.equal(await page.evaluate(()=>window.nav.length),2,
    "Clearing does not trigger a hidden camera movement");
  console.log("PASS actual "+(mobile?"mobile WebKit":"desktop Chromium")+
    " Q-SCOPE passive notifications: grouped evidence, sticky reload, click-to-source-frame and explicit dismissal");
} finally {
  await context.close();
  await browser.close();
}
