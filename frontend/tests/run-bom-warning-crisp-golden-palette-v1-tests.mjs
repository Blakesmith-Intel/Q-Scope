import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 BOM_WARNING_VISUAL_STYLES,officialBoMWarningVisualStyle,
 createWarningImageryProvider,createUnifiedBoMWarningTerrainPolygons
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
assert.equal(BOM_WARNING_VISUAL_STYLES.area.width,2);
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
 assert.equal(strokes.length,0,
  "Zoom-scaled raster imagery MUST have no border strokes: all sharp lines are terrain primitives");
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
assert(importer.includes("20261102-unified-terrain-warning-polygon-v1"));
const build=readFileSync(new URL("../../scripts/build-current-site.sh",import.meta.url),"utf8");
assert(build.includes("20261102-idq-product-source-isolation-v1"),
 "New source-qualified warning controller must bust previously cached modules");
assert(build.includes("idq-source-isolation-20261102-v1"),
 "Every new browser page must force the latest source-qualified controller");
assert(build.includes("unified-terrain-warning-polygon-20261102-v1"),
 "Fresh web application import chain must bust existing Safari/desktop module cache");
assert(build.includes("initialiseOfficialBomWarningPolygons({viewer,CesiumRef:Cesium"),
 "Original operational warning data source and camera integration remain unchanged");
console.log("PASS crisp BoM golden-yellow source areas, red source cells, red VDS labels, NO zoom-scaled raster strokes and fresh bundle version.");
// Every input warning is ONE terrain object with its genuine fill and
// fixed-width boundary bound together, including source holes and cell label.
class Collection{
 constructor(){this.children=[];}
 add(x){this.children.push(x);return x;}
 get length(){return this.children.length;}
}
class Geom{constructor(p){Object.assign(this,p);}}
const colours=[];
const mock={
 PrimitiveCollection:Collection,
 GeometryInstance:Geom,PolygonGeometry:Geom,PolygonHierarchy:class {
  constructor(positions,holes=[]){this.positions=positions;this.holes=holes;}
 },
 GroundPrimitive:Geom,GroundPolylinePrimitive:Geom,GroundPolylineGeometry:Geom,
 PerInstanceColorAppearance:class {static VERTEX_FORMAT="COLOR_VERTEX";constructor(p){Object.assign(this,p);}},
 PolylineColorAppearance:Geom,
 ColorGeometryInstanceAttribute:{fromColor:c=>c},
 Color:{WHITE:"white",fromCssColorString:s=>{colours.push(s);return s;}},
 ClassificationType:{TERRAIN:"terrain"},
 Cartesian3:{fromDegreesArray:n=>n,fromDegrees:(lon,lat)=>[lon,lat]},
 Cartesian2:class{constructor(x,y){this.x=x;this.y=y;}},
 VerticalOrigin:{CENTER:"center"},HorizontalOrigin:{CENTER:"center"},
 HeightReference:{CLAMP_TO_GROUND:"clamp"},
 LabelCollection:class extends Collection{}
};
const hole=[[152.05,-26.05],[152.15,-26.05],[152.15,-26.15],
 [152.05,-26.15],[152.05,-26.05]];
const items=[
 {...area,geometry:{type:"Polygon",coordinates:[ring,hole]}},
 {...detailed,geometry:{type:"Polygon",coordinates:[ring]}},
 {...dangerous,geometry:{type:"MultiPolygon",coordinates:[[ring],[ring.map(([x,y])=>[x+1,y])]]}}
];
const original=JSON.stringify(items);
const unified=createUnifiedBoMWarningTerrainPolygons(mock,items);
assert.equal(unified.length,3,"One grouped object per source warning");
assert.equal(JSON.stringify(items),original,"No mutation of original BoM vertices");
for(let i=0;i<unified.length;i++){
 const group=unified.children[i];
 assert(group instanceof Collection);
 assert.equal(group.children[0] instanceof mock.GroundPrimitive,true,
   "Terrain fill lives inside the SAME polygon object as the boundary");
 assert.equal(group.children[1] instanceof mock.GroundPolylinePrimitive,true,
   "Fixed width, terrain-following border lives inside the SAME polygon object");
 const lines=group.children[1].geometryInstances;
 assert(lines.every(x=>x.geometry.loop===true));
 assert(lines.every(x=>x.geometry.width=== (i===2?3:2)));
 assert(lines.every(x=>x.geometry.positions.length>=6));
}
assert.equal(unified.children[0].children[0].geometryInstances[0].geometry
 .polygonHierarchy.holes.length,1,"Original interior hole is preserved");
assert.equal(unified.children[0].children[1].geometryInstances.length,2,
 "Original external and interior boundary share one lifecycle");
assert.equal(unified.children[2].children.length,3,
 "Original Very Dangerous source cell keeps its label INSIDE its polygon object");
assert.equal(unified.children[2].children[2].children[0].text,"VD");
assert(colours.includes("#F5C427")&&colours.includes("#BD112A"));
assert(colours.includes("rgba(245,196,39,0.11)"));
console.log("PASS unified terrain warning polygons: one object per source, coincident fill+fixed pixel border, holes/multipolygons, real VDS label and unchanged source coordinates.");
