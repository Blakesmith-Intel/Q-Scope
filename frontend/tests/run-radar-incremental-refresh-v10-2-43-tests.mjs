import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {planIncrementalRadarWindow} from "../src/radar-incremental-window-v1.js";
import {createContinuousPlayback} from "../src/continuous-playback-v1.js";
import {installRadarLifecycleDiagnostics} from "../src/radar-lifecycle-diagnostics-v1.js";
import {radarTileFailureSnapshot} from "../src/bom-wmts-loop-v2.js";

const iso=n=>new Date(Date.UTC(2026,10,1,0,n)).toISOString().replace(".000Z","Z");
const frame=n=>({observedUtc:iso(n),sourceMetadata:{region:"08"}});
const series=mins=>mins.map(frame);
const first=series([0,5,10,15,20,25]);
const next=series([5,10,15,20,25,30]);
assert.deepEqual(planIncrementalRadarWindow(first,next),{
 dropped:1,retained:5,appended:1,appendStart:5,lastObservedUtc:iso(30)
});
assert.deepEqual(planIncrementalRadarWindow(first,series([0,5,10,15,20,25,30])),{
 dropped:0,retained:6,appended:1,appendStart:6,lastObservedUtc:iso(30)
});
assert.equal(planIncrementalRadarWindow(first,series([0,5,10,15,20,25])),null);
assert.equal(planIncrementalRadarWindow(first,series([5,10,15,20,25])),null);
// Genuine missing earlier observation is not an append. Rebuild from
// historical source-true UTC rather than inserting it out of chronology.
assert.equal(planIncrementalRadarWindow(series([0,5,15,20,25]),series([0,5,10,15,20,25,30])),null);
const inferred={...frame(10),sourceMetadata:{region:"08",temporalInference:{method:"linear"}}};
assert.equal(planIncrementalRadarWindow([frame(5),inferred,frame(15)],series([5,10,15,20])),null);
assert.equal(planIncrementalRadarWindow(first,next.map(f=>({...f,sourceMetadata:{region:"23"}}))),null);
assert.equal(planIncrementalRadarWindow(first,series([5,10,15,15,25,30])),null);

const records=new Map();
const storage={
 getItem:key=>records.get(key)??null,
 setItem:(key,value)=>records.set(key,value)
};
function target(){
 const callbacks=new Map();
 return {addEventListener:(name,fn)=>callbacks.set(name,fn),
   emit:(name,event={})=>callbacks.get(name)?.(event)};
}
const win={sessionStorage:storage,
 performance:{memory:{usedJSHeapSize:25000000,jsHeapSizeLimit:250000000},
 getEntriesByType:()=>[{type:"reload"}]},
 ...target()};
const doc={hidden:false,...target()},canvas=target();
const journal=installRadarLifecycleDiagnostics({win,doc,canvas,maxEvents:10});
doc.emit("visibilitychange");
canvas.emit("webglcontextlost");
canvas.emit("webglcontextrestored");
journal.sampleMemory({region:"23",frameCount:6,incremental:true});
assert.equal(journal.snapshot().bootCount,1);
assert.equal(journal.snapshot().webglLossCount,1);
assert.equal(journal.snapshot().events.at(-1).usedJsHeapBytes,25000000);
const restored=installRadarLifecycleDiagnostics({win,doc,canvas,maxEvents:10});
assert.equal(restored.snapshot().bootCount,2);
assert(restored.snapshot().events.some(item=>item.navigationType==="reload"));
assert.deepEqual(radarTileFailureSnapshot("08"),[]);

// Active playback must keep its existing clock and rebase a cursor after
// oldest-frame retirement. No pause/play pair is permitted during append.
let current=first.slice(),index=0,rendered=[],playingChanges=[];
let player;
player=createContinuousPlayback({
 count:()=>current.length,currentIndex:()=>index,
 showFrame:async nextIndex=>{
   await new Promise(resolve=>setTimeout(resolve,1));
   index=nextIndex;
   rendered.push(current[index].observedUtc);
   if(rendered.length===4){
     const proposal=series([5,10,15,20,25,30]);
     const plan=planIncrementalRadarWindow(current,proposal);
     assert(plan);
     const selectedTime=current[index].observedUtc;
     current=proposal;
     index=current.findIndex(f=>f.observedUtc===selectedTime);
     assert(index>=0);
   }
   if(rendered.length>=9)void player.pause();
   return true;
 },
 delay:()=>0,
 onPlayingChange:state=>playingChanges.push(state),
 onError:error=>{throw error;}
});
await player.play();
assert.equal(playingChanges.filter(x=>x===true).length,1);
assert.equal(playingChanges.filter(x=>x===false).length,1);
assert(rendered.includes(iso(30)),"New genuine observation was not played");
assert.equal(new Set(rendered.slice(0,6)).size,6,"Unintended duplicate after rotating frame window");

const runtime=readFileSync(new URL("../src/live3d-operational-v9.js",import.meta.url),"utf8");
const packager=readFileSync(new URL("../../scripts/apply-radar-auto-refresh-v1.py",import.meta.url),"utf8");
assert.match(runtime,/planIncrementalRadarWindow\(hybridFrames,displayFrames\)/);
assert.match(runtime,/if\(!incrementalCommit\)\{\s*\$\("hybridFrameSlider"\)/);
assert.match(runtime,/if\(resume && !incrementalCommit\)playback.play\(\)/);
assert.match(runtime,/hybridTrackVolumes=hybridTrackVolumes.slice\(incrementalCommit.dropped\)/);
assert.match(runtime,/window.__stormtrackerRadarDiagnostics=/);
assert.match(packager,/copyfile\("frontend\/src\/radar-incremental-window-v1.js"/);
assert.match(packager,/copyfile\("frontend\/src\/radar-lifecycle-diagnostics-v1.js"/);
assert.match(packager,/copyfile\("frontend\/src\/bom-wmts-loop-v2.js"/);
assert.match(packager,/v10.2.43-incremental-radar/);
console.log("PASS source-verified append planning, historical backfill fallback, active-player continuity, lifecycle and pinned package contracts");
