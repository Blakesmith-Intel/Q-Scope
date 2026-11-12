import assert from "node:assert/strict";
import {SES_REGION_NAMES,SES_REGION_SCHEMA,validSESRegionRegistry,
 sesRegionForStation,groupRainfallBySESRegion} from "../src/context-layers/rainfall-ses-region-v1.js";
import {buildSignificantRainfallReport} from "../src/context-layers/significant-rainfall-report-v1.js";

const registry={schema:SES_REGION_SCHEMA,sourceLayer:"SES Regions (layer 8)",
 regions:SES_REGION_NAMES,stations:{
  "544001":{latitude:-27.4,longitude:153.0,region:"Brisbane Region"},
  "544002":{latitude:-27.7,longitude:153.2,region:"South Eastern Region"},
  "544003":{latitude:-27.42,longitude:153.01,region:"Brisbane Region"}
 }};
assert(validSESRegionRegistry(registry));
assert(!validSESRegionRegistry({...registry,regions:["Brisbane Region"]}));
const row=(id,lat,lon,mm,aep,classification="meets-ifd-design-depth")=>({
 id,name:"Gauge "+id,latitude:lat,longitude:lon,mm,
 aep:{classification,aepDesignThreshold:aep}});
const items=[
 row("544001",-27.4,153.0,150,1),
 row("544002",-27.7,153.2,85,20),
 row("544003",-27.42,153.01,125,null,"below-20pct-aep"),
 row("544004",-27.43,153.03,99,5),
 row("544005",-27.44,153.0,49,10)
];
assert.equal(sesRegionForStation(items[0],registry)?.name,"Brisbane Region");
assert.equal(sesRegionForStation({...items[0],latitude:-18},registry),null);
assert.equal(sesRegionForStation(items[3],registry),null);
assert.equal(sesRegionForStation(items[0],{...registry,sourceLayer:"Wrong Layer"}),null);
const group=(mode,selected="all")=>groupRainfallBySESRegion(
 buildSignificantRainfallReport(items,mode),r=>sesRegionForStation(r,registry),selected);
const amount=group("amount");
assert.equal(amount.total,4,"50mm reporting threshold unchanged");
assert.deepEqual(amount.groups.map(g=>[g.title,g.rows.length]),[
 ["Brisbane Region",2],["South Eastern Region",1],["SES region unavailable",1]]);
assert.equal(group("aep").total,3,"AEP classification and exclusions unchanged");
assert.equal(group("amount","Brisbane Region").total,2);
assert.equal(group("amount","South Eastern Region").total,1);
assert.equal(group("amount","unavailable").total,1);
assert(amount.groups.flatMap(g=>g.rows).every(x=>x.reportingTier));
console.log("PASS SES grouping/filtering preserves station totals and AEP calculations");
