// V10.3 Doppler-only QA — observed source pixels, two consecutive scans.
// This is a radial-velocity signature, NOT a surface-gust or downburst warning.
// Never derive wind from reflectivity colours or temporal interpolation.
export const DOPPLER_QA_APPROVED_RADARS = Object.freeze(["08", "50", "66"]);
const trustedTimes = new Set([
  "bom-history-filename-utc", "bom-ftp-filename-utc",
  "bom-latest-filename-utc", "bom-latest-source-utc"
]);
const CELL_KM = 5;
const EARTH_KM_PER_DEGREE = 111.32;
const MAX_SAMPLES = 250000;
const MIN_PIXELS_PER_SCAN = 3;
const ADJACENCY_KM = 1.5;
const MAX_HIGH_PER_BUCKET = 4096; // Bound pathological decoder / source artefacts.
const MAX_GAP_MS = 8 * 60 * 1000; // Reject missed nominal Doppler scans.
const MAX_MATCH_KM = 9;
function finite(value) { return typeof value === "number" && Number.isFinite(value); }
function distanceKm(a, b) {
  const latitudeMean = (a.latitude + b.latitude) / 2;
  return Math.hypot((a.longitude-b.longitude) *
    EARTH_KM_PER_DEGREE * Math.cos(latitudeMean*Math.PI/180),
    (a.latitude-b.latitude)*EARTH_KM_PER_DEGREE);
}
function isTrusted(record) {
  return Boolean(record && DOPPLER_QA_APPROVED_RADARS.includes(String(record.radarId)) &&
    record.geometryVerified === true && trustedTimes.has(record.timeBasis) &&
    !record.temporalInference && !record.velocityInterpolated &&
    Array.isArray(record.samples) && record.samples.length <= MAX_SAMPLES &&
    record.samples.length > 0 && finite(Date.parse(record.observedUtc)));
}
// Source pixels must form a connected spatial cluster, not merely appear
// anywhere within the same 5-km bin. Local grid lookup keeps assessment
// approximately linear for ordinary scans and bounds extreme source artefacts.
function grouped(record) {
  const bins = new Map(), seenPixels = new Set(), seenCoords = new Set();
  for (const sample of record.samples) {
    const v=sample.velocity_kmh, lon=sample.longitude, lat=sample.latitude;
    if (!finite(v)||Math.abs(v)>70||!finite(lon)||!finite(lat)||
        Math.abs(lat)>=75||Math.abs(lon)>180||v===0) continue;
    const coord=lon.toFixed(6)+":"+lat.toFixed(6);
    const sourcePixel=Number.isInteger(sample.pixel_index) && sample.pixel_index>=0
      ? "pixel:"+sample.pixel_index : coord;
    // Require both a unique native pixel index (if given) and a unique
    // geographic sample. A decoder may accidentally repeat either one.
    if(seenPixels.has(sourcePixel)||seenCoords.has(coord))continue;
    seenPixels.add(sourcePixel);seenCoords.add(coord);
    if(Math.abs(v)<60)continue;
    const x=lon*EARTH_KM_PER_DEGREE*Math.cos(lat*Math.PI/180);
    const y=lat*EARTH_KM_PER_DEGREE;
    const ix=Math.floor(x/CELL_KM),iy=Math.floor(y/CELL_KM);
    const sign=v<0?-1:1;
    const key=ix+":"+iy+":"+sign;
    if(!bins.has(key))bins.set(key,{ix,iy,sign,high:[]});
    bins.get(key).high.push({longitude:lon,latitude:lat,
      velocity_kmh:v,x,y});
  }
  const connected=[];
  for(const bucket of bins.values()){
    const samples=bucket.high;
    if(samples.length<MIN_PIXELS_PER_SCAN||
       samples.length>MAX_HIGH_PER_BUCKET)continue;
    const cellIndices=new Map();
    const cellOf=sample=>Math.floor(sample.x)+":"+Math.floor(sample.y);
    for(let i=0;i<samples.length;i++){
      const key=cellOf(samples[i]);
      if(!cellIndices.has(key))cellIndices.set(key,[]);
      cellIndices.get(key).push(i);
    }
    const used=new Uint8Array(samples.length);
    for(let i=0;i<samples.length;i++){
      if(used[i])continue;
      used[i]=1;
      const queue=[i],cluster=[];
      for(let head=0;head<queue.length;head++){
        const p=samples[queue[head]];
        cluster.push(p);
        const cx=Math.floor(p.x),cy=Math.floor(p.y);
        for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++){
          const candidates=cellIndices.get((cx+dx)+":"+(cy+dy))??[];
          for(const j of candidates){
            if(used[j])continue;
            if(Math.hypot(p.x-samples[j].x,p.y-samples[j].y)>ADJACENCY_KM)
              continue;
            used[j]=1;queue.push(j);
          }
        }
      }
      if(cluster.length<MIN_PIXELS_PER_SCAN)continue;
      const strongest=cluster.reduce((a,b)=>Math.abs(a.velocity_kmh)>=
        Math.abs(b.velocity_kmh)?a:b);
      connected.push({
        longitude:cluster.reduce((sum,p)=>sum+p.longitude,0)/cluster.length,
        latitude:cluster.reduce((sum,p)=>sum+p.latitude,0)/cluster.length,
        velocity_kmh:strongest.velocity_kmh,count:cluster.length,
        sign:bucket.sign,ix:bucket.ix,iy:bucket.iy
      });
    }
  }
  return connected;
}
function nearbyOpposing(record,candidate){
  const seenCoordinates=new Set(),seenPixels=new Set();
  let count=0;
  for(const sample of record.samples){
    if(!finite(sample.velocity_kmh)||!finite(sample.longitude)||
       !finite(sample.latitude))continue;
    const coord=sample.longitude.toFixed(6)+":"+
      sample.latitude.toFixed(6);
    const pixel=Number.isInteger(sample.pixel_index)&&sample.pixel_index>=0
      ? "pixel:"+sample.pixel_index : coord;
    if(seenCoordinates.has(coord)||seenPixels.has(pixel))continue;
    seenCoordinates.add(coord);seenPixels.add(pixel);
    if(Math.sign(sample.velocity_kmh)===-candidate.sign &&
       Math.abs(sample.velocity_kmh)>=40 &&
       Math.abs(sample.velocity_kmh)<=70 &&
       distanceKm(sample,candidate)<=8){
       count++;if(count>=2)return true;
    }
  }
  return false;
}
export function assessConsecutiveDopplerWind(previous, current) {
  const empty={alerts:[],evidence:"no-paired-observed-doppler",experimental:true};
  if(!isTrusted(previous)||!isTrusted(current) ||
    String(previous.radarId)!==String(current.radarId))return empty;
  const elapsed=Date.parse(current.observedUtc)-Date.parse(previous.observedUtc);
  if(elapsed<=0||elapsed>MAX_GAP_MS)return empty;
  const older=grouped(previous), newer=grouped(current);
  const alerts=[];
  for(const candidate of newer){
    const match=older.find(old=>old.sign===candidate.sign &&
      distanceKm(old,candidate)<=MAX_MATCH_KM);
    if(!match||nearbyOpposing(current,candidate) ||
      nearbyOpposing(previous,match))continue;
    // Use source speed only. A BoM display limited to +/-70 km/h cannot
    // verify the 90/125 km/h destructive/damaging surface-gust thresholds.
    alerts.push({
      id:"v10:doppler-persistent:"+String(current.radarId)+":"+
        candidate.ix+":"+candidate.iy+":"+(candidate.sign<0?"in":"out"),
      type:"wind",category:"strong_radial_signature",severity:"research",
      title:"Persistent strong radial-wind signature",
      track_id:"",radar_id:String(current.radarId),
      observed_utc:current.observedUtc,source_utc:current.observedUtc,
      prior_source_utc:previous.observedUtc,longitude:candidate.longitude,
      latitude:candidate.latitude,velocity_kmh:candidate.velocity_kmh,
      sample_count:candidate.count,persistence_scans:2,
      velocity_aliasing_verified:false,
      caveat:"Two independent genuine Doppler scans show a persistent strong radial signature at radar beam height. NOT a surface gust, confirmed downburst, tornado or official BoM warning."
    });
    if(alerts.length>=6)break;
  }
  return {alerts,evidence:alerts.length?"two-actual-doppler-scans":"no-persistent-signature",
    experimental:true};
}
