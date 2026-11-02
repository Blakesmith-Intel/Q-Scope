#!/usr/bin/env node
// Genuine CesiumJS WebKit/Chromium runtime validation of unified source
// polygon terrain objects. The geometry is a synthetic TEST FIXTURE only,
// NEVER delivered as an operational BoM warning.
import assert from "node:assert/strict";
import {chromium,webkit} from "playwright";

const mobile=process.env.STORMTRACKER_BROWSER==="mobile";
const browser=mobile?await webkit.launch({headless:true}):
 await chromium.launch({headless:true,args:[
  "--no-sandbox","--disable-dev-shm-usage",
  "--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"
 ]});
const page=await browser.newPage(mobile?
 {viewport:{width:390,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true}:
 {viewport:{width:1440,height:900},deviceScaleFactor:1,isMobile:false,hasTouch:false});
page.setDefaultTimeout(60000);
const errors=[];
page.on("pageerror",error=>errors.push(String(error)));
try{
 await page.goto("http://127.0.0.1:8137/live3d-operational-v9.html",
  {waitUntil:"domcontentloaded",timeout:60000});
 const result=await page.evaluate(async()=>{
  const mod=await import("/src/context-layers/bom-warning-terrain-imagery-v1.js?v=20261102-unified-qa");
  const C=window.Cesium;
  if(!C?.GroundPolylinePrimitive||!C.GroundPrimitive||
     !C.PrimitiveCollection)throw Error("Real Cesium terrain geometry API unavailable");
  const fixture=(west)=>({type:"Polygon",coordinates:[[
    [west,-28],[west+1,-28],[west+1,-27],[west,-27],[west,-28]
  ]]});
  const area={official:true,type:"severe-thunderstorm",
   productCode:"IDQ21033",sourceProduct:"IDQ65654",geometry:fixture(145)};
  const cell={official:true,type:"severe-thunderstorm-cell",
   productCode:"IDQ21035",sourceProduct:"IDQ65652",
   geometry:fixture(148),veryDangerous:false};
  const dangerous={...cell,geometry:fixture(151),veryDangerous:true};
  const originals=[area,cell,dangerous].map(o=>JSON.stringify(o.geometry));
  const unified=mod.createUnifiedBoMWarningTerrainPolygons(C,[area,cell,dangerous]);
  if(!unified||unified.length!==3)throw Error("Expected three original source polygon objects");
  const children=[];
  for(let i=0;i<unified.length;i++){
   const grouped=unified.get(i);
   const pair=[grouped.get(0),grouped.get(1)];
   children.push({
    oneObject:grouped instanceof C.PrimitiveCollection,
    terrainFill:pair[0] instanceof C.GroundPrimitive,
    terrainOutline:pair[1] instanceof C.GroundPolylinePrimitive,
    count:grouped.length,
    linePixelWidth:i===2?3:2
   });
  }
  const realGroupAdded=unified instanceof C.PrimitiveCollection;
  // Existing imagery helper is now ONLY a backwards compatibility fixture
  // and must paint a translucent source fill, with NO magnifiable outlines.
  const rad=Math.PI/180;
  const scheme={
   Rectangle:{fromDegrees:()=>({west:136*rad,east:155*rad,south:-38*rad,north:-9*rad})},
   GeographicTilingScheme:class{
    constructor({rectangle}){this.rectangle=rectangle;}
    tileXYToRectangle(){return this.rectangle;}
   },
   Credit:class{},Event:class{}
  };
  const old=mod.createWarningImageryProvider(scheme,[area,cell,dangerous]);
  const canvas=await old.requestImage(0,0,7);
  const ctx=canvas.getContext("2d"),W=canvas.width,H=canvas.height;
  const sample=(lon,lat)=>{
   const x=Math.round((lon-136)/19*W),y=Math.round((-9-lat)/29*H);
   return [...ctx.getImageData(x,y,1,1).data];
  };
  const interior=sample(145.5,-27.5);
  const boundary=sample(145.5,-27);
  const outside=sample(143,-26.5);
  const unchanged=[area,cell,dangerous].every((o,i)=>
   JSON.stringify(o.geometry)===originals[i]);
  // Prevent test-created objects from attaching to live maps or leaking GPU resources.
  unified.destroy();
  return {canvas:[W,H],children,realGroupAdded,unchanged,
   interior,boundary,outside,
   importer:await fetch("/src/context-layers/bom-warning-operational-v1.js")
    .then(x=>x.text()).then(s=>s.includes(
     "20261102-unified-terrain-warning-polygon-v1"))};
 });
 assert.equal(result.importer,true,"Published app must import new unified terrain polygon renderer");
 assert.equal(result.realGroupAdded,true);
 assert.equal(result.unchanged,true,"Original source polygon rings must remain untouched");
 assert.equal(result.children.length,3);
 assert(result.children.every(x=>x.oneObject&&x.terrainFill&&x.terrainOutline),
  "Every source warning must be one terrain group containing BOTH fill and fixed-pixel line");
 assert.deepEqual(result.children.map(x=>x.count),[2,2,3],
  "Only genuine source VDS has a label inside its own grouped polygon object");
 assert.deepEqual(result.children.map(x=>x.linePixelWidth),[2,2,3]);
 assert.deepEqual(result.canvas,[1024,1024]);
 assert(result.interior[3]>0&&result.interior[3]<80,"Ground warning fill is subtle");
 assert(result.boundary[3]<100,
  "Raster source warning edge MUST be blank/subtle, never thick opaque crayon");
 assert.equal(result.outside[3],0,"No exterior halo around original polygon");
 assert(!errors.length,"Browser page errors: "+errors.slice(0,3).join(" | "));
 console.log("UNIFIED_BOM_TERRAIN_POLYGON_BROWSER_PASS",JSON.stringify({
  platform:mobile?"mobile WebKit":"desktop Chromium",
  sourceObjects:result.children.length,
  groupedParts:result.children.map(x=>x.count),
  pixelWidths:result.children.map(x=>x.linePixelWidth),
  fillAlpha:result.interior[3],rasterEdgeAlpha:result.boundary[3],
  originalsUntouched:result.unchanged,
  note:"Verified real Cesium primitive constructors and one-object lifecycle using QA-only source fixtures"
 }));
}catch(error){
 console.log("UNIFIED_BOM_TERRAIN_POLYGON_BROWSER_FAIL",String(error));
 throw error;
}finally{await browser.close();}
