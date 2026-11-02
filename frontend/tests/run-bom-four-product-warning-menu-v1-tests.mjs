import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 PRODUCT_FILTERS,filterOfficialWarnings,describeOfficialBomWarningState,
 warningProductAffectedGroups,isSourceMatchedOfficialWarningPolygon,
 sourceQualifiedOfficialWarnings,selectVisibleOfficialBoMGeometry
} from "../src/context-layers/bom-warning-operational-v1.js";
import {QLD_WARNING_PRODUCTS} from "../src/context-layers/bom-qld-warning-product-catalogue-v1.js";

const codes=["IDQ21035","IDQ21033","IDQ21037","IDQ21038"];
assert.deepEqual(PRODUCT_FILTERS,["all",...codes]);
assert.deepEqual(Object.keys(QLD_WARNING_PRODUCTS),codes,
 "All menu products are actual BoM original product references");
const geometry={type:"Polygon",coordinates:[[
 [151,-25],[152,-25],[152,-26],[151,-26],[151,-25]
]]};
const fixtures=codes.map((code,i)=>({
 id:code+":1",productCode:code,geometry,
 ldmgStatus:"verified",ddmgStatus:"verified",
 ldmgs:["Test council "+i],ddmgs:["District "+i]
}));
assert.equal(filterOfficialWarnings(fixtures,"all").length,4);
for(const code of codes){
 const one=filterOfficialWarnings(fixtures,code);
 assert.equal(one.length,1,"One product cannot display other warning areas");
 assert.equal(one[0].productCode,code);
 const groups=warningProductAffectedGroups(fixtures,code);
 assert.equal(groups.count,1);
 assert.equal(groups.ldmgs.length,1);
 assert.equal(groups.ddmgs.length,1);
}
// The selected product must also match its original BoM AXF geometry source.
const regional={id:"regional",productCode:"IDQ21033",sourceProduct:"IDQ65654",
 polygonProductCodes:["IDQ65654"],geometry};
const detailed={id:"detailed",productCode:"IDQ21035",sourceProduct:"IDQ65650",
 polygonProductCodes:["IDQ65650"],geometry};
const falseRegional={...detailed,id:"mislabeled-detailed",productCode:"IDQ21033"};
const rewrittenRegional={...falseRegional,polygonProductCodes:["IDQ65654"]};
const capRegional={id:"cap-regional",productCode:"IDQ21033",
 polygonProductCodes:["IDQ65654"],geometry};
assert(isSourceMatchedOfficialWarningPolygon(regional));
assert(isSourceMatchedOfficialWarningPolygon(detailed));
assert(isSourceMatchedOfficialWarningPolygon(capRegional),
 "Authentic CAP geometry without a separate GIS source remains supported");
assert(!isSourceMatchedOfficialWarningPolygon(falseRegional));
assert(!isSourceMatchedOfficialWarningPolygon(rewrittenRegional),
 "A conflicting original GIS source must override a rewritten product list");
assert(!isSourceMatchedOfficialWarningPolygon({id:"unverified",productCode:"IDQ21033",geometry}),
 "Missing BoM product provenance must fail closed");
const mixed=[detailed,regional,falseRegional,rewrittenRegional,capRegional];
assert.deepEqual(sourceQualifiedOfficialWarnings(mixed,"IDQ21033").map(w=>w.id),
 ["regional","cap-regional"],"IDQ21035 geometry cannot appear under 21033");
assert.deepEqual(sourceQualifiedOfficialWarnings(mixed,"IDQ21035").map(w=>w.id),
 ["detailed"],"Product selection is isolated in both directions");
assert.deepEqual(sourceQualifiedOfficialWarnings(mixed,"all").map(w=>w.id),
 ["detailed","regional","cap-regional"],"All contains only source-qualified warnings");
const cell={id:"cell",type:"severe-thunderstorm-cell",official:true,
 productCode:"IDQ21035",sourceProduct:"IDQ65652",geometry};
const invalidCell={...cell,id:"not-a-real-cell",sourceProduct:"IDQ65654"};
const cells=[cell,invalidCell];
assert.deepEqual(selectVisibleOfficialBoMGeometry(mixed,cells,"IDQ21033").map(w=>w.id),
 ["regional","cap-regional"],"21033 displays NO 21035 polygon or cell");
