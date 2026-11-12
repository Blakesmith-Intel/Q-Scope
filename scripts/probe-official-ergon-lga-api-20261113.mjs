// One-off public Energy Queensland council allocation endpoint discovery.
// Do not retry on errors or alter runtime source routes.
const urls=[];
for(const host of ["www.ergon.com.au","ergon.com.au"]){
 for(const version of ["v1.0.eg","v1.0.er","v1.0.en","v1.0.ex","v1.0"]){
  urls.push("https://"+host+"/api/outages-text/"+version+"/summary");
  urls.push("https://"+host+"/api/outages-text/"+version+"/suburb?council=&suburb=");
 }
}
urls.push("https://www.energex.com.au/api/outages-text/v1.0.ex/summary");
urls.push("https://www.energex.com.au/api/outages-text/v1.0.ex/suburb?council=&suburb=");
urls.push("https://www.ergon.com.au/static/Ergon/ergon_po_current_unplanned.geojson");
for(const u of urls){
 try{
  const c=new AbortController(),t=setTimeout(()=>c.abort(),9000);
  const res=await fetch(u,{headers:{Accept:"application/json", "User-Agent":"Mozilla/5.0"},signal:c.signal,redirect:"follow"}).finally(()=>clearTimeout(t));
  const text=(await res.text()).slice(0,1100);
  let parsed;try{parsed=JSON.parse(text)}catch{}
  console.log("Q_SCOPE_OUTAGE_COUNCIL_SOURCE_PROBE",JSON.stringify({
   u,status:res.status,type:res.headers.get("content-type"),
   keys:parsed?Object.keys(parsed):[],
   excerpt:text.slice(0,res.ok?500:120).replace(/\s+/g," ")
  }));
 }catch(e){console.log("Q_SCOPE_OUTAGE_COUNCIL_SOURCE_PROBE",JSON.stringify({u,error:e.message}));}
}
