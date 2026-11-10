// Q-SCOPE V10.6.8 ONLY: false-positive screening of experimental
// straight-line-wind research alerts. No change to Doppler imagery, warnings,
// existing radar science or earlier V10.3/4/5 comparison previews.
//
// Observing two real scans proves persistence of *pixels*, not meteorology.
// A handful of saturated +/-70km/hr display-palette pixels (especially
// speckled clutter) must not create an operator-facing wind event.
//
// This is deliberately independent of hook-echo / hook+couplet candidates.
const APPROVED_RADARS=new Set(["08","50","66"]);
const SOURCE_TIMES=new Set([
 "bom-history-filename-utc","bom-ftp-filename-utc",
 "bom-latest-filename-utc","bom-latest-source-utc"
]);
export const RESEARCH_WIND_QUALITY=Object.freeze({
 maxSamples:250000,
 radialMaxKmh:70,radialHighKmh:60,
 radialSupportMinKmh:25,
 highRadiusKm:4.5,supportRadiusKm:5.5,
 adjacencyKm:0.95,
 contextAdjacencyKm:1.6,
 minConnectedHigh:12,
 minSupportingPixels:8,
 minSpatialCells:3,
 cellKm:0.8
});
const valid=n=>typeof n==="number"&&Number.isFinite(n);
const loc=v=>valid(v?.latitude)&&valid(v?.longitude)&&
  Math.abs(v.latitude)<80&&Math.abs(v.longitude)<=180;
const km=(a,b)=>Math.hypot(
 (a.longitude-b.longitude)*111.32*
 Math.cos((a.latitude+b.latitude)*Math.PI/360),
 (a.latitude-b.latitude)*111.32);
