import assert from "node:assert/strict";
import {
 officialBoMWarningAreasOverlap,selectVisibleOfficialBoMGeometry,
 sourceQualifiedOfficialWarnings,filterOfficialWarnings,
 warningProductAffectedGroups
} from "../src/context-layers/bom-warning-operational-v1.js";

const polygon=(x1,y1,x2,y2)=>({type:"Polygon",coordinates:[[
 [x1,y1],[x2,y1],[x2,y2],[x1,y2],[x1,y1]
]]});
const warning=(code,id,geometry)=>({
 id,productCode:code,geometry,type:"severe-thunderstorm",
 polygonProductCodes:[code==="IDQ21033"?"IDQ65654":"IDQ65650"],
 sourceProduct:code==="IDQ21033"?"IDQ65654":"IDQ65650",
 ldmgStatus:"verified",ddmgStatus:"verified",
 ldmgs:[id],ddmgs:[id]
});
const regional=warning("IDQ21033","regional",polygon(150,-29,152,-27));
const distantRegional=warning("IDQ21033","distant",polygon(145,-25,146,-24));
const detailed=warning("IDQ21035","detailed",polygon(151,-28,153,-26));
const cell={id:"cell",type:"severe-thunderstorm-cell",official:true,
 productCode:"IDQ21035",sourceProduct:"IDQ65652",
 geometry:polygon(151.1,-27.8,151.2,-27.7)};
const sourceMismatch={...regional,id:"forged",productCode:"IDQ21035"};
const src=[regional,distantRegional,detailed,sourceMismatch];
assert(officialBoMWarningAreasOverlap(regional,detailed),
 "Authentic regional/detailed overlap is allowed for map context");
assert(!officialBoMWarningAreasOverlap(distantRegional,detailed));
assert.deepEqual(selectVisibleOfficialBoMGeometry(src,[cell],"IDQ21035").map(w=>w.id),
 ["regional","detailed","cell"],
 "Detailed view retains overlapping regional coverage in yellow underneath, with a separately verified red cell");
assert.deepEqual(selectVisibleOfficialBoMGeometry(src,[cell],"IDQ21033").map(w=>w.id),
 ["regional","distant"],
 "Regional view cannot include detailed geometry or a detailed storm cell");
assert.deepEqual(selectVisibleOfficialBoMGeometry(src,[cell],"all").map(w=>w.id),
 ["regional","distant","detailed","cell"],
 "All displays all source-exact warning footprints + cells");
assert.deepEqual(sourceQualifiedOfficialWarnings(src,"IDQ21035").map(w=>w.id),
 ["detailed"],"A regional footprint must never be reassigned to detailed source");
assert.equal(filterOfficialWarnings(src,"IDQ21033").length,2);
assert.equal(warningProductAffectedGroups(filterOfficialWarnings(src,"IDQ21035")).count,2,
 "Raw filtering is source product based; invalid data is excluded by source qualification at ingestion");
assert.equal(warningProductAffectedGroups(sourceQualifiedOfficialWarnings(src,"IDQ21035")).count,1);
assert.deepEqual(
 selectVisibleOfficialBoMGeometry([detailed],[cell],"IDQ21035").map(w=>w.id),
 ["detailed","cell"],"No regional warning means no borrowed region");
assert.deepEqual(
 selectVisibleOfficialBoMGeometry([regional],[cell],"IDQ21035").map(w=>w.id),
 ["cell"],"Never infer a detailed warning footprint from regional alone");
assert.deepEqual(selectVisibleOfficialBoMGeometry([regional,detailed],[],"IDQ21035").map(w=>w.id),
 ["regional","detailed"],"Missing cell source must not replace warning area");
const exactRegion=warning("IDQ21033","region-equal",detailed.geometry);
assert.deepEqual(
 selectVisibleOfficialBoMGeometry([exactRegion,detailed],[cell],"IDQ21035").map(w=>w.id),
 ["detailed","cell"],"Shared identical rings have only one visible area object");
assert.deepEqual(
 selectVisibleOfficialBoMGeometry([exactRegion,detailed],[cell],"all").map(w=>w.id),
 ["region-equal","cell"],"All view draws one of two identical source rings");
assert(officialBoMWarningAreasOverlap(polygon(150,-28,151,-27),polygon(151,-28,152,-27)),
 "Even boundary-only contact is geometrically meaningful");
assert(!officialBoMWarningAreasOverlap(
 {type:"Polygon",coordinates:[
  [[150,-29],[154,-29],[154,-25],[150,-25],[150,-29]],
  [[151,-28],[153,-28],[153,-26],[151,-26],[151,-28]]
 ]},
 polygon(151.3,-27.8,152.7,-26.2)),
 "Polygon entirely within an original hole is not an overlap");
assert(officialBoMWarningAreasOverlap(
 polygon(151,-29,152,-26),polygon(150,-28,153,-27)),
 "Crossing strips with no contained corner count as overlap");
assert(officialBoMWarningAreasOverlap(
 {type:"MultiPolygon",coordinates:[
  polygon(144,-25,145,-24).coordinates,
  regional.geometry.coordinates
 ]},detailed.geometry),
 "MultiPolygons retain all genuine constituent footprints");
assert(!officialBoMWarningAreasOverlap(null,detailed));
console.log("PASS Q-SCOPE regional/detailed shared warning-area display, exact source provenance, separated cell overlays, zero fabricated counts, topology and cancellation guards");
