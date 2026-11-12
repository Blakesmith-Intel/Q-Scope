// Read-only production transport diagnostic. Never claim an FTP source verified
// from a code-level parser or HTTP 200 alone: parse original CAP identity.
import {verifyOfficialFtpWarningCap} from "../relay/bom-warning-ftp-v1.js";
const urls=[
 ["BoM FWO HTTPS","https://www.bom.gov.au/fwo/IDQ21035.cap.xml"],
 ["BoM FWO alternate HTTPS","https://ftp.bom.gov.au/anon/gen/fwo/IDQ21035.cap.xml"],
 ["BoM published FWO bulletin","https://www.bom.gov.au/fwo/IDQ21035.txt"],
 ["Worker original FTP radar path","https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/ftp-live-manifest"]
];
for(const [name,url] of urls){
 try{
  const response=await fetch(url,{headers:{Accept:"application/xml,text/xml,text/plain,application/json,*/*"},
   redirect:"follow",signal:AbortSignal.timeout(14000)});
  const text=(await response.text()).slice(0,300000);
  let verified=null;
  if(response.ok&&url.endsWith(".cap.xml"))try{
   const found=verifyOfficialFtpWarningCap("IDQ21035",text);
   verified={code:found.notice.productCode,status:found.notice.status,
     issuedUtc:found.notice.issuedUtc};
  }catch(e){verified={error:String(e).slice(0,130)};}
  console.log("ORIGINAL_FWO_TRANSPORT_DIAGNOSTIC",JSON.stringify({
   name,status:response.status,finalUrl:response.url,
   contentType:response.headers.get("content-type"),
   bytes:text.length,xmlVerified:verified,
   preview:text.slice(0,150).replace(/\s+/g," ")
  }));
 }catch(e){
  console.log("ORIGINAL_FWO_TRANSPORT_DIAGNOSTIC_ERROR",
   JSON.stringify({name,message:String(e).slice(0,160)}));
 }
}