const key=(x,y)=>x+":"+y;
function recordFor(records,radarId,utc) {
 if(typeof utc!=="string"||!Number.isFinite(Date.parse(utc)))return null;
 const matched=(Array.isArray(records)?records:[]).filter(x=>
   x&&String(x.radarId)===radarId);
 // Invariant: one real scan per radar and requested UTC. Never choose a
 // convenient older/nearby scan out of an ambiguous mixed set.
 if(matched.length!==1)return null;
 const r=matched[0];
 if(!APPROVED_RADARS.has(radarId)||r.observedUtc!==utc||
    !SOURCE_TIMES.has(r.timeBasis)||r.geometryVerified!==true||
    r.temporalInference||r.velocityInterpolated||
    !Array.isArray(r.samples)||r.samples.length>RESEARCH_WIND_QUALITY.maxSamples)
   return null;
 return r;
}
function nativePoints(record,at,rules) {
 const seenCoordinates=new Set(),seenPixelIndices=new Set(),out=[];
 for(const s of record.samples) {
   if(!loc(s)||!valid(s.velocity_kmh)||s.velocity_kmh===0||
      Math.abs(s.velocity_kmh)>rules.radialMaxKmh||
      km(s,at)>rules.supportRadiusKm)continue;
   const coord=s.latitude.toFixed(6)+":"+s.longitude.toFixed(6);
   if(seenCoordinates.has(coord))continue;
   if(Number.isInteger(s.pixel_index)&&s.pixel_index>=0){
     if(seenPixelIndices.has(s.pixel_index))continue;
     seenPixelIndices.add(s.pixel_index);
   }
   seenCoordinates.add(coord);
   const x=(s.longitude-at.longitude)*111.32*
     Math.cos(at.latitude*Math.PI/180);
   const y=(s.latitude-at.latitude)*111.32;
   out.push({x,y,longitude:s.longitude,latitude:s.latitude,
     velocity:s.velocity_kmh,sign:Math.sign(s.velocity_kmh)});
 }
 return out;
}
function grid(points,unit) {
 const cells=new Map();
 for(let i=0;i<points.length;i++){
   const p=points[i];
   const k=key(Math.floor(p.x/unit),Math.floor(p.y/unit));
   if(!cells.has(k))cells.set(k,[]);
   cells.get(k).push(i);
 }
 return cells;
}
function neighbours(point,points,cells,unit,radius) {
 const cx=Math.floor(point.x/unit),cy=Math.floor(point.y/unit);
 const width=Math.ceil(radius/unit),out=[];
 for(let dx=-width;dx<=width;dx++)
 for(let dy=-width;dy<=width;dy++)
 for(const i of cells.get(key(cx+dx,cy+dy))??[]){
   const p=points[i];
   if(Math.hypot(p.x-point.x,p.y-point.y)<=radius)out.push(i);
 }
 return out;
}
function largestConnected(high,rules) {
 // Within 4.5 km of the event, spatial adjacency is a real contiguous
 // radar field, not "three same-coloured pixels anywhere in a 5km tile".
 const cells=grid(high,rules.adjacencyKm),used=new Uint8Array(high.length);
 let best=[];
 for(let i=0;i<high.length;i++){
   if(used[i])continue;
   used[i]=1;
   const queue=[i];
   for(let head=0;head<queue.length;head++){
     for(const j of neighbours(high[queue[head]],high,cells,
         rules.adjacencyKm,rules.adjacencyKm)){
       if(!used[j]){used[j]=1;queue.push(j);}
     }
   }
   if(queue.length>best.length)best=queue.map(j=>high[j]);
 }
 return best;
}
export function describeWindPatch(record,alert,{
  rules=RESEARCH_WIND_QUALITY
}={}){
 if(!record||!loc(alert))return {ok:false,reason:"missing-source"};
 const points=nativePoints(record,alert,rules);
 const high=points.filter(p=>Math.abs(p.velocity)>=rules.radialHighKmh&&
   Math.hypot(p.x,p.y)<=rules.highRadiusKm);
 const patch=largestConnected(high,rules);
 if(patch.length<rules.minConnectedHigh)
   return {ok:false,reason:"scattered-or-insufficient-high-pixels",
     highPixels:patch.length};
 const cells=new Set(patch.map(p=>
   key(Math.floor(p.x/rules.cellKm),Math.floor(p.y/rules.cellKm))));
 if(cells.size<rules.minSpatialCells)
   return {ok:false,reason:"narrow-palette-streak",highPixels:patch.length};
 const sign=patch[0].sign;
 // If the contiguous field is a mixture of opposing saturated velocities,
 // it is *not* a straight-line wind candidate.
 if(patch.some(p=>p.sign!==sign))
   return {ok:false,reason:"mixed-velocity-signs"};
 const context=points.filter(p=>p.sign===sign&&
   Math.abs(p.velocity)>=rules.radialSupportMinKmh&&
   Math.abs(p.velocity)<rules.radialHighKmh);
 const nearbyContext=grid(context,rules.contextAdjacencyKm);
 const supported=new Set();
 for(const p of patch){
   for(const i of neighbours(p,context,nearbyContext,
       rules.contextAdjacencyKm,rules.contextAdjacencyKm))supported.add(i);
 }
 if(supported.size<rules.minSupportingPixels)
   return {ok:false,reason:"no-coherent-velocity-gradient",
     highPixels:patch.length,contextPixels:supported.size};
 return {ok:true,reason:"coherent-source-velocity-patch",
   highPixels:patch.length,contextPixels:supported.size,
   velocitySign:sign};
}
export function screenResearchWindArtefacts({
 alerts=[],currentRecords=[],previousRecords=[]
}={}){
 const accepted=[],rejected=[];
 for(const alert of Array.isArray(alerts)?alerts:[]){
   if(alert?.category!=="strong_radial_signature"){
     accepted.push(alert);continue; // Hook and couplet logic unchanged.
   }
   const radar=String(alert.radar_id??"");
   const current=recordFor(currentRecords,radar,alert.source_utc);
   const prior=recordFor(previousRecords,radar,
     alert.prior_source_utc??alert.previous_doppler_utc);
   const modern=current&&describeWindPatch(current,alert);
   const older=prior&&describeWindPatch(prior,alert);
   if(modern?.ok&&older?.ok){
     accepted.push({...alert,
       quality_screen:"two-coherent-source-radial-patches",
       quality_pixels_latest:modern.highPixels,
       quality_pixels_prior:older.highPixels,
       caveat:String(alert.caveat??"")+
         " Additional V10.6 artefact screen: contiguous multi-pixel velocity "+
         "field plus surrounding measured radial-flow support in both scans; "+
         "NOT a confirmed surface gust, downburst or official BoM warning."});
   }else rejected.push({id:alert.id,radarId:radar,
     reason:modern?.ok?(older?.reason??"missing-prior-source"):
       (modern?.reason??"missing-current-source")});
 }
 return {alerts:accepted,rejected,screenedWind:accepted.filter(a=>
   a?.category==="strong_radial_signature").length};
}
