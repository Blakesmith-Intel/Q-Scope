import {formatAgencyTimestamp} from "./agency-source-time-v1.js?v=20261027-agency-panels-v1";
import {buildNotableFloodGaugeReport,FLOOD_CROSSINGS_SCHEMA}
 from "./river-gauge-notable-report-v1.js?v=20261024-notable-crossings-v1";
import {addOfficialSourceRow,bomGaugePlotUrl,OFFICIAL_SOURCE_LINKS} from "./official-source-links-v1.js?v=9.13.2";
import {
  createRiverGaugeLayer,
  createRiverGaugeMarkerImage,
  riverGaugeOperationalSummary
} from "./river-gauge-layer-v1.js?v=9.18.11-flood-colour-20261015-uniform-v10.2.22-safari-bitmap";

import {
  BOM_RIVER_TIDE_GAUGE_ATTRIBUTION
} from "./river-gauges-v1.js?v=9.12.0";

const $ = id =>
  document.getElementById(
    id
  );

// The compact Layers button reuses the same snapshot refresh as the 10-minute
// poll. Prevent duplicate taps, retain status/error reporting from the layer,
// and restore the control even if BoM is temporarily unavailable.
export function bindRiverGaugeManualRefresh(button, refresh) {
  if(!button)return false;
  button.addEventListener("click",async()=>{
    if(button.disabled)return;
    button.disabled=true;
    button.setAttribute("aria-busy","true");
    const originalText=button.textContent;
    button.textContent="Refreshing…";
    try{await refresh();}
    catch{/* createRiverGaugeLayer.refresh already publishes the error status */}
    finally{
      button.textContent=originalText;
      button.setAttribute("aria-busy","false");
      button.disabled=false;
    }
  });
  return true;
}

// Presentation only: retain authoritative source errors and diagnostics,
// but do not treat the absence of OPTIONAL station rise history as a
// broken live BoM bulletin. No gauge classification or source logic here.
export function formatFloodGaugeOperatorStatus({
  kind="normal",message="",count,
  partial=false,failedProducts=[],staleOfficial=0,metadataFallback=false,
  metadataCoverage=null,
  screeningIncomplete=0,historyScreeningAlertsAffected=0,
  historyRetainedStationSamples,historyLoaded,historyFailed,historyNoData,
  historySourceMissing=0
}={}){
  const raw=message||"BoM · live river heights";
  if(!Number.isInteger(count)||count<0||kind==="error"||kind==="loading"||
     kind==="normal")
    return {main:raw,kind,summary:"",details:[]};

  const affected=Math.max(0,Math.min(count,Number(historyScreeningAlertsAffected)||0));
  const gaps=Math.max(0,Number(screeningIncomplete)||0);
  const issues=[];
  if(partial)issues.push(
    `BoM height feed partial${Array.isArray(failedProducts)&&failedProducts.length?
      ` (${failedProducts.length} bulletin product${failedProducts.length===1?"":"s"} unavailable)`:""}`);
  if(staleOfficial>0)issues.push(
    `${staleOfficial} last-confirmed flood stage${staleOfficial===1?"":"s"} with stale observations`);
  if(metadataFallback){
    const c=metadataCoverage;
    if(Number.isInteger(c?.matched)&&Number.isInteger(c?.total)&&
       c.matched>=0&&c.total>c.matched)
      issues.push(`station locations verified: ${c.matched}/${c.total} (partial coverage)`);
    else issues.push("station reference recovery in use");
  }
  // Preserve any otherwise unexplained source warning, but don't colour a
  // routine missing 30–120-minute optional history check amber.
  if(kind==="warning"&&!issues.length&&!gaps&&!historySourceMissing&&
     !historyFailed&&!historyNoData)issues.push("source status requires attention");

  const main=`Flood gauges · ${count} signal${count===1?"":"s"} · `+
    (issues.length?issues.join(" · "):"Monitoring active");
  const summary=affected
    ?`${affected} signal${affected===1?"":"s"} awaiting additional rise-rate history · View data coverage`
    :"View data coverage";
  const details=[
    `Statewide rise-rate history: ${gaps} eligible gauge${gaps===1?"":"s"} awaiting enough recent verified observations (30–120-minute comparison).`,
    `Active flood signals affected: ${affected} of ${count}. These are not additional flood alerts.`
  ];
  if(Number.isInteger(historyRetainedStationSamples))
    details.push(`Stations with retained observations: ${historyRetainedStationSamples}.`);
  if(Number.isInteger(historyLoaded))
    details.push(`Station tables loaded in latest retrieval pass: ${historyLoaded}.`);
  if(Number.isInteger(historyNoData)&&historyNoData)
    details.push(`Station tables without recent observations in latest pass: ${historyNoData}.`);
  if(Number.isInteger(historyFailed)&&historyFailed)
    details.push(`Station-history retrieval failures in latest pass: ${historyFailed}.`);
  if(historySourceMissing)
    details.push(`Eligible stations without a verified history link: ${historySourceMissing}.`);
  details.push("Official BoM flood stages remain independent of optional measured rise-rate screening. Follow current BoM warnings.");
  details.push("Full source diagnostics: "+raw);
  return {main,kind:issues.length?"warning":"ok",summary,details};
}

