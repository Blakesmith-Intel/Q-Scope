import assert from "node:assert/strict";
import {
 chooseQscopeRadarEventDock,chooseQscopeRadarEvidenceWindow
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
assert(blocked.name.startsWith("below-radar-controls"),
 "Event inbox must stay attached directly beneath the radar toolbar");
assert.equal(overlap(blocked,{x:545,y:610,width:365,height:115}),0);
const missing=chooseQscopeRadarEventDock({width:900,height:800,contentHeight:200});
assert(Number.isFinite(missing.top) && Number.isFinite(missing.left),
 "Hidden initial legend cannot cause NaN coordinates");
console.log("PASS Q-SCOPE event docking avoids original BoM legend/nav on screenshot-sized desktop, mobile, and constrained layouts");

const scale={x:10,y:692,width:154,height:34};
const legend={x:545,y:610,width:365,height:115};
const nav={x:380,y:10,width:530,height:42};
const review=chooseQscopeRadarEvidenceWindow({
 width:920,height:780,legend,scale,nav,
 inbox:{x:10,y:432,width:360,height:255}
});
assert(review.maxHeight>=160,"Expanded review needs readable scroll area");
assert.equal(overlap(review,legend),0,"Expanded review cannot cover BoM legend");
assert.equal(overlap(review,scale),0,"Expanded review cannot cover geodesic map scale");
assert.equal(overlap(review,nav),0,"Expanded review cannot cover navigation");
assert(review.hideInbox,"Opening evidence replaces the inbox in the same anchored position");
const mobileReview=chooseQscopeRadarEvidenceWindow({
 width:390,height:500,
 legend:{x:129,y:370,width:255,height:82},
 scale:{x:8,y:444,width:140,height:30},
 nav:{x:5,y:4,width:380,height:40},
 inbox:{x:8,y:140,width:320,height:210}
});
assert(mobileReview.hideInbox,"On narrow maps the pending queue steps aside during review");
assert(mobileReview.maxHeight>=160,"Narrow evidence window stays readable");
assert.equal(overlap(mobileReview,{x:129,y:370,width:255,height:82}),0);
assert.equal(overlap(mobileReview,{x:8,y:444,width:140,height:30}),0);
console.log("PASS Q-SCOPE expanded research review reserves BoM legend and map scale on desktop/mobile");


function assertBelowRadarControls(p,nav,description){
 assert.equal(p.top,nav.y+nav.height+10,
   description+": window must start immediately BELOW the radar controls");
 assert(p.left+p.width<=nav.x+nav.width+1,
   description+": window must be right-aligned to the radar controls");
 assert(p.name.startsWith("below-radar-controls"),
   description+": not a free-floating map window");
}
for(const c of cases) {
 const compact=chooseQscopeRadarEventDock(c);
 const expanded=chooseQscopeRadarEvidenceWindow({
   ...c,scale:{x:10,y:c.height-88,width:146,height:28}
 });
 assertBelowRadarControls(compact,c.nav,c.name+" compact");
 assertBelowRadarControls(expanded,c.nav,c.name+" expanded");
 assert.equal(overlap(expanded,c.legend),0,c.name+": expanded vs BoM legend");
 assert.equal(overlap(expanded,{x:10,y:c.height-88,width:146,height:28}),0,
    c.name+": expanded vs map distance scale");
}
assertBelowRadarControls(review,nav,"Photographed desktop expanded");
const mobileNav={x:5,y:4,width:380,height:40};
assertBelowRadarControls(mobileReview,mobileNav,"Mobile expanded");
const compactWithScale=chooseQscopeRadarEventDock({
 width:390,height:500,nav:mobileNav,
 legend:{x:129,y:370,width:255,height:82},
 scale:{x:8,y:444,width:140,height:30},
 contentHeight:600
});
assertBelowRadarControls(compactWithScale,mobileNav,"9 mobile event cards");
assert.equal(overlap(compactWithScale,{x:129,y:370,width:255,height:82}),0,
 "Compact event list cannot intrude into lower right legend");
assert.equal(overlap(compactWithScale,{x:8,y:444,width:140,height:30}),0,
 "Compact event list cannot intrude into distance scale");
console.log("PASS Q-SCOPE both wind event sizes dock directly under radar controls");


const compassDesktop={x:852,y:72,width:56,height:68};
const compactCompass=chooseQscopeRadarEventDock({
 width:920,height:780,nav,legend,scale,
 contentHeight:320,compass:compassDesktop
});
const expandedCompass=chooseQscopeRadarEvidenceWindow({
 width:920,height:780,nav,legend,scale,
 compass:compassDesktop
});
for(const p of [compactCompass,expandedCompass]) {
 assert.equal(overlap(p,compassDesktop),0,
   "Never cover original true-north compass beneath radar toolbar");
 assert(p.top===nav.y+nav.height+10,
   "Compass avoidance must keep event anchored directly under radar controls");
 assert(p.left+p.width<=compassDesktop.x-10,
   "Event right edge must leave an independent compass gutter");
}
const compactMobileCompass={x:334,y:76,width:48,height:60};
const m0=chooseQscopeRadarEventDock({
 width:390,height:500,
 nav:{x:5,y:4,width:380,height:40},
 legend:{x:129,y:370,width:255,height:82},
 scale:{x:8,y:444,width:140,height:30},
 compass:compactMobileCompass,
 contentHeight:350
});
const m1=chooseQscopeRadarEvidenceWindow({
 width:390,height:500,
 nav:{x:5,y:4,width:380,height:40},
 legend:{x:129,y:370,width:255,height:82},
 scale:{x:8,y:444,width:140,height:30},
 compass:compactMobileCompass
});
for(const p of [m0,m1]) {
 assert.equal(overlap(p,compactMobileCompass),0);
 assert.equal(p.top,54,"Mobile events remain directly beneath the toolbar");
 assert(p.width>=260,"Small-screen content remains readable after protecting compass");
}
const beforeCompassReady=chooseQscopeRadarEventDock({
 width:920,height:780,nav,legend,scale,contentHeight:320
});
assert.equal(overlap(beforeCompassReady,compassDesktop),0,
 "Compass is protected even before its dynamically mounted button exists");
console.log("PASS measured and late-mounted original north compass fully unobstructed in both event states");
