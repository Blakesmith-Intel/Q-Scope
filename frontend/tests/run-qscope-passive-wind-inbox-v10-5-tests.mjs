import assert from "node:assert/strict";
import {
  createResearchRadarEventLedger,
  createPassiveWindEventInbox,
  Q_SCOPE_EVENT_STORAGE_KEY
} from "../src/qscope-passive-wind-inbox-v10-5.js";

function fakeStorage(){
  const values=new Map();
  return {
    values,
    setItem(k,v){values.set(k,v);},
    getItem(k){return values.get(k)??null;}
  };
}
function alert(category,utc,latitude=-27.45,longitude=153.1,extras={}){
  return {
    id:category+":"+utc,category,
    observed_utc:utc,source_utc:utc,radar_id:"66",
    track_id:"ST0050",latitude,longitude,
    caveat:"Experimental only. Not an official BoM warning.",
    velocity_kmh:category==="strong_radial_signature"?-65:undefined,
    radial_shear_kmh:category==="tornadic_candidate"?110:undefined,
    arc_degrees:category==="hook_shape_only"?140:undefined,
    ...extras
  };
}
const t1="2026-11-10T03:00:00Z",t2="2026-11-10T03:05:00Z",
  t3="2026-11-10T03:10:00Z";
const ctx=(utc,mode="rain",radarId="66")=>({mode,frameUtc:utc,radarId});
const storage=fakeStorage();
const ledger=createResearchRadarEventLedger({storage});
assert.equal(ledger.pendingCount,0);
assert.equal(ledger.ingest([alert("strong_radial_signature",t1)],ctx(t1)),1);
assert.equal(ledger.ingest([alert("hook_shape_only",t2)],ctx(t2)),1);
assert.equal(ledger.ingest([alert("tornadic_candidate",t3)],ctx(t3)),1);
assert.equal(ledger.pendingCount,1,"Three categories at one location become ONE event");
const merged=ledger.list()[0];
assert.equal(merged.evidence.length,3);
assert.equal(ledger.bestEvidence(merged).category,"tornadic_candidate");
assert.equal(ledger.ingest([alert("strong_radial_signature",t1)],ctx(t1)),0,
  "Repeated observation across radar refresh cannot duplicate an event");
assert.equal(ledger.pendingCount,1);
assert.equal(ledger.ingest([alert("hook_shape_only",t2,-27.452,153.102,
  {radar_id:"50"})],ctx(t2)),1,"Independent nearby radar goes into same event");
assert.equal(ledger.pendingCount,1);
assert.equal(ledger.list()[0].evidence.length,4);
assert.equal(ledger.ingest([alert("hook_shape_only",t2,-27.6,153.4)],ctx(t2)),1);
assert.equal(ledger.pendingCount,2,"Different location gets a different event");
assert.equal(ledger.ingest([alert("hook_shape_only","2026-11-10T03:50:00Z")],
  ctx("2026-11-10T03:50:00Z")),1);
assert.equal(ledger.pendingCount,3,"Separate later event cannot merge indefinitely");
assert.equal(ledger.ingest([alert("hook_shape_only",t2)],ctx(t1)),0,
  "Recorded-frame mismatch rejected: no synthetic timestamp navigation");
assert.equal(ledger.ingest([alert("hook_shape_only",t2,999,153.1)],ctx(t2)),0);
assert.equal(ledger.ingest([alert("hook_shape_only",t2)],ctx(t2,"66")),0,
  "No duplicate alert from another playback of same frame");

// Persistence must not expire on frame changes or reload.
const reloaded=createResearchRadarEventLedger({storage});
assert.equal(reloaded.pendingCount,3);
assert.equal(reloaded.list()[0].evidence.length,1);
const selected=reloaded.list().find(x=>x.evidence.length===4);
assert(selected);
assert.equal(reloaded.acknowledge(selected.id),true);
assert.equal(reloaded.pendingCount,2,"Interaction acknowledges only selected event");
assert.equal(reloaded.archivedCount,1);
assert.equal(reloaded.ingest([alert("hook_shape_only",t2)],ctx(t2)),0);
assert.equal(reloaded.pendingCount,2,"Acknowledged source scan cannot re-notify");
assert.equal(reloaded.clear(selected.id),true);
assert.equal(reloaded.get(selected.id).status,"cleared");
assert.equal(reloaded.ingest([alert("tornadic_candidate",t3)],ctx(t3)),0,
  "Cleared source scan must stay dismissed");
const again=createResearchRadarEventLedger({storage});
assert.equal(again.pendingCount,2,"Cleared event not resurrected after reload");
assert.equal(again.archivedCount,0);
assert(storage.values.get(Q_SCOPE_EVENT_STORAGE_KEY).includes('"version":1'));

// Storage failure is reported but does not prevent in-memory retention.
const blocked=createResearchRadarEventLedger({
  storage:{getItem(){throw Error("blocked");},setItem(){throw Error("blocked");}}
});
assert.equal(blocked.storageAvailable,false);
assert.equal(blocked.ingest([alert("hook_shape_only",t1)],ctx(t1)),1);
assert.equal(blocked.pendingCount,1);

// A minimal real-user interaction mock tests single event drawer and explicit
// acknowledgement + frame navigation, rather than only pure helper logic.
function node(tag){
  return {
    tag,children:[],listeners:{},attributes:{},hidden:false,
    textContent:"",className:"",style:{},
    setAttribute(k,v){this.attributes[k]=v;},
    addEventListener(name,fn){this.listeners[name]=fn;},
    append(...parts){this.children.push(...parts);},
    replaceChildren(...parts){this.children=[...parts];},
    remove(){this.removed=true;},
    click(){const fn=this.listeners.click;if(fn)fn();}
  };
}
const doc={createElement:node},map=node("map");
const nav=[];
const ui=createPassiveWindEventInbox({
  container:map,documentRef:doc,storage:fakeStorage(),
  onNavigate:async(event,evidence)=>{
    nav.push({event,evidence});
    return {ok:true,message:"Exact observed frame displayed."};
  }
});
assert.equal(ui.visible,false,"No new map layer or clutter before events");
ui.observe([alert("strong_radial_signature",t1)],ctx(t1));
ui.observe([alert("hook_shape_only",t2)],ctx(t2));
ui.observe([alert("tornadic_candidate",t3)],ctx(t3));
assert.equal(ui.pendingCount,1);
assert.equal(ui.visible,true);
assert.equal(map.children.length,2,"One notification tray and ONE evidence window");
const dock=map.children[0],window=map.children[1];
const list=dock.children[2];
assert.equal(list.children.length,1,"Related detections use one event row");
assert.equal(list.children[0].children.length,2,"Open and explicit clear actions");
list.children[0].children[0].click();
assert.equal(ui.pendingCount,0,"Interaction acknowledges sticky notification");
assert.equal(window.hidden,false,"All evidence shown in one event window");
assert.equal(window.children[3].children.length,3,"All three evidence types remain inspectable");
assert.equal(nav.length,1,"Automatic map navigation is user-initiated ONLY");
assert.equal(nav[0].evidence.category,"tornadic_candidate",
  "Open the strongest combined signature first");
assert.equal(nav[0].evidence.frameUtc,t3);
window.children[3].children[0].children[3].click();
assert.equal(nav.length,2,"Each evidence type can request its exact observed frame");
assert.equal(ui.pendingCount,0);
ui.destroy();
assert.equal(map.children[0].removed,true);
assert.equal(map.children[1].removed,true);
console.log("PASS Q-SCOPE passive radar inbox: sticky persistence, dedup, grouped multi-category event, one click-to-frame window, exact timestamps, clear and reload");
