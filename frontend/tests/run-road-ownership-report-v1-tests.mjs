import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseOperationalRoadReport,parseStateHighwaysReport,
 buildRoadOwnershipSnapshot,ROAD_OWNERSHIP_SCHEMA}
 from "../../relay/road-ownership-reports-v1.js";
import {roadOwnershipClass,groupedRoadOwnershipFeatures,groupRoadClosureItemsByHazard}
 from "../src/context-layers/road-ownership-report-v1.js";
import {filterFloodRoadClosures} from "../src/context-layers/flood-road-closure-filter-v1.js";

const operational='<h1>Operational Status of QUEENSLAND Road Network</h1>'+
'<table><tr><th>ID</th><th>LGA</th><th>Locality</th><th>Road</th><th>Conditions</th>'+
'<th>Closure/Restriction Reason</th><th>Chainage start</th><th>Chainage end</th>'+
'<th>Affects state-controlled road</th><th>Dist. Affected (km)</th></tr>'+
[['834399','Yes'],['836998','No'],['837150','No'],['837739','Yes'],
 ['837739','No'],['835196','Yes']].map(([id,yn])=>'<tr><td>'+id+
'</td><td>Barcaldine</td><td>Alpha</td><td>Road</td><td>Road closed to all traffic</td>'+
'<td>Flooding</td><td>443</td><td>443</td><td>'+yn+'</td><td>90</td></tr>').join('')+'</table>';
const highways='<h1>State Controlled Highways and Motorways Report</h1>'+
'<table><tr><th></th><th>Road</th><th>Location</th><th>Extra details</th>'+
'<th>Status</th><th>Closure/Restriction Reason</th><th>Last Update</th><th>Id</th></tr>'+
[['837150','Donohue Highway'],['835196','Dawson Developmental Road']]
.map(([id,name])=>'<tr><td><img src="icon.png"></td><td>'+name+'</td><td>Toko</td>'+
'<td></td><td>Road closed to all traffic</td><td>Flooding</td>'+
'<td>27/10/2026 10:16 AM</td><td>'+id+'</td></tr>').join('')+'</table>';

const flags=parseOperationalRoadReport(operational);
assert.deepEqual(flags['834399'],{state:true,local:false,highway:false});
assert.deepEqual(flags['836998'],{state:false,local:true,highway:false});
assert.deepEqual(flags['837739'],{state:true,local:true,highway:false});
assert(parseStateHighwaysReport(highways).has('837150'));
const source=buildRoadOwnershipSnapshot(operational,highways);
assert.equal(source.schema,ROAD_OWNERSHIP_SCHEMA);
assert.equal(roadOwnershipClass('834399',source),'state');
assert.equal(roadOwnershipClass('836998',source),'local');
assert.equal(roadOwnershipClass('837150',source),'state',
 'Official highway ID overrides an operational No entry, e.g. Donohue Highway');
assert.equal(roadOwnershipClass('837739',source),'unverified',
 'Conflicting Yes/No segment flags must not be mislabelled');
assert.equal(roadOwnershipClass('999999',source),'unverified');
assert.equal(roadOwnershipClass('834399',null),'unverified');
assert.throws(()=>parseOperationalRoadReport('<h1>Other roads</h1>'),/unverified/);
assert.throws(()=>parseStateHighwaysReport('<h1>Other roads</h1>'),/unverified/);
function feature(id){
 return {type:'Feature',properties:{id,
  road_summary:{road_name:'Road '+id,local_government_area:'Barcaldine Regional'},
  event_type:'Flooding',event_subtype:'Flash flooding',
  impact:{impact_type:'Closures',impact_subtype:'Road closed to all traffic'}}};
}
const live=[feature(834399),feature(836998),feature(837150),
 feature(837739),feature(555555),feature(834399),feature(835196)];
