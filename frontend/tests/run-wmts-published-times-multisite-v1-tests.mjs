import assert from "node:assert/strict";
import {
  parsePublishedReflectivityTimes,
  createPublishedReflectivityTimeSource,
  REFLECTIVITY_CAPABILITIES_URL
} from "../src/bom-wmts-published-times-v1.js";
import {
  publishedRadarHistoryTimes,discoverBoundedBomReflectivityHistory,discoverBomReflectivityHistory,
  findLatestBomReflectivityTime,findRecentBomReflectivityTimes,
  reflectivityWindowForRegion
} from "../src/bom-wmts-loop-v2.js";

const stamp=n=>"2026-10-18T05:"+String(n).padStart(2,"0")+":00Z";
const samples=[15,20,25,30,35,40,45,50,55].map(stamp);
const caps=values=>'<Capabilities><Contents>'+
'<Layer><ows:Identifier>another_layer</ows:Identifier><Dimension>'+
'<ows:Identifier>time</ows:Identifier><Value>2021-01-01T00:00:00Z</Value>'+
'</Dimension></Layer>'+
'<Layer><ows:Title>Reflectivity</ows:Title>'+
'<ows:Identifier>atm_surf_air_precip_reflectivity_dbz</ows:Identifier>'+
'<Dimension><ows:Identifier>time</ows:Identifier><Default>2026-10-18T06:15:00Z</Default>'+
values.map(v=>'<Value>'+v+'</Value>').join("")+
'</Dimension></Layer></Contents></Capabilities>';
assert.deepEqual(parsePublishedReflectivityTimes(caps([...samples].reverse())),samples);
assert.deepEqual(parsePublishedReflectivityTimes(caps([...samples,samples[0]])),samples);
for(const invalid of ["<html>Access denied</html>",'<Capabilities><Layer><ows:Identifier>another_layer</ows:Identifier></Layer></Capabilities>',
    '<Capabilities><Layer><ows:Identifier>atm_surf_air_precip_reflectivity_dbz</ows:Identifier><Dimension><ows:Identifier>elevation</ows:Identifier><Value>1</Value></Dimension></Layer></Capabilities>'])
  assert.throws(()=>parsePublishedReflectivityTimes(invalid),/capabilities|layer|dimension/i);
assert.throws(()=>parsePublishedReflectivityTimes(caps(["invalid"])),/missing/i);
assert.throws(()=>parsePublishedReflectivityTimes(caps(Array(61).fill(0).map((_,i)=>
  "2026-10-18T"+String(i%24).padStart(2,"0")+":"+String(Math.floor(i/24)).padStart(2,"0")+":00Z"))),/missing|bounds/i);

let clock=Date.parse("2026-10-18T06:00:00Z"),fetches=0,resolves=[];
const source=createPublishedReflectivityTimeSource({
  now:()=>clock,cacheMs:120000,fetchImpl:async (url,options)=>{
    fetches++;
    assert.equal(url,REFLECTIVITY_CAPABILITIES_URL);
    assert.equal(options.cache,"no-store");
    assert.equal(options.headers.Accept,"application/xml,text/xml");
    return new Promise(resolve=>resolves.push(()=>resolve(new Response(caps(samples),{
      status:200,headers:{"Content-Type":"application/xml"}
    }))));
  }
});
const requests=[source(),source(),source()];
await Promise.resolve();
assert.equal(fetches,1,"Rapid changes of radar site must share one metadata fetch");
resolves.shift()();
for(const times of await Promise.all(requests))assert.deepEqual(times,samples);
for(const site of ["SEQ","08","19","22","50","66","75","93"]){
  const times=await discoverBoundedBomReflectivityHistory(clock,180,site,{
    publishedTimes:source,verifyNationalTile:async()=>true});
  assert.deepEqual(times,samples,"Every radar uses the same published source times: "+site);
  assert.ok(reflectivityWindowForRegion(site),"Radar still uses actual regional tile location");
}
assert.equal(fetches,1,"Only one shared capabilities read; source-tile checks have separate verification");
assert.equal(await findLatestBomReflectivityTime(clock,"19",{publishedTimes:source,verifyNationalTile:async()=>true}),stamp(55));
assert.deepEqual(await discoverBoundedBomReflectivityHistory(clock,5,"SEQ",{
  publishedTimes:source,verifyNationalTile:async()=>true}),[stamp(50),stamp(55)]);