assert.deepEqual(selectVisibleOfficialBoMGeometry(mixed,cells,"IDQ21035").map(w=>w.id),
 ["detailed","cell"],"21035 displays only its own threat areas and valid cells");
assert.deepEqual(selectVisibleOfficialBoMGeometry(mixed,cells,"all").map(w=>w.id),
 ["detailed","regional","cap-regional","cell"],"All displays every verified regional/detailed polygon and cell");
assert.deepEqual(selectVisibleOfficialBoMGeometry(mixed,cells,"IDQ21033").map(w=>w.id),
 ["regional","cap-regional"],"Repeated switching All -> 21033 leaves no stale 21035 entries");
const statuses=Object.fromEntries(codes.map(code=>[code,{status:"no-active"}]));
for(const code of codes){
 const state=describeOfficialBomWarningState({products:statuses,selected:code});
 assert.match(state.message,/^No current warnings — IDQ2103[3578]/);
 assert.equal(state.kind,"normal","Verified no-current must not be an error");
}
assert.equal(describeOfficialBomWarningState({products:statuses}).message,
 "No current warnings");
for(const code of codes){
 const active={...statuses,[code]:{status:"active",count:1}};
 const message=describeOfficialBomWarningState({
  products:active,warnings:fixtures.filter(w=>w.productCode===code),selected:code
 }).message;
 assert.match(message,/active \(1 polygon\)/);
 assert(message.includes(code));
 const pending={...statuses,[code]:{status:"listed-active"}};
 assert.match(describeOfficialBomWarningState({products:pending,selected:code}).message,
  /polygon awaiting verification/);
 const missing={...statuses,[code]:{status:"unavailable"}};
 const bad=describeOfficialBomWarningState({products:missing,selected:code});
 assert(!bad.message.startsWith("No current warnings"),"Unknown is never confirmed clear");
 assert.equal(bad.kind,"warning");
}
const page=readFileSync(new URL("../live3d-operational-v9.html",import.meta.url),"utf8");
const optionBlock=page.split('<select id="officialBomWarningProduct"')[1].split("</select>")[0];
assert.equal((optionBlock.match(/<option\s/g)||[]).length,5,"All + four separate IDQ menu items");
for(const code of codes)
 assert.match(optionBlock,new RegExp('<option value="'+code+'">'));
assert(optionBlock.indexOf("IDQ21037")>optionBlock.indexOf("IDQ21033"));
assert(optionBlock.indexOf("IDQ21038")>optionBlock.indexOf("IDQ21037"));
const op=readFileSync(new URL("../src/context-layers/bom-warning-operational-v1.js",import.meta.url),"utf8");
assert.match(op,/const codes=filter\.value==="all"\?WARNING_CODES:\[filter\.value\]/);
assert(!op.includes('"other"]:[filter.value]'),"Never hide a clear 21037/38 under Other");
assert(op.includes("isSourceMatchedOfficialWarningPolygon(w));"),
 "Source-mismatched geometry is rejected when ingested");
assert(op.includes("const visible=selectVisibleOfficialBoMGeometry(warnings,stormCells,filter.value)"),
 "Map draw respects source-qualified product selection");
assert.match(op,/INTERVAL_MS=15\*60\*1000/);
assert.match(op,/now\(\)-lastAttemptAt>=currentRefreshMs\(\)\)void refresh\(\)/);
assert.match(op,/INTERVAL_MS=15\*60\*1000/);
assert.match(op,/WARNING_GEOMETRY_RECOVERY_MS=2\*60\*1000/);
assert.match(op,/missingActiveBoMWarningGeometry\(productStatuses,warnings\)/,
 "Short retries only during active warning with missing source-verified geometry");
assert.match(op,/const onRefresh=\(\)=>\{void refresh\(\{force:true\}\);\}/);
assert.match(op,/No current warnings for this product/);
console.log("PASS separate IDQ21033/35/37/38 selection, polygon isolation, independent verified no-current/report state and existing 15-minute/manual cadence");
