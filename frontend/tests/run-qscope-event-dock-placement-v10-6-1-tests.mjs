import assert from "node:assert/strict";
import {
 chooseQscopeRadarEventDock
} from "../src/qscope-research-event-dock-layout-v10-6-1.js";
function overlap(a,b){
 return Math.max(0,Math.min(a.left+a.width,b.x+b.width)-Math.max(a.left,b.x))*
 Math.max(0,Math.min(a.top+a.maxHeight,b.y+b.height)-Math.max(a.top,b.y));
}
const cases=[
 {name:"Operator's desktop screenshot / right-bottom 15-band legend",
  width:920,height:780,contentHeight:255,
  legend:{x:545,y:610,width:365,height:115},
  nav:{x:380,y:10,width:530,height:42},
  truth:{x:8,y:746,width:170,height:25}},
 {name:"Narrow map with same BoM rain legend",
  width:390,height:500,contentHeight:250,
  legend:{x:129,y:370,width:255,height:82},
  nav:{x:5,y:4,width:380,height:40},
  truth:{x:5,y:470,width:220,height:20}},
 {name:"Map with tall Doppler legend and 3 grouped events",
  width:620,height:445,contentHeight:430,
  legend:{x:244,y:302,width:365,height:90},
  nav:{x:6,y:4,width:608,height:44},
  truth:{x:5,y:417,width:220,height:20}},
 {name:"Collapsed-sidebar wide map",
  width:1320,height:800,contentHeight:360,
  legend:{x:945,y:621,width:365,height:123},
  nav:{x:800,y:10,width:510,height:42},
  truth:{x:8,y:765,width:170,height:25}},
];
for(const c of cases){
 const p=chooseQscopeRadarEventDock(c);
 assert(p.maxHeight>=104,`${c.name}: visible/openable alert card required`);
 assert.equal(overlap(p,c.legend),0,
  `${c.name}: alert must never overlap the original BoM legend`);
 assert.equal(overlap(p,c.nav),0,
  `${c.name}: nav controls must remain clear`);
 assert(p.left>=0&&p.top>=0&&p.left+p.width<=c.width &&
   p.top+p.maxHeight<=c.height,c.name+": alert must fit map");
}
const blocked=chooseQscopeRadarEventDock({
  width:920,height:780,contentHeight:255,
  legend:{x:545,y:610,width:365,height:115},
  nav:{x:380,y:10,width:530,height:42},
  truth:{x:8,y:746,width:170,height:25},
  obstacles:[{rect:{x:10,y:360,width:360,height:350},critical:true}]
});
assert(blocked.name!=="lower-left",
 "Nearby map popup forces alert into another non-overlapping placement");
assert.equal(overlap(blocked,{x:545,y:610,width:365,height:115}),0);
const missing=chooseQscopeRadarEventDock({width:900,height:800,contentHeight:200});
assert(Number.isFinite(missing.top) && Number.isFinite(missing.left),
 "Hidden initial legend cannot cause NaN coordinates");
console.log("PASS Q-SCOPE event docking avoids original BoM legend/nav on screenshot-sized desktop, mobile, and constrained layouts");
