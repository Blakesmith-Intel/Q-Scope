// Cesium ground imagery provider. Its position IN imageryLayers, below the
// measured radar imagery surface, keeps warning fills UNDER all radar pixels.
// Not Cesium PolygonGraphics: ground entities can obscure radar imagery.
export const WARNING_RECTANGLE=Object.freeze([136,-38,155,-9]);
const rad=180/Math.PI;
const ringsOf=g=>g?.type==="Polygon"?g.coordinates:
 g?.type==="MultiPolygon"?g.coordinates.flatMap(p=>p):[];
export function warningContainsPoint(geometry,longitude,latitude){
 let inside=false;
 for(const poly of geometry?.type==="Polygon"?[geometry.coordinates]:
     geometry?.type==="MultiPolygon"?geometry.coordinates:[]){
  if(!Array.isArray(poly)||!poly.length)continue;
  const within=ring=>{
   let state=false;
   for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if(((a[1]>latitude)!==(b[1]>latitude))&&
      longitude<(b[0]-a[0])*(latitude-a[1])/(b[1]-a[1])+a[0])
       state=!state;
   }
   return state;
  };
  if(within(poly[0])&&!poly.slice(1).some(within))inside=true;
 }
 return inside;
}
// A label should sit WITHIN the authentic storm location, not at the first
// vertex or on an invented path. For concave shapes retain a source vertex.
export function officialStormCellLabelPoint(geometry){
 const ring=(geometry?.type==="Polygon"?geometry.coordinates?.[0]:
  geometry?.type==="MultiPolygon"?geometry.coordinates?.[0]?.[0]:null);
 if(!ring?.length)return null;
 const length=ring.length>1&&ring[0][0]===ring.at(-1)[0]&&
  ring[0][1]===ring.at(-1)[1]?ring.length-1:ring.length;
 if(length<3)return null;
 const lon=ring.slice(0,length).reduce((a,p)=>a+p[0],0)/length;
 const lat=ring.slice(0,length).reduce((a,p)=>a+p[1],0)/length;
 return warningContainsPoint(geometry,lon,lat)?[lon,lat]:ring[0].slice(0,2);
}
// BoM's map convention: yellow warning areas, red severe thunderstorm cells,
// with an explicit stronger red callout only for a source-qualified VDS cell.
// These are PRESENTATION colours, never a severity inferred from radar values.
export const BOM_WARNING_VISUAL_STYLES=Object.freeze({
 area:Object.freeze({fill:"rgba(245,196,39,0.11)",stroke:"#F5C427",width:2}),
 severeWeather:Object.freeze({fill:"rgba(248,176,39,0.13)",stroke:"#EDBB59",width:2}),
 cell:Object.freeze({fill:"rgba(217,39,49,0.11)",stroke:"#DB2534",width:2.5}),
 veryDangerousCell:Object.freeze({fill:"rgba(171,6,26,0.16)",stroke:"#BD112A",width:3})
});
export function officialBoMWarningVisualStyle(entry){
 if(entry?.type==="severe-thunderstorm-cell"){
  return entry.sourceProduct==="IDQ65652"&&entry.veryDangerous===true?
   BOM_WARNING_VISUAL_STYLES.veryDangerousCell:BOM_WARNING_VISUAL_STYLES.cell;
 }
 if(entry?.type==="severe-thunderstorm")return BOM_WARNING_VISUAL_STYLES.area;
 if(entry?.type==="severe-weather")return BOM_WARNING_VISUAL_STYLES.severeWeather;
 return null;
}
// One operator-visible polygon object per source warning. Cesium requires
// terrain polygon and screen-pixel boundary geometry to be two GPU draws; keep
// both INSIDE one ownership/visibility/lifecycle PrimitiveCollection per
// warning. The same untouched source rings drive the two draws. Never publish
// an independent imagery fill or a separately managed line layer.
export function createUnifiedBoMWarningTerrainPolygons(CesiumRef,warnings){
 const all=new CesiumRef.PrimitiveCollection({destroyPrimitives:true});
 let count=0;
 const positions=ring=>{
  if(!Array.isArray(ring)||ring.length<4)return null;
  const first=ring[0],last=ring.at(-1);
  const closed=first?.[0]===last?.[0]&&first?.[1]===last?.[1];
  const original=closed?ring.slice(0,-1):ring.slice();
  if(original.length<3||original.some(p=>!Array.isArray(p)||
    !Number.isFinite(p[0])||!Number.isFinite(p[1])||
    Math.abs(p[0])>180||Math.abs(p[1])>90))return null;
  return CesiumRef.Cartesian3.fromDegreesArray(original.flatMap(([lon,lat])=>[lon,lat]));
 };
 for(const entry of warnings??[]){
  const style=officialBoMWarningVisualStyle(entry);
  if(!style||!["Polygon","MultiPolygon"].includes(entry?.geometry?.type))continue;
  const eachPolygon=entry.geometry.type==="Polygon"?
   [entry.geometry.coordinates]:entry.geometry.coordinates;
  const shape=new CesiumRef.PrimitiveCollection({destroyPrimitives:true});
  const fillInstances=[],borderInstances=[],seen=new Set();
  for(const polygon of eachPolygon){
   const exterior=positions(polygon?.[0]);
   if(!exterior)continue;
   const holes=polygon.slice(1).map(positions).filter(Boolean);
   fillInstances.push(new CesiumRef.GeometryInstance({
    geometry:new CesiumRef.PolygonGeometry({
     polygonHierarchy:new CesiumRef.PolygonHierarchy(exterior,
      holes.map(h=>new CesiumRef.PolygonHierarchy(h))),
     vertexFormat:CesiumRef.PerInstanceColorAppearance.VERTEX_FORMAT
    }),
    attributes:{color:CesiumRef.ColorGeometryInstanceAttribute.fromColor(
     CesiumRef.Color.fromCssColorString(style.fill))}
   }));
   // Boundary rings, including actual source holes. No Douglas-Peucker,
   // double strokes or invented closing points. A real GroundPolyline is
   // 2 CSS pixels wide at all zooms, not a scaled 1024px imagery stroke.
   for(const ring of polygon){
    const p=positions(ring);
    if(!p)continue;
    const id=JSON.stringify(ring);
    if(seen.has(id))continue;
    seen.add(id);
    borderInstances.push(new CesiumRef.GeometryInstance({
     geometry:new CesiumRef.GroundPolylineGeometry({
      positions:p,loop:true,width:style.width
     }),
     attributes:{color:CesiumRef.ColorGeometryInstanceAttribute.fromColor(
      CesiumRef.Color.fromCssColorString(style.stroke))}
    }));
   }
  }
  if(!fillInstances.length||!borderInstances.length)continue;
  shape.add(new CesiumRef.GroundPrimitive({
   geometryInstances:fillInstances,
   appearance:new CesiumRef.PerInstanceColorAppearance({
    flat:true,translucent:true
   }),
   classificationType:CesiumRef.ClassificationType.TERRAIN,
   allowPicking:false,asynchronous:true
  }));
  shape.add(new CesiumRef.GroundPolylinePrimitive({
   geometryInstances:borderInstances,
   appearance:new CesiumRef.PolylineColorAppearance({translucent:false}),
   classificationType:CesiumRef.ClassificationType.TERRAIN,
   allowPicking:false,asynchronous:true
  }));
  if(entry.type==="severe-thunderstorm-cell"&&
     entry.sourceProduct==="IDQ65652"&&entry.veryDangerous===true){
   const anchor=officialStormCellLabelPoint(entry.geometry);
   if(anchor){
    const labels=new CesiumRef.LabelCollection();
    labels.add({
     position:CesiumRef.Cartesian3.fromDegrees(anchor[0],anchor[1]),
     text:"VD",font:"bold 12px sans-serif",
     fillColor:CesiumRef.Color.WHITE,
     showBackground:true,
     backgroundColor:CesiumRef.Color.fromCssColorString("#870c23"),
     backgroundPadding:new CesiumRef.Cartesian2(7,4),
     verticalOrigin:CesiumRef.VerticalOrigin.CENTER,
     horizontalOrigin:CesiumRef.HorizontalOrigin.CENTER,
     heightReference:CesiumRef.HeightReference.CLAMP_TO_GROUND
    });
    shape.add(labels);
   }
  }
  all.add(shape);
  count++;
 }
 return count?all:null;
}
export function createWarningImageryProvider(CesiumRef,warnings){
 const tilingScheme=new CesiumRef.GeographicTilingScheme({
  rectangle:CesiumRef.Rectangle.fromDegrees(...WARNING_RECTANGLE),
  numberOfLevelZeroTilesX:1,numberOfLevelZeroTilesY:1
 });
 // Imagery is for translucent fills and existing small cell labels ONLY.
 // Source geometry strokes are exclusively screen-space GroundPolylinePrimitives.
 // Retain full fill resolution for source geometry and hole fidelity.
 const tileWidth=1024,tileHeight=1024;
 const image=(x,y,level)=>{
  const rect=tilingScheme.tileXYToRectangle(x,y,level),w=rect.east-rect.west,h=rect.north-rect.south;
  const canvas=document.createElement("canvas");canvas.width=tileWidth;canvas.height=tileHeight;
  const c=canvas.getContext("2d");
  if(!c)return canvas;
  c.shadowBlur=0;
  c.shadowColor="transparent";
  c.lineCap="butt";
  c.lineJoin="round";
  for(const entry of warnings){
   const rings=ringsOf(entry.geometry),style=officialBoMWarningVisualStyle(entry);
   if(!style)continue;
   c.beginPath();let has=false;
   for(const ring of rings){
    if(!Array.isArray(ring)||ring.length<4)continue;
    // True source vertices, no Douglas-Peucker simplification or sliver cull.
    for(let i=0;i<ring.length;i++){
     const px=((ring[i][0]/rad)-rect.west)/w*tileWidth;
     const py=(rect.north-(ring[i][1]/rad))/h*tileHeight;
     if(i===0)c.moveTo(px,py);else c.lineTo(px,py);
    }
    c.closePath();has=true;
   }
   if(!has)continue;
   // NO raster boundary stroke: Cesium magnifies strokes painted in tiles
   // while zooming, creating the 10-20px blurred crayon effect. GPU vector
   // outlines draw exactly once in screen space on the ground.
   c.fillStyle=style.fill;c.fill("evenodd");
   // A map callout is permitted ONLY for an individual IDQ65652 feature
   // whose OWN published text explicitly identifies it as VERY DANGEROUS.
   // The general CAP bulletin or IDQ65650 threat area never assigns the
   // dangerous label to an individual cell.
   if(entry.type==="severe-thunderstorm-cell"&&entry.sourceProduct==="IDQ65652"&&
      entry.veryDangerous===true&&level>=3){
    const point=officialStormCellLabelPoint(entry.geometry);
    const anchorLon=point?.[0]/rad,anchorLat=point?.[1]/rad;
    if(Number.isFinite(anchorLon)&&Number.isFinite(anchorLat)&&
       anchorLon>=rect.west&&anchorLon<=rect.east&&
       anchorLat>=rect.south&&anchorLat<=rect.north){
     const x0=((anchorLon-rect.west)/w)*tileWidth;
     const y0=((rect.north-anchorLat)/h)*tileHeight;
     // Small self-contained red pill, no BoM-style leader lines or huge
     // alert boxes. At broad zoom show VD to limit tile overlap.
     const message=level>=6?"VERY DANGEROUS":"VD";
     if(typeof c.fillText==="function"){
      c.font=level>=6?"bold 11px system-ui, sans-serif":"bold 12px system-ui, sans-serif";
      const tw=c.measureText?.(message)?.width??(level>=6?105:18);
      const pillWidth=tw+16,pillHeight=20;
      const left=x0-pillWidth/2,top=y0-pillHeight/2;
      c.fillStyle="#870c23";
      c.fillRect?.(left,top,pillWidth,pillHeight);
      c.strokeStyle="#fff4e7";c.lineWidth=1;
      c.strokeRect?.(left,top,pillWidth,pillHeight);
      c.fillStyle="#ffffff";
      c.fillText(message,left+8,top+14);
     }
    }
   }
  }
  return canvas;
 };
 const provider={
  tileWidth,tileHeight,minimumLevel:0,maximumLevel:12,
  tilingScheme,rectangle:tilingScheme.rectangle,
  hasAlphaChannel:true,credit:new CesiumRef.Credit("Official Bureau of Meteorology warning areas"),
  ready:true,readyPromise:Promise.resolve(true),
  errorEvent:new CesiumRef.Event(),
  // Cesium's imagery tile pipeline calls .then() on requestImage results.
  // Returning a raw HTMLCanvasElement crashes the entire Cesium scene.
  requestImage(x,y,level){return Promise.resolve(image(x,y,level));},
  pickFeatures(x,y,level,lon,lat){
   const found=warnings.filter(a=>warningContainsPoint(a.geometry,lon*rad,lat*rad));
   return Promise.resolve(found.map(a=>{
    const item=new CesiumRef.ImageryLayerFeatureInfo();
    item.name=a.headline||a.event;item.data=a;
    item.position=CesiumRef.Cartographic.fromRadians(lon,lat);
    return item;
   }));
  }
 };
 return provider;
}
