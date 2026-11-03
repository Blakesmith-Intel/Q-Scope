import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {officialLgaPointUrl,parseOfficialLgaPoint,resolveQueenslandLgaAtPoint,
 fallbackPointForSuburb,resolveOutageCouncilNames}
 from "../src/context-layers/outage-lga-geographic-fallback-v1.js";
import {UNKNOWN_LGA} from "../src/context-layers/incident-lga-model-v1.js";
const read=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");
const point={longitude:153.266,latitude:-27.776};
const params=new URL(officialLgaPointUrl(point)).searchParams;
assert.equal(params.get("inSR"),"4326");
assert.equal(params.get("geometryType"),"esriGeometryPoint");
assert.equal(params.get("outFields"),"lga");
assert.equal(params.get("spatialRel"),"esriSpatialRelIntersects");
assert.equal(JSON.parse(params.get("geometry")).x,point.longitude);
assert.equal(officialLgaPointUrl({longitude:22,latitude:12}),"");
assert.equal(parseOfficialLgaPoint({features:[{attributes:{lga:"Gold Coast City"}}]}),"Gold Coast City");
assert.equal(parseOfficialLgaPoint({features:[]}),UNKNOWN_LGA);
assert.equal(parseOfficialLgaPoint({features:[{attributes:{lga:"Council A"}},
 {attributes:{lga:"Council B"}}]}),UNKNOWN_LGA);
assert.throws(()=>parseOfficialLgaPoint({error:{message:"unavailable"}}));
const event=(id,suburbs,coordinates=[153.266,-27.776])=>({
 id,properties:{SUBURBS:suburbs},geometry:{type:"Point",coordinates}
});
const make=(name,item)=>({name,items:[item]});
const first={id:"a",feature:event("a","Ormeau")};
const shared={id:"b",feature:event("b","Coomera, Pimpama")};
assert.deepEqual(fallbackPointForSuburb(make("Ormeau",first),[make("Ormeau",first)],new Map()),{
 point,requiredCouncil:null
});
assert.equal(fallbackPointForSuburb(make("Pimpama",shared),[
 make("Pimpama",shared),make("Coomera",shared)
],new Map()),null,"multi-suburb centre must not be treated as suburb");
const verifiedEvent=new Map([["COOMERA","Gold Coast City"]]);
assert.equal(fallbackPointForSuburb(make("Pimpama",shared),[
 make("Pimpama",shared),make("Coomera",shared)
],verifiedEvent).requiredCouncil,"Gold Coast City");
const sourceCalls=[];
const fetchImpl=async url=>{
 const request=new URL(url);
 sourceCalls.push(request);
 if(request.pathname.endsWith("/2/query")){
   assert.match(request.searchParams.get("where"),/UPPER\(locality\)/);
   return {ok:true,json:async()=>({features:[
    {attributes:{locality:"Ormeau",lga:"Gold Coast City"}}
   ]})};
 }
 if(request.pathname.endsWith("/1/query")){
   const geometry=JSON.parse(request.searchParams.get("geometry"));
   assert.equal(geometry.x,153.266);
   return {ok:true,json:async()=>({features:[
    {attributes:{lga:"Gold Coast City"}}
   ]})};
 }
 throw Error("Unexpected source endpoint");
};
assert.equal(await resolveQueenslandLgaAtPoint(point,{fetchImpl}),"Gold Coast City");
const subset=[make("Ormeau",first),make("Missing",{
 id:"c",feature:event("c","Missing")
})];
const resolved=await resolveOutageCouncilNames(["Ormeau","Missing"],subset,{fetchImpl});
assert.equal(resolved.get("ORMEAU"),"Gold Coast City");
assert.equal(resolved.get("MISSING"),"Gold Coast City");
assert.ok(sourceCalls.some(x=>x.pathname.endsWith("/1/query")));
const sourcePower=read("../src/context-layers/power-outage-suburb-explorer-v1.js");
const sourceRoad=read("../src/context-layers/road-closure-lga-explorer-v1.js");
const html=read("../live3d-operational-v9.html");
const css=read("../src/sidebar-incident-counts-v1.css");
const controller=read("../src/live3d-operational-v9.js");
for(const key of ["sidebarPowerOutageCount","sidebarPowerCustomerCount",
 "sidebarRoadClosureCount"])assert.ok(html.includes('id="'+key+'"'));
assert.match(html,/incident-button-name/);
assert.match(html,/incident-button-numbers/);
assert.match(css,/grid-template-columns:minmax\(0,1fr\)!important/);
assert.match(sourcePower,/groupOutagesByVerifiedGeometry\(suburbGroups,eventLgas,localityLgas\)/);
assert.doesNotMatch(sourcePower,/LGA not verified/);
// Both the sidebar and provider report now use the same unique-event
// aggregation. Council/suburb multiplicity must never inflate statewide totals.
assert.match(sourcePower,/powerOutageProviderCounts\\(latestFeatures/);
assert.match(sourcePower,/const count=providerSummary\\.total\\.outages/);
assert.match(sourcePower,/const total=providerSummary\\.total\\.customers/);
assert.ok(html.includes('id="outageByProviderReport"'));
assert.match(sourcePower,/sidebarCustomers\.textContent/);
assert.match(sourceRoad,/sidebarCount\.textContent/);
assert.match(controller,/initialiseOperationalPowerOutages/);
assert.match(controller,/initialiseOperationalFloodRoadClosures/);
console.log("Live incident counters and official LGA boundary fallback tests passed.");