assert.deepEqual(await findRecentBomReflectivityTimes(clock,3,"50",{
  publishedTimes:source,verifyNationalTile:async()=>true}),[stamp(45),stamp(50),stamp(55)]);
assert.deepEqual(await discoverBomReflectivityHistory(clock,180,"93",{
  publishedTimes:source,verifyNationalTile:async()=>true}),samples);
clock+=119999;
assert.deepEqual(await source(),samples);
assert.equal(fetches,1);
clock+=2;
const second=source();await Promise.resolve();
assert.equal(fetches,2,"Source refreshes after bounded TTL, not every map frame");
resolves.shift()();assert.deepEqual(await second,samples);
await assert.rejects(discoverBoundedBomReflectivityHistory(clock,180,"SEQ",{
  publishedTimes:async()=>{throw Error("HTTP 503");},
  ftpHistory:async()=>{throw Error("HTTP 503");}
}),/503/);
assert.deepEqual(await discoverBoundedBomReflectivityHistory(clock,180,"19",{
  publishedTimes:async()=>[stamp(45),stamp(50),stamp(55)],
  verifyNationalTile:async()=>true}),
  [stamp(45),stamp(50),stamp(55)]);
// A single genuine BoM metadata abort must recover transparently, without
// altering the official UTC list or resetting the same tab's radar window.
let transientChecks=0;
const transientMetadata=createPublishedReflectivityTimeSource({
  cacheMs:120000,retryDelayMs:0,
  fetchImpl:async()=>{
    transientChecks++;
    if(transientChecks===1)throw Object.assign(
      new Error("The user aborted a request."),{name:"AbortError"});
    return new Response(caps(samples),{status:200});
  }
});
assert.deepEqual(await transientMetadata(),samples);
assert.equal(transientChecks,2,"Exactly one bounded metadata retry was allowed");
assert.deepEqual(await transientMetadata(),samples);
assert.equal(transientChecks,2,"Successful retry must be cached by ordinary TTL");
let refusedChecks=0;
const refusedMetadata=createPublishedReflectivityTimeSource({
  retryDelayMs:0,fetchImpl:async()=>{
    refusedChecks++;
    return new Response("Forbidden",{status:403});
  }
});
await assert.rejects(refusedMetadata(),/HTTP 403/);
assert.equal(refusedChecks,1,"A denied source must never be hammered");
console.log("PASS_ONE_TRANSIENT_BOM_METADATA_RETRY_WITHOUT_INVENTING_SCANS");

console.log("PASS real BoM GetCapabilities timestamps used at every radar, XML layer isolation, 9 genuine frames, one shared 120-sec cache, no speculative WMTS 400 site-load probes.");


// Incident regression: BoM advertises genuine 10:05-10:45 AEST frames,
// but at 11:10 AEST the legacy 45-minute filter removed older replay scans.
const delayedNow=Date.parse("2026-11-01T01:10:00Z");
const delayedHistory=Array.from({length:9},(_,i)=>
  new Date(Date.parse("2026-11-01T00:05:00Z")+i*300000)
    .toISOString().replace(".000Z","Z"));
assert.deepEqual(publishedRadarHistoryTimes(delayedHistory,delayedNow),delayedHistory);
for(const region of ["66","23","SEQ"]){
  const actual=await discoverBoundedBomReflectivityHistory(delayedNow,180,region,{
    publishedTimes:async()=>delayedHistory,verifyNationalTile:async()=>true
  });
  assert.deepEqual(actual,delayedHistory,
    "All genuine replay scans must survive delayed publication at "+region);
}
assert.deepEqual(publishedRadarHistoryTimes([
  "2026-10-31T20:00:00Z",...delayedHistory,"2026-11-01T01:20:00Z"
],delayedNow),delayedHistory);
console.log("PASS delayed WMTS source preserves a source-authentic 30-minute loop");