// Background history completion cannot replace a genuine failed live
// bulletin/metadata check with a green monitoring status. Clear only after
// a successful *live* source refresh, never merely a history-cache hit.
let lastLiveGaugeSourceFailure=null;
function setRiverGaugeStatus(status={}) {
  if(status.kind==="error")lastLiveGaugeSourceFailure=status.message;
  else if(Number.isFinite(status.loadedAt)&&status.loadedAt>0&&
          Number.isInteger(status.count))
    lastLiveGaugeSourceFailure=null;
  const effective=lastLiveGaugeSourceFailure&&status.kind!=="error"&&
    status.kind!=="loading"
    ?{kind:"error",message:lastLiveGaugeSourceFailure}:status;
  const view=formatFloodGaugeOperatorStatus(effective);
  // Keep the operator status visible in Severe Weather even though the old
  // advanced dashboard diagnostics are hidden in the four-section menu.
  const row=$("showRiverGauges")?.closest(".river-gauge-row");
  let visible=$("floodGaugeInlineStatus");
  if(row?.parentElement&&!visible){
    visible=document.createElement("div");
    visible.id="floodGaugeInlineStatus";
    visible.className="note flood-gauge-inline-status";
    visible.setAttribute("role","status");
    visible.setAttribute("aria-live","polite");
    visible.style.cssText="font-size:11px;line-height:1.45;margin:5px 0;overflow-wrap:anywhere";
    row.insertAdjacentElement("afterend",visible);
  }
  let coverage=$("floodGaugeCoverageDetails");
  if(visible?.parentElement&&!coverage){
    coverage=document.createElement("details");
    coverage.id="floodGaugeCoverageDetails";
    coverage.setAttribute("aria-label","Flood-gauge data coverage and retrieval details");
    coverage.style.cssText="font-size:10px;line-height:1.45;margin:3px 0 7px;overflow-wrap:anywhere";
    const summary=document.createElement("summary");
    summary.id="floodGaugeCoverageSummary";
    summary.style.cssText="cursor:pointer;list-style-position:inside";
    const content=document.createElement("div");
    content.id="floodGaugeCoverageContent";
    content.style.cssText="margin:5px 0 0 10px;white-space:pre-line";
    coverage.append(summary,content);
    visible.insertAdjacentElement("afterend",coverage);
  }
  for(const target of [$("riverGaugeStatus"),visible]){
    if(!target)continue;
    target.textContent=view.main;
    target.dataset.kind=view.kind;
    if(target===visible)target.style.color=
      view.kind==="error"?"#f2ab9f":view.kind==="warning"?"#f2d39d":"";
  }
  if(coverage){
    coverage.hidden=!view.details.length;
    if(view.details.length){
      const summary=$("floodGaugeCoverageSummary");
      const content=$("floodGaugeCoverageContent");
      if(summary)summary.textContent=view.summary;
      if(content)content.textContent=view.details.join("\n");
      // Never reset the user's expanded/collapsed choice on refresh.
    }
  }
}

function labelFloodClass(
  value
) {
  const text =
    String(
      value ?? ""
    ).trim();

  if (!text) {
    return "";
  }

  if (
    text === "below-minor"
  ) {
    return "Below minor";
  }

  return (
    text.charAt(0)
      .toUpperCase()
    + text.slice(1)
  );
}

function labelTendency(
  value
) {
  const text =
    String(
      value ?? ""
    ).trim();

  return text
    ? (
        text.charAt(0)
          .toUpperCase()
        + text.slice(1)
      )
    : "";
}

function addDetailRow(
  container,
  label,
  value
) {
  const text =
    String(
      value ?? ""
    ).trim();

  if (!text) {
    return;
  }

  const labelNode =
    document.createElement(
      "span"
    );

  labelNode.textContent =
    label;

  const valueNode =
    document.createElement(
      "strong"
    );

  valueNode.textContent =
    text;
  if(label==="Flood class")valueNode.classList.add("river-gauge-classification-value");
  if(label==="Rapid rise / flash-flood potential")
    valueNode.classList.add("river-gauge-rise-value");

  container.append(
    labelNode,
    valueNode
  );
}

