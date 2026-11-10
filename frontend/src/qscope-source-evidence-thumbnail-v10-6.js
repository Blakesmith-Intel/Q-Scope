// Q-SCOPE research evidence preservation. Each thumbnail is generated from
// exactly one ORIGINAL decoded BoM observation, never interpolated frames.
// Reflectivity is palette-reconstructed from its genuine categorical grid;
// Doppler pixels retain native RGB/alpha within the source panel crop.
import { lonLatToDopplerMapCoordinate } from "./bom-doppler-georef-v1.js";
import { SOURCE_PALETTES } from "./palette.js";
export const MAX_RESEARCH_SNAPSHOT_DATA_CHARS=90000;
const SIDE=160;
const COLOR_TABLE=new Uint8Array(16*3);
for(const item of SOURCE_PALETTES.reflectivityRgb??[]){
  if(item.value>0&&item.value<16&&Array.isArray(item.rgb))
    COLOR_TABLE.set(item.rgb,item.value*3);
}
function finite(x){return typeof x==="number"&&Number.isFinite(x);}
function mercatorPixel(frame,longitude,latitude){
  if(frame?.georef?.projection!=="EPSG:3857" ||
     !finite(longitude)||!finite(latitude)||Math.abs(latitude)>=85)return null;
  const r=6378137;
  const x=r*longitude*Math.PI/180;
  const y=r*Math.log(Math.tan(Math.PI/4+latitude*Math.PI/360));
  const g=frame.georef;
  const col=Math.floor((x-g.minX)/(g.maxX-g.minX)*frame.width);
  const row=Math.floor((g.maxY-y)/(g.maxY-g.minY)*frame.height);
  return {col,row};
}
function sourceCrop(source,coords,doc){
  if(!coords || !source || !Number.isInteger(source.width) ||
     !Number.isInteger(source.height) ||
     !source.data || !Number.isInteger(coords.col) ||
     !Number.isInteger(coords.row) ||
     coords.col<0||coords.row<0 ||
     coords.col>=source.width||coords.row>=source.height)return null;
  const canvas=doc.createElement("canvas");
  canvas.width=SIDE;canvas.height=SIDE;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  if(!ctx)return null;
  const out=ctx.createImageData(SIDE,SIDE);
  const x0=Math.floor(coords.col-SIDE/2),y0=Math.floor(coords.row-SIDE/2);
  let visible=0;
  for(let y=0;y<SIDE;y++)for(let x=0;x<SIDE;x++){
    const sx=x0+x,sy=y0+y;
    if(sx<0||sy<0||sx>=source.width||sy>=source.height)continue;
    const idx=(sy*source.width+sx)*4,outidx=(y*SIDE+x)*4;
    if(source.categories) {
      const category=source.categories[sy*source.width+sx];
      if(category<=0||category>=16)continue;
      const rgb=category*3;
      out.data[outidx]=COLOR_TABLE[rgb];
      out.data[outidx+1]=COLOR_TABLE[rgb+1];
      out.data[outidx+2]=COLOR_TABLE[rgb+2];
      out.data[outidx+3]=255;
    } else {
      const alpha=source.data?.[idx+3];
      if(!alpha)continue;
      out.data[outidx]=source.data[idx];
      out.data[outidx+1]=source.data[idx+1];
      out.data[outidx+2]=source.data[idx+2];
      out.data[outidx+3]=alpha;
    }
    visible++;
  }
  if(!visible)return null;
  ctx.putImageData(out,0,0);
  const encoded=canvas.toDataURL("image/png");
  return encoded.startsWith("data:image/png;base64,") &&
    encoded.length<=MAX_RESEARCH_SNAPSHOT_DATA_CHARS
    ? encoded:null;
}
export function captureResearchSourceThumbnail({
  alert,mode,frame=null,record=null,documentRef=globalThis.document
}={}){
  if(!alert||!documentRef || !finite(alert.latitude) ||
     !finite(alert.longitude))return null;
  try{
    if(mode==="rain"){
      if(!frame || frame.sourceMetadata?.temporalInference ||
        frame.observedUtc!==alert.observed_utc ||
        !Number.isInteger(frame.width)||!Number.isInteger(frame.height) ||
        frame.categories?.length!==frame.width*frame.height)return null;
      // Only process the 160px evidence window, not the entire statewide
      // source mosaic. Reduces decoding work and large allocations.
      const coords=mercatorPixel(frame,alert.longitude,alert.latitude);
      const dataUrl=sourceCrop({
        width:frame.width,height:frame.height,categories:frame.categories
      },coords,documentRef);
      return dataUrl?{
        dataUrl,
        label:"Retained crop reconstructed from the genuine BoM reflectivity category grid (not original map artwork).",
        observedUtc:frame.observedUtc,mode:"rain"
      }:null;
    }
    if(mode==="doppler"){
      if(record?.observedUtc!==alert.observed_utc ||
         !["08","50","66"].includes(String(record.radarId)) ||
         record?.nativePanel?.data?.length!==
           record.nativePanel.width*record.nativePanel.height*4)return null;
      const coords=lonLatToDopplerMapCoordinate(
        record.radarId,alert.longitude,alert.latitude);
      const dataUrl=sourceCrop(record.nativePanel,{
        col:Math.floor(coords.column),row:Math.floor(coords.row)
      },documentRef);
      return dataUrl?{
        dataUrl,
        label:"Retained native BoM Doppler radial-velocity RGB pixels; original source UTC, not measured surface gusts.",
        observedUtc:record.observedUtc,mode:"doppler"
      }:null;
    }
  }catch(error){
    console.warn("Research source thumbnail unavailable:",error);
  }
  return null;
}
