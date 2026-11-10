import assert from "node:assert/strict";
import worker from "../../relay/worker.js";

const originalFetch=globalThis.fetch;
let sourceCalls=0;
globalThis.fetch=async()=>{sourceCalls++;throw Error("Static station reference must not contact an upstream GIS server");};
const origin="https://blakesmith-intel.github.io";
const url="https://relay.invalid/river-gauge-metadata";
try{
  const begin=Date.now();
  const response=await worker.fetch(new Request(url,{headers:{Origin:origin}}),{});
  assert.equal(response.status,200,"Station reference must succeed without upstream BoM GIS");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"),origin);
  assert.equal(response.headers.get("Cross-Origin-Resource-Policy"),"cross-origin");
  assert.equal(response.headers.get("Cache-Control"),"public, max-age=300");
  assert.equal(response.headers.get("X-StormTracker-Metadata-Fallback"),"1",
    "Reference must be marked as incomplete, not falsely presented as a fresh BoM GIS lookup");
  assert.equal(response.headers.get("X-StormTracker-Metadata-Source"),
    "qld-government-bom-sls-reference");
  assert.equal(response.headers.get("X-StormTracker-Reference-Coverage"),"1728/1808");
  const data=await response.json();
  assert.equal(data.type,"FeatureCollection");
  assert.equal(data.stormtrackerReference.auditedTotal,1808);
  assert.equal(data.stormtrackerReference.matchedTotal,1728);
  assert.equal(data.stormtrackerReference.missingCount,80);
  assert.equal(data.features.length,1728);
  assert(data.features.every(x=>x.id===
    "bom:"+String(x.properties.bom_stn_num).padStart(6,"0")));
  assert(data.features.every(x=>x.geometry.type==="Point"&&
    x.properties.state==="QLD"&&Number.isFinite(x.geometry.coordinates[0])&&
    Number.isFinite(x.geometry.coordinates[1])));
  assert(data.features.every(x=>x.properties.location_types===""&&
    x.properties.forecast_site_classification===""),
    "Tidal/qualitative tags not present in Queensland source must not be invented");
  assert.equal(sourceCalls,0);
  assert(Date.now()-begin<5000,"A local reference must not incur GIS timeout");

  const head=await worker.fetch(new Request(url,{
    method:"HEAD",headers:{Origin:origin}
  }),{});
  assert.equal(head.status,200);
  assert.equal(await head.text(),"");
  assert.equal(sourceCalls,0);
  const forbidden=await worker.fetch(new Request(url,{
    headers:{Origin:"https://unapproved.example"}
  }),{});
  assert.equal(forbidden.status,403);
  console.log("PASS 1728/1808 source-matched government gauge station reference from same Worker: no upstream GIS calls, immediate response, provenance, incomplete coverage, CORS and HEAD");
}finally{globalThis.fetch=originalFetch;}
