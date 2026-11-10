import assert from "node:assert/strict";
import {chromium,webkit} from "playwright";

const mobile=process.env.STORMTRACKER_BROWSER==="mobile";
const browser=await (mobile?webkit:chromium).launch({headless:true});
const viewport=mobile?{width:390,height:760}:{width:1280,height:800};
const context=await browser.newContext(mobile?
  {viewport,isMobile:true,hasTouch:true}:{viewport});
const page=await context.newPage();
const base="http://127.0.0.1:8137/";
const preview="/preview/wind-hook-v10-6/";
const url=base+"qscope-radar-dock-legend-collision-fixture.html";
const html='<!doctype html><html><head>'+
  '<meta name="viewport" content="width=device-width, initial-scale=1">'+
  '<link rel="stylesheet" href="'+preview+'src/operational-dashboard-v9-1.css">'+
  '<link rel="stylesheet" href="'+preview+'src/lga-sidebar-legend-v1.css">'+
  '<link rel="stylesheet" href="'+preview+'src/qscope-reviewable-event-inbox-v10-6.css">'+
  '</head><body class="simple-ui" style="margin:0;overflow:hidden">'+
  '<main id="mapPanel" style="position:relative;overflow:hidden;isolation:isolate;height:'+(mobile?"500px":"780px")+
  ';width:'+(mobile?"390px":"920px")+';--stormtracker-control-z:3000">'+
  '<div id="nav" style="position:absolute;z-index:3000;top:6px;right:6px;display:flex;background:#0b2432;padding:4px"><button>Controls</button><button>Radar site</button><button>Reset view</button></div>'+

  '<section id="legendDock" class="card" data-mode="rain"><div id="legend" class="weather-legend-rain"><strong>BoM rain radar · reflectivity (dBZ)</strong>'+
  '<div class="intensity-scale">'+Array.from({length:15},(_,i)=>'<span><i style="background:hsl('+i*23+' 80% 50%)"></i>'+(12+i*4)+'</span>').join("")+'</div></div></section>'+
  '<div id="mapScaleBar" role="status" aria-label="Map scale" style="position:absolute;z-index:3000;left:8px;bottom:62px;width:140px;height:32px;background:#142b3a">20 km <span style="display:block;width:90px;border-bottom:3px solid #fff"></span></div>'+
  '<div id="mapTruthLabel" style="position:absolute;left:8px;bottom:28px;z-index:3000">Measured BoM reflectivity</div>'+
  '</main></body></html>';
