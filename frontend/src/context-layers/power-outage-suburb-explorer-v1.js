import {formatIncidentRefreshTime} from "./incident-refreshed-time-v1.js?v=20261017-refresh-v1";
import {filterLgaGroups,councilOutageCustomerSummary,localityKey,
  resolveQueenslandLocalityLgas}
 from "./incident-lga-model-v1.js?v=council-customers-20261017-v1";
import {powerOfficialUrl} from "./official-source-links-v1.js?v=9.13.2";
import {powerOutageProviderCounts} from "./power-outages-v1.js?v=20261104-qld-provider-count-reconciliation-v1";
import {groupOutagesByVerifiedGeometry,resolveOutageEventLgas,
  uniqueOutageEvents,outageGeometrySignature}
 from "./outage-lga-spatial-v2.js?v=outage-geometry-lga-20261020-v1";
import {groupOutagesBySuburb,filterOutageSuburbGroups,outageLocation}
  from "./power-outage-suburb-model-v1.js?v=suburb-explorer-20261017-v1";

// View over the EXISTING layer snapshot; no duplicate requests, no map pick,
// no new Cesium entities, no weather-frame redraws.
export function createPowerOutageSuburbExplorer({
  viewer,CesiumRef,mapCamera,refresh=()=>Promise.resolve(),getLoadedAt=()=>0,formatTime=()=>""
}={}){
  const byId=id=>document.getElementById(id);
  const dialog=byId("powerOutageExplorer");
  const opener=byId("openPowerOutageExplorer");
  const close=byId("closePowerOutageExplorer");
  const search=byId("outageSuburbSearch");
  const results=byId("outageSuburbResults");
  const summary=byId("outageSuburbSummary");
  const state=byId("outageSuburbFeedStatus");
  const more=byId("outageSuburbMore");
  const reload=byId("refreshPowerOutageExplorer");
  const byProvider=byId("outageByProviderReport");
  const title=byId("powerOutageExplorerTitle");
  const help=byId("powerOutageExplorerHelp");
  if(!dialog || !opener || !close || !search || !results || !summary || !state || !more || !reload || !byProvider)
    throw new Error("Power outage suburb explorer controls missing");
  const create=(tag,className,text)=>{
    const item=document.createElement(tag);
    if(className)item.className=className;
    if(text!==undefined)item.textContent=String(text);
    return item;
  };
  const number=v=>Number(v??0).toLocaleString("en-AU");
  const sidebarOutages=byId("sidebarPowerOutageCount");
  const sidebarCustomers=byId("sidebarPowerCustomerCount");
  const refreshEl=byId("sidebarPowerLastRefresh");
  let lastSuccessfulAt=0;
  function updateSourceRefreshLabel(){
    if(!refreshEl)return;
    const report=status;
    const failed=report.kind==="error";
    const expired=failed&&/source expired|old .* markers removed/i.test(report.message||"");
    const ms=lastSuccessfulAt||Number(getLoadedAt());
    refreshEl.textContent=formatIncidentRefreshTime(ms,{failed,expired});
    if(ms>0)refreshEl.dateTime=new Date(ms).toISOString();
    else refreshEl.removeAttribute("datetime");
  }
  function updateSidebarCounters(){
    if(!sidebarOutages||!sidebarCustomers)return;
    if(!hasSnapshot){
      sidebarOutages.textContent=status.kind==="error"?"Unavailable":"Checking…";
      sidebarCustomers.textContent="Customers: —";
      return;
    }
    // Same deduplicated provider snapshot used by the report, not the
    // count of council entries, suburb names or map polygon parts.
    const providerSummary=powerOutageProviderCounts(latestFeatures,{
      availableProviders:status.providers,
      failedProviders:status.failedProviders
    });
    const count=providerSummary.total.outages;
    const total=providerSummary.total.customers;
    sidebarOutages.textContent=count+" outage"+(count===1?"":"s");
    sidebarCustomers.textContent=total.toLocaleString("en-AU")+" customers affected";
    opener.setAttribute("aria-label",
      "Browse "+count+" unplanned power outages affecting "+total+" customers by council");
  }

  let groups=[],suburbGroups=[],unlocated=[];
  let localityLgas=new Map(),eventLgas=new Map(),attemptedLocalities=new Set();
  let lookupBusy=false,sourceChangedDuringLookup=false;
  let status={kind:"loading",message:"Waiting for live outage feed…"};
  let openKeys=new Set(),visibleLimit=60,hasSnapshot=false;
  let loading=false,disposed=false;
  let providerView=false;
  dialog.dataset.reportView="lga";
  // Suburb name is a direct route to its published outage geometry.
  // The disclosure arrow/count remain for expanding the incident table.
  function focusPublishedOutages(items){
    const points=[...new Map((items||[]).map(item=>[item.id,item])
      .map(([id,item])=>[id,outageLocation(item.feature)])
      .filter(([,coord])=>coord)).values()];
    if(!points.length)return false;
    dialog.close();
    if(byId("measureToggle")?.getAttribute("aria-pressed")==="true")
      byId("measureClose")?.click();
    // Reuse the existing map layer visibility control. Never change map
    // picking, polygon handlers or the provider's incident geometries.
    const checkbox=byId("showPowerOutages");
    if(checkbox && !checkbox.checked)checkbox.click();
    // Cesium camera.flyTo is overridden by StormTracker's managed camera
    // state on the next correction tick. Navigate through the controller.
    if (!mapCamera?.setView) throw Error("Managed map navigation is unavailable");
    const lons=points.map(point=>point.longitude);
    const lats=points.map(point=>point.latitude);
    const west=Math.min(...lons),east=Math.max(...lons);
    const south=Math.min(...lats),north=Math.max(...lats);
    const latitude=(south+north)/2;
    const longitude=(west+east)/2;
    const spanMetres=Math.max(
      (east-west)*111320*Math.cos(latitude*Math.PI/180),
      (north-south)*111320
    );
    mapCamera.setView({
      longitude,latitude,targetHeight:0,heading:0,
      pitch:CesiumRef.Math.toRadians(-80),
      range:Math.min(5000000,Math.max(13000,13000+spanMetres*2.5))
    });
    return true;
  }

  function field(grid,label,value){
    const text=String(value??"").trim();
    if(!text)return;
    const dt=create("dt","",label),dd=create("dd","",text);
    grid.append(dt,dd);
  }
  function renderProviderReport(){
    // The statewide provider report uses the identical unique event list as
    // the sidebar counter; no extra requests, invented locations or LGA sums.
    results.replaceChildren();
    more.hidden=true;
    if(!hasSnapshot){
      summary.textContent="Waiting for a verified power outage snapshot";
      results.append(create("p","outage-empty",
        "Power outage feeds have not loaded. Press Refresh to check again."));
      return;
    }
    const report=powerOutageProviderCounts(latestFeatures,{
      availableProviders:status.providers,
      failedProviders:status.failedProviders
    });
    const stamp=Number(getLoadedAt());
    summary.textContent=number(report.total.outages)+" distinct emergency outages · "+
      number(report.total.customers)+" customers affected"+
      (report.partial?" · PARTIAL source data":"")+
      (stamp>0?" · checked "+formatIncidentRefreshTime(stamp):"");
    const table=create("table","outage-provider-table");
    const thead=create("thead"),heading=create("tr");
    for(const column of ["Provider","Outages","Customers affected","Feed"]){
      const th=create("th","",column);th.scope="col";heading.append(th);
    }
    thead.append(heading);table.append(thead);
    const tbody=create("tbody");
    for(const item of report.rows){
      const tr=create("tr");
      const provider=create("td","",item.provider);
      const href=powerOfficialUrl(item.provider);
      if(href){
        const link=create("a","outage-source-link",item.provider);
        link.href=href;link.target="_blank";link.rel="noopener noreferrer";
        provider.replaceChildren(link);
      }
      const present=item.state!=="unavailable";
      const sourceState=create("td","outage-provider-status",
        item.state==="ok"?"Current":item.state==="partial"?"Partial feed":"Unavailable");
      if(item.sourceNewestAtMs!==null){
        const date=new Date(item.sourceNewestAtMs);
        const sourceClock=new Intl.DateTimeFormat("en-AU",{
          timeZone:"Australia/Brisbane",day:"2-digit",month:"2-digit",
          hour:"2-digit",minute:"2-digit",hourCycle:"h23"
        }).format(date);
        const timestamp=create("small","outage-provider-source-time",
          "Record "+sourceClock+" AEST");
        timestamp.title="Latest EXTRACTED timestamp on an active source record, not an independently verified provider feed refresh time";
        sourceState.append(timestamp);
      }
      tr.append(provider,
        create("td","outage-provider-number",present?number(item.outages):"—"),
        create("td","outage-provider-number",present?number(item.customers):"—"),
        sourceState);
      tbody.append(tr);
    }
    const footer=create("tr");
    footer.append(create("th","","Statewide total"),
      create("td","outage-provider-number",number(report.total.outages)),
      create("td","outage-provider-number",number(report.total.customers)),
      create("td","",report.partial?"Partial total":"All three feeds"));
    tbody.append(footer);table.append(tbody);results.append(table);
    results.append(create("p","outage-suburb-note",
      "Counts are unique UNPLANNED incidents per provider. Customers affected is a separate estimate. Record time is the latest source EXTRACTED stamp; checked time is when StormTracker fetched the feed. Neither establishes that provider web totals have refreshed at the same moment. Shared councils are not double-counted."));
    if(report.total.withoutGeometry)results.append(create("p","outage-suburb-note",
      number(report.total.withoutGeometry)+" provider outage records have no source-mapped geometry; included in statewide counts but not plotted or assigned to a council."));
    if(report.partial)results.append(create("p","outage-suburb-note",
      "PARTIAL: at least one provider or its map layer was unavailable. The statewide total is a verified subtotal, not a statewide all-clear."));
  }
  function render(){
    if(!dialog.open || disposed)return;
    if(providerView){renderProviderReport();return;}
    results.replaceChildren();
    const matching=filterLgaGroups(groups,search.value);
    const listed=matching.slice(0,visibleLimit);
    const unique=new Set([...matching.flatMap(g=>g.items.map(i=>i.id)),
      ...unlocated.map(item=>item.id)]);
    summary.textContent=hasSnapshot
      ? `${matching.length} verified council areas · ${unique.size} distinct outages`+
        (unlocated.length?` · ${unlocated.length} awaiting location`:"")
      : "Waiting for outage information";
    if(!hasSnapshot){
      results.append(create("p","outage-empty","Outage data hasn't loaded. Press Refresh to retry."));
    }else if(!matching.length && !unlocated.length){
      results.append(create("p","outage-empty",search.value
        ? "No matching council areas, suburbs or outage details.":
          "No unplanned outages are currently reported in this feed."));
    }
    for(const council of listed){
      const parent=create("details","outage-suburb outage-council");
      parent.open=openKeys.has("lga:"+council.key);
      parent.addEventListener("toggle",()=>parent.open
        ?openKeys.add("lga:"+council.key):openKeys.delete("lga:"+council.key));
      const parentTitle=create("summary","outage-suburb-title");
      const totals=councilOutageCustomerSummary(council,groups);
      const badges=create("span","outage-council-metrics");
      badges.append(
        create("span","outage-suburb-count",
          `${totals.outages} outage${totals.outages===1?"":"s"}`),
        create("span","outage-council-customers",
          `${number(totals.customers)} customer${totals.customers===1?"":"s"}`)
      );
      if(totals.crossCouncilEvents){
        badges.append(create("span","outage-council-shared","Shared*"));
        badges.title="Includes outage-wide customer totals for events listed in more than one council. These are not council-specific customer allocations.";
      } else {
        badges.title="Unique outage IDs within this council; customers affected as reported by the electricity providers.";
      }
      parentTitle.append(create("span","outage-suburb-name",council.name),badges);
      parent.append(parentTitle);
      const parentInner=create("div","outage-suburb-inner outage-lga-inner");
      // All listed councils are verified by intersecting the actual mapped
      // outage geometry with Queensland Government LGA boundary polygons.
      if(totals.crossCouncilEvents)
        parentInner.append(create("p","outage-suburb-note",
          "* Shared outages can appear under multiple councils. Customer totals represent entire provider events, not customers allocated to each council."));
      for(const group of council.suburbs){
      const section=create("details","outage-suburb outage-locality");
      section.open=openKeys.has(group.key);
      section.addEventListener("toggle",()=>{
        if(section.open)openKeys.add(group.key);
        else openKeys.delete(group.key);
      });
      const title=create("summary","outage-suburb-title");
      const suburbName=create("button","outage-suburb-map",group.name+" ↗");
      suburbName.type="button";
      const hasMappedEvent=group.items.some(item=>Boolean(outageLocation(item.feature)));
      suburbName.disabled=!hasMappedEvent;
      suburbName.title=hasMappedEvent
        ?"Show this suburb's published outage locations on the map"
        :"No geographic outage location was published";
      suburbName.setAttribute("aria-label",
        "Show outages for "+group.name+" on the map");
      suburbName.addEventListener("click",event=>{
        event.preventDefault();
        event.stopPropagation();
        focusPublishedOutages(group.items);
      });
      title.append(
        suburbName,
        create("span","outage-suburb-count",
          `${group.items.length} outage${group.items.length===1?"":"s"}`)
      );
      section.append(title);
      const inner=create("div","outage-suburb-inner");
      if(group.shared){
        inner.append(create("p","outage-suburb-note",
          "Shared events may affect several suburbs. Customer figures are provider-wide per event, not suburb totals."));
      }
      const table=create("table","outage-suburb-table");
      const head=create("thead"),hrow=create("tr");
      for(const name of ["Outage","Customers","Restoration"]) {
        const th=create("th","",name);th.scope="col";hrow.append(th);
      }
      head.append(hrow);table.append(head);
      const tbody=create("tbody");
      for(const item of group.items){
        const {summary:info}=item;
        const row=create("tr");
        const eventCell=create("td");
        const coords=outageLocation(item.feature);
        // Incident title is the primary map-navigation action; expanding the
        // suburb or the secondary Details expander never navigates.
        const navigate=()=>focusPublishedOutages([item]);
        const title=create("button","outage-row-locate",
          info.provider+(info.eventId?` · #${info.eventId}`:" · Fault"));
        title.type="button";
        title.disabled=!coords;
        title.title=coords?"Go to the outage on the map":"Location not provided by outage source";
        title.setAttribute("aria-label",coords
          ?`Show ${info.provider} outage ${info.eventId||""} in ${group.name} on map`
          :`Location unavailable for ${info.provider} outage`);
        if(coords)title.addEventListener("click",navigate);
        eventCell.append(title);
        const detail=create("details","outage-event");
        const label=create("summary","","Details");
        detail.append(label);
        const attrs=create("dl","outage-event-attributes");
        field(attrs,"Status",info.status);
        field(attrs,"Street(s)",info.streets);
        if(item.providerLocationConflicts?.length)
          field(attrs,"Provider location conflicts",
            item.providerLocationConflicts.join(", ")+
            " (excluded from council placement; outside the mapped council area)");
        field(attrs,"Reason",info.reason);
        field(attrs,"Started",formatTime(info.start,info.provider));
        field(attrs,"Estimated restoration",formatTime(info.estimatedFix,info.provider));
        field(attrs,"Provider",info.attribution);
        detail.append(attrs);
        if(item.shared)detail.append(create("p","outage-suburb-note","Reported customer count covers the entire event, not this suburb alone."));
        const actions=create("div","outage-event-actions");
        const href=powerOfficialUrl(info.provider);
        if(href){
          const official=create("a","outage-source-link","Official provider");
          official.href=href; official.target="_blank";
          official.rel="noopener noreferrer";
          actions.append(official);
        }
        detail.append(actions);eventCell.append(detail);
        const customers=create("td","outage-customers",number(info.customersAffected));
        if(item.shared)customers.title="Shared incident: affected customer count is not assigned per suburb";
        const eta=create("td","outage-eta",
          formatTime(info.estimatedFix,info.provider)||"Not supplied");
        row.append(eventCell,customers,eta);
        if(coords){
          row.classList.add("outage-clickable-row");
          row.title="Tap this outage row to view its location on the map";
          row.addEventListener("click",event=>{
            if(event.target.closest("button,a,summary,details"))return;
            navigate();
          });
        }
        tbody.append(row);
      }
      table.append(tbody);inner.append(table);section.append(inner);
      parentInner.append(section);
      }
      parent.append(parentInner);
      results.append(parent);
    }
    // Outages with no verified council are still accessible, but not
    // incorrectly counted under any LGA. This section is not a council.
    const awaiting=unlocated.filter(item=>{
      const q=search.value.trim().toLocaleLowerCase("en-AU");
      return !q || [item.id,item.summary?.suburbs,item.summary?.streets,
        item.summary?.provider,item.summary?.eventId].some(v=>
        String(v??"").toLocaleLowerCase("en-AU").includes(q));
    });
    if(awaiting.length && visibleLimit>=matching.length){
      const section=create("details","outage-suburb outage-unlocated");
      const heading=create("summary","outage-suburb-title",
        `Location pending — ${awaiting.length} outage${awaiting.length===1?"":"s"}`);
      section.append(heading);
      const content=create("div","outage-suburb-inner");
      content.append(create("p","outage-suburb-note",
        "Geographic council verification is unavailable for these events. No council has been guessed or assigned."));
      for(const item of awaiting){
        const info=item.summary;
        const entry=create("div","outage-suburb-note",
          `${info.provider} · #${info.eventId||item.id} · ${number(info.customersAffected)} customers · ${info.suburbs||"No locality supplied"}`);
        const coords=outageLocation(item.feature);
        if(coords){
          const btn=create("button","outage-row-locate","Show on map ↗");
          btn.type="button";
          btn.addEventListener("click",()=>focusPublishedOutages([item]));
          entry.append(btn);
        }
        content.append(entry);
      }
      section.append(content);
      results.append(section);
    }
    more.hidden=visibleLimit>=matching.length;
    if(!more.hidden)more.textContent=`Show more council areas (${matching.length-visibleLimit} remaining)`;
  }
  let latestFeatures=[];
  function rebuildSpatialGroups(){
    const grouped=groupOutagesByVerifiedGeometry(suburbGroups,eventLgas,localityLgas);
    groups=grouped.groups;unlocated=grouped.unlocated;
  }
  function updateFeaturesFromLatest(){updateFeatures(latestFeatures);}
  function updateFeatures(features){
    latestFeatures=features;
    suburbGroups=groupOutagesBySuburb(features);
    updateSidebarCounters();
    rebuildSpatialGroups();
    // Exact event geometry is the primary LGA evidence. Official locality
    // attributes ONLY validate labels inside each event's council boundary.
    const pendingNames=suburbGroups.map(g=>g.name).filter(name=>{
      const key=localityKey(name);
      return key!=="SUBURB NOT SUPPLIED"&&!localityLgas.has(key)&&
        !attemptedLocalities.has(key);
    });
    const pendingGeometry=[...uniqueOutageEvents(suburbGroups)].some(([id,item])=>{
      const cached=eventLgas.get(id);
      return cached?.signature!==outageGeometrySignature(item.feature);
    });
    if(lookupBusy){
      if(pendingNames.length||pendingGeometry)sourceChangedDuringLookup=true;
    }else if(pendingNames.length||pendingGeometry){
      for(const name of pendingNames)attemptedLocalities.add(localityKey(name));
      lookupBusy=true;
      state.textContent=(status.message||"")+" · Verifying mapped council boundaries…";
      const currentSuburbGroups=suburbGroups;
      Promise.allSettled([
        resolveOutageEventLgas(currentSuburbGroups,{existing:eventLgas}),
        pendingNames.length?resolveQueenslandLocalityLgas(pendingNames):Promise.resolve(new Map())
      ]).then(([eventResult,localityResult])=>{
        if(disposed)return;
        if(eventResult.status==="fulfilled")eventLgas=eventResult.value;
        else console.warn("Outage LGA polygon lookup unavailable:",eventResult.reason);
        if(localityResult.status==="fulfilled"){
          for(const [name,value] of localityResult.value)localityLgas.set(name,value);
        }else console.warn("Outage locality verification unavailable:",localityResult.reason);
        rebuildSpatialGroups();
        state.textContent=(status.message||"")+" · "+groups.length+
          " verified council areas"+
          (unlocated.length?` · ${unlocated.length} locations pending`:"");
        if(dialog.open)render();
      }).finally(()=>{
        lookupBusy=false;
        if(!disposed&&sourceChangedDuringLookup){
          sourceChangedDuringLookup=false;
          updateFeaturesFromLatest();
        }
      });
    }
    hasSnapshot=true;
    if(dialog.open)render();
  }
  function updateStatus(next){
    if(next)status=next;
  const checkedAt=Number(status.loadedAt);
  if(Number.isFinite(checkedAt) && checkedAt>0)lastSuccessfulAt=checkedAt;
    if(status.kind==="error" && /source expired|old outage markers removed/i.test(status.message||"")){hasSnapshot=false;groups=[];suburbGroups=[];unlocated=[];openKeys.clear();}
    const kind=status.kind||"normal";
    state.dataset.kind=kind;
    state.textContent=status.message||"Current unplanned outage data";
    updateSourceRefreshLabel();
    updateSidebarCounters();
    // Expired snapshots were already cleared by createPowerOutageLayer.onUpdate([]).
    if(dialog.open)render();
  }
  function open(){
    if(disposed)return;
    if(!dialog.open)dialog.showModal();
    visibleLimit=60;
    render();
    search.focus();
    // Reuse the already running 15-minute polling of the same outage layer.
    // Only request an immediate source refresh when there has been no load.
    if(!getLoadedAt() && !loading){
      loading=true;
      Promise.resolve().then(()=>refresh()).catch(()=>{
        if(!hasSnapshot)state.textContent="Unable to load outages. Try Refresh.";
      }).finally(()=>{loading=false;});
    }
  }
  const onProviderView=()=>{
    providerView=!providerView;
    dialog.dataset.reportView=providerView?"provider":"lga";
    byProvider.textContent=providerView?"Report by LGA":"Report by provider";
    byProvider.setAttribute("aria-pressed",String(providerView));
    search.disabled=providerView;
    if(title)title.textContent=providerView?"⚡ Power outages by provider":"⚡ Power outages by LGA";
    if(help)help.textContent=providerView?
      "One statewide total · three providers · distinct emergency incidents":
      "Unplanned outages · expand a council, then a suburb";
    // The council lookup summary is relevant only when browsing LGAs.
    state.textContent=providerView?(status.message||"Current unplanned outage sources"):
      (status.message||"Current unplanned outage sources")+
      (hasSnapshot?" · "+groups.length+" verified council areas":"");
    render();
  };
  const onOpen=()=>{
    // Give a previously failed official lookup another chance whenever the
    // user opens this panel, without a hot-loop of automatic retries.
    attemptedLocalities.clear();
    // Retry failures, not already verified immutable event footprints.
    eventLgas=new Map([...eventLgas].filter(([,v])=>v?.councils?.length));
    if(hasSnapshot)updateFeaturesFromLatest();
    open();
  };
  const onClose=()=>dialog.close();
  const onSearch=()=>{visibleLimit=60;render();};
  const onMore=()=>{visibleLimit+=60;render();};
  const onRefresh=()=>{
    if(loading)return;
    attemptedLocalities.clear();
    eventLgas=new Map([...eventLgas].filter(([,v])=>v?.councils?.length));
    loading=true;reload.disabled=true;
    refresh().catch(()=>{
      if(!hasSnapshot)state.textContent="Unable to load outages. Try Refresh.";
    }).finally(()=>{loading=false;reload.disabled=false;});
  };
  opener.addEventListener("click",onOpen);
  byProvider.addEventListener("click",onProviderView);
  close.addEventListener("click",onClose);
  search.addEventListener("input",onSearch);
  more.addEventListener("click",onMore);
  reload.addEventListener("click",onRefresh);
  const destroy=()=>{
    disposed=true;
    opener.removeEventListener("click",onOpen);
    byProvider.removeEventListener("click",onProviderView);
    close.removeEventListener("click",onClose);
    search.removeEventListener("input",onSearch);
    more.removeEventListener("click",onMore);
    reload.removeEventListener("click",onRefresh);
    if(dialog.open)dialog.close();
  };
  updateSourceRefreshLabel();
  updateSidebarCounters();
  return {updateFeatures,updateStatus,destroy};
}
