import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fetchOriginalBoMFtpWarning,verifyOfficialFtpWarningCap,
 FTP_WARNING_CODES} from "../../relay/bom-warning-ftp-v1.js";
import {produceOfficialBoMWarningEditionSignal}
 from "../../relay/bom-warning-editions-v1.js";
import {hasNewOfficialBoMWarningEdition,WARNING_EDITION_SCHEMA}
 from "../src/context-layers/bom-warning-operational-v1.js";

const now=Date.parse("2026-11-12T12:48:00Z");
const previous="2026-11-12T12:22:57Z",newIssue="2026-11-12T12:45:00Z";
const original=(code,issued,{cancel=false}={})=>
'<?xml version="1.0" encoding="UTF-8"?>'+
'<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">'+
'<identifier>AusBoM-'+code+'-'+issued+'</identifier>'+
'<sender>CAP.Message@bom.gov.au</sender><sent>'+issued+'</sent>'+
'<status>Actual</status><msgType>'+(cancel?"Cancel":"Update")+'</msgType>'+
'<info><language>en-AU</language><category>Met</category>'+
'<event>Severe Thunderstorm Warning</event>'+
'<headline>'+code+' Severe Thunderstorm Warning</headline>'+
'<expires>2026-11-12T15:45:00Z</expires>'+
'<area><areaDesc>South East Queensland</areaDesc></area>'+
'</info></alert>';
assert.deepEqual(FTP_WARNING_CODES,["IDQ21033","IDQ21035","IDQ21037","IDQ21038"]);
const xml=original("IDQ21035",newIssue);
const parsed=verifyOfficialFtpWarningCap("IDQ21035",xml,{nowMs:now});
assert.equal(parsed.notice.productCode,"IDQ21035");
assert.equal(parsed.notice.issuedUtc,"2026-11-12T12:45:00.000Z");
assert.equal(parsed.notice.status,"issued");
assert.equal(parsed.warnings.length,0,"FTP issue is not a substitute for missing geometry");
assert.throws(()=>verifyOfficialFtpWarningCap("IDQ21033",xml,{nowMs:now}));
assert.throws(()=>verifyOfficialFtpWarningCap("IDQ21035",
 original("IDQ21035","2026-11-08T01:00:00Z"),{nowMs:now}));
const cancelled=verifyOfficialFtpWarningCap("IDQ21035",original(
 "IDQ21035",newIssue,{cancel:true}),{nowMs:now});
assert.equal(cancelled.notice.status,"cancelled");

let ftpReads=0;
const ftpRead=async code=>{
 ftpReads++;assert.equal(code,"IDQ21035");
 return new TextEncoder().encode(xml);
};
const verified=await fetchOriginalBoMFtpWarning("IDQ21035",{
 nowMs:now,ftpRead,cache:null});
assert.equal(ftpReads,1);
let httpsCalled="";
const originalHttps=await fetchOriginalBoMFtpWarning("IDQ21035",{
 nowMs:now,cache:null,
 fetchImpl:async(url,options)=>{
  httpsCalled=String(url);
  assert.equal(options.cf.cacheTtl,75);
  assert.equal(options.redirect,"manual");
  return new Response(xml,{status:200,headers:{"content-type":"text/xml"}});
 }
});
assert.equal(httpsCalled,"https://www.bom.gov.au/fwo/IDQ21035.cap.xml",
 "Runtime uses the original BoM HTTPS FWO product, not a hanging FTP socket");
assert.equal(originalHttps.notice.issuedUtc,new Date(newIssue).toISOString());
assert.equal(verified.notice.productCode,"IDQ21035");
assert.equal(verified.warnings.length,0);
await assert.rejects(()=>fetchOriginalBoMFtpWarning("IDQ21039",{
 nowMs:now,ftpRead,cache:null}));
assert.equal(ftpReads,1,"No unknown or arbitrary FTP commands");

const summary='<html><head><title>Queensland Warnings Summary</title></head>'+
 '<body><h1>Queensland Warnings Summary</h1><p id="timestamp">'+
 'This page was created at 12:48 on Thursday 12 November 2026 (UTC)</p>'+
 '<h2>Warnings current:</h2><ul>'+
 '<li><a href="/warning/severe-thunderstorm-warning/IDQ21035">'+
 'Severe Thunderstorm Warning - Southeast Queensland</a></li>'+
 '</ul>'+('<p>Queensland warning summary</p>'.repeat(70))+'</body></html>';
const geo={features:[]};
const fetcher=async(url)=>{
 if(String(url).includes("/qld/warnings.shtml"))
  return new Response(summary,{status:200});
 if(String(url).includes("/query"))
  return new Response(JSON.stringify(geo),{status:200});
 throw Error("No unexpected fetch");
};
let lookedUp=[];
const signal=await produceOfficialBoMWarningEditionSignal({
 fetchImpl:fetcher,nowMs:now,
 ftpCapFetcher:async(code)=>{
  lookedUp.push(code);
  return verified;
 }
});
assert.deepEqual(lookedUp,["IDQ21035"],"Only indexed active product calls FTP");
assert.equal(signal.schema,WARNING_EDITION_SCHEMA);
assert.equal(signal.products.IDQ21035.count,0,
 "Original government ArcGIS zero is never replaced by synthetic geometry");
assert.equal(signal.products.IDQ21035.bulletinIssuedUtc,
 "2026-11-12T12:45:00.000Z");
const current={IDQ21035:{
 status:"geometry-unavailable",bulletinIssuedUtc:previous,
 issuedUtc:previous},IDQ21033:{status:"no-active"},
 IDQ21037:{status:"no-active"},IDQ21038:{status:"no-active"}};
assert(hasNewOfficialBoMWarningEdition(signal,current,[],[]),
 "FTP reissue must initiate full map check even with no source geometry");
const updated={...current,IDQ21035:{...current.IDQ21035,
 bulletinIssuedUtc:signal.products.IDQ21035.bulletinIssuedUtc}};
assert.equal(hasNewOfficialBoMWarningEdition(signal,updated,[],[]),false,
 "Identical current FTP bulletin must not repeatedly trigger full refresh");
const outage=await produceOfficialBoMWarningEditionSignal({
 fetchImpl:fetcher,nowMs:now,
 ftpCapFetcher:async()=>{throw Error("FTP temporarily unavailable")}
});
assert.equal(outage.products.IDQ21035.bulletinIssuedUtc,undefined,
 "FTP source outage does not fabricate a newer warning or clear a source");
assert.equal(outage.products.IDQ21035.count,0);

const relay=readFileSync(new URL("../../relay/bom-warning-polygons-v1.js",
 import.meta.url),"utf8");
assert.match(relay,/ftpPending=Promise\.allSettled/);
assert.match(relay,/fetchOriginalBoMFtpWarning\(code,\{nowMs:now,force\}\)/);
assert.match(relay,/messageRecords\.push\(row\.value\)/);
assert.match(relay,/fetchQldBomWfsCurrentIndexGeometry/);
assert.match(relay,/reconcileLatestBoMWarnings/);
console.log("PASS: source-authentic FTP bulletin issues + safe missing geometry, index-only active reads, isolated outages, unchanged GIS geometry and automatic reissue signal");
