// StormTracker V10 research detector. Browser-only; NEVER infers a surface gust
// from BoM Doppler radial velocity. Not an official warning or a tornado diagnosis.
import { findExperimentalHookArc } from "./severe-storm-alerts-v1.js";

export const BOM_DAMAGING_GUST_KMH = 90;
export const BOM_DESTRUCTIVE_GUST_KMH = 125;
export const V10_RADIAL_IMAGE_MAX_KMH = 70;
export const V10_HIGH_RADIAL_KMH = 60;
export const V10_ROTATION_PAIR_KMH = 40;
export const V10_VERIFIED_RADARS = Object.freeze(["08", "50", "66"]);
const MAX_PAIR_MINUTES = 8;
const MAX_ARC_GAP_MINUTES = 15;
const TRUSTED_TIME_BASIS = new Set([
  "bom-history-filename-utc", "bom-ftp-filename-utc",
  "bom-latest-filename-utc", "bom-latest-source-utc"
]);
const MAX_RADIAL_SAMPLES = 250000;

export function classifyObservedBoMGust(gustKmh) {
  if (!Number.isFinite(gustKmh) || gustKmh < 0) return null;
  if (gustKmh >= BOM_DESTRUCTIVE_GUST_KMH) return "destructive";
  if (gustKmh >= BOM_DAMAGING_GUST_KMH) return "damaging";
  return null;
}

function validObserved(frame, result) {
  return Boolean(frame && result && frame?.georef?.projection === "EPSG:3857" &&
    frame.categories?.length === frame.width * frame.height &&
    result.segmentations?.[0]?.labels?.length === frame.width * frame.height &&
    !frame.sourceMetadata?.temporalInference &&
    Number.isFinite(Date.parse(frame.observedUtc)));
}
function toPixel(frame, longitude, latitude) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) ||
      Math.abs(latitude) >= 85) return -1;
  const r = 6378137;
  const x = r * longitude * Math.PI / 180;
  const y = r * Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360));
  const g = frame.georef;
  const col = Math.floor((x - g.minX) / (g.maxX - g.minX) * frame.width);
  const row = Math.floor((g.maxY - y) / (g.maxY - g.minY) * frame.height);
  return col < 0 || row < 0 || col >= frame.width || row >= frame.height
    ? -1 : row * frame.width + col;
}
function distanceKm(a, b) {
  const dy = (a.latitude - b.latitude) * 111.32;
  const dx = (a.longitude - b.longitude) *
    Math.cos((a.latitude + b.latitude) * Math.PI / 360) * 111.32;
  return Math.hypot(dx, dy);
}
function collectMatchedSamples(frame, result, dopplerState) {
  const segmentation = result.segmentations[0];
  const labelToTrack = new Map();
  for (const track of result.tracks ?? []) {
    const observation = (track.history ?? []).find(
      entry => entry.observed_utc === frame.observedUtc
    );
    const source = String(segmentation.radar_id ?? "BOM-MOSAIC");
    const matchingCell = (observation?.source_cells ?? []).find(
      entry => String(entry[0]) === source
    );
    const id = Number(matchingCell?.[1]);
    if (Number.isInteger(id) && id > 0) labelToTrack.set(id, track.track_id);
  }
  const groups = new Map();
  for (const record of dopplerState?.records ?? []) {
    const radarId = String(record.radarId ?? "");
    const diff = Math.abs(Date.parse(record.observedUtc) - Date.parse(frame.observedUtc)) / 60000;
    // Accept only real source-dated Doppler image pixels with verified
    // native radar geometry. There is no support for inferred temporal samples,
    // relayed display overlays or user-supplied/wind-gust values here.
    if (!V10_VERIFIED_RADARS.includes(radarId) ||
        !TRUSTED_TIME_BASIS.has(record.timeBasis) ||
        record.geometryVerified !== true ||
        record.temporalInference || record.velocityInterpolated ||
        !Array.isArray(record.samples) ||
        record.samples.length > MAX_RADIAL_SAMPLES ||
        !Number.isFinite(diff) || diff > MAX_PAIR_MINUTES) continue;
    const seenPixel = new Set();
    for (const sample of record.samples) {
      const velocity = Number(sample.velocity_kmh);
      const longitude = Number(sample.longitude);
      const latitude = Number(sample.latitude);
      // A palette at +/-70 cannot measure +/-90 or +/-125. Reject unsupported
      // out-of-range numbers rather than presenting an aliased/made-up gust.
      if (!Number.isFinite(velocity) || Math.abs(velocity) > V10_RADIAL_IMAGE_MAX_KMH ||
          velocity === 0) continue;
      const pixel = toPixel(frame, longitude, latitude);
      if (pixel < 0) continue;
      const trackId = labelToTrack.get(segmentation.labels[pixel]);
      if (!trackId) continue;
      // One source radar pixel == one sample, even if a decoder accidentally
      // emits it more than once. Prevents artificial clusters/couplets.
      if (seenPixel.has(pixel)) continue;
      seenPixel.add(pixel);
      const key = radarId + ":" + trackId;
      if (!groups.has(key)) groups.set(key, {
        radarId, trackId, sourceUtc: record.observedUtc, samples: []
      });
      groups.get(key).samples.push({ longitude, latitude, velocity });
    }
  }
  return groups;
}
function highRadialCluster(group) {
  const high = group.samples.filter(s => Math.abs(s.velocity) >= V10_HIGH_RADIAL_KMH);
  for (const pivot of high) {
    const close = high.filter(s => distanceKm(s, pivot) <= 5);
    const aligned = close.filter(s => Math.sign(s.velocity) === Math.sign(pivot.velocity));
    const opposed = group.samples.filter(s =>
      Math.sign(s.velocity) === -Math.sign(pivot.velocity) &&
      Math.abs(s.velocity) >= V10_ROTATION_PAIR_KMH &&
      distanceKm(s, pivot) <= 8);
    if (aligned.length >= 3 && aligned.length / close.length >= .8 &&
        opposed.length === 0) {
      return {
        strongest: aligned.reduce((a, b) =>
          Math.abs(a.velocity) >= Math.abs(b.velocity) ? a : b),
        count: aligned.length
      };
    }
  }
  return null;
}
function closeRotationCouplet(group) {
  const towards = group.samples.filter(s => s.velocity <= -V10_ROTATION_PAIR_KMH);
  const away = group.samples.filter(s => s.velocity >= V10_ROTATION_PAIR_KMH);
  if (towards.length < 2 || away.length < 2) return null;
  for (const a of towards) {
    const aNear = towards.filter(s => distanceKm(s, a) <= 3);
    if (aNear.length < 2) continue;
    for (const b of away) {
      if (distanceKm(a, b) > 8) continue;
      const bNear = away.filter(s => distanceKm(s, b) <= 3);
      if (bNear.length < 2) continue;
      return { deltaKmh: b.velocity - a.velocity, towards:a, away:b };
    }
  }
  return null;
}
function persistentHook(frame, result, previousFrame, previousResult, trackId) {
  if (!validObserved(previousFrame, previousResult)) return null;
  const gap = Date.parse(frame.observedUtc) - Date.parse(previousFrame.observedUtc);
  if (gap <= 0 || gap > MAX_ARC_GAP_MINUTES * 60000) return null;
  const current = findExperimentalHookArc(frame, result, trackId);
  const prior = findExperimentalHookArc(previousFrame, previousResult, trackId);
  return current && prior ? current : null;
}