// The selected gauge panel uses the EXACT marker renderer and current BoM
// flood category from the map. Its blue arrow is never a separate warning
// colour; rate-only tidal change does not qualify for that modifier.
export function riverGaugePanelAppearance(summary) {
  const state=["minor","moderate","major","crossing","unverified","elevated"].includes(summary?.displayState)
    ? summary.displayState:"rapid-rise";
  const rise=Boolean(summary?.rapidRise) || state==="rapid-rise";
  const reached=Boolean(summary?.crossingReached);
  const category=state==="rapid-rise"
    ? "RAPID RISE BELOW MINOR · SCREENING"
    : state==="crossing"
      ? "PUBLISHED CROSSING HEIGHT REACHED · ROAD STATUS UNCONFIRMED"
    : state==="elevated"
      ? (reached?"PUBLISHED CROSSING LEVEL REACHED · MONITORING":
         "POST-RISE ELEVATED WATER · MONITORING")
    : state==="unverified"
      ? "LATEST HEIGHT · FLOOD CLASS UNVERIFIED"
    : summary?.classificationUnverified
      ? "LAST CONFIRMED BOM "+state.toUpperCase()+
        " · CURRENT FLOOD CLASS UNVERIFIED"
      : "BOM "+state.toUpperCase()+" FLOOD"+(rise?" · RAPID RISE":"");
  return {
    state,
    rapidRise:rise,
    category:category+(reached&&state!=="elevated"?" · CROSSING LEVEL REACHED":"")+
      (summary?.observationStale?" · LAST CONFIRMED, STALE":""),
    image:createRiverGaugeMarkerImage(state,rise)
  };
}

// A published approaches reference is a road-height measurement, not a
// bridge height or an official road closure. Keep the flood-stage marker
// unchanged and show the measured excess independently in the gauge panel.
function formatRoadReferenceObservationTime(utcMs){
  return typeof utcMs==="number"&&Number.isFinite(utcMs)&&utcMs>0
    ?formatAgencyTimestamp(utcMs,"bom-gauge"):"";
}

export function riverGaugeRoadReferenceRows(summary){
  const level=summary?.crossingLevelMetres;
  if(typeof level!=="number"||!Number.isFinite(level))return [];
  const approaches=summary?.crossingType==="A"||summary?.crossingType==="R";
  const height=summary?.heightMetres;
  const hasHeight=typeof height==="number"&&Number.isFinite(height);
  const stale=Boolean(summary?.observationStale);
  const observedAt=formatRoadReferenceObservationTime(summary?.officialObservedAt);
  // A stale but valid observation still establishes the water depth AT THAT
  // observation time. It does not establish the current level or a road closure.
  // The live marker's crossingReached flag remains independently freshness-gated.
  let status;
  if(stale&&hasHeight){
    const difference=height-level;
    const measured=difference>=0
      ?difference.toFixed(2)+
        (approaches?" m over published approaches level":" m above published reference")
      :Math.abs(difference).toFixed(2)+
        (approaches?" m below published approaches level":" m below published reference");
    status="Last measured "+measured+
      (observedAt?" as at "+observedAt:" (observation time unavailable)")+
      " · STALE — current level unverified · NOT confirmation of road closure";
  }else if(stale){
    status="Last valid height unavailable — current exceedance unverified";
  }else if(hasHeight&&summary?.crossingReached&&height>=level){
    status=(height-level).toFixed(2)+
      (approaches?" m over published approaches level":" m above published reference")+
      " · NOT confirmation of road closure";
  }else{
    status=approaches?"Approaches level not currently exceeded"
      :"Published reference not currently exceeded";
  }
  return [
    [approaches?"BoM published approaches level":"BoM published crossing level",
      (summary.crossingName||(approaches?"Approaches":"Crossing"))+" · "+
      level.toFixed(2)+" m"],
    [approaches?"Approaches reference source":"Crossing reference source",
      summary.crossingSource||"BoM crossing reference"],
    [approaches?"Water over approaches":"Crossing status",status]
  ];
}

