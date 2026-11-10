import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {
  createPassiveWindEventInbox,createResearchRadarEventLedger,
  Q_SCOPE_PAUSE_PREFERENCE_KEY,Q_SCOPE_EVENT_STORAGE_KEY,
  RESEARCH_RADAR_EVENT_TYPES,radarEventPresentation
} from "../src/qscope-reviewable-event-inbox-v10-6.js";
import {captureResearchSourceThumbnail} from "../src/qscope-source-evidence-thumbnail-v10-6.js";
import {dopplerMapCoordinateToLonLat} from "../src/bom-doppler-georef-v1.js";
import {shouldPauseForNewResearchEvent,FRESH_RESEARCH_EVENT_MAX_AGE_MS} from "../src/qscope-intelligent-pause-v10-6.js";

const t="2026-11-10T05:00:00Z",t2="2026-11-10T05:05:00Z";
const nowMs=Date.parse(t2);
assert.equal(shouldPauseForNewResearchEvent({
  event:{latestUtc:t},nowMs,isPlaying:true,isResearch:true
}),true,"Fresh genuine research event can interrupt playback when opted in");
for(const policy of [
  {isPlaying:false,isResearch:true},
  {isPlaying:true,isResearch:false},
  {isPlaying:true,isResearch:true,isHidden:true},
  {isPlaying:true,isResearch:true,isNavigating:true},
  {isPlaying:true,isResearch:true,nowMs:Date.parse(t)+FRESH_RESEARCH_EVENT_MAX_AGE_MS+1},
  {isPlaying:true,isResearch:true,nowMs:Date.parse(t)-1000}
])assert.equal(shouldPauseForNewResearchEvent({
  event:{latestUtc:t},nowMs,...policy
}),false,"No pauses for inactive, old, hidden or user-reviewed evidence");

const alert=(category,time=t)=>({
  category,observed_utc:time,source_utc:time,
  radar_id:"66",track_id:"ST-TEST",longitude:153.1,latitude:-27.45,
  caveat:"Research-only, not an official warning."
});
const memory=()=>{
  const values=new Map();
  return {values,getItem:k=>values.get(k)??null,
    setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
};
function mockDocument() {
  const nodes=[];
  const node=(name)=>({
    name,children:[],textContent:"",className:"",hidden:false,
    listeners:{},attributes:{},style:{},dataset:{},
    setAttribute(k,v){this.attributes[k]=v;},
    addEventListener(k,cb){this.listeners[k]=cb;},
    append(...v){this.children.push(...v);},
    appendChild(v){this.children.push(v);return v;},
    replaceChildren(...v){this.children=[...v];},
    remove(){this.removed=true;},
    click(){this.listeners.click?.();},
  });
  return {nodes,createElement:name=>{
    const el=node(name);nodes.push(el);
    if(name==="canvas"){
      el.getContext=()=>({
        createImageData:(width,height)=>({
          width,height,data:new Uint8ClampedArray(width*height*4)
        }),
        putImageData:()=>{}
      });
      el.toDataURL=()=> "data:image/png;base64,"+"A".repeat(1000);
    }
    return el;
  },createTextNode:value=>({textContent:value})};
}
const doc=mockDocument();
const merc=(lon,lat)=>({
  x:6378137*lon*Math.PI/180,
  y:6378137*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))
});
const {x,y}=merc(153.1,-27.45);
const cats=new Uint8Array(256*256);
for(let y=110;y<146;y++)for(let x=110;x<146;x++)cats[y*256+x]=9;
const frame={width:256,height:256,categories:cats,observedUtc:t,
  georef:{projection:"EPSG:3857",minX:x-50000,maxX:x+50000,
    minY:y-50000,maxY:y+50000}};
const rain=captureResearchSourceThumbnail({
  alert:alert("hook_shape_only"),mode:"rain",frame,documentRef:doc
});
assert(rain,"Measured source category window generates durable image");
assert.match(rain.label,/reconstructed from the genuine BoM/);
assert(rain.dataUrl.startsWith("data:image/png;base64,"));
assert.equal(captureResearchSourceThumbnail({
  alert:alert("hook_shape_only"),mode:"rain",
  frame:{...frame,sourceMetadata:{temporalInference:{}}},documentRef:doc
}),null,"Never retain a fabricated radar frame");
assert.equal(captureResearchSourceThumbnail({
  alert:alert("hook_shape_only"),mode:"rain",
  frame:{...frame,observedUtc:t2},documentRef:doc
}),null,"Never retain mismatched-time evidence");

const atCentre=dopplerMapCoordinateToLonLat("66",256,256);
const nativeData=new Uint8ClampedArray(512*512*4);
for(let yy=250;yy<263;yy++)for(let xx=250;xx<263;xx++){
  const i=(yy*512+xx)*4;
  nativeData[i]=120;nativeData[i+1]=80;nativeData[i+2]=190;
  nativeData[i+3]=255;
}
const windAlert={...alert("strong_radial_signature"),
  longitude:atCentre.longitude,latitude:atCentre.latitude};
const doppler=captureResearchSourceThumbnail({
  alert:windAlert,mode:"doppler",
  record:{radarId:"66",observedUtc:t,nativePanel:{
    width:512,height:512,data:nativeData
  }},documentRef:doc
});
assert(doppler,"Native Doppler original RGB imagery remains reviewable");
assert.match(doppler.label,/native BoM Doppler/);
assert.equal(captureResearchSourceThumbnail({
  alert:windAlert,mode:"doppler",
  record:{radarId:"66",observedUtc:t2,nativePanel:{
    width:512,height:512,data:nativeData
  }},documentRef:doc
}),null,"Native scan's timestamp must exactly match event");

