// One-off read-only operational audit. Never called by browser, relay or map.
// Distinguish latest EXTRACTED among displayed source records from the ArcGIS
// ProcessAudit LAST_RUN_DATE (provider processing event) and our check time.
import {loadPowerOutages,powerOutageProviderCounts} from
  "../frontend/src/context-layers/power-outages-v1.js";

const SERVICES=[
 {provider:"Energex",base:"https://services.arcgis.com/bfVzktoY0OhzQCDj/arcgis/rest/services/VwEnergexOutages/FeatureServer"},
 {provider:"Ergon",base:"https://services.arcgis.com/33eHbTVqo7gtiCE8/ArcGIS/rest/services/VwErgonOutages/FeatureServer"}
];
const aest=t=>Number.isFinite(t)&&t>0?
 new Intl.DateTimeFormat("en-AU",{
  timeZone:"Australia/Brisbane",day:"2-digit",month:"2-digit",year:"numeric",
  hour:"2-digit",minute:"2-digit",hourCycle:"h23"
 }).format(new Date(t))+" AEST":"not published";
const observed=await loadPowerOutages({});
const report=powerOutageProviderCounts(observed.reportFeatures,{
 availableProviders:observed.providers,failedProviders:observed.failedProviders
});
for(const {provider,base} of SERVICES){
 const item=report.rows.find(r=>r.provider===provider);
 let audit=null,error=null;
 try{
  const url=new URL(base+"/2/query");
  url.search=new URLSearchParams({
   where:"1=1",outFields:"LAST_RUN_DATE",
   orderByFields:"LAST_RUN_DATE DESC",resultRecordCount:"1",
   returnGeometry:"false",f:"json"
  });
  const response=await fetch(url,{signal:AbortSignal.timeout(14000)});
  if(!response.ok)throw Error("ArcGIS HTTP "+response.status);
  const json=await response.json();
  if(json.error)throw Error("ArcGIS "+json.error.message);
  const raw=json.features?.[0]?.attributes?.LAST_RUN_DATE;
  if(raw!=null&&Number.isFinite(Number(raw)))audit=Number(raw);
  else error="ProcessAudit contained no recorded LAST_RUN_DATE";
 }catch(e){error=String(e?.message??e);}
 console.log("PROVIDER_CLOCK_PROVENANCE_AUDIT",JSON.stringify({
  provider,
  dashboardCheckedAtAest:aest(Date.now()),
  activeEventCount:item?.outages??null,
  latestActiveRecordExtractedAest:aest(item?.sourceNewestAtMs),
  oldestActiveRecordExtractedAest:aest(item?.sourceOldestAtMs),
  providerProcessAuditLastRunAest:aest(audit),
  providerProcessAuditAvailable:audit!==null,
  processMinusActiveRecordMinutes:audit!==null&&item?.sourceNewestAtMs!==null?
   Number(((audit-item.sourceNewestAtMs)/60000).toFixed(1)):null,
  sourceStatus:item?.state??"unknown",
  caution:"EXTRACTED is an incident-record field, not a last-checked timestamp",
  auditError:error
 }));
}
