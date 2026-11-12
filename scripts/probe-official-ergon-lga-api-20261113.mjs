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


const root="https://services.arcgis.com/33eHbTVqo7gtiCE8/ArcGIS/rest/services/VwErgonOutages/FeatureServer";
const load=async(layer)=>{
 const output=[];
 for(let offset=0;offset<8000;offset+=1000){
  const params=new URLSearchParams({where:"1=1",outFields:"*",returnGeometry:"true",
   outSR:"4326",f:"geojson",resultOffset:String(offset),resultRecordCount:"1000"});
  const res=await fetch(root+"/"+layer+"/query?"+params);
  const data=await res.json();
  if(!res.ok||data.error)throw Error("Source "+layer+": "+JSON.stringify(data.error??res.status));
  output.push(...(data.features??[]));
  if((data.features?.length??0)<1000)break;
 }
 return output;
};
const [areas,points]=await Promise.all([load(0),load(1)]);
const summarise=(collection)=>{const ids=new Map(),types={},statuses={};
 for(const f of collection){
  const p=f.properties??{};const id=String(p.EVENT_ID??"");
  if(!ids.has(id))ids.set(id,[]);
  ids.get(id).push({count:p.CUSTOMERS_AFFECTED,suburbs:p.SUBURBS, geometry:f.geometry?.type,
   status:p.STATUS,type:p.TYPE, extracted:p.EXTRACTED});
  types[p.TYPE]=(types[p.TYPE]??0)+1;statuses[p.STATUS]=(statuses[p.STATUS]??0)+1;
 }
 return {count:collection.length,distinct:ids.size,
  duplicate:[...ids].filter(([id,v])=>v.length>1).slice(0,8),
  types,statuses,ids};
};
const ar=summarise(areas),pt=summarise(points);
console.log("ERGON_LAYERS",JSON.stringify({
 area:{count:ar.count,distinct:ar.distinct,dups:ar.duplicate.length,types:ar.types},
 point:{count:pt.count,distinct:pt.distinct,dups:pt.duplicate.length,types:pt.types},
 pointOnly:[...pt.ids.keys()].filter(id=>!ar.ids.has(id)).length,
 areaOnly:[...ar.ids.keys()].filter(id=>!pt.ids.has(id)).length,
 overlap:[...ar.ids.keys()].filter(id=>pt.ids.has(id)).length
}));
for(const [id,records] of [...pt.ids].filter(([id,v])=>v.length>1).slice(0,8))
 console.log("ERGON_POINT_REPEATED",id,JSON.stringify(records).slice(0,1500));
for(const id of [...ar.ids.keys()].filter(id=>pt.ids.has(id)).slice(0,12))
 console.log("ERGON_AREA_POINT_COMPARE",id,JSON.stringify({area:ar.ids.get(id),point:pt.ids.get(id)}).slice(0,950));
for(const id of ["26FN11158","26WB11234","26SW14789"]){
 console.log("ERGON_KNOWN_CROSS_LGA",id,JSON.stringify({area:ar.ids.get(id),point:pt.ids.get(id)}).slice(0,1600));
}
