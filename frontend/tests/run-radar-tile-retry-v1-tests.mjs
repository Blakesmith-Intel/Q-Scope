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
assert.equal(deniedAttemptCount,2,
  "A denied source frame must stop before requesting the third tile");
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

// Source throttling must not turn one denied full-size mosaic into twelve
// futile upstream requests. Already verified tiles are still preserved.
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
/remaining tiles not requested after source refusal/);
assert.deepEqual(attempted,["tile-0","tile-1","tile-2","tile-3"],
  "Remaining 8 tiles must never be requested after the source denial");

console.log("PASS hard relay 403 fails complete source scan without duplicate attempts or fabricated pixels.");
console.log("PASS selective WMTS tile retry; existing real tiles retained; no missing-pixel fabrication.");
