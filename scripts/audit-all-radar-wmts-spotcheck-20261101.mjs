#!/usr/bin/env node
// Source-aware, bounded all-site spot check. Complements full six-UTC, all-tile
// forensic sampling for Gympie and Gladstone, without making 22*6*mosaic
// upstream requests that would trigger avoidable relay/BoM throttling.
import {BORDER_RADAR_SITES} from "../frontend/src/border-radar-sites-v1.js";
import {publishedReflectivityTimes} from "../frontend/src/bom-wmts-published-times-v1.js";
import {reflectivityWindowForRegion,buildBomReflectivityTileUrl}
 from "../frontend/src/bom-wmts-loop-v2.js";
const published=await publishedReflectivityTimes();
const utc=published.at(-2)??published.at(-1);
if(!utc)throw Error("No authentic BoM WMTS timestamp published");
const ids=Object.keys(BORDER_RADAR_SITES);
async function sample(region,tile){
 const url=buildBomReflectivityTileUrl(tile.col,tile.row,utc);
 try{
  const response=await fetch(url,{
   headers:{Origin:"https://blakesmith-intel.github.io"},
   cache:"no-store",signal:AbortSignal.timeout(12000)
  });
  const bytes=new Uint8Array(await response.arrayBuffer());
  const png=response.ok&&bytes.length>8&&bytes[0]===137&&bytes[1]===80&&
    bytes[2]===78&&bytes[3]===71;
  return {...tile,png,status:response.status,
   reason:png?"":new TextDecoder().decode(bytes.slice(0,120))};
 }catch(error){return {...tile,png:false,error:String(error?.message??error)};}
}
const outcomes=[];
for(const id of ids){
 const w=reflectivityWindowForRegion(id);
 const positions=[{col:w.colStart,row:w.rowStart},
  {col:Math.floor((w.colStart+w.colEnd)/2),
   row:Math.floor((w.rowStart+w.rowEnd)/2)}];
 const samples=[];
 for(const position of positions) samples.push(await sample(id,position));
 const result={region:id,name:BORDER_RADAR_SITES[id].name,utc,
  geographicWindow:w,samples,sourceReadable:samples.every(s=>s.png)};
 outcomes.push(result);
 console.log("BOUNDED_ALL_SITE_WMTS_SPOT_CHECK",JSON.stringify(result));
}
const complete=outcomes.filter(o=>o.sourceReadable).length;
console.log("ALL_SITE_WMTS_SUMMARY",JSON.stringify({publishedUtc:utc,
 sites:outcomes.length,readable:complete,failed:outcomes.filter(x=>!x.sourceReadable)
 .map(x=>({region:x.region,samples:x.samples.filter(s=>!s.png)}))}));
