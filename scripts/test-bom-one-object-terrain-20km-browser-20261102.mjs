#!/usr/bin/env node
// Full Cesium scene QA at operator-like 20km and farther scales.
// Synthetic QA-only original polygon source, NEVER shown to operators.
import assert from "node:assert/strict";
import {PNG} from "pngjs";
import {chromium,webkit} from "playwright";

const mobile=process.env.STORMTRACKER_BROWSER==="mobile";
const browser=mobile?await webkit.launch({headless:true}):
 await chromium.launch({headless:true,args:[
  "--no-sandbox","--disable-dev-shm-usage",
  "--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"
 ]});
const page=await browser.newPage(mobile?
 {viewport:{width:390,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true}:
 {viewport:{width:1050,height:820},deviceScaleFactor:1,isMobile:false,hasTouch:false});
const errors=[];
page.on("pageerror",e=>errors.push(String(e)));
page.setDefaultTimeout(70000);
try{
 await page.goto("http://127.0.0.1:8137/live3d-operational-v9.html",
  {waitUntil:"domcontentloaded",timeout:60000});
 const setup=await page.evaluate(async()=>{
  const C=window.Cesium;
  if(!C?.Viewer||!C.GroundPrimitive||!C.GroundPolylinePrimitive)
   throw Error("Actual Cesium 1.145 WebGL terrain runtime not loaded");
  const mod=await import("/src/context-layers/bom-warning-terrain-imagery-v1.js?v=unified-map-qa");
  const div=document.createElement("div");
  div.id="one-object-ground-qa";
  Object.assign(div.style,{
   position:"fixed",left:"0",top:"0",width:"min(100vw,640px)",
   height:"min(95vh,680px)",zIndex:"2147483647",background:"#f5f5f5"
  });
  document.body.append(div);
  const viewer=new C.Viewer(div,{
   animation:false,timeline:false,baseLayerPicker:false,baseLayer:false,
   geocoder:false,homeButton:false,sceneModePicker:false,
   navigationHelpButton:false,fullscreenButton:false,
   selectionIndicator:false,infoBox:false,
   terrainProvider:new C.EllipsoidTerrainProvider(),
   contextOptions:{webgl:{preserveDrawingBuffer:true}},
   requestRenderMode:false
  });
  viewer.scene.globe.baseColor=C.Color.fromCssColorString("#efefef");
  viewer.scene.globe.enableLighting=false;
  viewer.scene.skyAtmosphere.show=false;
  const coords=[
   [152.54,-26.29],[152.86,-26.29],[152.86,-26.1],
   [152.54,-26.1],[152.54,-26.29]
  ];
  const feature={id:"QA-ONLY",type:"severe-thunderstorm",
   productCode:"IDQ21035",sourceProduct:"IDQ65650",
   geometry:{type:"Polygon",coordinates:[coords]}};
  const original=JSON.stringify(feature.geometry);
  const polygons=mod.createUnifiedBoMWarningTerrainPolygons(C,[feature]);
  if(!polygons||polygons.length!==1||polygons.get(0).length!==2)
   throw Error("Expected exactly ONE BoM source feature with fill + line");
  viewer.scene.groundPrimitives.add(polygons);
  if(JSON.stringify(feature.geometry)!==original)
   throw Error("Rendering mutated genuine geometry");
  window.__oneObjectTerrainQA={C,viewer,polygons};
  return {loaded:true,featureObjects:polygons.length,children:polygons.get(0).length};
 });
 assert.deepEqual(setup,{loaded:true,featureObjects:1,children:2});
 async function cameraAndScreenshot(rect,label){
  const info=await page.evaluate(async coordinates=>{
   const {C,viewer,polygons}=window.__oneObjectTerrainQA;
   viewer.camera.setView({destination:C.Rectangle.fromDegrees(...coordinates)});
   const group=polygons.get(0);
   const fill=group.get(0),line=group.get(1);
   const start=Date.now();
   while((!fill.ready||!line.ready)&&Date.now()-start<25000){
    viewer.render();
    await new Promise(resolve=>setTimeout(resolve,180));
   }
   if(!fill.ready||!line.ready)
    throw Error("Terrain fill or fixed-width outline did not finish rendering");
   for(let i=0;i<8;i++){
    viewer.render();
    await new Promise(resolve=>requestAnimationFrame(resolve));
   }
   const edge=C.Cartesian3.fromDegrees(152.7,-26.1);
   const point=viewer.scene.cartesianToCanvasCoordinates(edge);
   const bounds=viewer.scene.canvas.getBoundingClientRect();
   return {point:{x:point?.x,y:point?.y},
    bounds:{width:bounds.width,height:bounds.height},
    fillReady:fill.ready,lineReady:line.ready,
    primitiveType:[fill.constructor.name,line.constructor.name]};
  },rect);
  const png=PNG.sync.read(await page.locator("#one-object-ground-qa canvas.cesium-widget-canvas")
   .screenshot({type:"png"}));
  const x=Math.round(info.point.x*png.width/info.bounds.width);
  const y=Math.round(info.point.y*png.height/info.bounds.height);
  const pixels=[];
  for(let dy=-14;dy<=14;dy++){
   let py=y+dy;
   if(py<0||py>=png.height)continue;
   let i=(py*png.width+x)*4;
   const p=[...png.data.subarray(i,i+4)];
   pixels.push({dy,p,yellow:p[0]>175&&p[0]<255&&p[1]>120&&
    p[1]<235&&p[2]<125&&p[0]>p[1]+18});
  }
  const matches=pixels.filter(p=>p.yellow);
  const run=matches.length?Math.max(...matches.map(p=>p.dy))-
   Math.min(...matches.map(p=>p.dy))+1:0;
  console.log("UNIFIED_TERRAIN_REAL_MAP_EDGE",JSON.stringify({
   platform:mobile?"mobile WebKit":"desktop Chromium",zoom:label,
   primitiveType:info.primitiveType,ready:[info.fillReady,info.lineReady],
   screenPixel:{x,y},png:[png.width,png.height],
   goldenCount:matches.length,span:run,
   sampledAlpha:matches.slice(0,10).map(x=>x.p)
  }));
  assert(matches.length>0,"No golden-yellow source outline on true Cesium globe at "+label);
  assert(run<=Math.ceil((mobile?2:1)*5),
   "Warning edge still magnifies as an oversized yellow crayon at "+label+
    ": "+JSON.stringify({run,matches:matches.length}));
  return run;
 }
 const near=await cameraAndScreenshot([152.27,-26.59,153.16,-25.82],"around-20km");
 const far=await cameraAndScreenshot([151.9,-26.95,153.6,-25.35],"far-zoom");
 assert(Math.abs(near-far)<=(mobile?5:3),
  "Warning border line grew with map zoom instead of staying fixed on screen");
 const polygonErrors=errors.filter(e=>/(GroundPrimitive|GroundPolyline|createUnified|TerrainGeometry|unified.*polygon)/i.test(e));
 assert(!polygonErrors.length,"Actual polygon runtime errors: "+polygonErrors.slice(0,3).join(" | "));
 console.log("UNIFIED_TERRAIN_20KM_MAP_PASS",JSON.stringify({
  platform:mobile?"mobile WebKit":"desktop Chromium",
  lineWidthScreenPx:[near,far],oneTerrainSourceObject:true
 }));
}catch(error){
 console.log("UNIFIED_TERRAIN_20KM_MAP_FAIL",String(error));
 throw error;
}finally{await browser.close();}
