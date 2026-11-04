import assert from "node:assert/strict";
import {createRiverGaugeLayer} from "../src/context-layers/river-gauge-layer-v1.js";
import {buildNotableFloodGaugeReport} from "../src/context-layers/river-gauge-notable-report-v1.js";
const now=Date.UTC(2026,9,24,11,30);
const ids=Array.from({length:130},(_,i)=>String(535100+i));
const features=ids.map((number,i)=>({
 id:"bom:"+number,type:"Feature",
 geometry:{type:"Point",coordinates:[147.5569+i*0.0001,-22.973]},
 properties:{name:"BoM "+number,bom_stn_num:number,state:"QLD",
  location_types:"water level gauge;",lat:-22.973,long:147.5569+i*0.0001}
}));
const observations=ids.map(number=>({
 stationId:number,stationName:"BoM "+number,
 heightMetres:number==="535162"?2.77:2.50,tendency:"steady",
 floodClass:"",observedText:"09.19PM Sat",
 recentDataHref:"/fwo/IDQ65392/IDQ65392."+number+".plt.shtml",
 sourceProduct:"IDQ60289"
}));
const calls={recent:new Map(),active:0,maximum:0};
class Collection{
 values=[];
 suspendEvents(){} resumeEvents(){}
 removeAll(){this.values=[];}
 add(value){this.values.push(value);return value;}
}
class DataSource {
 constructor(){this.entities=new Collection();this.show=false;}
}
const CesiumRef={CustomDataSource:DataSource,
 Cartesian3:{fromDegrees:(a,b)=>[a,b]},
 VerticalOrigin:{CENTER:1},HeightReference:{CLAMP_TO_GROUND:1}};
const viewer={dataSources:{add(){}},scene:{requestRender(){}}};
const fetchImpl=async url=>{
 const s=String(url),u=new URL(s);
 let data;
 if(s.includes("/qld-bom-river-station-locations-v1.json")) data={type:"FeatureCollection",features};
 else if(s.includes("/river-height-bulletins"))data={products:[{product:"IDQ60289",observations}],failed:[],partial:false};
 else if(s.includes("/river-recent-history")){
  const station=u.searchParams.get("station");
  assert(ids.includes(station),"Every BoM station lookup must use verified ID");
  calls.recent.set(station,(calls.recent.get(station)??0)+1);
  calls.active++;calls.maximum=Math.max(calls.maximum,calls.active);
  await Promise.resolve();
  calls.active--;
  data={format:"StormTrackerBomRecentRiverHistoryV1",product:"IDQ65392",
   station,availability:"available",
   samples:[{time:now-11*60000,height:station==="535162"?2.77:2.50}],
   crossing:station==="535162"||Number(station)%5===0
    ?{type:"B",heightMetres:1.71,crossingName:"BoM published bridge level",
      source:"BoM station river-height table"}:null};
 }else throw Error("Unexpected BoM request "+s);
 return {ok:true,async json(){return data}};
};
const stored={};
const layer=createRiverGaugeLayer({viewer,CesiumRef,now:()=>now,fetchImpl,
 storage:{getItem:k=>stored[k]??null,setItem:(k,v)=>{stored[k]=v;}}});
await layer.refresh();
const before=layer.crossingCoverage;
assert(before.pending>0,"Cold browser must have pending crossing sources");
await layer.checkCrossingReferences();
assert.equal(layer.crossingCoverage.pending,0,
 "A requested full report check must finish ALL 130 source records, not just 16");
assert.equal(layer.crossingCoverage.sourceMissing,0);
assert.equal(calls.recent.size,130);
assert(calls.maximum<=4,"No more than four simultaneous station source requests");
assert.equal(new Set(calls.recent.keys()).size,130,
 "The 64-station limit is a batch size, NEVER a global cap");
assert(calls.maximum>=2,"Avoid expensive fully serial station retrieval");
const report=buildNotableFloodGaugeReport(layer.sourceFeatures,null,now);
const station=report.groups[2].rows.find(x=>x.id==="bom:535162");
assert(station,"535162 must be in report after the complete source pass");
assert.equal(station.crossing.levelMetres,1.71);
assert.equal(station.crossing.amountAboveMetres,1.06);
assert.equal(layer.features.some(f=>f.id==="bom:535162"),true,
 "Map also shows the real crossing after source verification");
console.log("PASS 130-station complete crossing scan via original BoM relay, 535162 included in map/report, bounded concurrency and no silent remaining eligible gauges");