const groups=groupedRoadOwnershipFeatures(live,source);
assert.equal(groups.state.length,3);
assert.equal(groups.local.length,1);
assert.equal(groups.unverified.length,2);
assert.equal(groups.state.length+groups.local.length+groups.unverified.length,6);
assert.equal(groupedRoadOwnershipFeatures(live,null).unverified.length,6);
// Must not promote planned restrictions (even on state highways).
const planned=feature(834235);
planned.properties.event_type='Roadworks';
planned.properties.event_subtype='Planned roadworks';
const filtered=filterFloodRoadClosures({type:'FeatureCollection',
 features:[...live,planned]},Date.parse('2026-10-27T20:00:00+10:00'));
assert(!filtered.features.some(f=>f.properties.id===834235),
 'Existing unplanned-only filter must reject planned highway works');
// Group the existing report items, with one event ID only. Source hierarchy
// and road ownership remain independent; missing causes stay explicit.
const hazards=groupRoadClosureItemsByHazard([
 {id:"1",summary:{eventType:"Hazard",eventSubtype:"Poor visibility",eventDueTo:"Smoke"}},
 {id:"2",summary:{eventType:"hazard",eventSubtype:"poor visibility",eventDueTo:" smoke "}},
 {id:"1",summary:{eventType:"Hazard",eventSubtype:"Fire"}},
 {id:"3",summary:{eventType:"Flooding",eventSubtype:"Flash flooding",eventDueTo:"Water over road"}},
 {id:"4",summary:{eventType:"Flooding",eventSubtype:"Long-term flooding",eventDueTo:"Heavy rain"}},
 {id:"5",summary:{eventType:"Hazard",eventSubtype:"Fire"}},
 {id:"6",summary:{}},
]);
assert.equal(hazards[0].name,"Poor visibility — Smoke");
assert.equal(hazards[0].items.length,2);
assert.equal(hazards.reduce((sum,h)=>sum+h.items.length,0),6);
assert(hazards.some(h=>h.name==="Flash flooding — Water over road"));
assert(hazards.some(h=>h.name==="Long-term flooding — Heavy rain"));
assert(hazards.some(h=>h.name==="Fire"));
assert(hazards.some(h=>h.name==="Cause not supplied"));
// All official unplanned hazard categories already pass the same full closure
// predicate; lane restrictions, expired events, and planned works do not.
const candidates=[
 ["Hazard","Fire",""],["Hazard","Debris on road","Fallen vegetation"],
 ["Hazard","Adverse driving conditions","High winds"],
 ["Hazard","Bridge or culvert damaged",""],["Hazard","Road damage","Earlier flooding"],
 ["Hazard","Poor visibility","Smoke"],["Hazard","Debris on road","Spill"],
 ["Hazard","Signal fault","Lights blacked out"],["Hazard","Emergency roadworks",""],
 ["Flooding","Flash flooding","Water over road"]
].map(([event_type,event_subtype,event_due_to],i)=>{
 const f=feature(850000+i);
 Object.assign(f.properties,{status:"Published",event_type,event_subtype,event_due_to});return f;
});
assert.equal(filterFloodRoadClosures({features:candidates}).features.length,candidates.length);
assert.equal(filterFloodRoadClosures({features:candidates.map(f=>({...f,properties:{...f.properties,
 impact:{impact_type:"Closures",impact_subtype:"Lane closed"}}}))}).features.length,0);
const html=readFileSync(new URL('../live3d-operational-v9.html',import.meta.url),'utf8');
for(const id of ['openRoadTypeReport','roadTypeReport','roadTypeSearch',
 'roadTypeResults','roadTypeSummary','backRoadTypeReport','roadTypeGrouping']){
 assert(html.includes('id="'+id+'"'),'Missing report control '+id);
}
const build=readFileSync(new URL('../../scripts/build-current-site.sh',import.meta.url),'utf8');
assert(build.includes('"road-ownership-report-v1.js"'));
assert(build.includes('road-ownership-report-20261027-v1'));
const worker=readFileSync(new URL('../../relay/worker.js',import.meta.url),'utf8');
assert(worker.includes('incoming.pathname === "/road-ownership-report"'));
console.log('PASS event-ID-only QLDTraffic state/local/highway report with conflict handling and existing closure filtering');
