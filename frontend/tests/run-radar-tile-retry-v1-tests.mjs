import assert from "node:assert/strict";
import { loadCompleteRadarTiles } from "../src/radar-tile-retry-v1.js";

const tasks=[
  {url:"tile-a",col:1,row:1,x:0,y:0},
  {url:"tile-b",col:2,row:1,x:256,y:0},
  {url:"tile-c",col:3,row:1,x:512,y:0}
];
const image={width:256,height:256,data:new Uint8ClampedArray(4)};
const attempts=new Map();
const loaded=await loadCompleteRadarTiles(tasks,async url=>{
  attempts.set(url,(attempts.get(url)??0)+1);
  if(url==="tile-b"&&attempts.get(url)===1)throw Error("503");
  return image;
},{wait:async()=>{}});
assert.deepEqual(loaded.map(x=>x.url),tasks.map(x=>x.url));
assert.equal(attempts.get("tile-a"),1);
assert.equal(attempts.get("tile-b"),2);
assert.equal(attempts.get("tile-c"),1);
assert.deepEqual(loaded.map(x=>x.x),[0,256,512]);
let failed=false;
try{
 await loadCompleteRadarTiles(tasks,async task=>{
   if(task==="tile-c")throw Error("WMTS HTTP 404");
   return image;
 },{wait:async()=>{}});
}catch(error){
 failed=true;
 assert.match(error.message,/Incomplete BoM reflectivity mosaic/);
 assert.match(error.message,/tile 3\/1/);
 assert.match(error.message,/404/);
}
assert.equal(failed,true,"missing real radar pixel tile must reject entire scan");
await assert.rejects(loadCompleteRadarTiles([],async()=>image),TypeError);
await assert.rejects(loadCompleteRadarTiles(tasks,async()=>({width:0,height:0}),
 {wait:async()=>{}}),/empty radar tile/);
let deniedAttemptCount=0;
const denialLoader=async url=>{
  deniedAttemptCount++;
  if(url==="tile-b"){
    const err=new Error("Image request failed: HTTP 403");err.status=403;
    throw err;
  }
  return image;
};
await assert.rejects(
  loadCompleteRadarTiles(tasks,denialLoader,{stopOnPermanent:true,wait:async()=>{}}),
  /Incomplete BoM reflectivity mosaic.*403/
);
assert.equal(deniedAttemptCount,3,
  "A refused original tile must not block other authentic source PNGs");
let invalidTimeAttempts=0;
await assert.rejects(loadCompleteRadarTiles(tasks,async url=>{
  invalidTimeAttempts++;
  if(url==="tile-b"){
    const e=Error("Image request failed: HTTP 400");e.status=400;throw e;
  }
  return image;
},{stopOnPermanent:true,wait:async()=>{}}),
/Incomplete BoM reflectivity mosaic.*400/);
assert.equal(invalidTimeAttempts,2,
  "Published-time rejection must stop further exact-UTC tile requests");

// Recorded BoM source audits show one HTTP 403 while other source PNGs
// at the SAME UTC are authentic. Cache the rest, but never fake the missing tile.
let attempted=[];
const many=Array.from({length:12},(_,i)=>({
  url:"tile-"+i,col:30+i,row:14,x:i*256,y:0
}));
await assert.rejects(loadCompleteRadarTiles(many,async url=>{
  attempted.push(url);
  if(url==="tile-2")throw Object.assign(
    Error("Image request failed: HTTP 403"),{status:403});
  return image;
},{stopOnPermanent:true,wait:async()=>{}}),
/Incomplete BoM reflectivity mosaic.*403/);
assert.deepEqual(attempted,many.map(tile=>tile.url),
  "Other authentic tiles MUST be requested after a single 403");
assert.equal(attempted.length,12,
  "One refused tile must not be immediately retried during this mosaic");
let unknown403=true,networkReads=0;
const previouslyVerified=new Map();
const fetchVerified=async url=>{
  if(previouslyVerified.has(url))return previouslyVerified.get(url);
  networkReads++;
  if(url==="tile-5" && unknown403){
    throw Object.assign(Error("Image request failed: HTTP 403"),{status:403});
  }
  previouslyVerified.set(url,image);
  return image;
};
await assert.rejects(loadCompleteRadarTiles(many,fetchVerified,{
  stopOnPermanent:true,wait:async()=>{}
}),/403/);
assert.equal(previouslyVerified.size,11,
  "All source PNGs other than a refused exact tile must be retained");
unknown403=false;
const recovered=await loadCompleteRadarTiles(many,fetchVerified,{
  stopOnPermanent:true,wait:async()=>{}
});
assert.equal(recovered.length,12,"Only real completed mosaics can display");
assert.equal(networkReads,13,
  "After retry, only the one missing original tile should require network");

// New source-verified seven-frame path: one delayed missing original
// succeeds while 11 other real pixels are retained without re-requesting.
let oneDenied=true,reads=[],waits=[];
const authentic=await loadCompleteRadarTiles(many,async url=>{
 reads.push(url);
 if(url==="tile-7"&&oneDenied){
  oneDenied=false;
  const e=new Error("Image request failed: HTTP 403");e.status=403;throw e;
 }
 return image;
},{
 stopOnPermanent:true,retries:1,retryVerified403:true,retry403DelayMs:5500,
 wait:async ms=>{waits.push(ms)}
});
assert.equal(authentic.length,12);
assert.deepEqual(waits,[5500],"Respect delayed source cooldown");
assert.equal(reads.length,13,"Exactly one extra relay call, not 12 new tiles");
assert.equal(reads.filter(u=>u==="tile-7").length,2);
assert.equal(reads.filter(u=>u==="tile-8").length,1);
let stubbornReads=0;
await assert.rejects(loadCompleteRadarTiles(many,async url=>{
 stubbornReads++;
 if(url==="tile-7")throw Object.assign(
  Error("Image request failed: HTTP 403"),{status:403});
 return image;
},{stopOnPermanent:true,retries:1,retryVerified403:true,wait:async()=>{}}),/403/);
assert.equal(stubbornReads,13,
 "Persistent source 403 stops after ONE exact missing-tile retry; no loops");
let rateLimitCalls=0;
await assert.rejects(loadCompleteRadarTiles(many,async url=>{
 rateLimitCalls++;
 if(url==="tile-0")throw Object.assign(
  Error("Image request failed: HTTP 429"),{status:429});
 return image;
},{stopOnPermanent:true,retries:1,retryVerified403:true,wait:async()=>{}}),/429/);
assert.equal(rateLimitCalls,2,
 "A source 429 stops immediately; never amplify provider rate limiting");

console.log("PASS isolated 403 caches other genuine tiles and next attempt recovers only refused original");
console.log("PASS selective WMTS tile retry; existing real tiles retained; no missing-pixel fabrication.");