const storage=memory();
const ledger=createResearchRadarEventLedger({storage});
const withSnapshot={...alert("hook_shape_only"),snapshot:rain};
ledger.ingest([withSnapshot],{mode:"rain",frameUtc:t});
assert(ledger.list()[0].evidence[0].snapshot,
  "Original decoded-category image is durably associated with source time");
const stored=createResearchRadarEventLedger({storage});
assert.equal(stored.list()[0].evidence[0].snapshot.dataUrl,rain.dataUrl);
const malicious={...alert("hook_shape_only",t2),snapshot:{
  ...rain,observedUtc:t2,dataUrl:"javascript:alert(1)"
}};
stored.ingest([malicious],{mode:"rain",frameUtc:t2});
assert.equal(stored.list()[0].evidence.at(-1).snapshot,null,
  "Untrusted thumbnail protocol cannot survive validation");
const store2=memory();
const map=doc.createElement("main");
const seen=[],navigated=[];
const ui=createPassiveWindEventInbox({
  container:map,documentRef:doc,storage:store2,
  onNewEvent:(event,context)=>seen.push({event,context}),
  onNavigate:async(event,evidence)=>{
    navigated.push({event,evidence});
    return {ok:false,message:"Frame has expired; retained crop available."};
  }
});
assert.equal(ui.pauseOnNewEvent,false,"Intelligent pause defaults OFF");
assert.equal(map.children[0].hidden,true,
  "No pending/history events means the entire radar event window is absent");
assert.equal(map.children[1].hidden,true,
  "No stale evidence popup when no event exists");
ui.setPauseOnNewEvent(true);
assert.equal(store2.getItem(Q_SCOPE_PAUSE_PREFERENCE_KEY),"true");
ui.observe([withSnapshot],{mode:"rain",frameUtc:t});
assert.equal(map.children[0].hidden,false,
  "A new radar event makes the passive inbox immediately visible");
assert.equal(seen.length,1,"One new pending event requests one optional pause");
assert.equal(navigated.length,0,"No camera navigation on passive detection");
ui.observe([withSnapshot],{mode:"rain",frameUtc:t});
assert.equal(seen.length,1,"Loop replay never triggers another pause");
ui.observe([alert("strong_radial_signature",t2)],{mode:"rain",frameUtc:t2});
assert.equal(seen.length,1,"More evidence for same event never triggers pause");
assert.equal(ui.pendingCount,1,"Multi-type event remains a single card");
const event=ui.events[0];
assert.equal(event.evidence.length,2);
assert.equal(radarEventPresentation(event).severity,"hook",
  "Mixed hook and radial wind evidence remains a single orange hook event");
assert.match(radarEventPresentation(event).summary,/HOOK ECHO.*WIND SIGNATURE/);
assert.equal(map.children[0].children[2].children[0].dataset.severity,"hook",
  "Pending card displays the highest matched radar review category");
ui.openEvent(event.id);
assert.equal(ui.pendingCount,0,"Click acknowledges pending state");
assert.equal(navigated.length,1,"Click, not detection, triggers frame navigation");
assert.equal(map.children[1].hidden,false,"Evidence window remains open after failure");
assert.equal(map.children[1].dataset.severity,"hook",
  "Expanded evidence retains the orange hook category");
const figures=doc.nodes.filter(x=>x.className==="qscope-wind-evidence-snapshot");
assert(figures.length>=1,"Saved source evidence is visible after BoM frame expiry");
ui.observe([alert("hook_shape_only",t)],{mode:"rain",frameUtc:t});
assert.equal(seen.length,1,"Acknowledged alerts cannot auto-pause again");
ui.clearEvent(event.id);
assert.equal(map.children[0].hidden,true,
  "Clearing the final viewable event hides the entire dock again");
ui.observe([withSnapshot],{mode:"rain",frameUtc:t});
assert.equal(seen.length,1,"Cleared archived source scan cannot revive");
const resume=createPassiveWindEventInbox({
  container:doc.createElement("main"),documentRef:doc,storage:store2,
  onNewEvent:()=>{throw Error("Old events are never new on restart");}
});
assert.equal(resume.pauseOnNewEvent,true,
  "User preference survives reload independently of alerts");
assert.equal(resume.pendingCount,0);
ui.destroy();resume.destroy();

for(const [category,severity,label] of [
  ["strong_radial_signature","wind","POSSIBLE STRAIGHT-LINE WIND"],
  ["hook_shape_only","hook","HOOK ECHO"],
  ["tornadic_candidate","couplet","HOOK + VELOCITY COUPLET"]
]) {
 const record={id:"fixture",evidence:[{category,frameUtc:t}]};
 assert.equal(radarEventPresentation(record).severity,severity);
 assert(radarEventPresentation(record).summary.includes(label));
 assert(RESEARCH_RADAR_EVENT_TYPES[category].evidence.includes("unverified")||
   RESEARCH_RADAR_EVENT_TYPES[category].evidence.includes("not confirmed"),
   "Radar classification must not claim a confirmed tornado or surface gust");
}

const build=readFileSync(fileURLToPath(new URL("../../scripts/build-current-site.sh",import.meta.url)),"utf8");
assert.match(build,/wind-hook-v10-6/);
console.log("PASS Q-SCOPE V10.6 source-faithful evidence crops, thumbnail safety, persistent review, and one-time opt-in pause control");
