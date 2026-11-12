import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {extractOfficialBoMEditionSignals,produceOfficialBoMWarningEditionSignal,
 BOM_WARNING_EDITIONS_SCHEMA} from "../../relay/bom-warning-editions-v1.js";
import {hasNewOfficialBoMWarningEdition,officialWarningRefreshInterval,
 WARNING_EDITION_SCHEMA,WARNING_EDITION_POLL_MS,WARNING_ACTIVE_FULL_BACKSTOP_MS
} from "../src/context-layers/bom-warning-operational-v1.js";

const now=Date.parse("2026-11-12T11:32:00Z");
const t1=Date.parse("2026-11-12T11:20:00Z"),t2=Date.parse("2026-11-12T11:30:00Z");
const feature=(product,from,to,id)=>({attributes:{
 product,validfrom_utc:from,validto_utc:to,gml_id:id}});
const end=now+2*60*60000;
const prior=feature("IDQ65654",t1,end,"regional-old");
const current=feature("IDQ65654",t2,end,"regional-new");
const detailed=feature("IDQ65650",t2,end,"detail-new");
const cell=feature("IDQ65652",t2,end,"cell-new");
const collection={features:[prior,current,detailed,cell,
 feature("IDQ65654",t2,now-1000,"expired"),
 feature("IDQ65654",now+800000,end,"future")]};
const metadata=extractOfficialBoMEditionSignals(collection,now);
assert.deepEqual(metadata.IDQ21033.sourceIds,["regional-new"]);
assert.equal(metadata.IDQ21033.count,1);
assert.equal(metadata.IDQ21033.issuedUtc,new Date(t2).toISOString());
assert.deepEqual(metadata["IDQ21035:cells"].sourceIds,["cell-new"]);
assert.equal(metadata.IDQ21035.count,1);
assert.equal(metadata.IDQ21037.count,0);
assert.throws(()=>extractOfficialBoMEditionSignals({features:[],exceededTransferLimit:true},now));

const summary='<html><head><title>Queensland Warnings Summary</title></head>'+
 '<body><h1>Queensland Warnings Summary</h1>'+
 '<p id="timestamp">This page was created at 11:32 on Thursday 12 November 2026 (UTC)</p>'+
 '<h2>Warnings current:</h2><ul><li>'+
 '<a href="/warning/severe-thunderstorm-warning/IDQ21033">Severe Thunderstorm Warning</a>'+
 '</li><li><a href="/warning/severe-thunderstorm-warning/IDQ21035">'+
 'Severe Thunderstorm Warning - Southeast Queensland</a></li></ul>'+
 '<p>Queensland verified current warning listing.</p>'.repeat(60)+'</body></html>';
const calls=[];
const fake=async(url,options)=>{
 calls.push({url:String(url),options});
 if(url.includes("/qld/warnings.shtml"))return new Response(summary,{status:200});
 if(url.includes("/3/query"))return new Response(JSON.stringify(collection),{status:200});
 if(url.includes("/2/query"))return new Response(JSON.stringify({features:[]}),{status:200});
 throw Error("Unexpected upstream request "+url);
};
const signal=await produceOfficialBoMWarningEditionSignal({fetchImpl:fake,nowMs:now});
assert.equal(signal.schema,BOM_WARNING_EDITIONS_SCHEMA);
assert.equal(WARNING_EDITION_SCHEMA,BOM_WARNING_EDITIONS_SCHEMA);
assert.equal(signal.indexStatus,"verified");
assert.deepEqual(signal.activeCodes,["IDQ21033","IDQ21035"]);
assert.equal(signal.products.IDQ21033.issuedUtc,new Date(t2).toISOString());
assert.equal(signal.products.IDQ21035.count,1);
assert.equal(signal.products.IDQ21037.count,0);
assert.equal(calls.length,3,"One Queensland CURRENT index, exactly two shared no-geometry GIS reads");
for(const call of calls.filter(x=>x.url.includes("/query"))){
 const u=new URL(call.url);
 assert.equal(u.searchParams.get("returnGeometry"),"false");
 assert.equal(u.searchParams.get("f"),"json");
 assert.equal(call.options.cf.cacheTtl,60,"Shared 60s cached GIS metadata");
}
assert(!calls.some(x=>/severeweather\.wmo\.int|spatial-gis\.information/.test(x.url)),
 "Edition heartbeat NEVER crawls national CAP or council geometries");

