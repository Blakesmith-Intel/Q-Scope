// Direct BoM anonymous FTP CAP bulletin source for current Queensland warnings.
// This supplies only source-authenticated bulletin editions, NEVER warning geometry.
// Strict filenames and a shared 75-second cache avoid excessive Worker usage.
// This transport is independent of the frozen radar FTP reader.
import {parseBomCapProductNotice,parseOfficialBomCap}
 from "../frontend/src/context-layers/bom-warning-cap-source-v1.js";

export const FTP_WARNING_CODES=Object.freeze([
 "IDQ21033","IDQ21035","IDQ21037","IDQ21038"
]);
const ROOT="/anon/gen/fwo";
const HOST="ftp.bom.gov.au";
const MAX_CAP_BYTES=240000;
const READER=new TextDecoder();
const WRITER=new TextEncoder();
const CACHE_ORIGIN="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev";
const DEADLINE_MS=19000;
export function verifyOfficialFtpWarningCap(code,xml,{nowMs=Date.now()}={}){
 if(!FTP_WARNING_CODES.includes(code)||typeof xml!=="string"||
    xml.length<150||xml.length>MAX_CAP_BYTES)throw Error("Unrecognised BoM CAP product");
 const notice=parseBomCapProductNotice(xml,{nowMs});
 if(!notice||notice.productCode!==code)
  throw Error("BoM FTP CAP identity or issue invalid");
 return {notice,warnings:parseOfficialBomCap(xml,{nowMs})};
}

// Only a named original CAP product; no arbitrary paths, directory listing or
// user-controlled FTP commands. FTP failures leave the WMO/index fallback intact.
async function originalFtpCapBytes(code,{connectSocket}={}){
 if(!FTP_WARNING_CODES.includes(code))throw Error("Unsupported BoM FTP product");
 const connect=connectSocket||(await import("cloudflare:sockets")).connect;
 const sockets=[];
 let ctrlReader,ctrlWriter,buffer="",step="connect",deadlineTimer;
 const limit=new Promise((_,reject)=>{
  deadlineTimer=setTimeout(()=>{
   for(const s of sockets)try{s.close()}catch{}
   reject(Error("BoM FTP deadline at "+step));
  },DEADLINE_MS);
 });
 const run=async()=>{
  try{
   const ctrl=connect({hostname:HOST,port:21});sockets.push(ctrl);
   await ctrl.opened;
   ctrlReader=ctrl.readable.getReader();
   ctrlWriter=ctrl.writable.getWriter();
   async function response(){
    let multiline=null,received=0;
    while(true){
     const idx=buffer.indexOf("\n");
     if(idx<0){
      const chunk=await ctrlReader.read();
      if(chunk.done)throw Error("BoM FTP control channel closed");
      received+=chunk.value.byteLength;
      if(received>30000)throw Error("Oversized BoM FTP response");
      buffer+=READER.decode(chunk.value,{stream:true});
      continue;
     }
     const line=buffer.slice(0,idx).trimEnd();
     buffer=buffer.slice(idx+1);
     const m=/^(\d{3})([- ])/.exec(line);
     if(!m)continue;
     if(!multiline&&m[2]==="-"){multiline=m[1];continue;}
     if(multiline&&(m[1]!==multiline||m[2]!==" "))continue;
     return {code:Number(m[1]),line};
    }
   }
   async function command(cmd){
    await ctrlWriter.write(WRITER.encode(cmd+"\r\n"));
    const ans=await response();
    if(ans.code>=400)throw Error("BoM FTP response "+ans.code);
    return ans;
   }
   step="welcome";
   if((await response()).code!==220)throw Error("BoM FTP banner rejected");
   step="login";
   const login=await command("USER anonymous");
   if(login.code===331)await command("PASS qscope-public@example.com");
   else if(login.code!==230)throw Error("BoM anonymous FTP refused");
   if((await command("TYPE I")).code!==200)throw Error("BoM FTP binary mode unavailable");
   step="directory";
   if((await command("CWD "+ROOT)).code!==250)throw Error("BoM FWO directory unavailable");
   step="passive";
   let port,epsv;
   try{epsv=await command("EPSV")}catch{}
   const matched=epsv?.code===229?/\(\|\|\|(\d+)\|\)/.exec(epsv.line):null;
   if(matched)port=Number(matched[1]);
   else{
    const pasv=await command("PASV");
    const tuple=/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/.exec(pasv.line);
    if(pasv.code!==227||!tuple)throw Error("BoM FTP passive port missing");
    port=Number(tuple[5])*256+Number(tuple[6]);
   }
   if(!Number.isInteger(port)||port<1024||port>65535)
    throw Error("BoM FTP unsafe passive port");
   step="data";
   const data=connect({hostname:HOST,port});sockets.push(data);
   await data.opened;
   const reader=data.readable.getReader();
   const started=await command("RETR "+code+".cap.xml");
   if(![125,150].includes(started.code))throw Error("BoM FTP transfer not accepted");
   const chunks=[];let total=0;
   for(;;){
    const chunk=await reader.read();
    if(chunk.done)break;
    total+=chunk.value.byteLength;
    if(total>MAX_CAP_BYTES)throw Error("BoM FTP CAP exceeded safe size");
    chunks.push(chunk.value);
   }
   try{reader.releaseLock()}catch{}
   const finished=await response();
   if(![226,250].includes(finished.code))throw Error("BoM FTP transfer incomplete");
   const bytes=new Uint8Array(total);
   let offset=0;
   for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength;}
   return bytes;
  }finally{
   try{ctrlReader?.releaseLock()}catch{}
   try{ctrlWriter?.releaseLock()}catch{}
   for(const s of sockets)try{s.close()}catch{}
  }
 };
 try{return await Promise.race([run(),limit]);}
 finally{clearTimeout(deadlineTimer);}
}

export async function fetchOriginalBoMFtpWarning(code,{
 force=false,nowMs=Date.now(),ftpRead=originalFtpCapBytes,
 cache=globalThis.caches?.default
}={}){
 if(!FTP_WARNING_CODES.includes(code))throw Error("Unsupported BoM FTP CAP product");
 const key=new Request(CACHE_ORIGIN+"/__internal-fwo-cap/"+code);
 if(cache&&!force){
  try{
   const found=await cache.match(key);
   if(found?.ok){
    const cached=await found.text();
    return verifyOfficialFtpWarningCap(code,cached,{nowMs});
   }
  }catch{/* Unreadable cache must fall back to original FTP */ }
 }
 const bytes=await ftpRead(code);
 if(!(bytes instanceof Uint8Array)||bytes.byteLength<150||
    bytes.byteLength>MAX_CAP_BYTES)throw Error("Invalid BoM FTP CAP payload size");
 const xml=READER.decode(bytes);
 const verified=verifyOfficialFtpWarningCap(code,xml,{nowMs});
 if(cache){
  try{
   const body=new Response(xml,{headers:{
    "Content-Type":"application/xml;charset=utf-8",
    "Cache-Control":"public,max-age=75"}});
   await cache.put(key,body);
  }catch{/* Cache failure does not invalidate verified CAP */ }
 }
 return verified;
}
