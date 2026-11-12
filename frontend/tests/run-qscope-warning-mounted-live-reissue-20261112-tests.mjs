// End-to-end controller integration: a mounted, UNRELOADED warning map
// receives a newer original GIS issue through the 60s edition heartbeat,
// replaces its GPU polygon objects, then independently clears on cancellation.
// No real network, DOM browser or scheduled sleep required.
import assert from "node:assert/strict";
import {initialiseOfficialBomWarningPolygons} from
 "../src/context-layers/bom-warning-operational-v1.js";

const oldDocument=globalThis.document,oldWindow=globalThis.window;
const oldInterval=globalThis.setInterval,oldClear=globalThis.clearInterval;
let tick=null,now=Date.parse("2026-11-12T11:00:00Z");
const nodes=new Map();
function element(id){
 if(!nodes.has(id)){
  const handlers=new Map();
  nodes.set(id,{id,checked:false,value:"",hidden:false,open:false,
    dataset:{},textContent:"",handlers,
    addEventListener(event,callback){handlers.set(event,callback)},
    removeEventListener(event){handlers.delete(event)},
    replaceChildren(){},append(){},dispatch(event){handlers.get(event)?.()},
    contains(){return false},getBoundingClientRect(){return {left:0,top:0,right:900,bottom:700}}});
 }
 return nodes.get(id);
}
const winHandlers=new Map();
globalThis.document={hidden:false,getElementById:element,
 addEventListener(){},removeEventListener(){}};
globalThis.window={addEventListener:(e,cb)=>winHandlers.set(e,cb),
 removeEventListener:e=>winHandlers.delete(e)};
