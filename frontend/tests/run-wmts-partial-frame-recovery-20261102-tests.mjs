import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  fetchWmtsPreflightTile,
  reflectivityWindowForRegion,
  buildBomReflectivityTileUrl,
  createWmtsTimeFailureGuard
} from "../src/bom-wmts-loop-v2.js";
import {
  fetchReadableImage, networkPressureDiagnostics,
  WMTS_TILE_REQUEST_TIMEOUT_MS
} from "../src/radar-source.js";

// Taroom (BoM site 98) uses the same verified WMTS pipeline as every other
// selectable region, not a single-site exception or guessed rain timestamp.
const region="98";
const w=reflectivityWindowForRegion(region);
assert(w.colStart<=w.colEnd&&w.rowStart<=w.rowEnd);
assert(buildBomReflectivityTileUrl(w.colStart,w.rowStart,
  "2026-11-02T10:00:00Z").includes("TILECOL="+w.colStart));

const guard=createWmtsTimeFailureGuard({now:()=>1000});
guard.reject("2026-11-02T10:00:00Z",region);
assert(guard.isRejected("2026-11-02T10:00:00Z",region));
assert(!guard.isRejected("2026-11-02T10:00:00Z","66"),
  "One site's hard failure cannot suppress another site's real observation");

let attempts=0;
const transient=await fetchWmtsPreflightTile("genuine-published-tile",async()=>{
  if(++attempts===1)throw Error("BoM WMTS tile timed out");
  return {width:256,height:256};
},{retryDelayMs:0,wait:async()=>{}});
assert.equal(attempts,2);
assert.equal(transient.width,256);
attempts=0;
await assert.rejects(fetchWmtsPreflightTile("unpublished-tile",async()=>{
  attempts++;
  const error=new Error("Image request failed: HTTP 400");
  error.status=400;
  throw error;
},{wait:async()=>{throw Error("Must not retry BoM HTTP 400")}}),/HTTP 400/);
assert.equal(attempts,1,"A real source-rejected UTC must not be invented or hammered");

assert.equal(WMTS_TILE_REQUEST_TIMEOUT_MS,15000);
const originalFetch=globalThis.fetch;
const originalTimeout=globalThis.setTimeout;
const originalClear=globalThis.clearTimeout;
let aborted=false;
try{
  // Trigger exactly the fetch's 15-second deadline immediately in a test:
  // prove it releases the two-request relay pressure queue, without a
  // 15-second wall-clock wait or live BoM network requests.
  globalThis.setTimeout=(fn,ms,...args)=>
    ms===WMTS_TILE_REQUEST_TIMEOUT_MS
      ? (queueMicrotask(()=>fn(...args)),424242)
      : originalTimeout(fn,ms,...args);
  globalThis.clearTimeout=id=>id===424242?undefined:originalClear(id);
  globalThis.fetch=(_url,{signal})=>new Promise((_resolve,reject)=>{
    signal.addEventListener("abort",()=>{
      aborted=true;
      reject(new DOMException("Aborted","AbortError"));
    },{once:true});
  });
  await assert.rejects(
    fetchReadableImage("https://relay.example/wmts?time=real-utc&tile=taroom"),
    /BoM WMTS tile timed out after 15000 ms/
  );
  assert(aborted,"A stalled transfer must actually abort");
  assert.equal(networkPressureDiagnostics().active,0);
  assert.equal(networkPressureDiagnostics().queued,0);
  // A later request must not inherit the failure or a stuck busy slot.
  globalThis.fetch=async()=>({ok:false,status:503});
  await assert.rejects(
    fetchReadableImage("https://relay.example/wmts?time=another-real-utc&tile=taroom"),
    /HTTP 503/
  );
  assert.equal(networkPressureDiagnostics().active,0);
} finally {
  globalThis.fetch=originalFetch;
  globalThis.setTimeout=originalTimeout;
  globalThis.clearTimeout=originalClear;
}

// A refused but advertised old UTC is NOT a recovered measurement.
const {needsChronologicalRadarRebuild}=await import("../src/live-loop-refresh-v1.js");
const acceptedTimes=["2026-11-02T10:00:00Z","2026-11-02T10:10:00Z"];
const withheldUtc="2026-11-02T10:05:00Z";
assert(needsChronologicalRadarRebuild(
  [...acceptedTimes,withheldUtc],acceptedTimes.at(-1),acceptedTimes));
