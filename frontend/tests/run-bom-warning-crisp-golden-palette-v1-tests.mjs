import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 BOM_WARNING_VISUAL_STYLES,officialBoMWarningVisualStyle,
 createWarningImageryProvider
} from "../src/context-layers/bom-warning-terrain-imagery-v1.js";

const area={type:"severe-thunderstorm",productCode:"IDQ21033",
 sourceProduct:"IDQ65654",hazardAssessment:{highEnd:["Destructive winds"]}};
const detailed={...area,productCode:"IDQ21035",sourceProduct:"IDQ65650"};
const cell={type:"severe-thunderstorm-cell",productCode:"IDQ21035",
 sourceProduct:"IDQ65652",veryDangerous:false};
const dangerous={...cell,veryDangerous:true};
const fakeVds={...dangerous,sourceProduct:"IDQ65650"};
assert.equal(officialBoMWarningVisualStyle(area),BOM_WARNING_VISUAL_STYLES.area);
assert.equal(officialBoMWarningVisualStyle(detailed),BOM_WARNING_VISUAL_STYLES.area);
assert.equal(officialBoMWarningVisualStyle(cell),BOM_WARNING_VISUAL_STYLES.cell);
assert.equal(officialBoMWarningVisualStyle(dangerous),
 BOM_WARNING_VISUAL_STYLES.veryDangerousCell);
assert.equal(officialBoMWarningVisualStyle(fakeVds),BOM_WARNING_VISUAL_STYLES.cell,
 "Very Dangerous requires an original, designated IDQ65652 cell");
assert.equal(officialBoMWarningVisualStyle({type:"severe-weather"}),
 BOM_WARNING_VISUAL_STYLES.severeWeather);
assert.equal(officialBoMWarningVisualStyle({type:"unverified"}),null);
assert.match(BOM_WARNING_VISUAL_STYLES.area.stroke,/^#F5C427$/i);
assert.equal(BOM_WARNING_VISUAL_STYLES.area.width,3);
assert.match(BOM_WARNING_VISUAL_STYLES.cell.stroke,/^#DB2534$/i);
assert.match(BOM_WARNING_VISUAL_STYLES.veryDangerousCell.stroke,/^#BD112A$/i);

const sources=[];
const oldDocument=globalThis.document;
const rad=Math.PI/180;
const Cesium={
 Rectangle:{fromDegrees:(...values)=>values},
 GeographicTilingScheme:class{
  constructor({rectangle}){this.rectangle=rectangle;}
  tileXYToRectangle(){return {west:136*rad,east:155*rad,south:-38*rad,north:-9*rad};}
 },
 Credit:class{constructor(message){this.message=message;}},
 Event:class{}
};
globalThis.document={
 createElement(tag){
  assert.equal(tag,"canvas");
  const calls=[];
  const ctx={
   beginPath(){},moveTo(){},lineTo(){},closePath(){},
   fill(rule){calls.push({action:"fill",fill:this.fillStyle,rule});},
   stroke(){calls.push({action:"stroke",colour:this.strokeStyle,width:this.lineWidth,
     shadowBlur:this.shadowBlur,cap:this.lineCap,join:this.lineJoin});},
   fillRect(){},strokeRect(){},
   fillText(text){calls.push({action:"text",text});},
   measureText(text){return {width:text.length*8};}
  };
  const canvas={width:0,height:0,calls,getContext(){return ctx;}};
  sources.push(canvas);
  return canvas;
 }
};
const ring=[[152,-26],[152.5,-26],[152.5,-26.4],[152,-26.4],[152,-26]];
const geometry={type:"Polygon",coordinates:[ring]};
try{
 const provider=createWarningImageryProvider(Cesium,
  [area,detailed,cell,dangerous,fakeVds].map((a,i)=>({...a,id:String(i),geometry})));
 assert.equal(provider.tileWidth,1024,"Use high-resolution sharp map tiles");
 assert.equal(provider.tileHeight,1024);
 assert.equal(provider.maximumLevel,12,"Do not reduce detailed warning map coverage");
 assert.equal(provider.hasAlphaChannel,true);
 const image=await provider.requestImage(0,0,7);
 assert.equal(image.width,1024);
 assert.equal(image.height,1024);
 const strokes=image.calls.filter(v=>v.action==="stroke");
 assert.equal(strokes.length,5,
  "Single solid outline per real source polygon: no fuzzy halo / double stroke");
 assert.deepEqual(strokes.map(v=>v.colour),[
  "#F5C427","#F5C427","#DB2534","#BD112A","#DB2534"
 ]);
 assert(strokes.every(v=>v.shadowBlur===0&&v.cap==="butt"&&v.join==="round"));
 assert(strokes.every(v=>v.width>=3&&v.width<=4));
 const fills=image.calls.filter(v=>v.action==="fill");
 assert.equal(fills.length,5);
 assert(fills.every(v=>v.rule==="evenodd"&&/rgba\(/.test(v.fill)));
 assert.equal(image.calls.filter(v=>v.action==="text"&&v.text==="VERY DANGEROUS").length,1,
  "Only the actual IDQ65652 VDS feature has a severe cell callout");
 const broad=await provider.requestImage(0,0,4);
 assert.equal(broad.calls.filter(v=>v.action==="text"&&v.text==="VD").length,1);
 const distant=await provider.requestImage(0,0,2);
 assert.equal(distant.calls.filter(v=>v.action==="text").length,0);
}finally{
 if(oldDocument===undefined)delete globalThis.document;
 else globalThis.document=oldDocument;
}
const importer=readFileSync(new URL("../src/context-layers/bom-warning-operational-v1.js",
 import.meta.url),"utf8");
assert(importer.includes("20261102-crisp-boM-golden-v1"));
const build=readFileSync(new URL("../../scripts/build-current-site.sh",import.meta.url),"utf8");
assert(build.includes("20261102-crisp-gold-v1"));
assert(build.includes("crisp-golden-bom-polygons-20261102-v1"),
 "Fresh web application import chain must bust existing Safari/desktop module cache");
assert(build.includes("initialiseOfficialBomWarningPolygons({viewer,CesiumRef:Cesium"),
 "Original operational warning data source and camera integration remain unchanged");
console.log("PASS crisp BoM golden-yellow regions/detailed threats, red source cells, red VDS labels, single strokes, high-resolution canvas, unchanged geometry and cache refresh.");
