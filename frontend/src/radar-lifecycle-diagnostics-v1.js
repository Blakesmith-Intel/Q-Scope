// Per-tab, read-only radar lifecycle and memory evidence.
// No external telemetry, browser refresh, polling or operator UI changes.
export function installRadarLifecycleDiagnostics({
  win=window,doc=document,canvas=null,storageKey="stormtracker-radar-lifecycle-v1",
  maxEvents=48
}={}){
  let storage=null;
  try{storage=win.sessionStorage;}catch{}
  let persisted=[];
  try{
    const value=JSON.parse(storage?.getItem(storageKey)??"[]");
    if(Array.isArray(value))persisted=value.slice(-maxEvents);
  }catch{}
  const entries=persisted;
  function record(type,extra={}){
    const event={type,utc:new Date().toISOString(),...extra};
    entries.push(event);
    while(entries.length>maxEvents)entries.shift();
    try{storage?.setItem(storageKey,JSON.stringify(entries));}catch{}
  }
  function memory(){
    const heap=win.performance?.memory;
    return {
      usedJsHeapBytes:Number.isFinite(heap?.usedJSHeapSize)?heap.usedJSHeapSize:null,
      heapLimitBytes:Number.isFinite(heap?.jsHeapSizeLimit)?heap.jsHeapSizeLimit:null
    };
  }
  const navigation=win.performance?.getEntriesByType?.("navigation")?.[0];
  record("radar-iframe-runtime-boot",{navigationType:navigation?.type??"unknown"});
  doc.addEventListener("visibilitychange",()=>{
    record(doc.hidden?"tab-hidden":"tab-visible");
  });
  win.addEventListener("pageshow",e=>record("page-show",{restored:!!e.persisted}));
  win.addEventListener("pagehide",e=>record("page-hide",{restored:!!e.persisted}));
  canvas?.addEventListener("webglcontextlost",()=>record("webgl-context-lost"));
  canvas?.addEventListener("webglcontextrestored",()=>record("webgl-context-restored"));
  try{
    // The top-level app owns its iframe. Distinguish an actual iframe reload
    // from an ordinary measured-frame swap inside the existing Cesium map.
    win.frameElement?.addEventListener("load",()=>record("iframe-document-loaded"));
  }catch{}
  return {
    record,
    sampleMemory(extra={}){record("radar-refresh-memory",{...memory(),...extra});},
    snapshot(){
      return {events:entries.map(entry=>({...entry})),memory:memory(),
        bootCount:entries.filter(entry=>entry.type==="radar-iframe-runtime-boot").length,
        webglLossCount:entries.filter(entry=>entry.type==="webgl-context-lost").length};
    }
  };
}
