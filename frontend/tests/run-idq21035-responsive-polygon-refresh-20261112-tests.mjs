import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const relay=readFileSync(new URL("../../relay/bom-warning-polygons-v1.js",import.meta.url),"utf8");
const client=readFileSync(new URL("../src/context-layers/bom-warning-operational-v1.js",import.meta.url),"utf8");
// Index-authenticated IDQ21035 WFS retrieval must begin before national
// CAP link processing: 22 unrelated CAP files can add an entire timeout window.
const sourceStart=relay.indexOf("const indexedResultsPending=Promise.allSettled(");
const capParse=relay.indexOf("const found=await Promise.allSettled(links.map(");
assert(sourceStart>0&&capParse>sourceStart,
 "Verified current-index GIS geometry starts before 22 CAP XML documents resolve");
const mergeStart=relay.indexOf("const [indexedResults,capOnlyResults]=await Promise.all(");
assert(mergeStart>capParse,"CAP observations and concurrently prefetched source polygons both reconcile");
assert.match(relay,/const gisResults=\[\.\.\.indexedResults,\.\.\.capOnlyResults\]/);
assert.match(relay,/const requests=\[\.\.\.indexedRequests,\.\.\.capOnlyRequests\]/);
assert.match(relay,/const capOnly=\[\.\.\.latestIssued\.values\(\)\]\.filter\(n=>!indexed\.has\(n\.productCode\)\)/,
 "Retain CAP-only recovery when independent Queensland CURRENT index is unavailable");
const startBoundary=relay.indexOf("const enrichedPending=enrichAllWarningBoundaries(qld)");
const fetchCells=relay.indexOf("stormCells=await fetchQldBomStormLocations(");
const finishBoundary=relay.indexOf("const enriched=await enrichedPending");
assert(startBoundary>0&&startBoundary<fetchCells&&fetchCells<finishBoundary,
 "Boundary intersections and detailed source storm cells are no longer sequential");
assert.match(relay,/boundaryIntersectionRequest\(warning\.geometry,LGA_URL/);
assert.match(relay,/boundaryIntersectionRequest\(warning\.geometry,DDMG_URL/);
assert.match(relay,/sourceFailures>0\|\|gisFailures>0/,
 "Partial source failures must remain explicitly unverified");
// The browser's original safeguard remains: a request has a deadline,
// but a timed-out request is not doubled by a second 27-second wait.
assert.match(client,/AbortSignal\.timeout\(27000\)/);
const retry=client.match(/if\(!\/([^\n]+)\/i\.test\(String\(/)?.[1];
assert(retry&&/load failed/.test(retry)&&!/abort|timeout/.test(retry),
 "Only immediate Safari transport failures retry; timeout has one bounded attempt");
assert.match(client,/BoM polygon check timed out — warning geometry unverified/);
assert.match(client,/status\(code\)==="geometry-unavailable"/);
assert.match(client,/INTERVAL_MS=15\*60\*1000/);
console.log("PASS: concurrent IDQ21035 authoritative polygon retrieval, separate cell and complete boundary checks, one bounded browser timeout, exact-source and polling guards");
