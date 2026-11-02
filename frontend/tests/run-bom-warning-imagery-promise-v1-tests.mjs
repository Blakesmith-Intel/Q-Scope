import assert from "node:assert/strict";
import {createWarningImageryProvider}
 from "../src/context-layers/bom-warning-terrain-imagery-v1.js";

// Regression for the REAL iPhone Cesium crash on 30 Oct 2026:
// "TypeError: a.then is not a function" when 1 genuine warning polygon arrived.
// Cesium's ImageryLayer expects requestImage -> Promise<Canvas>, not Canvas.
const radians=Math.PI/180;
const paints=[];
const oldDocument=globalThis.document;
globalThis.document={
 createElement(kind){
  assert.equal(kind,"canvas");
  const canvas={
   width:0,height:0,
   getContext(type){
    assert.equal(type,"2d");
    return {
     beginPath(){paints.push("begin")},
     moveTo(x,y){assert(Number.isFinite(x)&&Number.isFinite(y));paints.push("move")},
     lineTo(x,y){assert(Number.isFinite(x)&&Number.isFinite(y));paints.push("line")},
     closePath(){paints.push("close")},
     fill(mode){assert.equal(mode,"evenodd");paints.push("fill")},
     stroke(){paints.push("stroke")},
     set fillStyle(_v){},set strokeStyle(_v){},set lineWidth(_v){}
    };
   }
  };
  return canvas;
 }
};
const rectangle={
 west:136*radians,south:-38*radians,east:155*radians,north:-9*radians
};
const cesium={
 Rectangle:{fromDegrees(...bounds){
  assert.deepEqual(bounds,[136,-38,155,-9]);return rectangle;
 }},
 GeographicTilingScheme:class{
  constructor({rectangle:rect,numberOfLevelZeroTilesX,numberOfLevelZeroTilesY}){
   assert.equal(rect,rectangle);
   assert.equal(numberOfLevelZeroTilesX,1);
   assert.equal(numberOfLevelZeroTilesY,1);
   this.rectangle=rect;
  }
  tileXYToRectangle(){return this.rectangle;}
 },
 Credit:class{constructor(text){this.text=text;}},
 Event:class{},
 ImageryLayerFeatureInfo:class{},
 Cartographic:{fromRadians(lon,lat){return {longitude:lon,latitude:lat};}}
};
const notice={
 id:"IDQ21033:test",type:"severe-thunderstorm",
 headline:"BoM verified regional Queensland thunderstorm warning",
 geometry:{type:"Polygon",coordinates:[[
  [149.2,-27.2],[149.5,-27.2],[149.5,-27.4],[149.2,-27.4],[149.2,-27.2]
 ]]}
};
try{
 const provider=createWarningImageryProvider(cesium,[notice]);
 assert.equal(provider.ready,true);
 assert.equal(provider.hasAlphaChannel,true);
 // This is the interface Cesium itself dereferences; a raw canvas here
 // causes exactly the error reported by the operator.
 const tileRequest=provider.requestImage(0,0,0);
 assert.equal(typeof tileRequest?.then,"function",
  "Cesium must receive a genuine thenable imagery tile");
 const canvas=await tileRequest;
 assert.equal(canvas.width,1024);
 assert.equal(canvas.height,1024);
 assert(paints.includes("fill")&&paints.includes("stroke"),
  "Original source polygon must still be painted");
 const inside=provider.pickFeatures(0,0,0,149.3*radians,-27.3*radians);
 assert.equal(typeof inside?.then,"function",
  "Cesium feature picking must also return a promise");
 const picked=await inside;
 assert.equal(picked.length,1);
 assert.equal(picked[0].data,notice);
 assert.match(picked[0].name,/verified regional/);
 const outside=await provider.pickFeatures(0,0,0,150*radians,-28*radians);
 assert.deepEqual(outside,[]);
 console.log("PASS live iPhone Cesium warning overlay crash: promise-based tile and feature contracts, original polygon painted and source features selectable");
}finally{
 if(oldDocument===undefined)delete globalThis.document;
 else globalThis.document=oldDocument;
}