function showRiverGaugeInfo(
  feature
) {
  const panel =
    $("riverGaugeInfo");

  const rows =
    $("riverGaugeInfoRows");

  const title =
    $("riverGaugeInfoTitle");

  const kicker =
    $("riverGaugeInfoKicker");

  if (
    !panel
    || !rows
    || !title
  ) {
    return;
  }

  if (!feature) {
    panel.hidden =
      true;

    panel.dataset
      .gaugeId =
      "";
    panel.dataset.gaugeState = "";
    panel.dataset.rapidRise = "false";
    return;
  }

  const summary =
    riverGaugeOperationalSummary(
      feature
    );

  $("floodRoadClosureInfo")
    ?.setAttribute(
      "hidden",
      ""
    );

  $("powerOutageInfo")
    ?.setAttribute(
      "hidden",
      ""
    );

  $("qfdTechnicalRescueInfo")?.setAttribute("hidden","");

  panel.dataset
    .gaugeId =
    summary.id;

  const appearance=riverGaugePanelAppearance(summary);
  panel.dataset.gaugeState=appearance.state;
  panel.dataset.rapidRise=String(appearance.rapidRise);

  title.textContent=summary.name;
  if(kicker)kicker.textContent=appearance.category;
  const pin=panel.querySelector(".river-gauge-key");
  if(pin){
    // Replace obsolete generic circle with the same SVG used on Cesium.
    const icon=document.createElement("img");
    icon.src=appearance.image;
    icon.alt="";
    icon.setAttribute("aria-hidden","true");
    pin.replaceChildren(icon);
  }

  rows.replaceChildren();

  addDetailRow(
    rows,
    "Height",
    summary.heightMetres
      === null
      ? ""
      : `${summary.heightMetres.toFixed(2)} m`
  );

  addDetailRow(rows, "Signal", summary.alertReason);
  for(const [label,value] of riverGaugeRoadReferenceRows(summary))
    addDetailRow(rows,label,value);
  if(summary.alertPersisted){
    addDetailRow(rows,"Event state",
      `Monitoring · ${summary.recoveryReadings}/2 recovery observations confirmed`);
    if(typeof summary.recoveryBaselineMetres==="number")
      addDetailRow(rows,"Measured pre-rise reference",
        `${summary.recoveryBaselineMetres.toFixed(2)} m · same gauge, not an official flood threshold`);
  }

  // Every visible station reports a signed 30-minute change, or explains
  // why it cannot be calculated. Never hide missing data or invent a rate.
  const measuredRate=summary.riseRateMetresPerHour;
  addDetailRow(rows, "Measured rise / fall",
    typeof measuredRate==="number"&&Number.isFinite(measuredRate)
      ? `${measuredRate>0?"+":""}${measuredRate.toFixed(2)} m/hour`
      : "Rate unavailable — insufficient recent observations");

  addDetailRow(rows, "Rise interval",
    summary.rateIntervalMinutes === null ? "" :
      `${Math.round(summary.rateIntervalMinutes)} min`);

  addDetailRow(rows, "Historic tidal rise P90",
    summary.tidalBaselineMetresPerHour === null ? "" :
      `${summary.tidalBaselineMetresPerHour.toFixed(2)} m/hour`);

  addDetailRow(rows, "Tendency",
    labelTendency(
      summary.tendency
    )
  );

  // Every gauge information panel gets a sourced threshold row.
  // Only actual BoM-published station stages can be numbers; missing source
  // levels are NEVER filled from a similarly named or nearby station.
  const thresholds=summary.floodThresholds??{};
  const fmt=n=>typeof n==="number"&&Number.isFinite(n)?
    n.toFixed(2)+" m":"not published";
  addDetailRow(rows,"BoM flood thresholds",
    thresholds.minor===null&&thresholds.moderate===null&&
    thresholds.major===null?
      summary.thresholdStatus==="2026-data-only"
        ? "BoM 2026 data-only gauge — no defined flood classification"
        : "2026 station level/datum not verified — flood colour not inferred":
      "Minor "+fmt(thresholds.minor)+" · Moderate "+
        fmt(thresholds.moderate)+" · Major "+fmt(thresholds.major));
  addDetailRow(rows,"Flood stage reference",
    summary.thresholdStatus==="2026-ahd-converted"
      ? "AHD · station 540097 · BoM 4/5/6 m stages adjusted by documented 48.85 m datum offset"
      : summary.thresholdStatus==="2026-station-native"
      ? "BoM SLS v3.7 · exact station ID · native station reported metres"
      : summary.thresholdStatus==="historical-exact-id-caution"
        ? "BoM 2022 exact-ID legacy classification · 2026 classification unavailable"
        : "No station/datum-verified current threshold");
  if(summary.gaugeIdentityWarning)
    addDetailRow(rows,"Station ID conflict",summary.gaugeIdentityWarning);
  addDetailRow(
    rows,
    "Flood class",
    summary.alertSource==="bom-station-threshold"?
      labelFloodClass(summary.displayState)+" (measured height)":
    summary.alertSource==="bom-uncorroborated-cache"?
      "Unverified — source history contradicts cached flood reading":
    summary.classificationUnverified
      ? "Not supplied with latest measured height"
      : labelFloodClass(summary.floodClass)
  );
  if(summary.classificationUnverified){
    const confirmed=summary.lastConfirmedFloodAt
      ? formatAgencyTimestamp(summary.lastConfirmedFloodAt,"bom-gauge") : "time unavailable";
    addDetailRow(rows,"Last confirmed flood class",
      summary.lastConfirmedFloodClass.toUpperCase()+" · "+confirmed+
      " · NOT reconfirmed by current BoM bulletin");
  }
  addDetailRow(rows,"Rapid rise / flash-flood potential",
    appearance.rapidRise
      ? "Measured rapid rise · screening indicator, not a BoM flash-flood warning"
      : summary.tidalScreened
        ? "Tidal influence · rate-only alerts excluded"
        : "Not indicated by current measured observations");

  if(summary.observationStale)
    addDetailRow(rows,"Observation freshness",
      "STALE measured height — current water level unverified; await a newer observation.");
  addDetailRow(
    rows,
    "Tidal context",
    summary.tidalContext
  );

  addDetailRow(
    rows,
    "Observed",
    summary.officialObservedAt
      ?formatAgencyTimestamp(summary.officialObservedAt,"bom-gauge")
      :summary.observedText
  );

  addDetailRow(
    rows,
    "Basin",
    summary.basin
  );

  addDetailRow(
    rows,
    "Forecast site",
    summary
      .forecastSiteClassification
  );

  addDetailRow(
    rows,
    "Agency",
    summary.agency
  );

  addDetailRow(
    rows,
    "BoM station",
    summary.bomStationNumber
  );

  addDetailRow(
    rows,
    "AWRC station",
    summary.awrcStationId
  );

  addDetailRow(
    rows,
    "Product",
    summary.sourceProduct
  );

  addOfficialSourceRow(
    rows,"Source",BOM_RIVER_TIDE_GAUGE_ATTRIBUTION,
    OFFICIAL_SOURCE_LINKS.bom
  );
  const directPlot=bomGaugePlotUrl(summary.recentDataHref);
  addOfficialSourceRow(rows,"BoM gauge",
    directPlot?"View recent observations and river-height plot":"View BoM river-height station data",
    directPlot||OFFICIAL_SOURCE_LINKS.bom);

  addDetailRow(rows,"Interpretation",
    appearance.state==="rapid-rise"
      ? "Measured rapid-rise screening only. Potential flash flooding is not an official BoM warning."
      : appearance.state==="crossing"
        ? "Fresh measured water has reached the same station's published bridge/road/causeway reference. Road inundation or closure is NOT confirmed; check QLDTraffic and local authorities."
      : appearance.state==="elevated"
        ? "Post-rise water remains under observation until two distinct current readings return near this gauge\u0027s pre-rise reference. Not an official minor flood level."
      : summary.classificationUnverified
        ? "Height and time refer to the newest verified reading. Marker colour is the LAST confirmed flood classification, not a current BoM classification; consult official warnings."
        : "Current BoM flood classification controls colour. The blue arrow only appears for independent qualifying measured rapid rise; consult BoM warnings.");

  panel.hidden =
    false;
}

