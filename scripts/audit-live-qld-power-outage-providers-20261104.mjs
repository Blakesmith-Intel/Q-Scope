// Read-only audit of the same three Queensland provider feeds and source
// filters used by the operator's map. Never adjust or guess official counts.
import {
  loadPowerOutages, powerOutageProviderCounts,
  powerOutageSummary
} from "../frontend/src/context-layers/power-outages-v1.js";

const snapshotStarted=Date.now();
const label=new Date(snapshotStarted).toISOString();
try {
  const source=await loadPowerOutages({nowMs:snapshotStarted});
  const report=powerOutageProviderCounts(source.reportFeatures,{
    availableProviders:source.providers,
    failedProviders:source.failedProviders
  });
  const mapped=new Set(source.payload.features.map(f=>String(f.id)));
  const byProvider=report.rows.map(row=>({
    ...row,
    mapped:source.payload.features.filter(f=>
      powerOutageSummary(f).provider===row.provider).length
  }));
  if(report.total.outages !== source.reportFeatures.length)
    throw Error("Provider report distinct-event sum differs from loaded report record count");
  if(report.total.outages - report.total.withoutGeometry !== mapped.size)
    throw Error("Statewide report and genuine mapped outage IDs do not reconcile");
  console.log("QLD_EMERGENCY_POWER_SOURCE_AUDIT",JSON.stringify({
    checkedAtUtc:label,
    checkedAtAest:new Date(snapshotStarted+10*60*60000).toISOString().replace("Z","+10:00"),
    loadedAtUtc:new Date().toISOString(),
    transport:source.transport,
    providers:byProvider,
    statewide:report.total,
    sourcePartial:source.partial,
    failedProviderLayers:source.failedProviders,
    incidentDefinition:"Distinct source EVENT_ID per provider; active UNPLANNED only",
    mapDefinition:"Only incidents with genuine source geometry are plotted",
    customerDefinition:"Sum of original reported CUSTOMERS_AFFECTED across unique events"
  }));
  if(source.partial)console.warn("QLD_EMERGENCY_POWER_AUDIT_PARTIAL: total excludes unavailable provider sources; not a statewide all-clear");
  else console.log("QLD_EMERGENCY_POWER_AUDIT_ALL_THREE_PROVIDER_FEEDS_AVAILABLE");
}catch(error){
  console.error("QLD_EMERGENCY_POWER_AUDIT_SOURCE_UNAVAILABLE",JSON.stringify({
    checkedAtUtc:label,error:String(error?.message??error)
  }));
  // This diagnostic never substitutes zero for unavailable official sources.
  // The production source status and report remain fail-closed.
}