await page.route(url,route=>route.fulfill({status:200,contentType:"text/html",body:html}));
function intersection(a,b){
 const x=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x));
 const y=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
 return x*y;
}
async function geometry(){
 return page.evaluate(()=>{
   const selectors=[".qscope-wind-event-inbox",".qscope-wind-event-detail","#legendDock","#mapScaleBar","#stormTrackerNorthCompass","#nav",".qscope-wind-event-open","#mapPanel"];
   const result={};
   for(const s of selectors){
     const el=document.querySelector(s);
     if(!el)continue;
     const r=el.getBoundingClientRect();
     result[s]={x:r.x,y:r.y,width:r.width,height:r.height};
   }
   const btn=document.querySelector(".qscope-wind-event-open");
   if(btn) {
     const r=btn.getBoundingClientRect();
     const el=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
     result.clickable=el===btn||btn.contains(el);
   }
   const inbox=document.querySelector(".qscope-wind-event-inbox");
   result.position=inbox?.dataset.placement??"";
   result.zIndex=inbox?Number(getComputedStyle(inbox).zIndex):null;
   result.inboxVisible=inbox?getComputedStyle(inbox).visibility!=="hidden":false;
   return result;
 });
}
try {
  const packed=await (await page.request.get(base+preview.slice(1)+"src/live3d-operational-v9.js")).text();
  assert(packed.includes("attachQscopeResearchEventDock"),
    "Full Q-SCOPE preview must use actual responsive event layout");
  assert(packed.includes("mountNorthCompass({") &&
    packed.includes('from "./north-compass-v1.js?v=v10-6-5-operational-compass"'),
    "Actual V10.6 package must mount original controller-powered compass");
  const layoutScript=await (await page.request.get(
    base+preview.slice(1)+"src/qscope-research-event-dock-layout-v10-6-1.js")).text();
  assert(layoutScript.includes("chooseQscopeRadarEventDock"));
  await page.goto(url,{waitUntil:"load"});
  await page.evaluate(async preview=>{
    const [{createPassiveWindEventInbox},{attachQscopeResearchEventDock},
      {mountNorthCompass}]=await Promise.all([
      import(preview+"src/qscope-reviewable-event-inbox-v10-6.js"),
      import(preview+"src/qscope-research-event-dock-layout-v10-6-1.js"),
      import(preview+"src/north-compass-v1.js")
    ]);
    const m=document.querySelector("#mapPanel");
    window.visits=[];
    // Mount the ORIGINAL operational compass module, NOT a fixture icon.
    // Its camera-controller click must preserve centre/range/pitch.
    window.compassClicks=0;
    window.cameraState={
      heading:Math.PI/2,longitude:153.4,latitude:-27.6,
      range:85000,pitch:-0.48
    };
    const controller={
      getState:()=>({...window.cameraState}),
      setView:patch=>{
        window.compassClicks++;
        Object.assign(window.cameraState,patch);
      }
    };
    window.realCompass=mountNorthCompass({
      cameraController:controller,mapPanel:m,documentRef:document,windowRef:window
    });
    if(window.realCompass.element.id!=="stormTrackerNorthCompass")
      throw Error("Original true-north compass component was not mounted");
    window.realCompass.update();
    window.researchInbox=createPassiveWindEventInbox({
      container:m,documentRef:document,storage:null,
      onNavigate:async(event,evidence)=>{
        window.visits.push({event,evidence});return {ok:true};
      }
    });
    window.placement=attachQscopeResearchEventDock({
      map:m,inbox:m.querySelector(".qscope-wind-event-inbox"),
      details:m.querySelector(".qscope-wind-event-detail"),
      win:window,documentRef:document
    });
    window.addEvent=(i=0)=>{
      const time=new Date(Date.UTC(2026,10,10,2,0)+i*60*60000).toISOString();
      return window.researchInbox.observe([{
        category:"hook_shape_only",observed_utc:time,
        source_utc:time,radar_id:"66",track_id:"ST"+i,
        latitude:-27.4+i*0.25,longitude:153.1,
        caveat:"Experimental only; not an official BoM warning."
      }],{mode:"rain",frameUtc:time});
    };
    window.placement.reposition();
  },preview);
  await page.waitForTimeout(160);
  assert.equal(await page.locator(".qscope-wind-event-inbox").isHidden(),true,
    "Zero viewable events must leave the entire under-toolbar region clear");
  assert.equal(await page.locator("#stormTrackerNorthCompass").isVisible(),true);
  await page.locator("#stormTrackerNorthCompass").click();
  assert.equal(await page.evaluate(()=>window.compassClicks),1,
    "Original compass remains clickable when no alerts are present");
  assert.equal(await page.evaluate(()=>window.cameraState.heading),0,
    "Compass click actually realigns the original map camera due north");
  assert.equal(await page.evaluate(()=>window.cameraState.range),85000,
    "Compass preserves selected zoom and viewpoint");
  await page.evaluate(()=>{
    window.addEvent();
    window.placement.reposition();
  });
  await page.waitForTimeout(160);
  let g=await geometry();
  assert.equal(intersection(g[".qscope-wind-event-inbox"],g["#legendDock"]),0,
    "One pending alert cannot overlap the existing BoM legend");
  assert.equal(intersection(g[".qscope-wind-event-inbox"],g["#mapScaleBar"]),0,
    "Persistent wind-event queue cannot obscure the separate map scale");
  assert.equal(intersection(g[".qscope-wind-event-inbox"],g["#stormTrackerNorthCompass"]),0,
    "Persistent radar-event queue cannot obscure the true-north compass");
  assert.equal(intersection(g[".qscope-wind-event-inbox"],g["#nav"]),0,
    "Alert cannot obscure map navigation controls");
  assert(Math.abs(g[".qscope-wind-event-inbox"].y-
    (g["#nav"].y+g["#nav"].height+10))<=2,
    "Compact event dock must sit directly beneath the radar controls");
  assert(g[".qscope-wind-event-inbox"].x+
    g[".qscope-wind-event-inbox"].width<=g["#nav"].x+g["#nav"].width+2,
    "Compact event dock must align with radar toolbar");
  if(!g.clickable){
    const details=await page.evaluate(()=>{
      const button=document.querySelector(".qscope-wind-event-open");
      const dock=document.querySelector(".qscope-wind-event-inbox");
      const r=button.getBoundingClientRect();
      const target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      const dockRect=dock.getBoundingClientRect();
      const nav=document.querySelector("#nav").getBoundingClientRect();
      return {button:[r.x,r.y,r.width,r.height],
        target:target?.outerHTML?.slice(0,260)??null,
        eventVisibility:getComputedStyle(dock).visibility,
        eventDisplay:getComputedStyle(dock).display,
        dock:[dockRect.x,dockRect.y,dockRect.width,dockRect.height],
        nav:[nav.x,nav.y,nav.width,nav.height],
        placement:dock.dataset.placement,hidden:dock.hidden};
    });
    console.error("Q-SCOPE EVENT HIT TARGET",JSON.stringify(details));
  }
  assert(g.clickable,"Operator MUST be able to actually click the event button");
  assert(g.zIndex>3000,"Event dock must have map-control stacking priority");

  // Multiple separate events must not grow underneath the original legend.
  await page.evaluate(()=>{
    for(let i=1;i<9;i++)window.addEvent(i);
    window.placement.reposition();
  });
  await page.waitForTimeout(200);
  g=await geometry();
  assert.equal(intersection(g[".qscope-wind-event-inbox"],g["#legendDock"]),0,
    "Event list with 9 stored cases remains clear of BoM legend");
  assert(g.clickable,"Top actionable event survives scrollable multi-event queue");
  assert.equal(intersection(g[".qscope-wind-event-inbox"],g["#mapScaleBar"]),0,
    "Long persistent wind-event list cannot obscure the map scale");
  assert.equal(intersection(g[".qscope-wind-event-inbox"],g["#stormTrackerNorthCompass"]),0,
    "Nine queued alerts cannot obscure the true-north compass");
  assert(await page.locator(".qscope-wind-event-list").evaluate(x=>
    getComputedStyle(x).overflowY==="auto"),"Long event queue scrolls rather than covering legend");
  await page.locator(".qscope-wind-event-open").first().click();
  await page.waitForTimeout(160);
  assert.equal(await page.evaluate(()=>window.visits.length),1);
  g=await geometry();
  for(const k of ["#legendDock","#mapScaleBar","#stormTrackerNorthCompass","#nav"]){
    assert.equal(intersection(g[".qscope-wind-event-detail"],g[k]),0,
      "Expanded event evidence cannot obscure "+k);
  }
  assert.equal(g.inboxVisible,false,
    "Opening an event replaces its queue at the same under-toolbar location");
  assert(Math.abs(g[".qscope-wind-event-detail"].y-
    (g["#nav"].y+g["#nav"].height+10))<=2,
    "Expanded evidence must open directly beneath radar controls, not over the scale");
  assert(g[".qscope-wind-event-detail"].x+
    g[".qscope-wind-event-detail"].width<=g["#stormTrackerNorthCompass"].x-8,
    "Expanded evidence retains a dedicated compass gutter beneath the toolbar");
  await page.locator("#stormTrackerNorthCompass").click();
  assert.equal(await page.evaluate(()=>window.compassClicks),2,
    "North compass remains clickable even with expanded radar-event evidence");
  const closeAction=await page.locator(".qscope-wind-event-detail-title button").boundingBox();
  assert(closeAction,"Expanded review must have its own close action");
  assert(await page.evaluate(()=>{
    const btn=document.querySelector(".qscope-wind-event-detail-title button");
    const r=btn.getBoundingClientRect();
    const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return hit===btn||btn.contains(hit);
  }),"Expanded evidence close action must remain clickable");
  const details=await page.locator(".qscope-wind-event-detail").boundingBox();
  const map=await page.locator("#mapPanel").boundingBox();
  assert(details&&details.x>=map.x-1&&details.y>=map.y-1 &&
    details.x+details.width<=map.x+map.width+1 &&
    details.y+details.height<=map.y+map.height+1,
    "Evidence review window must fit inside available map canvas");
  assert.equal(await page.locator(".qscope-wind-event-detail:not([hidden])").count(),1);
  await page.locator(".qscope-wind-event-detail-title button").click();
  await page.waitForTimeout(100);
  assert.equal(await page.locator(".qscope-wind-event-inbox").evaluate(
    x=>getComputedStyle(x).visibility),"visible",
    "Closing expanded evidence restores the pending event queue");
  await page.evaluate(()=>{
    const legend=document.querySelector("#legendDock");
    legend.dataset.mode="wind";
    legend.style.height="155px"; // Different BoM wind legend height.
    window.placement.reposition();
  });
  await page.waitForTimeout(80);
  g=await geometry();
  assert.equal(intersection(g[".qscope-wind-event-inbox"],g["#legendDock"]),0,
    "Doppler legend resizing cannot cover persistent event queue");
  assert.equal(intersection(g[".qscope-wind-event-inbox"],g["#mapScaleBar"]),0,
    "Mode changes cannot cover the real map scale");
  await page.evaluate(()=>{
    for(const event of window.researchInbox.events)
      window.researchInbox.clearEvent(event.id);
  });
  await page.waitForTimeout(50);
  assert.equal(await page.locator(".qscope-wind-event-inbox").isHidden(),true,
    "Clearing the last historical/pending event removes the dock entirely");
  await page.locator("#stormTrackerNorthCompass").click();
  assert.equal(await page.evaluate(()=>window.compassClicks),3,
    "Original true-north control remains fully operable after clearing events");
  console.log("PASS "+(mobile?"mobile WebKit":"desktop Chromium")+
    ": real BoM 15-band legend and 9 persistent alert cards clear; compact/expanded events dock under radar controls with reachable actions");
}finally{await context.close();await browser.close();}