globalThis.setInterval=cb=>{tick=cb;return 123};
globalThis.clearInterval=()=>{tick=null};
element("showOfficialBomWarnings").checked=true;
element("officialBomWarningProduct").value="IDQ21033";
const scenePolygons=[];
class PrimitiveCollection{
 constructor(){this.items=[]}
 add(item){this.items.push(item);return item}
 remove(item){this.items=this.items.filter(x=>x!==item);return true}
}
class Primitive{constructor(args){Object.assign(this,args)}}
class PerAppearance extends Primitive{}
PerAppearance.VERTEX_FORMAT={};
const mockCesium={
 PrimitiveCollection,PolygonGeometry:Primitive,PolygonHierarchy:Primitive,
 GeometryInstance:Primitive,GroundPrimitive:Primitive,
 GroundPolylineGeometry:Primitive,GroundPolylinePrimitive:Primitive,
 PolylineColorAppearance:Primitive,PerInstanceColorAppearance:PerAppearance,
 ClassificationType:{TERRAIN:1},
 Cartesian3:{fromDegreesArray:x=>x},
 ColorGeometryInstanceAttribute:{fromColor:c=>c},
 Color:{fromCssColorString:x=>x}
};
const viewer={scene:{groundPrimitives:{
 add(item){scenePolygons.push(item);return item},
 remove(item){const i=scenePolygons.indexOf(item);if(i>=0)scenePolygons.splice(i,1)}
},requestRender(){},canvas:{width:900,height:700}},camera:{frustum:{fovy:1}}};
const ring=(offset)=>({type:"Polygon",coordinates:[[
 [151+offset,-27],[151.3+offset,-27],[151.3+offset,-27.3],
 [151+offset,-27.3],[151+offset,-27]
]]});
const issue1="2026-11-12T10:59:00.000Z",issue2="2026-11-12T11:01:00.000Z";
const warn=(issued,id,offset)=>({
 id:"IDQ21033:"+issued+":"+id,issuer:"Bureau of Meteorology",official:true,
 type:"severe-thunderstorm",productCode:"IDQ21033",
 sourceProduct:"IDQ65654",polygonProductCodes:["IDQ65654"],
 geometry:ring(offset),issuedUtc:issued,expiresUtc:"2026-11-12T13:00:00Z",
 bulletinUrl:"https://www.bom.gov.au/warning/severe-thunderstorm-warning/IDQ21033",
 headline:"Severe Thunderstorm Warning"
});
const issues=[
 [warn(issue1,"old",0)],
 [warn(issue2,"new1",0.1),warn(issue2,"new2",0.5)],
 []
];
let fullVersion=0,fullRequests=0,pulseRequests=0,edition=0;
function productStates(){
 const status=fullVersion>=2?"no-active":"active";
 return {IDQ21033:{status,issuedUtc:fullVersion===0?issue1:issue2,
   count:status==="active"?issues[fullVersion].length:0},
 IDQ21035:{status:"no-active"},IDQ21037:{status:"no-active"},
 IDQ21038:{status:"no-active"}};
}
const mockFetch=async url=>{
 if(url.includes("/bom-official-warning-editions")){
  pulseRequests++;
  const canceled=edition>=2;
  const published=edition===0?issue1:issue2;
  return new Response(JSON.stringify({
   schema:"QScopeBoMWarningEditionsV1",indexStatus:"verified",
   activeCodes:canceled?[]:["IDQ21033"],
   products:{IDQ21033:{status:"verified",
     issuedUtc:canceled?null:published,count:canceled?0:edition===0?1:2,
     sourceIds:canceled?[]:edition===0?["old"]:["new1","new2"]},
    IDQ21035:{status:"verified",issuedUtc:null,count:0,sourceIds:[]},
    IDQ21037:{status:"verified",issuedUtc:null,count:0,sourceIds:[]},
    IDQ21038:{status:"verified",issuedUtc:null,count:0,sourceIds:[]},
    "IDQ21035:cells":{status:"verified",issuedUtc:null,count:0,sourceIds:[]}}
  }),{status:200});
 }
 if(url.includes("/bom-official-warning-polygons")){
  fullRequests++;
  const current=fullVersion;
  return new Response(JSON.stringify({
   schema:"StormTrackerOfficialBoMWarningPolygonsV1",
   status:current===2?"no-verified-current-polygons":"active",
   warnings:issues[current],stormCells:[],products:productStates()
  }),{status:200});
 }
 throw Error("Unexpected request "+url);
};
const wait=()=>new Promise(resolve=>setImmediate(resolve));
try{
 const controller=initialiseOfficialBomWarningPolygons({
   viewer,CesiumRef:mockCesium,fetchImpl:mockFetch,now:()=>now
 });
 assert.equal(typeof tick,"function","One 60-second wake-up timer installed");
 element("showOfficialBomWarnings").dispatch("change");
 await wait();
 assert.equal(fullRequests,1);
 assert.equal(scenePolygons.length,1,"Initial regional map is visible");
 assert.match(element("officialBomWarningsStatus").textContent,/1 polygon/);
 fullVersion=1;edition=1;now+=61000;
 tick();
 await wait();await wait();
 assert.equal(fullRequests,2,
  "New source-issued polygons MUST force a full fetch from mounted map without page reload");
 assert.equal(scenePolygons.length,1,
  "Old terrain-warning collection must be atomically replaced, not stacked");
 assert.equal(scenePolygons[0].items.length,2,
  "New map must show TWO verified current regional polygons, not stale single polygon");
 assert.match(element("officialBomWarningsStatus").textContent,/2 polygons/);
 now+=61000;tick();await wait();await wait();
 assert.equal(fullRequests,2,
  "Unchanged edition must NOT repeat expensive full relay request");
 fullVersion=2;edition=2;now+=61000;tick();await wait();await wait();
 assert.equal(fullRequests,3,"Verified cancellation must be detected automatically");
 assert.equal(scenePolygons.length,0,"Superseded regional polygons must clear");
 assert.match(element("officialBomWarningsStatus").textContent,/No current warnings/);
 assert.equal(pulseRequests,3,"One lightweight edition check per minute, no double polling");
 controller.destroy();
 assert.equal(tick,null,"Timers destroyed after leaving map");
 console.log("PASS mounted Q-SCOPE live reissue: automatic 1->2 genuine polygons, no extra unchanged full fetch, automatic cancellation clearing, no page reload");
}finally{
 globalThis.document=oldDocument;globalThis.window=oldWindow;
 globalThis.setInterval=oldInterval;globalThis.clearInterval=oldClear;
}
