import assert from "node:assert/strict";
import {chromium,webkit} from "playwright";
const mobile=process.env.STORMTRACKER_BROWSER==="mobile";
const browser=await (mobile?webkit:chromium).launch({headless:true});
const width=mobile?390:1280,height=mobile?844:800;
const ctx=await browser.newContext(mobile?{
  viewport:{width,height},isMobile:true,hasTouch:true
}:{viewport:{width,height}});
const page=await ctx.newPage();
const origin="http://127.0.0.1:8137",dir="/preview/wind-hook-v10-7/src/";
const fixture=origin+"/qscope-v10-7-layout-test.html";
const bands=Array.from({length:15},(_,i)=>'<span><i style="background:'+
  ["#fff","#77aadd","#14aacc","#ffcc22","#de4433"][i%5]+
  '"></i>'+(12+i*3)+'</span>').join("");
const body='<!doctype html><html><head>'+
  '<meta name="viewport" content="width=device-width, initial-scale=1">'+
  '<link rel="stylesheet" href="/src/operational-dashboard-v9-1.css">'+
  '<link rel="stylesheet" href="/src/lga-sidebar-legend-v1.css">'+
  '<link rel="stylesheet" href="'+dir+'qscope-reviewable-event-inbox-v10-6.css">'+
  '<link rel="stylesheet" href="'+dir+'qscope-event-dock-layout-v10-7.css">'+
  '<style>html,body{margin:0}#app{display:block}#mapPanel{width:'+
  (mobile?"100vw":"min(900px,calc(100vw - 360px))")+
  ';height:'+(mobile?"min(740px,90dvh)":"min(700px,96dvh)")+
  ';position:relative;min-width:0;min-height:0;isolation:isolate;overflow:hidden;background:#dee0d4}'+
  '#geoLabel{position:absolute;right:140px;bottom:100px;z-index:var(--stormtracker-geo-label-z);font:bold 22px Arial}</style>'+
  '</head><body><div id="app"><main id="mapPanel">'+
  '<div id="geoLabel">St George</div>'+
  '<div id="nav"><button>Radar</button><button>Reset view</button></div>'+
  '<section id="legendDock" class="card" data-mode="rain">'+
  '<div id="legend" class="weather-legend-rain"><strong>BoM rain radar · reflectivity (dBZ)</strong>'+
  '<div id="reflectivityLegend" class="intensity-scale">'+bands+'</div></div>'+
  '<strong class="velocity-title">BoM Doppler radial velocity · km/h</strong>'+
  '<div id="dopplerVelocityLegend"><div class="velocity-scale">'+bands+'</div></div>'+
  '</section></main></div></body></html>';
await page.route(fixture,route=>route.fulfill({status:200,contentType:"text/html",body}));
function area(a,b){return Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*
  Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));}
