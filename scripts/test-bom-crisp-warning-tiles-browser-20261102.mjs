#!/usr/bin/env node
// QA-only WebKit/Chromium pixel probe of the exact packaged warning renderer.
// The geometries below are TEST FIXTURES, never delivered to production.
import assert from "node:assert/strict";
import {chromium,webkit} from "playwright";

const mobile=process.env.STORMTRACKER_BROWSER==="mobile";
const browser=mobile
 ?await webkit.launch({headless:true})
 :await chromium.launch({headless:true,args:[
  "--no-sandbox","--disable-dev-shm-usage",
  "--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"
 ]});
const page=await browser.newPage(mobile?
 {viewport:{width:390,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true}:
 {viewport:{width:1440,height:900},deviceScaleFactor:1,isMobile:false,hasTouch:false});
page.setDefaultTimeout(60000);
try{
 await page.goto("http://127.0.0.1:8137/live3d-operational-v9.html",
  {waitUntil:"domcontentloaded",timeout:60000});
 const measured=await page.evaluate(async()=>{
  const mod=await import("/src/context-layers/bom-warning-terrain-imagery-v1.js?v=20261102-crisp-gold-qa");
  const rad=Math.PI/180;
  const bounds={west:136*rad,east:155*rad,south:-38*rad,north:-9*rad};
  const CesiumStub={
   Rectangle:{fromDegrees:()=>bounds},
   GeographicTilingScheme:class{
    constructor({rectangle}){this.rectangle=rectangle;}
    tileXYToRectangle(){return bounds;}
   },
   Credit:class{},Event:class{}
  };
  const g=(west)=>({type:"Polygon",coordinates:[[
   [west,-28],[west+1,-28],[west+1,-27],[west,-27],[west,-28]
  ]]});
  const area={official:true,type:"severe-thunderstorm",
   productCode:"IDQ21033",sourceProduct:"IDQ65654",geometry:g(145),
   hazardAssessment:{highEnd:["Destructive winds"]}};
  const cell={official:true,type:"severe-thunderstorm-cell",
   productCode:"IDQ21035",sourceProduct:"IDQ65652",geometry:g(148),
   veryDangerous:false};
  const vds={...cell,geometry:g(151),veryDangerous:true};
  const originalRings=[area,cell,vds].map(f=>JSON.stringify(f.geometry));
  const provider=mod.createWarningImageryProvider(CesiumStub,[area,cell,vds]);
  const canvas=await provider.requestImage(0,0,7),ctx=canvas.getContext("2d");
  const width=canvas.width,height=canvas.height;
  const sample=(lon,lat)=>{
   const px=(lon-136)/19*width,py=(-9-lat)/29*height;
   const d=ctx.getImageData(Math.round(px),Math.round(py),1,1).data;
   return [...d];
  };
  // 3 separate polygons at nonoverlapping source locations; sample the
  // middle of each TOP edge: sample only +/-5px so the separate VDS label\n  // cannot be mistaken for a polygon border on a deliberately small QA cell.
  const edgeStats=(lon)=>{
   const readings=[];
   const center=(-9+27)/29*height;
   for(let y=Math.round(center)-5;y<=Math.round(center)+5;y++)
    readings.push([...ctx.getImageData(Math.round((lon-136)/19*width),y,1,1).data]);
   return {
    opaquePixels:readings.filter(p=>p[3]>=190).length,
    dominant:readings.reduce((best,p)=>p[3]>best[3]?p:best,[0,0,0,0]),
    nearbyAlpha:readings.map(x=>x[3])
   };
  };
  return {width,height,area:edgeStats(145.5),cell:edgeStats(148.5),
   dangerous:edgeStats(151.5),
   areaInterior:sample(145.5,-27.5),
   outside:sample(143,-26.5),
   authenticVerticesUnmodified:[area,cell,vds].every((f,i)=>
    JSON.stringify(f.geometry)===originalRings[i]),
   warningModuleImport:await fetch("/src/context-layers/bom-warning-operational-v1.js")
    .then(r=>r.text()).then(s=>s.includes("20261102-crisp-boM-golden-v1"))};
 });
 assert.equal(measured.width,1024);
 assert.equal(measured.height,1024);
 assert(measured.warningModuleImport,"Compiled operator uses the fresh warning drawing module");
 assert(measured.authenticVerticesUnmodified,
  "Visual rendering must never modify official geometry vertices");
 const colourIs=(v,r,g,b)=>Math.abs(v[0]-r)<20&&Math.abs(v[1]-g)<20&&Math.abs(v[2]-b)<20;
 assert(colourIs(measured.area.dominant,245,196,39),
  "Regional area must be solid BoM-style golden yellow: "+JSON.stringify(measured.area));
 assert(colourIs(measured.cell.dominant,219,37,52),
  "Original severe cell must be red: "+JSON.stringify(measured.cell));
 assert(colourIs(measured.dangerous.dominant,189,17,42),
  "Source-labelled VERY DANGEROUS cell must be deeper red: "+JSON.stringify(measured.dangerous));
 for(const [name,stats] of Object.entries({
  area:measured.area,cell:measured.cell,dangerous:measured.dangerous
 })){
  assert(stats.opaquePixels>=2&&stats.opaquePixels<=6,
   name+" border is fuzzy/too thick: "+JSON.stringify(stats));
 }
 assert(measured.areaInterior[3]>0&&measured.areaInterior[3]<80,
  "Golden warning fill should be subtle and translucent");
 assert.equal(measured.outside[3],0,"No glow/halo outside the source geometry");
 console.log("BOM_CRISP_WARNING_PIXEL_QA_PASS",JSON.stringify({
  platform:mobile?"mobile WebKit":"desktop Chromium",
  width:measured.width,height:measured.height,
  borderWidths:[measured.area.opaquePixels,measured.cell.opaquePixels,
   measured.dangerous.opaquePixels],
  actualPixelColours:[measured.area.dominant,measured.cell.dominant,
   measured.dangerous.dominant],subtleFillAlpha:measured.areaInterior[3],
  source:"TEST-FIXTURE imagery against packaged production renderer"
 }));
}catch(error){
 console.log("BOM_CRISP_WARNING_PIXEL_QA_FAIL",String(error));
 await page.screenshot({path:mobile?
  "/tmp/bom-crisp-warning-mobile-failure.png":
  "/tmp/bom-crisp-warning-desktop-failure.png"}).catch(()=>{});
 throw error;
}finally{await browser.close();}
