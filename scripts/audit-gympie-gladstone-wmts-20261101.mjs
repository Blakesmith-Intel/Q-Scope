#!/usr/bin/env node
// Bounded, one-off source evidence for Gympie 08, Gladstone 23, and
// Stapylton control 66. Uses only authoritative published UTCs and actual
// complete WMTS PNGs; never fills a missing tile or invents a source frame.
import {publishedReflectivityTimes} from "../frontend/src/bom-wmts-published-times-v1.js";
import {reflectivityWindowForRegion,buildBomReflectivityTileUrl}
  from "../frontend/src/bom-wmts-loop-v2.js";

const times=(await publishedReflectivityTimes()).slice(-6);
console.log("GYMPIE_GLADSTONE_PUBLISHED_UTC",JSON.stringify(times));
if(times.length<6)console.log("SOURCE_HISTORY_SHORTER_THAN_SIX");
async function tile(region,utc,col,row){
 const url=buildBomReflectivityTileUrl(col,row,utc);
 for(let attempt=1;attempt<=2;attempt++){
  try{
   const response=await fetch(url,{
    headers:{Origin:"https://blakesmith-intel.github.io"},
    signal:AbortSignal.timeout(12000),cache:"no-store"
   });
   const buf=new Uint8Array(await response.arrayBuffer());
   const png=response.ok && buf[0]===137 && buf[1]===80 &&
     buf[2]===78 && buf[3]===71;
   if(png)return null;
   const reason={utc,col,row,attempt,status:response.status,
     detail:new TextDecoder().decode(buf.slice(0,130))};
   if(attempt===2||[400,403,429].includes(response.status))return reason;
  }catch(error){
   if(attempt===2)return {utc,col,row,attempt,error:String(error?.message??error)};
  }
  await new Promise(resolve=>setTimeout(resolve,300));
 }
}
for(const region of ["08","23","66"]){
 const box=reflectivityWindowForRegion(region),summary=[];
 for(const utc of times){
  const failures=[];
  for(let row=box.rowStart;row<=box.rowEnd;row++){
   for(let col=box.colStart;col<=box.colEnd;col++){
    const error=await tile(region,utc,col,row);
    if(error)failures.push(error);
   }
  }
  summary.push({utc,verified:failures.length===0,
    tilesTested:(box.rowEnd-box.rowStart+1)*(box.colEnd-box.colStart+1),
    failures});
 }
 console.log("GYMPIE_GLADSTONE_EXACT_TILE_AUDIT",
  JSON.stringify({region,window:box,summary,
   genuineCompleteFrames:summary.filter(item=>item.verified).length}));
}