async function readLayout(){
  return page.evaluate(()=>{
    const m=document.querySelector("#mapPanel"),i=m.querySelector(".qscope-wind-event-inbox"),
      l=m.querySelector("#legendDock"),d=m.querySelector(".qscope-wind-event-detail");
    const rect=x=>{const v=x.getBoundingClientRect();return {
      left:v.left,right:v.right,top:v.top,bottom:v.bottom,
      width:v.width,height:v.height
    };};
    return {mode:m.dataset.qscopeEventDock,map:rect(m),
      inbox:rect(i),legend:rect(l),detail:rect(d),
      inboxZ:Number(getComputedStyle(i).zIndex),
      legendZ:Number(getComputedStyle(l).zIndex),
      detailZ:Number(getComputedStyle(d).zIndex),
      inboxVis:getComputedStyle(i).visibility,
      legendVis:getComputedStyle(l).visibility,
      reviewHidden:m.dataset.qscopeLegendReviewHidden};
  });
}
async function verify(label){
  const g=await readLayout();
  assert(g.inboxZ>g.legendZ,label+": event panel must outrank original BoM legend and town labels");
  assert.equal(area(g.inbox,g.legend),0,label+": NOT overlapping event/legend rectangles");
  assert(g.inbox.left>=g.map.left-1&&g.inbox.right<=g.map.right+1&&
    g.inbox.top>=g.map.top-1,label+": event panel inside real map bounds");
  await page.locator(".qscope-wind-event-open").click({trial:true,timeout:4500});
  return g;
}
try{
  for(const path of ["/src/lga-sidebar-legend-v1.css",
    dir+"qscope-event-dock-layout-v10-7.js",
    dir+"qscope-event-dock-layout-v10-7.css"]){
    const response=await page.request.get(origin+path);
    assert(response.ok(),"Missing actual QA resource: "+path+" "+response.status());
  }
  const runtime=await (await page.request.get(origin+
    "/preview/wind-hook-v10-7/src/live3d-operational-v9.js")).text();
  assert(runtime.includes("attachQScopeRadarEventLayout"));
  assert(!runtime.includes("enableWindHookResearch"));
  await page.goto(fixture,{waitUntil:"load"});
  await page.evaluate(async dir=>{
    const {createPassiveWindEventInbox,Q_SCOPE_EVENT_STORAGE_KEY}=
      await import(dir+"qscope-reviewable-event-inbox-v10-6.js");
    const {attachQScopeRadarEventLayout}=
      await import(dir+"qscope-event-dock-layout-v10-7.js");
    localStorage.removeItem(Q_SCOPE_EVENT_STORAGE_KEY);
    const map=document.querySelector("#mapPanel");
    window.navCalls=[];
    window.inbox=createPassiveWindEventInbox({
      container:map,storage:localStorage,
      onNavigate:async(event,evidence)=>{
        window.navCalls.push({event,evidence});
        return {ok:true,message:"Original source UTC frame displayed in fixture."};
      }
    });
    window.layout=attachQScopeRadarEventLayout({mapPanel:map});
    const t="2026-11-10T07:00:00Z";
    window.inbox.observe([{category:"hook_shape_only",
      radar_id:"66",track_id:"ST202",
      longitude:153.1,latitude:-27.45,
      observed_utc:t,source_utc:t,
      caveat:"Research only, not a BoM warning"
    }],{mode:"rain",frameUtc:t});
  },dir);
  await page.waitForTimeout(150);
  let g=await verify(mobile?"Mobile map":"Desktop map");
  assert.equal(g.mode,mobile?"stacked":"split");
  assert.equal(await page.evaluate(()=>window.navCalls.length),0);
  if(!mobile){
    await page.locator("#mapPanel").evaluate(el=>el.style.width="640px");
    await page.waitForTimeout(180);
    g=await verify("Desktop with narrow map alongside sidebar");
    assert.equal(g.mode,"stacked");
    await page.locator("#mapPanel").evaluate(el=>el.style.width="900px");
    await page.waitForTimeout(180);
    assert.equal((await verify("Resized desktop map")).mode,"split");
  }
  await page.locator("#legendDock").evaluate(el=>el.dataset.mode="wind");
  await page.waitForTimeout(180);
  await verify("Taller Doppler legend");
  await page.locator(".qscope-wind-event-open").click();
  await page.waitForTimeout(180);
  g=await readLayout();
  assert(g.detailZ>g.legendZ,
    "Interactive event evidence must outrank the original BoM legend");
  assert.equal(g.inboxVis,"hidden",
    "Notification tray gives focused event review its own unobscured window");
  if(g.reviewHidden==="true")assert.equal(g.legendVis,"hidden",
    "Very narrow map temporarily hides colliding original legend only during review");
  assert.equal(await page.evaluate(()=>window.navCalls.length),1,
    "Camera/frame navigation occurs only after operator interaction");
  await page.locator(".qscope-wind-event-detail-title button").click();
  await page.waitForTimeout(180);
  g=await readLayout();
  assert.equal(g.inboxVis,"visible");
  assert.equal(g.legendVis,"visible");
  console.log("PASS "+(mobile?"mobile WebKit":"desktop Chromium")+
    " V10.7 source-real BoM legend and persistent alert occupy separate slots; navigable unoccluded event window; responsive map resizing");
}finally{await ctx.close();await browser.close();}
