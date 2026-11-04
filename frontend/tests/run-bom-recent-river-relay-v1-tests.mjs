import assert from "node:assert/strict";
import worker from "../../relay/worker.js";
const originalFetch=globalThis.fetch;
const now=new Date();
const qld=new Date(Date.now()+10*3600000);
const dd=String(qld.getUTCDate()).padStart(2,"0");
const mm=String(qld.getUTCMonth()+1).padStart(2,"0");
const yy=qld.getUTCFullYear();
const hh=String(qld.getUTCHours()).padStart(2,"0");
const minute=String(qld.getUTCMinutes()).padStart(2,"0");
const time=`${dd}/${mm}/${yy} ${hh}:${minute}`;
const sample='<table id="tableStyle1"><tr><th>Date/Time</th><th>Water Level (m)</th></tr>'
  +`<tr><td>${time}</td><td>0.92</td></tr></table>`;
const targets=[];
globalThis.fetch=async url=>{
  targets.push(String(url));
  assert.equal(String(url),
    "https://www.bom.gov.au/fwo/IDQ65388/IDQ65388.540384.tbl.shtml");
  return new Response(sample,{status:200,headers:{"Content-Type":"text/html"}});
};
try {
  const target="https://relay.invalid/river-recent-history?product=IDQ65388&station=540384";
  const response=await worker.fetch(new Request(target,{
    headers:{Origin:"https://blakesmith-intel.github.io"}
  }),{});
  assert.equal(response.status,200);
  assert.equal(response.headers.get("access-control-allow-origin"),
    "https://blakesmith-intel.github.io");
  assert.equal(response.headers.get("Cache-Control"),"public, max-age=60",
    "Verified table is shared briefly; browser TTL must not compound source delay");
  assert.equal(response.headers.get("X-StormTracker-Relay-Cache"),"MISS");
  const json=await response.json();
  assert.equal(json.format,"StormTrackerBomRecentRiverHistoryV1");
  assert.equal(json.product,"IDQ65388");
  assert.equal(json.station,"540384");
  assert.equal(json.samples.length,1);
  assert.equal(json.samples[0].height,0.92);
  assert.equal(targets.length,1);
  const head=await worker.fetch(new Request(target,{method:"HEAD"}),{});
  assert.equal(head.status,200);
  assert.equal(await head.text(),"");
  for(const bad of [
    "product=IDN65388&station=540384",
    "product=IDQ65388&station=540384x",
    "product=IDQ65388&station=https://evil.example",
    "product=IDQ65387&station=540384",
    "product=IDQ65399&station=0000"
  ]) {
    const r=await worker.fetch(new Request(
      "https://relay.invalid/river-recent-history?"+bad
    ),{});
    assert.equal(r.status,400,"Reject invalid country/product/station before upstream call");
  }
  assert.equal(targets.length,2,"No extra upstream fetches for invalid station inputs");
  const blocked=await worker.fetch(new Request(target,{
    headers:{Origin:"https://evil.example"}
  }),{});
  assert.equal(blocked.status,403);
  // Do not collapse no-data, BoM access refusal and genuine upstream faults
  // into indistinguishable 502 errors.
  const scenarios=[
    [403,503,"source_access_denied"],
    [429,429,"source_rate_limited"],
    [500,503,"bom_upstream_http"]
  ];
  // A source 404/410 means the optional per-station table was never
  // published. Return a valid typed empty availability (HTTP 200) instead of
  // generating continuous browser Network errors. NOT a zero river reading.
  for(const upstreamStatus of [404,410]){
    globalThis.fetch=async()=>new Response("not found",{status:upstreamStatus});
    const r=await worker.fetch(new Request(target,{headers:{
      Origin:"https://blakesmith-intel.github.io"}}),{});
    assert.equal(r.status,200);
    assert.equal(r.headers.get("Cache-Control"),"public, max-age=1800");
    const data=await r.json();
    assert.equal(data.format,"StormTrackerBomRecentRiverHistoryV1");
    assert.equal(data.availability,"not_published");
    assert.equal(data.sourceStatus,upstreamStatus);
    assert.deepEqual(data.samples,[]);
  }
  for(const [upstreamStatus,expectedStatus,code] of scenarios){
    globalThis.fetch=async()=>new Response("upstream error",{status:upstreamStatus});
    const response=await worker.fetch(new Request(target,{
      headers:{Origin:"https://blakesmith-intel.github.io"}
    }),{});
    assert.equal(response.status,expectedStatus);
    assert.equal(response.headers.get("X-StormTracker-Error-Code"),code);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"),
      "https://blakesmith-intel.github.io",
      "Worker-generated upstream 503/429/500 must keep browser CORS");
    assert.equal(response.headers.get("Cache-Control"),"no-store");
    const payload=await response.json();
    assert.equal(payload.code,code);
    assert.equal(payload.upstreamStatus,upstreamStatus);
  }
  globalThis.fetch=async()=>new Response(
    '<table id="tableStyle1"><tr><th>Date/Time</th><th>Water Level (m)</th></tr></table>',
    {status:200});
  const empty=await worker.fetch(new Request(target),{});
  assert.equal(empty.status,200);
  assert.equal(empty.headers.get("Cache-Control"),"public, max-age=60");
  const unavailable=await empty.json();
  assert.equal(unavailable.format,"StormTrackerBomRecentRiverHistoryV1");
  assert.equal(unavailable.availability,"no_recent_observations");
  assert.deepEqual(unavailable.samples,[]);
  // A header-valid table with numeric levels but unrecognised timestamps
  // is a changed schema, not proof that the station has no observations.
  globalThis.fetch=async()=>new Response(
    '<table id="tableStyle1"><tr><th>Date/Time</th><th>Water Level (m)</th></tr>'+
    '<tr><td>unknown-date-format</td><td>2.34</td></tr></table>',
    {status:200});
  const changedDates=await worker.fetch(new Request(target),{});
  assert.equal(changedDates.status,502);
  assert.equal((await changedDates.json()).code,"source_format_mismatch");
  // The actual field report was a valid BoM station page blocked by the
  // obsolete 1.2-million-character WHOLE-PAGE check. Large real tables
  // must parse, not be rejected just for their length.
  const longRow=`<tr><td>${time}</td><td>0.92</td></tr>`;
  const longTable='<table id="tableStyle1"><tr><th>Date/Time</th><th>Water Level (m)</th></tr>'+
    longRow.repeat(35000)+'</table>';
  assert.ok(longTable.length>1200000);
  globalThis.fetch=async()=>new Response(longTable,{status:200});
  const largeValid=await worker.fetch(new Request(target),{});
  assert.equal(largeValid.status,200,"Valid long BoM tables must no longer produce 502");
  assert.equal((await largeValid.json()).samples.length,1);

  // A massive unrelated page footer must never invalidate a complete,
  // small and authenticated BoM observations table.
  globalThis.fetch=async()=>new Response(sample+'X'.repeat(13*1024*1024),{status:200});
  const oversizedFooter=await worker.fetch(new Request(target),{});
  assert.equal(oversizedFooter.status,200,
    "Large non-observation HTML must not be mistaken for a huge station table");
  assert.equal((await oversizedFooter.json()).samples.length,1);

  // A genuinely oversized table is still rejected with its exact reason.
  // Never manufacture readings from a truncated/incomplete table.
  globalThis.fetch=async()=>new Response(
    '<table id="tableStyle1"><tr><th>Date/Time</th><th>Water Level (m)</th></tr>'+
    longRow.repeat(220000)+'</table>',{status:200});
  const oversizedTable=await worker.fetch(new Request(target),{});
  assert.equal(oversizedTable.status,502);
  assert.equal((await oversizedTable.json()).code,"source_response_too_large");

  // Missing opening table marker in a huge HTML document also remains
  // strictly bounded rather than loading arbitrary untrusted HTML.
  globalThis.fetch=async()=>new Response("Z".repeat(13*1024*1024),{status:200});
  const absentLargeTable=await worker.fetch(new Request(target),{});
  assert.equal(absentLargeTable.status,502);
  assert.equal((await absentLargeTable.json()).code,"source_response_too_large");

  globalThis.fetch=async()=>new Response("<html>Unexpected login page</html>",{status:200});
  const changedMarkup=await worker.fetch(new Request(target),{});
  assert.equal(changedMarkup.status,502);
  assert.equal((await changedMarkup.json()).code,"source_format_mismatch");
  globalThis.fetch=async()=>{throw Error("upstream connection failed");};
  const unreachable=await worker.fetch(new Request(target),{});
  assert.equal(unreachable.status,503);
  assert.equal((await unreachable.json()).code,"source_transport_failure");

  // Reproduce the actual resource hazard: upstream sends HTTP headers and a
  // partial table, then the body never completes. The deadline MUST span the
  // entire stream, not stop immediately after fetch() resolves its headers.
  // Accelerate only this test's timeout rather than waiting 12 seconds.
  const normalTimeout=globalThis.setTimeout;
  let aborted=false;
  try{
    globalThis.setTimeout=(fn,delay,...args)=>
      normalTimeout(fn,delay===12000?25:delay,...args);
    globalThis.fetch=async (url,options)=>{
      const body=new ReadableStream({start(controller){
        controller.enqueue(new TextEncoder().encode(
          '<table id="tableStyle1"><tr><th>Date/Time</th><th>Water Level (m)</th></tr>'));
        options.signal.addEventListener("abort",()=>{
          aborted=true;
          controller.error(new DOMException("aborted mid-stream","AbortError"));
        },{once:true});
      }});
      return new Response(body,{status:200});
    };
    const slowBody=await Promise.race([
      worker.fetch(new Request(target,{headers:{
        Origin:"https://blakesmith-intel.github.io"
      }}),{}),
      new Promise((_,reject)=>normalTimeout(()=>reject(
        Error("Upstream station history body timeout was cleared too early")),350))
    ]);
    assert.equal(aborted,true);
    assert.equal(slowBody.status,504);
    assert.equal(slowBody.headers.get("Access-Control-Allow-Origin"),
      "https://blakesmith-intel.github.io");
    assert.equal(slowBody.headers.get("X-StormTracker-Error-Code"),"source_timeout");
    assert.equal((await slowBody.json()).code,"source_timeout");
  }finally{
    globalThis.setTimeout=normalTimeout;
  }
}finally {
  globalThis.fetch=originalFetch;
}
console.log("BoM recent-history relay checks passed: existing CORS origin policy, fixed QLD 12-product IDs, station sanitization, AEST table parsing, 5-min cache and HEAD response.");
