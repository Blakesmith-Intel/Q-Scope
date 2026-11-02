import assert from "node:assert/strict";
import {classifyPublishedBoMThunderstormHazards as classify}
 from "../src/context-layers/bom-warning-hazard-terms-v1.js";
import {sourceExactQldBomWfsFeatures} from "../../relay/bom-warning-gis2web-replica-v1.js";
import {reconcileLatestBoMWarnings} from "../../relay/bom-warning-product-reconcile-v1.js";
import {readFileSync} from "node:fs";
import {officialBoMWarningVisualStyle} from "../src/context-layers/bom-warning-terrain-imagery-v1.js";

const normal=classify({headline:"Severe Thunderstorm Warning for damaging winds, large hail and heavy rainfall"});
assert.equal(normal.level,"severe");
assert.deepEqual(normal.highEnd,[]);
assert.deepEqual(normal.codes,["W","LH","R"]);
const high=classify({description:"Destructive wind gusts, giant hailstones and intense rainfall that may lead to dangerous and life-threatening flash flooding"});
assert.equal(high.level,"high-end");
assert.deepEqual(high.codes,["W+","LH+","R+"]);
assert.deepEqual(high.highEnd,["Destructive winds","Giant hail","Intense rainfall"]);
const amoc=classify({phenomena:"W+ LH+ R+ TO"});
assert.deepEqual(amoc.highEnd,["Destructive winds","Giant hail","Intense rainfall","Tornado"]);
assert.equal(classify({phenomena:"W LH R"}).level,"severe");
assert.equal(classify({description:"The storm may bring intense lightning"}).level,"unspecified");
assert.equal(classify({description:"Damaging wind gusts 90 km/h"}).highEnd.length,0);
assert.equal(classify({description:"This is a very dangerous situation"}).level,"unspecified",
 "Unattributed language alone must not become source-verified cell or high-end hazard");
assert.equal(classify({headline:"Tornado warning"}).highEnd[0],"Tornado");

const now=Date.parse("2026-10-30T05:50:00Z");
const notice={productCode:"IDQ21033",status:"issued",
 issuedUtc:"2026-10-30T05:45:00Z",expiresUtc:"2026-10-30T08:45:00Z",
 headline:"Severe Thunderstorm Warning for DESTRUCTIVE WINDS and INTENSE RAINFALL",
 description:"Storms may produce destructive wind gusts",instruction:"Seek shelter",
 bulletinUrl:"https://www.bom.gov.au/warning/severe-thunderstorm-warning/IDQ21033"};
const poly={type:"Polygon",coordinates:[[
 [144,-25],[145,-25],[145,-26],[144,-26],[144,-25]
]]};
const geojson={type:"FeatureCollection",features:[{type:"Feature",geometry:poly,
 properties:{product:"IDQ65654",gml_id:"example",
  validfrom_utc:Date.parse("2026-10-30T05:45:00Z"),
  validto_utc:Date.parse("2026-10-30T08:45:00Z"),
  phenomena:"W+"}}]};
const source=sourceExactQldBomWfsFeatures(geojson,notice,{nowMs:now});
assert.equal(source.length,1);
assert.deepEqual(source[0].hazardAssessment.highEnd,["Destructive winds","Intense rainfall"]);
assert.equal(source[0].sourceProduct,"IDQ65654");
assert.equal(source[0].type,"severe-thunderstorm","Regional polygon is NOT a cell");
const result=reconcileLatestBoMWarnings([{notice,warnings:source}],{nowMs:now,complete:false});
assert.deepEqual(result.products.IDQ21033.hazardAssessment.highEnd,
 ["Destructive winds","Intense rainfall"]);
assert.equal(result.products.IDQ21035.status,"unavailable");

const root=new URL("../../",import.meta.url);
const ui=readFileSync(new URL("frontend/src/context-layers/bom-warning-operational-v1.js",root),"utf8");
assert.match(ui,/HIGH-END: /);
assert.match(ui,/warning-area language only, no identified individual storm cells/);
assert.match(ui,/highEnd\.join\(" · "\)/);
const imagery=readFileSync(new URL("frontend/src/context-layers/bom-warning-terrain-imagery-v1.js",root),"utf8");
assert.match(imagery,/createUnifiedBoMWarningTerrainPolygons/);
assert.equal(officialBoMWarningVisualStyle(source[0]).stroke,"#F5C427",
 "Regional warning areas remain golden yellow even for source-named destructive hazards");
assert(!/\bIDQ21033\b[^\n]*veryDangerous/.test(imagery));
console.log("PASS BoM 90/125 kmh, 2/5cm, heavy/intense, tornado escalation terms: source-verified regional high-end, never invented detailed cell identities");