const statuses={IDQ21033:{status:"active",issuedUtc:new Date(t1).toISOString()},
 IDQ21035:{status:"active",issuedUtc:new Date(t1).toISOString()},
 IDQ21037:{status:"no-active"},IDQ21038:{status:"no-active"}};
const older=(code,axf,id,issue)=>({id:code+":"+new Date(issue).toISOString()+":"+id,
 productCode:code,sourceProduct:axf,issuedUtc:new Date(issue).toISOString()});
const before=[older("IDQ21033","IDQ65654","regional-old",t1),
 older("IDQ21035","IDQ65650","detail-old",t1)];
assert(hasNewOfficialBoMWarningEdition(signal,statuses,before,[]),
 "New published issue must trigger map refresh while older polygons are valid");
const currentWarn=[older("IDQ21033","IDQ65654","regional-new",t2),
 older("IDQ21035","IDQ65650","detail-new",t2)];
const cells=[{productCode:"IDQ21035",sourceProduct:"IDQ65652",
 cellSourceId:"cell-new",issuedUtc:new Date(t2).toISOString()}];
assert.equal(hasNewOfficialBoMWarningEdition(signal,statuses,currentWarn,cells),false,
 "Same published geometry and cell edition must NOT repeat heavy full fetches");
assert(hasNewOfficialBoMWarningEdition({...signal,
 activeCodes:["IDQ21033"]},statuses,currentWarn,cells),
 "Verified cancellation in CURRENT index must remove detailed polygons");
assert(hasNewOfficialBoMWarningEdition({...signal,
 products:{...signal.products,IDQ21033:{...signal.products.IDQ21033,
 count:2,sourceIds:["regional-new","regional-2"]}}},statuses,currentWarn,cells),
 "Same-issue genuine feature addition must update map and LDMG/DDMG count");
assert(hasNewOfficialBoMWarningEdition({...signal,
 products:{...signal.products,"IDQ21035:cells":{...signal.products["IDQ21035:cells"],
 sourceIds:["cell-changed"]}}},statuses,currentWarn,cells),
 "Detailed storm-cell change is independent of threat-area outline");
assert.equal(hasNewOfficialBoMWarningEdition({...signal,indexStatus:"unavailable",
 activeCodes:null},statuses,before,[]),false,
 "Unverified index cannot publish a false cancellation");
assert.equal(WARNING_EDITION_POLL_MS,60000);
assert.equal(WARNING_ACTIVE_FULL_BACKSTOP_MS,300000);
assert.equal(officialWarningRefreshInterval({products:statuses,warnings:currentWarn}),
 300000,"Active warning CAP text backstop does not wait 15 minutes");
assert.equal(officialWarningRefreshInterval({products:{
 IDQ21033:{status:"no-active"},IDQ21035:{status:"no-active"}}}),900000,
 "Verified clear returns to approved 15-minute full poll");

const src=readFileSync(new URL("../src/context-layers/bom-warning-operational-v1.js",import.meta.url),"utf8");
const worker=readFileSync(new URL("../../relay/worker.js",import.meta.url),"utf8");
const build=readFileSync(new URL("../../scripts/build-current-site.sh",import.meta.url),"utf8");
assert.match(src,/setInterval\(\(\)=>\{[\s\S]*?void checkWarningEditions\(\)/);
assert.match(src,/fetchImpl\(EDITION_SOURCE/);
assert.match(src,/if\(!toggle\.checked\|\|document\.hidden\)return/);
assert.match(src,/lastEditionTriggerAt<WARNING_EDITION_RETRY_MS/);
assert.match(src,/await refresh\(\{force:true\}\)/);
assert.match(worker,/incoming\.pathname === "\/bom-official-warning-editions"/);
assert.match(build,/20261112-live-warning-edition-watch-v1/);
console.log("PASS live warning reissue detection, new/cancelled/cell editions, 60s cached metadata watch, 5m active CAP backstop, 15m quiet baseline, no synthetic geometry or redundant national CAP crawls");
