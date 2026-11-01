import {publishedReflectivityTimes} from "../frontend/src/bom-wmts-published-times-v1.js";
import {buildBomReflectivityTileUrl,reflectivityWindowForRegion} from "../frontend/src/bom-wmts-loop-v2.js";
const now=new Date().toISOString(), times=await publishedReflectivityTimes();
console.log("PROBE_NOW",now,"PUBLISHED",JSON.stringify(times));
for(const region of ["66","106","24","107","74","75","36","23"]){
 const w=reflectivityWindowForRegion(region); const first={col:w.colStart,row:w.rowStart},
 center={col:Math.floor((w.colStart+w.colEnd)/2),row:Math.floor((w.rowStart+w.rowEnd)/2)};
 const probes=[];
 for(const time of times.slice(-9)){
  const row={time};
  for(const [name,tile] of [["first",first],["center",center]]){
   try{
    const url=buildBomReflectivityTileUrl(tile.col,tile.row,time);
    const response=await fetch(url,{signal:AbortSignal.timeout(12000)});
    const bytes=new Uint8Array(await response.arrayBuffer());
    row[name]={status:response.status,bytes:bytes.length,png:bytes[0]===137&&bytes[1]===80,
      snippet:response.ok?"":new TextDecoder().decode(bytes.slice(0,180)),
      cf:response.headers.get("cf-cache-status")};
   }catch(e){row[name]={error:String(e)};}
  }
  probes.push(row);
 }
 console.log("PROBE_SITE",JSON.stringify({region,w,probes}));
}
