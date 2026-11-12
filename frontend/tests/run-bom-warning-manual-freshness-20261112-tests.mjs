import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fetchCurrentQldBoMWarningsIndex} from "../../relay/bom-warning-qld-current-index-v1.js";
import {fetchQldBomWfsCurrentIndexGeometry,fetchQldBomWfsGeometry,
 fetchQldBomStormLocations} from "../../relay/bom-warning-gis2web-replica-v1.js";

// 12 Nov 19:48 AEST = 09:48 UTC: a manual request must see the
// newly issued original feature, without changing normal cached polling.
const now=Date.parse("2026-11-12T09:49:00Z");
const indexHtml='<html><head><title>Queensland Warnings Summary</title></head>'+
 '<body><h1>Queensland Warnings Summary</h1><p id="timestamp">'+
 'This page was created at 09:49 on Thursday 12 November 2026 (UTC)</p>'+
 '<h2>Warnings current:</h2><ul><li>'+
 '<a href="/warning/severe-thunderstorm-warning/IDQ21033">'+
 'Severe Thunderstorm Warning for Queensland</a></li></ul>'+
 ('<p>Queensland warning summary.</p>'.repeat(50))+'</body></html>';
let opts;
const indexFetcher=async (_url,options)=>{opts=options;return new Response(indexHtml,{status:200});};
const index=await fetchCurrentQldBoMWarningsIndex({fetchImpl:indexFetcher,nowMs:now,force:true});
assert.deepEqual(index.activeCodes,["IDQ21033"]);
assert.equal(opts.cf.cacheTtl,0,"manual index read must bypass the 90-second cache");
assert.equal(opts.cf.cacheEverything,false);
await fetchCurrentQldBoMWarningsIndex({fetchImpl:indexFetcher,nowMs:now});
assert.equal(opts.cf.cacheTtl,90,"automatic index reads keep existing 90-second cache");

const ring=[[150,-27],[151,-27],[151,-26],[150,-26],[150,-27]];
const geometry={type:"Polygon",coordinates:[ring]};
const issued=new Date(now-60000).toISOString(),expires=new Date(now+1200000).toISOString();
const collection={type:"FeatureCollection",features:[{
 type:"Feature",id:"new-1948",properties:{product:"IDQ65654",
  validfrom_utc:issued,validto_utc:expires,gml_id:"new-1948"},
 geometry}]};
let geoOpts;
const geomFetcher=async (_url,options)=>{geoOpts=options;return new Response(JSON.stringify(collection),{status:200});};
const indexed=await fetchQldBomWfsCurrentIndexGeometry("IDQ21033",index,{
 fetchImpl:geomFetcher,nowMs:now,force:true});
assert.equal(indexed.warnings.length,1);
assert.match(indexed.warnings[0].id,/new-1948/);
assert.equal(geoOpts.cf.cacheTtl,0,"manual GIS read bypasses edge cache");
assert.equal(geoOpts.cf.cacheEverything,false);
const direct=await fetchQldBomWfsGeometry(indexed.notice,{
 fetchImpl:geomFetcher,nowMs:now,force:false});
assert.equal(direct.length,1);
assert.equal(geoOpts.cf,undefined,"ordinary GIS retrieval preserves normal source cache policy");
const cellCollection={type:"FeatureCollection",features:[{
 type:"Feature",id:"cell-1",properties:{product:"IDQ65652",validfrom_utc:issued,
  validto_utc:expires,gml_id:"cell-1",warning:"This thunderstorm is very dangerous."},
 geometry}]};
const cellFetcher=async (_url,options)=>{geoOpts=options;return new Response(JSON.stringify(cellCollection),{status:200});};
const cells=await fetchQldBomStormLocations({...indexed.notice,productCode:"IDQ21035"},{
 fetchImpl:cellFetcher,nowMs:now,force:true});
assert.equal(cells.length,1,"storm cells remain a separate exact-source product");
assert.equal(cells[0].veryDangerous,true);
assert.equal(geoOpts.cf.cacheTtl,0);

const front=readFileSync(new URL("../src/context-layers/bom-warning-operational-v1.js",import.meta.url),"utf8");
const relay=readFileSync(new URL("../../relay/bom-warning-polygons-v1.js",import.meta.url),"utf8");
assert.match(front,/const url=force\?SOURCE\+"\?force=1":SOURCE/,"manual button sends an explicit relay bypass");
assert.match(relay,/new URL\(request.url\).searchParams.get\("force"\)==="1"/);
assert.match(relay,/textResponse\(BOM_CAP_RSS,3000000,\{force\}\)/);
assert.match(relay,/fetchCurrentQldBoMWarningsIndex\(\{nowMs:now,force\}\)/);
assert.match(relay,/fetchQldBomWfsCurrentIndexGeometry\([\s\S]*?\{nowMs:now,force\}/);
assert.match(relay,/fetchQldBomStormLocations\(detailedNotice,\{nowMs:now,force\}\)/);
assert.match(relay,/"Cache-Control":force\?"no-store":"public,max-age=90"/);
console.log("PASS: manual warning refresh bypasses CAP, current-index and GIS edge caches; automatic source policy unchanged; original 21033 polygon and separate cell provenance retained.");
