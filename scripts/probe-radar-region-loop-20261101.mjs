#!/usr/bin/env node
// ONE-SHOT source diagnostic for 1 November multi-region frame availability.
// Fetch only published source timestamps, no probing imagined frames.
import {publishedReflectivityTimes} from "../frontend/src/bom-wmts-published-times-v1.js";
import {reflectivityWindowForRegion,buildBomReflectivityTileUrl} from "../frontend/src/bom-wmts-loop-v2.js";
const times=(await publishedReflectivityTimes()).slice(-7);
console.log("RADAR_REGION_SOURCE_TIMES",JSON.stringify(times));
const regions=["66","23","08","50","19","22","75","107","72","106","56"];
for(const region of regions){
 const w=reflectivityWindowForRegion(region);
 const positions=[{col:w.colStart,row:w.rowStart,type:"first"},{col:Math.floor((w.colStart+w.colEnd)/2),row:Math.floor((w.rowStart+w.rowEnd)/2),type:"center"}];
 const summary=[];
 for(const time of times){
  const tiles=[];
  for(const p of positions){
   const url=buildBomReflectivityTileUrl(p.col,p.row,time);
   try{
    const r=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{Origin:"https://blakesmith-intel.github.io"}});
    const bytes=new Uint8Array(await r.arrayBuffer());
    tiles.push({type:p.type,col:p.col,row:p.row,status:r.status,png:r.ok&&bytes.length>8&&bytes[0]===137&&bytes[1]===80,bytes:bytes.length,reason:r.ok?"":new TextDecoder().decode(bytes.slice(0,150))});
   }catch(e){tiles.push({type:p.type,error:String(e.message)})}
  }
  summary.push({time,tiles});
 }
 console.log("RADAR_REGION_TILE_AUDIT",JSON.stringify({region,window:w,summary}));
}