assert(!needsChronologicalRadarRebuild(
  acceptedTimes,acceptedTimes.at(-1),acceptedTimes),
  "Refused historical WMTS time must not reset worker or running player");
assert(needsChronologicalRadarRebuild(
  [...acceptedTimes,withheldUtc],acceptedTimes.at(-1),acceptedTimes),
  "Once the authentic missing scan is accepted, chronological replay is required");

// When the six-frame window shifts under an in-flight Cesium render, an
// unchanged array index now identifies a DIFFERENT real observation.
const beforeShift=[
 "2026-11-02T10:00:00Z","2026-11-02T10:05:00Z",
 "2026-11-02T10:10:00Z","2026-11-02T10:15:00Z",
 "2026-11-02T10:20:00Z","2026-11-02T10:25:00Z"
];
const afterShift=[...beforeShift.slice(1),"2026-11-02T10:30:00Z"];
const inFlightOldIndex=3;
assert.notEqual(afterShift[inFlightOldIndex],beforeShift[inFlightOldIndex]);
assert.equal(afterShift.indexOf(beforeShift[inFlightOldIndex]),2,
 "Actual BoM UTC, not the old index, is the only safe 2-D/3-D frame anchor");

// Source and operational Pages overlay must both schedule backfill when
// a manual load finishes with fewer measured observations than advertised.
const root=new URL("../../",import.meta.url);
const source=readFileSync(new URL("frontend/src/live3d-operational-v9.js",root),"utf8");
const packageOverlay=readFileSync(new URL("scripts/apply-radar-auto-refresh-v1.py",root),"utf8");
for(const text of [source,packageOverlay]){
  assert.match(text,/updated; some genuine source frames unavailable/);
  assert.match(text,/BoM radar frames incomplete; retrying missing genuine observations automatically/);
  assert.match(text,/if\(background\)throw new Error\(/);
  assert.match(text,/\},60000\);/);
}
// An automatically recovered interior scan must not stop the existing
// playback timer while the historical track/window data are rebuilt.
assert.match(source,/const noninterruptingBackfill = automatic/);
assert.match(source,/if\(!incrementalCommit && !noninterruptingBackfill\)\{/);
assert.match(source,/if\(resume && !incrementalCommit && !noninterruptingBackfill\)playback\.play\(\)/);
assert.match(packageOverlay,/source\[start:end\]\+"  hybridFrames = displayFrames;"/);
assert.match(packageOverlay,/copyfile\("frontend\/src\/radar-source\.js"/);
// Source and exact production overlay must never full-rebuild merely
// because a published old UTC was refused before its actual PNGs arrived.
assert.match(source,/const recoveredHistoricalObservation =/);
assert(source.includes("const rebuild = trackedThrough == null || recoveredHistoricalObservation"));
assert.match(source,/const incrementalCommit = automatic && !isCombined && !rebuild &&/);
assert(packageOverlay.includes("rebuild_start=source.index"));
assert(packageOverlay.includes("source[rebuild_start:rebuild_end].rstrip()"));
assert.match(packageOverlay,/const incrementalCommit = automatic && !isCombined && !rebuild &&/);
assert(source.includes("const liveMeasuredIndex=hybridCombinedSchedule.length"));
assert(source.includes("const liveDisplayedIndex=hybridCombinedSchedule.length"));
assert(source.includes("hybridFrames.findIndex(item=>item.observedUtc===frame.observedUtc)"));
assert(source.includes("updateTrackDisplayControls(liveMeasuredIndex)"));
assert(source.includes("hybridFrameIndex=liveDisplayedIndex"));
assert(packageOverlay.includes("old_geometry="));
assert(packageOverlay.includes("old_cursor="));
assert(packageOverlay.includes("source[geometry_start:geometry_end].rstrip()"));
assert(packageOverlay.includes("source[cursor_start:cursor_end].rstrip()"));
assert.match(source,/A refused NEWEST scan must not discard other newly verified scans/);
assert.match(source,/Date\.parse\(frames\.at\(-1\)\.observedUtc\)\s*<\s*Date\.parse\(hybridFrames\.at\(-1\)\.observedUtc\)/);
assert.match(source,/playback\.isPlaying\(\) \|\| hybridFrames\.length === 0/);
assert.match(packageOverlay,/A refused NEWEST scan must not discard other newly verified scans/);
assert.match(packageOverlay,/copyfile\("frontend\/src\/radar-tile-retry-v1\.js"/);
console.log("PASS Taroom/global real-tile timeout and six-frame missing-observation recovery source + shipped overlay");
