import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getRadarFrames,pruneRadarFrames} from "../src/storage.js";

// Executable IndexedDB contract: region-prefix key lookups may deserialize
// only the few requested source scans. A full statewide getAll() fails.
const rows=new Map(),counts={getAll:0,get:0,getAllKeys:0};
const initial=Date.parse("2026-11-03T00:00:00Z");
const utc=i=>new Date(initial+i*300000).toISOString();
for(const site of ["66","08","23"]){
  for(let i=0;i<30;i++){
    const time=utc(i);
    rows.set("radar-history-v1:"+site+":"+time,{
      kind:"radar-history-v1",region:site,observedUtc:time,
      frame:{observedUtc:time,categories:new Uint8Array([i]),sourceMetadata:{region:site}}
    });
  }
}
rows.set("other:unrelated", {key:"other:unrelated",keep:true});
function transaction(){
  let pending=0;
  const tx={oncomplete:null,onerror:null,onabort:null};
  function request(fn){
    pending++;
    const req={onsuccess:null,onerror:null,result:null,error:null};
    queueMicrotask(()=>{
      try {
        req.result=fn();
        req.onsuccess?.({target:req});
      }catch(error){
        req.error=error;
        req.onerror?.({target:req});
        tx.onerror?.({target:tx});
      }finally{
        pending--;
        if(pending===0)queueMicrotask(()=>{
          if(pending===0)tx.oncomplete?.({target:tx});
        });
      }
    });
    return req;
  }
  tx.objectStore=()=>({
    getAll(){counts.getAll++;throw new Error("statewide decoded getAll forbidden");},
    getAllKeys(range){
      counts.getAllKeys++;
      return request(()=>[...rows.keys()].sort().filter(key=>
        !range||(key>=range.lower&&key<=range.upper)));
    },
    get(key){counts.get++;return request(()=>rows.get(key));},
    delete(key){return request(()=>rows.delete(key));}
  });
  return tx;
}
const db={transaction,close(){}};
globalThis.IDBKeyRange={bound:(lower,upper)=>({lower,upper})};
globalThis.indexedDB={open:()=>{
  const req={onsuccess:null,result:null,error:null};
  queueMicrotask(()=>{req.result=db;req.onsuccess?.({target:req});});
  return req;
}};
const six=await getRadarFrames("66",0,6);
assert.deepEqual(six.map(f=>f.observedUtc),
  Array.from({length:6},(_,i)=>utc(24+i)));
assert.deepEqual(six.map(f=>f.sourceMetadata.region),Array(6).fill("66"));
assert.equal(counts.get,6,"only six actual images may be deserialized");
const fresh=await getRadarFrames("08",Date.parse(utc(26)),9);
assert.deepEqual(fresh.map(f=>f.observedUtc),[utc(26),utc(27),utc(28),utc(29)]);
assert.equal(counts.get,10,"different site keys never force reloading all images");
const one=await getRadarFrames("23",0,1);
assert.equal(one.length,1);
assert.equal(one[0].observedUtc,utc(29));
assert.equal(counts.get,11);
const removed=await pruneRadarFrames({maxRecords:12});
assert.equal(removed,78,"original global 240-record style cap still prunes archive");
assert.equal([...rows.keys()].filter(key=>key.startsWith("radar-history-v1:")).length,12);
assert(rows.has("other:unrelated"),"unrelated offline data must remain untouched");
assert.equal(counts.getAll,0,"neither retrieval nor cleanup may clone all image data");
assert.equal(counts.get,11,"prune may read only compact keys");
const source=readFileSync(new URL("../src/storage.js",import.meta.url),"utf8");
assert(source.includes("getAllKeys("));
assert(!source.includes(".getAll()"));
console.log("PASS selected-site bounded IndexedDB frames and key-only statewide pruning; genuine observation UTCs unchanged.");