export function riverGaugeEntityFromPick(
  picked
) {
  return (
    picked?.id
    ?? picked?.primitive?.id
    ?? null
  );
}

export function riverGaugeIdFromPick(
  picked
) {
  const entity =
    riverGaugeEntityFromPick(
      picked
    );

  const id =
    entity
      ?.stormTrackerRiverGaugeId;

  return id
    ? String(id)
    : "";
}

function gaugeIdNearPosition({
  viewer,
  position,
  width =
    28,
  height =
    28
}) {
  if (
    !viewer
    || !position
  ) {
    return "";
  }

  const picks =
    typeof viewer.scene
      .drillPick
      === "function"
      ? viewer.scene
          .drillPick(
            position,
            24,
            width,
            height
          )
      : [];

  for (
    const picked
    of picks
  ) {
    const id =
      riverGaugeIdFromPick(
        picked
      );

    if (id) {
      return id;
    }
  }

  return riverGaugeIdFromPick(
    viewer.scene.pick(
      position,
      width,
      height
    )
  );
}

export function initialiseOperationalRiverGauges({
  viewer,
  CesiumRef =
    globalThis.Cesium
} = {}) {
  if (
    !viewer
    || !CesiumRef
  ) {
    throw new Error(
      "Operational river-gauge UI requires Cesium and a viewer."
    );
  }

  // Use the exact SVG marker artwork as the map and gauge information panel.
  // Legend is display-only; never changes gauge state, queries or layers.
  const floodLegend=$("riverGaugeSeverityLegend");
  for(const icon of floodLegend?.querySelectorAll("img[data-flood-legend-state]")??[]){
    const state=icon.dataset.floodLegendState;
    const rapid=icon.dataset.floodLegendRapidRise==="true";
    icon.src=createRiverGaugeMarkerImage(state,rapid);
    icon.width=24;
    icon.height=27;
  }

  const checkbox =
    $("showRiverGauges");

  const panel =
    $("riverGaugeInfo");

  const reportDialog=$("floodGaugeReport");
  const reportRows=$("floodGaugeReportRows");
  const reportSummary=$("floodGaugeReportSummary");
  const reportStatus=$("floodGaugeReportStatus");
  let crossingCatalogue=null,crossingLoading=null,crossingRetryAfter=0;

  const timeAest=at=>at?formatAgencyTimestamp(at,"bom-gauge"):"unknown time";
  function renderFloodGaugeReport(){
    if(!reportDialog?.open||!reportRows||!reportSummary||!reportStatus)return;
    const now=Date.now();
    const snapshot=buildNotableFloodGaugeReport(layer.sourceFeatures,
      crossingCatalogue,now);
    const crossingCoverage=layer.crossingCoverage;
    reportRows.replaceChildren();
    const last=layer.lastLoadedAt;
    const checked=last?"Checked "+timeAest(last):"Awaiting BoM observations";
    reportStatus.textContent=checked+(crossingCatalogue?
      " · BoM Section 5 crossing levels loaded":
      crossingLoading?" · Loading official crossing references…":
      snapshot.crossingSourceAvailable?
      " · Verified station-plot crossing levels available":
      " · Crossing reference unavailable")+
      (crossingCoverage.pending?
       " · "+crossingCoverage.pending+" station references still unresolved"+
         (crossingCoverage.checking?" · checking all available sources…":"")+
         (crossingCoverage.retryPending?
          " · "+crossingCoverage.retryPending+" awaiting source retry":""):
       crossingCoverage.sourceMissing?
         " · All available station pages checked; "+
         crossingCoverage.sourceMissing+" without a verifiable source link":
         " · All eligible station sources checked");
    reportSummary.textContent=snapshot.total+" qualifying gauge"+
      (snapshot.total===1?"":"s")+" · "+snapshot.groups[0].rows.length+
      " major · "+snapshot.groups[1].rows.length+" moderate"+
      (snapshot.crossingSourceAvailable?" · "+snapshot.crossedCount+
      " with fresh readings at/above published crossings":" · crossing checks unavailable")+
      (snapshot.lastConfirmedCrossedCount?
       " · "+snapshot.lastConfirmedCrossedCount+
         " LAST CONFIRMED above crossing (reading stale)":"")+
      (snapshot.excludedStaleCount?" · "+snapshot.excludedStaleCount+
       " stale/unverified readings excluded":"");
    if(!last){
      const note=document.createElement("p");
      note.className="rainfall-report-empty";
      note.textContent="River observations are loading. Use Refresh to request current BoM data.";
      reportRows.append(note);
      return;
    }
    for(const group of snapshot.groups){
      const section=document.createElement("section");
      section.className="rainfall-report-group";
      const title=document.createElement("h3"),name=document.createElement("span"),
        count=document.createElement("span");
      name.textContent=group.title;
      count.className="rainfall-report-count";
      count.textContent=group.rows.length+" gauge"+(group.rows.length===1?"":"s");
      title.append(name,count);section.append(title);
      if(!group.rows.length){
        const empty=document.createElement("p");
        empty.className="rainfall-report-empty";
        empty.textContent=group.key==="crossing"&&!snapshot.crossingSourceAvailable?
          "Crossing reference unavailable; results cannot be verified.":
          "No qualifying gauges in this category.";
        section.append(empty);
      }else{
        const list=document.createElement("ul");
        for(const station of group.rows){
          const item=document.createElement("li"),top=document.createElement("div"),
            name=document.createElement("strong"),height=document.createElement("span");
          top.className="rainfall-report-entry";
          name.textContent=station.name;
          height.className="rainfall-report-mm";
          height.textContent=station.heightMetres.toFixed(2)+" m";
          top.append(name,height);item.append(top);
          const meta=document.createElement("div");
          meta.className="rainfall-report-meta";
          meta.textContent=(station.observationStale?
            "LAST CONFIRMED — STALE READING, NOT CURRENT STATUS · ":"")+
            station.id+" · "+
            (station.floodClass==="unclassified"?"No current official flood class":
             station.floodClass.charAt(0).toUpperCase()+station.floodClass.slice(1))+
            " · "+(station.tendency||"tendency not supplied")+
            " · "+timeAest(station.observedAt);
          item.append(meta);
          if(station.bridgeOrCausewayReached&&station.crossing){
            const crossing=document.createElement("div");
            crossing.className="flood-report-crossing";
            crossing.textContent=station.crossing.name+" · published "+
              station.crossing.levelMetres.toFixed(2)+" m · "+
              (station.observationStale?"last measured ":"current ")+
              station.heightMetres.toFixed(2)+" m ("+
              station.crossing.amountAboveMetres.toFixed(2)+" m above reference)";
            item.append(crossing);
          }
          list.append(item);
        }
        section.append(list);
      }
      reportRows.append(section);
    }
  }
  async function loadCrossingReference(){
    if(crossingCatalogue||crossingLoading)return crossingLoading;
    if(Date.now()<crossingRetryAfter)return null;
    crossingLoading=(async()=>{
      try{
        const response=await fetch(
          "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/river-crossing-heights",
          {signal:AbortSignal.timeout(20000),cache:"default"});
        if(!response.ok)throw Error("Crossing reference HTTP "+response.status);
        const data=await response.json();
        if(data?.schema!==FLOOD_CROSSINGS_SCHEMA||
           !data?.entries||Object.keys(data.entries).length<40||
           data.sourceDate!=="2022-01-05")
          throw Error("Published crossing catalogue failed validation");
        crossingCatalogue=data;
        layer.setCrossingCatalogue(data);
      }catch(error){
        console.warn("Official bridge/causeway reference unavailable:",error);
        crossingRetryAfter=Date.now()+15*60000;
      }finally{
        crossingLoading=null;
        renderFloodGaugeReport();
      }
    })();
    return crossingLoading;
  }
  function openFloodGaugeReport(){
    if(!reportDialog)return;
    if(!reportDialog.open)reportDialog.showModal();
    renderFloodGaugeReport();
    void loadCrossingReference();
    // Refresh the observations first when missing/stale, THEN complete all
    // available source checks. Never start a zero-station scan on cold load.
    const source=(!layer.lastLoadedAt||Date.now()-layer.lastLoadedAt>10*60000)
      ?layer.refresh():Promise.resolve();
    void source.then(()=>layer.checkCrossingReferences())
      .catch(error=>console.warn("BoM source coverage incomplete:",error))
      .finally(renderFloodGaugeReport);
  }

  const canvas =
    viewer.scene.canvas;

  const mapContainer =
    $("cesiumContainer")
    ?? canvas.parentElement;

  const layer =
    createRiverGaugeLayer({
      viewer,
      CesiumRef,

      visible:
        Boolean(
          checkbox?.checked
        ),

      onStatus:
        setRiverGaugeStatus,

      onUpdate:
        features => {
          if(reportDialog?.open)renderFloodGaugeReport();
          if (
            !panel
            || panel.hidden
          ) {
            return;
          }

          const selectedId =
            panel.dataset
              .gaugeId
            || "";

          const latest=features.find(feature=>String(feature.id)===selectedId);
          if(selectedId){
            // Refresh the already-open panel whenever new levels or the
            // persisted event state change; never require a second tap.
            showRiverGaugeInfo(latest??null);
          }
        }
    });

  // Opt-in browser QA: verify only qualifying BoM flood signals are rendered.
  if (
    typeof window !== "undefined"
    && new URLSearchParams(window.location.search).has("qaFloodSignals")
  ) {
    window.__stormtrackerFloodDiagnostics = () => ({
      visible: Boolean(layer.dataSource.show),
      alertCount: layer.features.length,
      states: layer.features.map(feature =>
        feature.properties?.STORMTRACKER_DISPLAY_STATE ?? "unknown"
      ),
      matched: layer.diagnostics?.matchedCount ?? 0,
      totalObservations:layer.diagnostics?.totalObservations??null,
      metadataSource:layer.diagnostics?.metadataSource??null,
      metadataFallback:layer.diagnostics?.metadataFallback??null,
      counts: layer.diagnostics?.floodSignalCounts ?? null,
      historyStationCount: layer.historyStationCount,
      recentHistoryRequestCount: layer.recentHistoryRequestCount,
      recentHistory: layer.diagnostics?.recentHistory??null,
      loadedAt: layer.lastLoadedAt
    });
  }

  function showById(
    gaugeId
  ) {
    if (!gaugeId) {
      return false;
    }

    const feature =
      layer.featureById(
        gaugeId
      );

    if (!feature) {
      return false;
    }

    showRiverGaugeInfo(
      feature
    );

    return true;
  }

  function canvasPositionFromPointer(
    event
  ) {
    const rect =
      canvas
        .getBoundingClientRect();

    return new CesiumRef
      .Cartesian2(
        event.clientX
          - rect.left,
        event.clientY
          - rect.top
      );
  }

  function selectNearPosition(
    position,
    {
      width =
        30,
      height =
        30
    } = {}
  ) {
    return showById(
      gaugeIdNearPosition({
        viewer,
        position,
        width,
        height
      })
    );
  }

  const pointerTap = {
    id:
      null,
    x:
      0,
    y:
      0,
    startedAt:
      0,
    moved:
      false
  };

  const onPointerDown =
    event => {
      if (
        event.button
          !== undefined
        && event.button
          !== 0
      ) {
        return;
      }

      if (
        !mapContainer
        || !mapContainer
          .contains(
            event.target
          )
      ) {
        return;
      }

      const blockedControl =
        event.target
          ?.closest?.(
            "#nav,#riverGaugeInfo,#floodRoadClosureInfo,#powerOutageInfo,#qfdTechnicalRescueInfo"
          );

      if (blockedControl) {
        return;
      }

      pointerTap.id =
        event.pointerId;

      pointerTap.x =
        event.clientX;

      pointerTap.y =
        event.clientY;

      pointerTap.startedAt =
        performance.now();

      pointerTap.moved =
        false;
    };

  const onPointerMove =
    event => {
      if (
        pointerTap.id
        !== event.pointerId
      ) {
        return;
      }

      if (
        Math.hypot(
          event.clientX
            - pointerTap.x,
          event.clientY
            - pointerTap.y
        ) > 12
      ) {
        pointerTap.moved =
          true;
      }
    };

  const clearPointerTap =
    event => {
      if (
        pointerTap.id
        !== event.pointerId
      ) {
        return;
      }

      pointerTap.id =
        null;
    };

  const onPointerUp =
    event => {
      if (
        pointerTap.id
        !== event.pointerId
      ) {
        return;
      }

      const duration =
        performance.now()
        - pointerTap.startedAt;

      const isTap =
        !pointerTap.moved
        && duration <= 700;

      pointerTap.id =
        null;

      if (!isTap) {
        return;
      }

      selectNearPosition(
        canvasPositionFromPointer(
          event
        ),
        {
          width:
            event.pointerType
            === "touch"
              ? 42
              : 28,

          height:
            event.pointerType
            === "touch"
              ? 42
              : 28
        }
      );
    };

  window.addEventListener(
    "pointerdown",
    onPointerDown,
    {
      capture:
        true,
      passive:
        true
    }
  );

  window.addEventListener(
    "pointermove",
    onPointerMove,
    {
      capture:
        true,
      passive:
        true
    }
  );

  window.addEventListener(
    "pointerup",
    onPointerUp,
    {
      capture:
        true,
      passive:
        true
    }
  );

  window.addEventListener(
    "pointercancel",
    clearPointerTap,
    {
      capture:
        true,
      passive:
        true
    }
  );

  const clickFallback =
    typeof PointerEvent
      === "undefined"
      ? new CesiumRef
          .ScreenSpaceEventHandler(
            canvas
          )
      : null;

  clickFallback
    ?.setInputAction(
      movement => {
        selectNearPosition(
          movement.position,
          {
            width:
              32,
            height:
              32
          }
        );
      },
      CesiumRef
        .ScreenSpaceEventType
        .LEFT_CLICK
    );

  const hoverHandler =
    new CesiumRef
      .ScreenSpaceEventHandler(
        canvas
      );

  // No synchronous Cesium GPU picking on every pointer movement in the
  // isolated WebGL diagnostic preview. Gauge click inspection remains enabled.
  const suppressHoverGpuPicking =
    ["/preview/radar-history-fix/", "/preview/next-baseline/", "/preview/incremental-3d/"].some(
      path=>globalThis.location?.pathname?.includes(path)===true) ||
      (/\/live3d-operational-v9\.html$/.test(
        String(globalThis.location?.pathname??"")) &&
        !String(globalThis.location?.pathname??"").includes("/preview/"));
  if (!suppressHoverGpuPicking) {
    let lastHoverPickAt = 0;
    hoverHandler.setInputAction(movement => {
      const now = performance.now();
      if (now - lastHoverPickAt < 160) return;
      lastHoverPickAt = now;
      const gaugeId = gaugeIdNearPosition({
        viewer, position: movement.endPosition, width: 18, height: 18
      });
      canvas.style.cursor = gaugeId ? "pointer" : "";
    }, CesiumRef.ScreenSpaceEventType.MOUSE_MOVE);
  }

  checkbox
    ?.addEventListener(
      "change",
      event => {
        layer.setVisible(
          event.target.checked
        );

        if (
          !event.target
            .checked
        ) {
          showRiverGaugeInfo(
            null
          );

          setRiverGaugeStatus({
            message:
              "Flood-signal markers hidden · observations continue while this page is open"
          });
        }
      }
    );

  $("openFloodGaugeReport")?.addEventListener("click",openFloodGaugeReport);
  $("closeFloodGaugeReport")?.addEventListener("click",()=>reportDialog?.close());
  $("refreshFloodGaugeReport")?.addEventListener("click",async()=>{
    const button=$("refreshFloodGaugeReport");
    if(button?.disabled)return;
    if(button)button.disabled=true;
    try{
      await Promise.allSettled([layer.refresh({force:true}),loadCrossingReference()]);
      await layer.checkCrossingReferences();
    }finally{
      if(button)button.disabled=false;
      renderFloodGaugeReport();
    }
  });

  bindRiverGaugeManualRefresh(
    $("refreshRiverGaugesButton"),
    () => layer.refresh({force:true})
  );

  $("closeRiverGaugeInfo")
    ?.addEventListener(
      "click",
      () => {
        showRiverGaugeInfo(
          null
        );
      }
    );

  window.addEventListener(
    "pagehide",
    () => {
      layer.stop();

      window.removeEventListener(
        "pointerdown",
        onPointerDown,
        true
      );

      window.removeEventListener(
        "pointermove",
        onPointerMove,
        true
      );

      window.removeEventListener(
        "pointerup",
        onPointerUp,
        true
      );

      window.removeEventListener(
        "pointercancel",
        clearPointerTap,
        true
      );

      if (
        clickFallback
        && !clickFallback
          .isDestroyed()
      ) {
        clickFallback
          .destroy();
      }

      if (
        !hoverHandler
          .isDestroyed()
      ) {
        hoverHandler
          .destroy();
      }
    },
    {
      once:
        true
    }
  );

  layer.start();
  // Load once at startup for ALL map gauges, not only when the report opens.
  void loadCrossingReference();

  return layer;
}
