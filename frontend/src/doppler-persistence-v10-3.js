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
const MAX_GAP_MS = 15 * 60 * 1000;
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
function grouped(record) {
  const bins = new Map(), seen = new Set();
  for (const sample of record.samples) {
    const v=sample.velocity_kmh;
    const lon=sample.longitude, lat=sample.latitude;
    if (!finite(v)||Math.abs(v)>70||!finite(lon)||!finite(lat)||
      Math.abs(lat)>=75||Math.abs(lon)>180) continue;
    const position=Number.isInteger(sample.pixel_index) ? "pixel:"+sample.pixel_index :
      lon.toFixed(6)+":"+lat.toFixed(6);
    if(seen.has(position))continue;
    seen.add(position);
    const x=lon*EARTH_KM_PER_DEGREE*Math.cos(lat*Math.PI/180);
    const y=lat*EARTH_KM_PER_DEGREE;
    const ix=Math.floor(x/CELL_KM), iy=Math.floor(y/CELL_KM);
    const key=ix+":"+iy+":"+(v<0?"in":"out");
    let group=bins.get(key);
    if(!group){group={ix,iy,sign:Math.sign(v),high:[],opposed:[],sumLon:0,sumLat:0};bins.set(key,group);}
    if(Math.abs(v)>=60){
      group.high.push(v);group.sumLon+=lon;group.sumLat+=lat;
    } else if(Math.abs(v)>=40)group.opposed.push(v);
  }
  // Local high-speed cores require a contiguous spatial neighbourhood and a
  // coherent sign; a lone high-speed display pixel is insufficient evidence.
  const values=[...bins.values()].filter(g=>g.high.length>=MIN_PIXELS_PER_SCAN);
  return values.map(g=>({
    longitude:g.sumLon/g.high.length,latitude:g.sumLat/g.high.length,
    velocity_kmh:g.high.reduce((a,b)=>Math.abs(a)>Math.abs(b)?a:b),
    count:g.high.length,sign:g.sign,ix:g.ix,iy:g.iy
  }));
}
function nearbyOpposing(record, candidate) {
  let count=0;
  for(const s of record.samples){
    if(!finite(s.velocity_kmh)||!finite(s.longitude)||!finite(s.latitude))continue;
    if(Math.sign(s.velocity_kmh)===-candidate.sign &&
      Math.abs(s.velocity_kmh)>=40 &&
      distanceKm(s,candidate)<=8){count++;if(count>=2)return true;}
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
