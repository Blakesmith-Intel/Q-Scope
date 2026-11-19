import {formatIncidentRefreshTime} from "./incident-refreshed-time-v1.js?v=20261017-refresh-v1";
import {groupRoadClosuresByLga,searchRoadCouncilGroups} from "./road-closure-lga-model-v1.js?v=roads-lga-20261017-v1";
import {roadOfficialUrl} from "./official-source-links-v1.js?v=9.13.2";
import {createRoadOwnershipReport,groupRoadClosureItemsByHazard,sortRoadReportGroups,sortRoadReportItems,roadReportGroupCountLabel} from "./road-ownership-report-v1.js?v=road-ownership-report-20261027-v1";
export function createRoadClosureLgaExplorer({
 viewer,CesiumRef,mapCamera,refresh=()=>Promise.resolve(),getLoadedAt=()=>0,formatTime=()=>"",
}={}){
 const $=id=>document.getElementById(id);
 const dialog=$("roadLgaExplorer"),openButton=$("openRoadLgaExplorer"),
  closeButton=$("closeRoadLgaExplorer"),input=$("roadLgaSearch"),
  list=$("roadLgaResults"),counter=$("roadLgaSummary"),
  status=$("roadLgaFeedStatus"),refreshButton=$("refreshRoadLgaExplorer"),
  grouping=$("roadLgaGrouping"),sort=$("roadLgaSort");
 if(![dialog,openButton,closeButton,input,list,counter,status,refreshButton].every(Boolean))
  throw Error("Road closure LGA explorer controls missing");
 const make=(tag,cls,label)=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(label!==undefined)node.textContent=String(label);
  return node;
 };
 const ownershipReport=createRoadOwnershipReport({CesiumRef,mapCamera,councilDialog:dialog,refresh,onReturn:()=>{render();input.focus();}});
 let groups=[],feedStatus={kind:"loading",message:"Waiting for QLDTraffic…"},
   loaded=false,destroyed=false,busy=false;
 const openKeys=new Set();
 const sidebarCount=$("sidebarRoadClosureCount");
 const refreshEl=$("sidebarRoadLastRefresh");
  let lastSuccessfulAt=0;
  function updateSourceRefreshLabel(){
    if(!refreshEl)return;
    const report=feedStatus;
    const failed=report.kind==="error";
    const expired=failed&&/source expired|old .* markers removed/i.test(report.message||"");
    const ms=lastSuccessfulAt||Number(getLoadedAt());
    refreshEl.textContent=formatIncidentRefreshTime(ms,{failed,expired});
    if(ms>0)refreshEl.dateTime=new Date(ms).toISOString();
    else refreshEl.removeAttribute("datetime");
  }
 function updateSidebarCount(){
  if(!sidebarCount)return;
  if(!loaded){
   sidebarCount.textContent=feedStatus.kind==="error"?"Unavailable":"Checking…";
   return;
  }
  const count=new Set(groups.flatMap(group=>group.items.map(item=>item.id))).size;
  sidebarCount.textContent=count+" closure"+(count===1?"":"s");
  openButton.setAttribute("aria-label","Browse "+count+" unplanned all-traffic road closures by council");
 }

 function addDetail(dl,label,value){
  const text=String(value??"").trim();if(!text)return;
  dl.append(make("dt","",label),make("dd","",text));
 }
 function fly(location){
  if(!Array.isArray(location)||location.length<2)return;
  if(!Number.isFinite(location[0])||!Number.isFinite(location[1]))return;
  dialog.close();
  if($("measureToggle")?.getAttribute("aria-pressed")==="true")
    $("measureClose")?.click();
  // The managed StormTracker camera is authoritative. A raw Cesium flyTo
  // gets cancelled by its camera correction guard before the map can move.
  if (!mapCamera?.setView) throw Error("Managed map navigation is unavailable");
  mapCamera.setView({
   longitude:location[0],latitude:location[1],targetHeight:0,
   range:20000,heading:0,pitch:CesiumRef.Math.toRadians(-75)
  });
 }
 function render(){
  if(!dialog.open||destroyed)return;
  list.replaceChildren();
  const mode=sort?.value??"default";
  const matching=sortRoadReportGroups(searchRoadCouncilGroups(groups,input.value),mode);
  counter.textContent=loaded
   ?`${matching.length} council areas · ${new Set(matching.flatMap(g=>g.items.map(i=>i.id))).size} distinct closures`
   :"Waiting for road closure information";
  if(!loaded||!matching.length)
   list.append(make("p","outage-empty",!loaded
    ?"Road closure data has not loaded. Press Refresh to retry."
    :input.value?"No matching council, locality, road or hazard.":"No current unplanned all-traffic closures in the available source."));
  for(const group of matching){
    const parent=make("details","outage-suburb outage-council");
    parent.open=openKeys.has("c:"+group.key);
    parent.addEventListener("toggle",()=>parent.open?openKeys.add("c:"+group.key):openKeys.delete("c:"+group.key));
    const header=make("summary","outage-suburb-title");
    header.append(make("span","outage-suburb-name",group.name),
      make("span","outage-suburb-count",roadReportGroupCountLabel(group,mode)));
    parent.append(header);
    const inner=make("div","outage-suburb-inner outage-lga-inner");
    const sections=sortRoadReportGroups(grouping?.value==="hazard"?groupRoadClosureItemsByHazard(group.items):group.suburbs,mode);
    for(const suburb of sections){
      const section=make("details","outage-suburb outage-locality");
      const subKey="s:"+(grouping?.value??"locality")+":"+group.key+":"+suburb.key;
      section.open=openKeys.has(subKey);
      section.addEventListener("toggle",()=>section.open?
        openKeys.add(subKey):openKeys.delete(subKey));
      const name=make("summary","outage-suburb-title");
      name.append(make("span","outage-suburb-name",suburb.name),
        make("span","outage-suburb-count",roadReportGroupCountLabel(suburb,mode)));
      section.append(name);
      const content=make("div","road-closure-list");
      for(const item of sortRoadReportItems(suburb.items,mode)){
        const {summary:s,location}=item;
        const wrap=make("div","road-closure-item");
        const button=make("button","outage-row-locate",s.roadName||"Unnamed road");
        button.type="button";
        button.disabled=!Array.isArray(location);
        button.title=button.disabled?"Location unavailable":"Jump to this road closure on map";
        button.addEventListener("click",()=>fly(location));
        const subtitle=make("div","road-closure-caption",
          [s.locality,s.impactSubtype||s.impactType,s.eventDueTo||s.eventSubtype||s.eventType].filter(Boolean).join(" · "));
        wrap.append(button,subtitle);
        const detail=make("details","outage-event");
        detail.append(make("summary","","Details"));
        const dl=make("dl","outage-event-attributes");
        addDetail(dl,"Location",s.locality);
        addDetail(dl,"Cause",s.eventDueTo||s.eventSubtype||s.eventType);
        addDetail(dl,"Closure",s.impactSubtype||s.impactType);
        addDetail(dl,"Direction",s.direction);
        addDetail(dl,"Started",formatTime(s.startTime));
        addDetail(dl,"Expected end",formatTime(s.endTime));
        addDetail(dl,"Last updated",formatTime(s.lastUpdated));
        addDetail(dl,"Next inspection",formatTime(s.nextInspection));
        addDetail(dl,"Advice",s.advice||s.information||s.description);
        detail.append(dl);
        const official=make("a","outage-source-link","QLDTraffic source");
        official.href=roadOfficialUrl(s.webLink);
        official.target="_blank"; official.rel="noopener noreferrer";
        detail.append(official);wrap.append(detail);content.append(wrap);
      }
      section.append(content);inner.append(section);
    }
    parent.append(inner);list.append(parent);
  }
 }
 function updateFeatures(features){groups=groupRoadClosuresByLga(features);ownershipReport.updateFeatures(features);loaded=true;updateSidebarCount();render();}
 function updateStatus(next){
  if(next)feedStatus=next;
  const checkedAt=Number(feedStatus.loadedAt);
  if(Number.isFinite(checkedAt) && checkedAt>0)lastSuccessfulAt=checkedAt;
  status.textContent=feedStatus.message||"QLDTraffic operational closure feed";
  status.dataset.kind=feedStatus.kind||"normal";
  if(feedStatus.kind==="error"&&/source expired|old closure markers removed/i.test(feedStatus.message||""))
   {loaded=false;groups=[];}
    updateSourceRefreshLabel();
  ownershipReport.updateStatus(feedStatus);
  updateSidebarCount();
  render();
 }
 const open=()=>{dialog.showModal();render();input.focus();if(!getLoadedAt()&&!busy)reload();};
 const close=()=>dialog.close(),search=()=>render();
 const reload=()=>{
  if(busy)return;
  busy=true;refreshButton.disabled=true;
  Promise.resolve().then(()=>refresh()).catch(error=>{
   status.dataset.kind="error";status.textContent="Refresh failed: "+error.message;
  }).finally(()=>{busy=false;refreshButton.disabled=false;});
 };
 openButton.addEventListener("click",open);
 closeButton.addEventListener("click",close);
 input.addEventListener("input",search);
 grouping?.addEventListener("change",search);
 sort?.addEventListener("change",search);
 refreshButton.addEventListener("click",reload);
 updateSourceRefreshLabel();
 updateSidebarCount();
 return {updateFeatures,updateStatus,destroy(){
  destroyed=true;ownershipReport.destroy();
  openButton.removeEventListener("click",open);
  closeButton.removeEventListener("click",close);
  input.removeEventListener("input",search);
  grouping?.removeEventListener("change",search);
  sort?.removeEventListener("change",search);
  refreshButton.removeEventListener("click",reload);
  if(dialog.open)dialog.close();
 }};
}
