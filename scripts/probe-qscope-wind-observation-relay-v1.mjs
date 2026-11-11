import assert from "node:assert/strict";
import {setTimeout as sleep} from "node:timers/promises";
const BASE=process.env.QSCOPE_WIND_RELAY_URL??"http://127.0.0.1:8787";
const ORIGIN="https://blakesmith-intel.github.io";
async function request(path,origin=ORIGIN){
 const response=await fetch(BASE+path,{
   headers:{Origin:origin},signal:AbortSignal.timeout(25000)
 });
 return {response,body:await response.text()};
}
let healthy=false;
for(let attempt=0;attempt<24;attempt++){
 try{
  const ping=await fetch(BASE+"/qld-wind-observations?wmo=not-a-number",{
   headers:{Origin:ORIGIN},signal:AbortSignal.timeout(3000)
  });
  if(ping.status===400){healthy=true;break;}
 }catch{}
 await sleep(1000);
}
assert(healthy,"Local Cloudflare Worker did not start or route validation is missing");
const malformed=await request("/qld-wind-observations?wmo=1234");
assert.equal(malformed.response.status,400,"Malformed WMO must be refused");
const denied=await request("/qld-wind-observations","https://untrusted.example");
assert.equal(denied.response.status,403,"Origin allowlist must apply before source access");
const state=await request("/qld-wind-observations");
assert.equal(state.response.status,200,"Official wind state relay must succeed: "+state.body.slice(0,180));
assert.equal(state.response.headers.get("access-control-allow-origin"),ORIGIN);
const content=JSON.parse(state.body);
assert.equal(content.format,"QScopeBoMWindObservationsV1");
assert.equal(content.product,"IDQ60920");
assert(content.observations.length>=50,"Statewide BoM observations missing");
assert(content.observations.every(s=> /^\d{5}$/.test(s.wmo) &&
  Number.isFinite(s.latitude)&&Number.isFinite(s.longitude)&&
  Number.isFinite(Date.parse(s.observedUtc))),"Station metadata invalid");
const valid=content.observations.find(s=>s.gustKmh!==null&&s.current);
assert(valid,"No live current gust station verified");
const history=await request("/qld-wind-observations?wmo="+valid.wmo);
assert.equal(history.response.status,200,"Station 24h relay must succeed: "+history.body.slice(0,180));
const h=JSON.parse(history.body);
assert.equal(h.format,"QScopeBoMWindStation24hV1");
assert.equal(h.wmo,valid.wmo);
assert(Number.isFinite(h.peak.peakGustKmh)&&h.peak.sampleCount>=1);
assert(Number.isFinite(Date.parse(h.peak.peakUtc)));
const invalid=await request("/qld-wind-observations?wmo=99999");
assert([404,503].includes(invalid.response.status));
console.log("Q-SCOPE local Cloudflare Worker → official BoM end-to-end PASS",
 JSON.stringify({stations:content.observations.length,sampleStation:valid.wmo,
  available24hSamples:h.peak.sampleCount,
  cors:state.response.headers.get("access-control-allow-origin"),
  invalidStation:invalid.response.status}));
