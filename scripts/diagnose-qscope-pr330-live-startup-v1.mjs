// Read-only real-browser diagnostic against the DEPLOYED named Cloudflare
// branch preview. A green HTML request is never evidence that Cesium booted.
import {chromium,webkit} from 'playwright';
const base=process.env.QSCOPE_SMOKE_URL||
 'https://qscope-ui-seven-pr330-stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/';
let bad=0;
for(const [name,engine,viewport] of (process.env.QSCOPE_RADAR_DIAG==='1' ?
 [['chromium',chromium,{width:1365,height:920}]]:
 [['chromium',chromium,{width:1365,height:920}],['webkit',webkit,{width:390,height:844}]])
){
 const browser=await engine.launch({headless:true,args:name==='chromium'?
  ['--disable-dev-shm-usage','--enable-webgl','--use-gl=angle','--use-angle=swiftshader']:[]});
 const ctx=await browser.newContext({viewport,ignoreHTTPSErrors:false});
 const top=await ctx.newPage();
 const reports=[];
 const record=(type,x)=>{if(reports.length<75)reports.push({type,detail:String(x).slice(0,440)})};
 top.on('pageerror',e=>record('shell-pageerror',e.stack||e));
 top.on('response',res=>{
   if(res.status()>=400)record('FRAME-http-'+res.status(),
     res.request().resourceType()+' '+res.url().slice(0,650));
 });
 top.on('requestfailed',req=>record('FRAME-failed',
    req.resourceType()+' '+req.url().slice(0,650)+' '+req.failure()?.errorText));
 top.on('console',m=>{
   if(m.type()==='error')record('FRAME-console-error',
      m.text()+' at '+m.location()?.url+':'+m.location()?.lineNumber);
 });
 top.on('console',m=>{if(m.type()==='error'||m.type()==='warning')record('shell-'+m.type(),m.text())});
 ctx.on('page',page=>{
   page.on('pageerror',e=>record('iframe-pageerror',e.stack||e));
   page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')record('iframe-'+m.type(),m.text())});
   page.on('requestfailed',req=>{
     const u=req.url();
     if(/qscope|worker|cesium|.js|.css|earth|ion|terrain/.test(u))
       record('request-failed',u+' '+req.failure()?.errorText)
   });
   page.on('response',res=>{
     if(res.status()>=400){
       const url=res.url();
       if(/\.js|\.css|cesium|qscope|stormtracker|terrain/.test(url))
        record('http-'+res.status(),url)
     }
   });
 });
 let navigation='';
 try{const res=await top.goto(base,{waitUntil:'domcontentloaded',timeout:30000});navigation=String(res?.status())}
 catch(e){record('navigation',e.stack||e)}
 await top.waitForTimeout(3500);
 const iframe=top.frameLocator('iframe#liveFrame');
 let state={};
 try{
  state=await iframe.locator('body').evaluate(async body=>{
   const id=x=>document.getElementById(x);
   const cesiumContainer=id('cesiumContainer')||id('map')||id('viewer');
   const canvases=[...document.querySelectorAll('canvas')].map(el=>{
     const r=el.getBoundingClientRect();
     return {width:el.width,height:el.height,clientWidth:r.width,clientHeight:r.height,parent:el.parentElement?.className};
   });
   const scripts=[...document.scripts].map(s=>({type:s.type,src:s.src})).filter(s=>s.src).slice(-12);
   return {
    title:document.title,readyState:document.readyState,
    canvasCount:canvases.length,canvases,
    cesiumContainer:cesiumContainer?{id:cesiumContainer.id,
      width:cesiumContainer.getBoundingClientRect().width,
      height:cesiumContainer.getBoundingClientRect().height}:null,
    checkingRadar: id('hybridStatus')?.textContent?.slice(0,200)||
      id('radarLoopStatus')?.textContent?.slice(0,200),
    radarFrames:window.hybridFrames?.length??null,
    cesiumLoaded:typeof window.Cesium,
    clockRegistry:typeof window.__qscopePollClock,
    mainScripts:scripts
   };
  });
 }catch(e){record('iframe-state-failed',e.stack||e)}
 if(process.env.QSCOPE_RADAR_DIAG==='1'){
   try{
    await top.waitForFunction(()=>{
      const doc=document.querySelector('iframe#liveFrame')?.contentDocument;
      const txt=doc?.getElementById('sharedHistoryNote')?.textContent||'';
      return /Loaded \d+ observed|skipped|unavailable/i.test(txt);
    },{timeout:45000}).catch(()=>{});
    const radar=await iframe.locator('body').evaluate(()=>{
      const el=id=>document.getElementById(id);
      return {checkedAt:new Date().toISOString(),
       frameLabel:el('hybridFrameLabel')?.textContent,
       loopWindow:el('operationalLoopWindow')?.textContent,
       history:el('sharedHistoryNote')?.textContent?.slice(0,1000),
       sourceFailureDetails:el('sharedHistoryNote')?.title?.slice(0,3000),
       autoRefresh:el('autoRefreshNote')?.textContent,
       status:el('hybridStatus')?.textContent||el('status')?.textContent,
       sliderMax:el('hybridFrameSlider')?.max
      };
    });
    console.log('QSCOPE_LIVE_RADAR_SEVENTH_FRAME_HANDOFF',JSON.stringify(radar));
   }catch(e){record('radar-diagnostic',e.stack||e)}
  }
 let screen='';
 try{screen='/tmp/qscope-pr330-'+name+'.png';await top.screenshot({path:screen,fullPage:false})}catch{}
 console.log('QSCOPE_REAL_BROWSER_STARTUP',JSON.stringify({name,navigation,state,reports,screenshot:screen}));
 if(!state?.canvasCount || reports.some(r=>r.type==='iframe-pageerror'))bad++;
 await browser.close();
}
if(bad){console.error('QSCOPE_REAL_BROWSER_STARTUP_FAILED',bad);process.exitCode=1}
