const DB_NAME = "stormtracker-browser";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("state")) db.createObjectStore("state");
      if (!db.objectStoreNames.contains("frames")) db.createObjectStore("frames", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putState(key,value) {
  const db = await openDb();
  return new Promise((resolve,reject) => {
    const tx = db.transaction("state","readwrite");
    tx.objectStore("state").put(value,key);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}

export async function getState(key) {
  const db = await openDb();
  return new Promise((resolve,reject) => {
    const req = db.transaction("state","readonly").objectStore("state").get(key);
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}

export async function putFrame(frame) {
  const db = await openDb();
  return new Promise((resolve,reject) => {
    const tx = db.transaction("frames","readwrite");
    tx.objectStore("frames").put(frame);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}

export async function clearAll() {
  const db = await openDb();
  await Promise.all(["state","frames"].map(store => new Promise((resolve,reject) => {
    const tx = db.transaction(store,"readwrite"); tx.objectStore(store).clear();
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  })));
}


const RADAR_FRAME_KIND = "radar-history-v1";

function radarFrameKey(region, observedUtc) {
  return `${RADAR_FRAME_KIND}:${String(region)}:${String(observedUtc)}`;
}

export async function putRadarFrame(region, frame) {
  if (!frame?.observedUtc || !frame?.categories) {
    throw new Error("Radar cache requires a timestamped decoded frame.");
  }

  return putFrame({
    key: radarFrameKey(region, frame.observedUtc),
    kind: RADAR_FRAME_KIND,
    region: String(region),
    observedUtc: frame.observedUtc,
    storedAt: Date.now(),
    frame
  });
}

// Browse only the selected site's KEY range. Never clone every stored
// statewide decoded radar mosaic merely to inspect one site's history.
// Read recent verified frames on demand; the live player retains its own
// current observed window independently of the persistent browser archive.
export async function getRadarFrames(region,sinceEpoch=0,maxFrames=48) {
  const db=await openDb();
  const wantedRegion=String(region);
  const prefix=`${RADAR_FRAME_KIND}:${wantedRegion}:`;
  const cutoff=Number(sinceEpoch)||0;
  const requested=Number(maxFrames);
  const limit=Number.isFinite(requested)
    ? Math.max(1,Math.min(48,Math.trunc(requested))):48;
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("frames","readonly");
    const store=tx.objectStore("frames");
    const frames=[];
    let settled=false;
    const fail=error=>{
      if(settled)return;
      settled=true;db.close();
      reject(error||new Error("Radar history archive read failed"));
    };
    tx.onerror=()=>fail(tx.error);
    tx.onabort=()=>fail(tx.error);
    tx.oncomplete=()=>{
      if(settled)return;
      settled=true;db.close();
      resolve(frames.filter(Boolean));
    };
    // ISO UTC sorts lexicographically, so the last N valid timestamps are
    // the most recent authentic observations at this *one* radar site.
    const keysRequest=store.getAllKeys(
      IDBKeyRange.bound(prefix,prefix+"\uffff")
    );
    keysRequest.onsuccess=()=>{
      const keys=(keysRequest.result??[])
        .filter(key=>typeof key==="string" &&
          Number.isFinite(Date.parse(key.slice(prefix.length))) &&
          Date.parse(key.slice(prefix.length))>=cutoff)
        .slice(-limit);
      for(const [index,key] of keys.entries()){
        const request=store.get(key);
        request.onsuccess=()=>{
          const record=request.result;
          if(record?.kind===RADAR_FRAME_KIND &&
             record.region===wantedRegion &&
             record.observedUtc===key.slice(prefix.length) &&
             record.frame?.categories)frames[index]=record.frame;
        };
      }
    };
  });
}

// Prune by the compact archive KEYS, not by deserialising every stored
// high-resolution radar image. Keep the original global age and count policy.
export async function pruneRadarFrames({
  beforeEpoch = 0,
  maxRecords = 240
} = {}) {
  const db=await openDb();
  const keys=await new Promise((resolve,reject)=>{
    const req=db.transaction("frames","readonly")
      .objectStore("frames").getAllKeys();
    req.onsuccess=()=>resolve(req.result??[]);
    req.onerror=()=>reject(req.error);
  });
  const prefix=RADAR_FRAME_KIND+":";
  const radarRecords=keys
    .filter(key=>typeof key==="string" && key.startsWith(prefix))
    .map(key=>{
      const suffix=key.slice(prefix.length);
      const sep=suffix.indexOf(":");
      return {key,observedUtc:sep>=0?suffix.slice(sep+1):""};
    })
    .filter(record=>Number.isFinite(Date.parse(record.observedUtc)))
    .sort((a,b)=>Date.parse(a.observedUtc)-Date.parse(b.observedUtc));
  const cutoff=Number(beforeEpoch)||0;
  const keepCount=Math.max(1,Number(maxRecords)||240);
  const overflow=Math.max(0,radarRecords.length-keepCount);
  const keysToDelete=radarRecords
    .filter((record,index)=>Date.parse(record.observedUtc)<cutoff ||
      index<overflow)
    .map(record=>record.key);
  if(!keysToDelete.length){db.close();return 0;}
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("frames","readwrite");
    const table=tx.objectStore("frames");
    for(const key of keysToDelete)table.delete(key);
    tx.oncomplete=()=>{db.close();resolve(keysToDelete.length);};
    tx.onerror=()=>{db.close();reject(tx.error);};
  });
}
