#!/usr/bin/env node
// One-shot full national reflectivity tile-mosaic source verification.
import {publishedReflectivityTimes} from "../frontend/src/bom-wmts-published-times-v1.js";
import {reflectivityWindowForRegion,buildBomReflectivityTileUrl} from "../frontend/src/bom-wmts-loop-v2.js";
const times=(await publishedReflectivityTimes()).slice(-6);
console.log("RADAR_FULL_SOURCE_TIMES",JSON.stringify(times));
const regions=["66","23","08","19","22","75"];
for(const region of regions){
 const w=reflectivityWindowForRegion(region),summary=[];
 for(const observedUtc of times){
  const failures=[],tiles=[];
  for(let row=w.rowStart;row<=w.rowEnd;row++)for(let col=w.colStart;col<=w.colEnd;col++)tiles.push({col,row});
  for(const tile of tiles){
   try{
    const response=await fetch(buildBomReflectivityTileUrl(tile.col,tile.row,observedUtc),{
      signal:AbortSignal.timeout(10000),headers:{Origin:"https://blakesmith-intel.github.io"}});
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(!response.ok||bytes[0]!==137||bytes[1]!==80){
      failures.push({col:tile.col,row:tile.row,status:response.status,bytes:bytes.length,detail:new TextDecoder().decode(bytes.slice(0,120))});
    }
   }catch(e){failures.push({col:tile.col,row:tile.row,error:String(e.message)})}
  }
  summary.push({observedUtc,total:tiles.length,valid:tiles.length-failures.length,failures:failures.slice(0,8)});
 }
 console.log("RADAR_FULL_MOSAIC_AUDIT",JSON.stringify({region,window:w,summary}));
}
