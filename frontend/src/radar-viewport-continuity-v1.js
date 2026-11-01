// Per-tab operator viewport continuity. Weather-frame updates have no
// authority to select a radar or re-centre the camera. A same-tab Safari
// restoration or Pages reload should not silently return to Mt Stapylton.
export const RADAR_VIEW_SESSION_KEY="StormTracker.operatorRadarViewport.v1";
const cameraKeys=["longitude","latitude","targetHeight","range","heading","pitch"];

export function validateRadarViewportRecord(record,sites){
 if(!record || typeof record!=="object" || !sites ||
   !Object.hasOwn(sites,String(record.radarSiteId??"")))return null;
 // sessionStorage belongs to this operator tab. Do not expire its
 // camera during a long incident/shift; only a new tab starts at default.
 if(!Number.isFinite(record.savedAt))return null;
 const camera=record.camera;
 if(!camera || cameraKeys.some(key=>!Number.isFinite(camera[key])))return null;
 if(camera.longitude < -180 || camera.longitude > 180 ||
   camera.latitude < -85 || camera.latitude > 85 ||
   camera.targetHeight < -1000 || camera.targetHeight > 100000 ||
   camera.range < 800 || camera.range > 5000000 ||
   camera.heading < -7 || camera.heading > 7 ||
   camera.pitch < -Math.PI || camera.pitch > Math.PI)return null;
 return {radarSiteId:String(record.radarSiteId),camera:Object.fromEntries(
   cameraKeys.map(key=>[key,Number(camera[key])])),savedAt:record.savedAt};
}

export function createRadarViewportSession({
 storage=null,sites,now=()=>Date.now(),key=RADAR_VIEW_SESSION_KEY
}={}){
 function restore(){
  if(!storage)return null;
  try{
   const raw=storage.getItem(key);
   return raw?validateRadarViewportRecord(JSON.parse(raw),sites):null;
  }catch{return null;}
 }
 function save(radarSiteId,camera){
  if(!storage)return false;
  const validated=validateRadarViewportRecord({
   radarSiteId,camera,savedAt:now()
  },sites);
  if(!validated)return false;
  try{storage.setItem(key,JSON.stringify(validated));return true;}
  catch{return false;}
 }
 return {restore,save};
}
