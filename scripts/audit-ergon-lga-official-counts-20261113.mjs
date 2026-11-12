// Read-only comparison of Ergon's public council text view and ArcGIS source.
// No web UI or production changes; output only structure and small excerpts.
import {ERGON_OUTAGE_AREA_QUERY_URL,fetchPagedPowerOutageFeatures,
 powerOutageSummary,loadPowerOutages} from "../frontend/src/context-layers/power-outages-v1.js";
const textUrl="https://www.ergon.com.au/network/outages/outage-finder/outage-finder-text-view";
const response=await fetch(textUrl,{headers:{"User-Agent":"Mozilla/5.0","Accept":"text/html"}});
const raw=await response.text();
console.log("ERGON_TEXT_HTTP",response.status,"bytes",raw.length,
 "contenttype",response.headers.get("content-type"));
const blocks=[...raw.matchAll(/South Burnett Regional Council|South Burnett|Event ID|Customer\(s\) affected|26SW14789/gi)];
console.log("ERGON_TEXT_MATCHES",blocks.length);
for(const match of blocks.slice(0,5)){
 let pos=match.index;console.log("ERGON_HTML_MATCH",match[0],pos,
  raw.slice(Math.max(0,pos-500),Math.min(raw.length,pos+1800)).replace(/\s+/g," ").slice(0,2250));
}
const controls=[...raw.matchAll(/<script\b[^>]+src=["']([^"']+)/gi)].map(x=>x[1]);
console.log("ERGON_SCRIPTS",JSON.stringify(controls.slice(-15)));
const query=new URL(ERGON_OUTAGE_AREA_QUERY_URL);
query.searchParams.set("resultRecordCount","250");
const area=await fetch(query);
const geo=await area.json();
console.log("ERGON_ARCGIS",area.status,"features",geo.features?.length,"error",geo.error,
 "fields",Object.keys(geo.features?.[0]?.properties??{}));
const byOutage=new Map();
for(const f of geo.features??[]){
 const id=String(f.properties?.EVENT_ID??"");if(!id)continue;
 if(!byOutage.has(id))byOutage.set(id,[]);
 byOutage.get(id).push({customers:f.properties?.CUSTOMERS_AFFECTED,
  suburbs:String(f.properties?.SUBURBS??"").slice(0,250),geom:f.geometry?.type,
  extracted:f.properties?.EXTRACTED});
}
for(const [id,v] of [...byOutage].filter(([id,x])=>x.length>1).slice(0,6))
 console.log("ERGON_ARCGIS_DUPLICATE_EVENT",id,JSON.stringify(v).slice(0,1500));
console.log("ERGON_ARCGIS_UNIQUE",byOutage.size,"duplicate_event_ids",
 [...byOutage].filter(([id,v])=>v.length>1).length);
