// Q-SCOPE refresh clocks: read-only view of EXISTING controller schedulers.
// Exactly one local 1-second UI tick; absolutely no fetch, Worker call, source
// interval change, page reload, radar frame replacement or new service.
(function(){
 "use strict";
 const deadlines=new Map(),readers=new Map();
 const clock={
  arm(key,interval){
   const ms=Number(interval);
   if(!Number.isFinite(ms)||ms<=0)return;
   deadlines.set(key,Date.now()+ms);
  },
  tick(key,interval){this.arm(key,interval);},
  stop(key){deadlines.delete(key);readers.delete(key);},
  observe(key,read){if(typeof read==="function")readers.set(key,read);},
  next(key){
   try{
    const r=readers.get(key)?.();
    if(r!==undefined)return r;
    return deadlines.get(key)||0;
   }catch{return 0;}
  }
 };
 Object.defineProperty(window,"__qscopePollClock",{
  configurable:false,writable:false,value:clock
 });
 const status=id=>document.getElementById(id);
 const enabled={
  warnings:()=>Boolean(status("showOfficialBomWarnings")?.checked),
  rainfall:()=>Boolean(status("showSignificantRainfall")?.checked),
  "observed-wind":()=>Boolean(status("showBomWindObservations")?.checked||
    status("bomWindGustReport")?.open),
  qfd:()=>Boolean(status("showQfdTechnicalRescues")?.checked),
  "road-classes":()=>Boolean(status("roadTypeReport")?.open)
 };
 function phrase(key,due,now){
  const isPaused=document.hidden;
  if(isPaused)return "Paused in background";
  if(enabled[key]&&!enabled[key]())return "Enable layer for updates";
  const onOpen=key==="road-classes";
  const t=Number(due);
  if(!Number.isFinite(t)||t<=0)return onOpen?"Checks on opening":"Awaiting schedule";
  const seconds=Math.max(0,Math.ceil((t-now)/1000));
  if(seconds===0)return onOpen?"Recheck on reopening":"Next check due";
  const hours=Math.floor(seconds/3600);
  const mm=Math.floor(seconds%3600/60),ss=seconds%60;
  const clock=(hours?String(hours).padStart(2,"0")+":":"")+
   String(mm).padStart(2,"0")+":"+String(ss).padStart(2,"0");
  return onOpen?"Recheck eligible in "+clock:"Next check "+clock;
 }
 function update(){
  const now=Date.now();
  for(const el of document.querySelectorAll("output[data-qscope-poll]")){
   const key=el.dataset.qscopePoll;
   const label=phrase(key,clock.next(key),now);
   if(el.textContent!==label)el.textContent=label;
  }
 }
 // Source controllers mount on their established tick; reconnect on bfcache.
 function start(){
  if(window.__qscopeCountdownInterval)return;
  update();
  window.__qscopeCountdownInterval=window.setInterval(update,1000);
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
 else start();
 window.addEventListener("pageshow",update);
 document.addEventListener("visibilitychange",update);
 window.addEventListener("pagehide",()=>{
  if(window.__qscopeCountdownInterval){
   clearInterval(window.__qscopeCountdownInterval);
   window.__qscopeCountdownInterval=0;
  }
 });
 window.addEventListener("pageshow",start);
})();
