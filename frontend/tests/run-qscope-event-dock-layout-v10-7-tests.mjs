import assert from "node:assert/strict";
import {calculateQScopeEventDock} from "../src/qscope-event-dock-layout-v10-7.js";

const desktop=calculateQScopeEventDock({
  width:920,height:710,legendWidth:365,legendHeight:123,
  legendTop:531,legendBottom:56,navBottom:47
});
assert.equal(desktop.mode,"split",
  "Real desktop map area has space for separate left alert / right BoM legend");
assert.equal(desktop.inboxLeft,12);
assert.equal(desktop.inboxRight,null);
assert(desktop.inboxLeft+360+12<920-365-10,
  "Alert and original legend cannot occupy same horizontal space");
assert(desktop.inboxMaxHeight>=200);
assert(desktop.detailTop>47);
const mobile=calculateQScopeEventDock({
  width:390,height:610,legendWidth:255,legendHeight:95,
  legendTop:467,legendBottom:48,navBottom:43
});
assert.equal(mobile.mode,"stacked");
assert.equal(mobile.inboxRight,12);
assert.equal(610-mobile.inboxBottom,455,
  "Alert must end ABOVE the legend instead of obscuring it");
assert(610-mobile.inboxBottom < 467-10);
assert(mobile.inboxMaxHeight>200,
  "Mobile alerts must have room for the actual notification cards");
const narrowDesktop=calculateQScopeEventDock({
  width:650,height:500,legendWidth:365,legendHeight:90,
  legendTop:354,legendBottom:56,navBottom:47
});
assert.equal(narrowDesktop.mode,"stacked",
  "Use actual map panel width, not wide outer desktop browser viewport");
assert(500-narrowDesktop.inboxBottom<354);
const windy=calculateQScopeEventDock({
  width:390,height:610,legendWidth:255,legendHeight:175,
  legendTop:387,legendBottom:48,navBottom:43
});
assert.equal(windy.mode,"stacked");
assert(windy.inboxBottom>mobile.inboxBottom,
  "Tall Doppler legend pushes event tray upward without overlap");
assert.equal(windy.detailTop,mobile.detailTop);
assert.throws(()=>calculateQScopeEventDock({width:0,height:600}),
  /Expected map panel dimensions/);
console.log("PASS Q-SCOPE v10.7 radar legend/alert slots: desktop split, mobile stack, narrow maps, dynamic Doppler legend height, preserved nav clearance");