// Shape-only results are separate from tornadic candidates. A possible tornado
// needs a persistent hook-like feature AND a same-storm, same-radar local radial
// velocity couplet. Even that is provisional: aliasing can mimic rotation.
export function assessV10RadarFrame({
  frame, result, previousFrame, previousResult, dopplerState,
  previousDopplerState
} = {}) {
  if (!validObserved(frame, result)) return {
    alerts: [], availableRadialEvidence: false, experimental: true
  };
  const groups = collectMatchedSamples(frame, result, dopplerState);
  // Both yellow and red require two DIFFERENT observed BoM Doppler scans.
  // Never double-count the same scan against separate rain timestamps.
  const previousGroups = validObserved(previousFrame, previousResult)
    ? collectMatchedSamples(previousFrame, previousResult, previousDopplerState)
    : new Map();
  const windGap=Date.parse(frame.observedUtc)-Date.parse(previousFrame?.observedUtc);
  const scanOrderValid=Number.isFinite(windGap) &&
    windGap>0 && windGap<=MAX_ARC_GAP_MINUTES*60000;
  const persistentGroup = group => {
    if(!scanOrderValid)return null;
    const past=previousGroups.get(group.radarId+":"+group.trackId);
    if(!past || past.sourceUtc===group.sourceUtc)return null;
    const sourceGap=Date.parse(group.sourceUtc)-Date.parse(past.sourceUtc);
    return sourceGap>0 && sourceGap<=MAX_ARC_GAP_MINUTES*60000 ? past:null;
  };
  const hookByTrack = new Map();
  for (const track of result.tracks ?? []) {
    const hook = persistentHook(
      frame, result, previousFrame, previousResult, track.track_id);
    if (hook) hookByTrack.set(track.track_id, hook);
  }
  const alerts = [];
  const rotatedTracks = new Set();
  for (const group of groups.values()) {
    // Opposite-sign image clusters are NOT true rotation without dealiasing.
    const past=persistentGroup(group);
    const rotation=closeRotationCouplet(group);
    const oldRotation=past?closeRotationCouplet(past):null;
    const hook=hookByTrack.get(group.trackId);
    // The velocity couplet must be close to the hook, not merely somewhere
    // inside a potentially sprawling storm footprint.
    const coupletNearHook=rotation && oldRotation && hook &&
      distanceKm(rotation.towards,hook)<=10 &&
      distanceKm(rotation.away,hook)<=10 &&
      distanceKm(rotation.towards,oldRotation.towards)<=9 &&
      distanceKm(rotation.away,oldRotation.away)<=9;
    if (coupletNearHook) {
      rotatedTracks.add(group.trackId);
      alerts.push({
        id: "v10:tornadic:" + group.radarId + ":" + group.trackId,
        type: "hook", category: "tornadic_candidate", severity: "research",
        title: "Potential tornadic radar signature",
        track_id: group.trackId, radar_id: group.radarId,
        observed_utc: frame.observedUtc, source_utc: group.sourceUtc,
        longitude: hook.longitude, latitude: hook.latitude,
        arc_degrees: hook.arc_degrees,
        radial_shear_kmh: rotation.deltaKmh,
        previous_doppler_utc: past.sourceUtc, persistence_scans: 2,
        velocity_aliasing_verified: false,
        caveat: "Experimental persistent hook + close radar velocity couplet. Velocity aliasing is unverified. NOT a confirmed tornado or official BoM warning."
      });
      continue;
    }
    const high=highRadialCluster(group);
    const oldHigh=past?highRadialCluster(past):null;
    if (high && oldHigh &&
        Math.sign(high.strongest.velocity)===Math.sign(oldHigh.strongest.velocity) &&
        distanceKm(high.strongest,oldHigh.strongest)<=9) alerts.push({
      id: "v10:radial:" + group.radarId + ":" + group.trackId,
      type: "wind", category: "strong_radial_signature", severity: "research",
      title: "Strong straight-line wind signature candidate",
      track_id: group.trackId, radar_id: group.radarId,
      observed_utc: frame.observedUtc, source_utc: group.sourceUtc,
      longitude: high.strongest.longitude, latitude: high.strongest.latitude,
      velocity_kmh: high.strongest.velocity, sample_count: high.count,
      previous_doppler_utc: past.sourceUtc, persistence_scans: 2,
      velocity_aliasing_verified: false,
      caveat: "Two genuine consecutive Doppler scans show persistent radar-beam radial velocity; aliasing unverified. NOT a surface gust or proof of a straight-line downburst; BoM 90/125 km/h thresholds NOT demonstrated."
    });
  }
  for (const [trackId, hook] of hookByTrack) {
    if (rotatedTracks.has(trackId)) continue;
    alerts.push({
      id: "v10:hook:" + trackId,
      type: "hook", category: "hook_shape_only", severity: "research",
      title: "Possible hook-shaped reflectivity echo",
      track_id: trackId, observed_utc: frame.observedUtc,
      longitude: hook.longitude, latitude: hook.latitude,
      arc_degrees: hook.arc_degrees,
      caveat: "Shape-only candidate; no verified radial couplet. NOT evidence of a tornado or an official BoM warning."
    });
  }
  return {
    alerts, availableRadialEvidence: groups.size > 0,
    experimental: true,
    interpretation: "Observed reflectivity and georeferenced Doppler only. No fabricated surface gusts, no warnings, no inferred 3-D evidence."
  };
}

// Feed this ONLY actual BoM-observed 3-second gusts, with an accurate station
// position and official observation timestamp. Never pass radar speed here.
export function assessObservedBoMGust(observation, referenceTimeUtc) {
  if (observation?.source !== "BoM-AWS") return null;
  const at = Date.parse(observation.observed_utc);
  const now = Date.parse(referenceTimeUtc);
  const kmh = Number(observation.gust_kmh);
  const classification = classifyObservedBoMGust(kmh);
  if (!Number.isFinite(at) || !Number.isFinite(now) ||
      now < at || now - at > 15 * 60000 ||
      !Number.isFinite(observation.longitude) ||
      !Number.isFinite(observation.latitude) ||
      !classification) return null;
  return {
    type: "observed_surface_gust", classification,
    gust_kmh: kmh, station: observation.station,
    longitude: observation.longitude, latitude: observation.latitude,
    observed_utc: observation.observed_utc,
    caveat: "BoM weather-station reported gust at this station, not an estimated storm-wide gust."
  };
}
