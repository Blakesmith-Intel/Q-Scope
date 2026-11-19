import {groupRoadClosuresByLga,searchRoadCouncilGroups}
 from "./road-closure-lga-model-v1.js?v=roads-lga-20261017-v1";
import {roadOfficialUrl} from "./official-source-links-v1.js?v=9.13.2";
import {formatAgencyTimestamp} from "./agency-source-time-v1.js?v=20261027-agency-panels-v1";

export const ROAD_OWNERSHIP_SCHEMA="StormTrackerQLDTrafficRoadClassV1";
const URL="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/road-ownership-report";
const HEADINGS=[
 ["state","State-controlled roads, highways & motorways"],
 ["local","Local government roads"],
 ["unverified","Classification unverified"]
];
const $=id=>document.getElementById(id);
const item=(tag,cls,text)=>{
 const node=document.createElement(tag);if(cls)node.className=cls;
 if(text!==undefined)node.textContent=String(text);return node;
};
// One classification per QLDTraffic event ID. Exact IDs only; road labels,
// suburbs, and highway suffixes must NEVER imply a management category.
export function roadOwnershipClass(id,snapshot){
 const key=String(id??"").trim();
 if(!/^\d{5,9}$/.test(key)||snapshot?.schema!==ROAD_OWNERSHIP_SCHEMA)
   return "unverified";
 const type=snapshot.entries?.[key];
 return type==="state-highway"||type==="state-controlled"?"state":
   type==="local"?"local":"unverified";
}
export function groupedRoadOwnershipFeatures(features,snapshot){
 const groups={state:[],local:[],unverified:[]},seen=new Set();
 for(const f of Array.isArray(features)?features:[]){
   const id=String(f?.properties?.id??"").trim();
   if(!id||seen.has(id))continue;
   seen.add(id);
   groups[roadOwnershipClass(id,snapshot)].push(f);
 }
 return groups;
}
// Group by official structured classifications; never infer a cause from prose.
export function groupRoadClosureItemsByHazard(items){
 const groups=new Map(),seen=new Set();
 const clean=value=>String(value??"").trim().replace(/\s+/g," ");
 for(const record of items??[]){
   const id=String(record?.id??"").trim();
   if(!id||seen.has(id))continue;seen.add(id);
   const s=record.summary??{};
   const type=clean(s.eventType),subtype=clean(s.eventSubtype),cause=clean(s.eventDueTo);
   const parts=[subtype||type,cause].filter(v=>v&&!/^n\/?a$/i.test(v));
   const unique=parts.filter((v,i)=>parts.findIndex(x=>x.toLowerCase()===v.toLowerCase())===i);
   const name=unique.join(" — ")||(type&&!/^n\/?a$/i.test(type)?type:"Cause not supplied");
   const key=JSON.stringify([type,subtype,cause].map(v=>v.toLowerCase()));
   if(!groups.has(key))groups.set(key,{key,name,items:[]});
   groups.get(key).items.push(record);
 }
 return [...groups.values()].sort((a,b)=>b.items.length-a.items.length||
   a.name.localeCompare(b.name,"en-AU"));
}
export function createRoadOwnershipReport({CesiumRef,mapCamera,councilDialog,
  refresh=()=>Promise.resolve(),getLoadedAt=()=>0}={}){
 const dialog=$("roadTypeReport"),trigger=$("openRoadTypeReport"),
   close=$("closeRoadTypeReport"),back=$("backRoadTypeReport"),
   reload=$("refreshRoadTypeReport"),search=$("roadTypeSearch"),
   summary=$("roadTypeSummary"),status=$("roadTypeStatus"),results=$("roadTypeResults"),
   grouping=$("roadTypeGrouping");
 if(![dialog,trigger,close,back,reload,search,summary,status,results].every(Boolean))
   return {updateFeatures(){},updateStatus(){},destroy(){}};
 let features=[],snapshot=null,lastAt=0,loading=null,destroyed=false;
 const fly=coordinates=>{
   if(!Array.isArray(coordinates)||coordinates.length<2||
     !coordinates.every(Number.isFinite))return;
   dialog.close();
   if($("measureToggle")?.getAttribute("aria-pressed")==="true")
     $("measureClose")?.click();
   if(!mapCamera?.setView)throw Error("Managed map navigation unavailable");
   mapCamera.setView({longitude:coordinates[0],latitude:coordinates[1],
     targetHeight:0,range:20000,heading:0,pitch:CesiumRef.Math.toRadians(-75)});
 };
 const detail=(dl,label,value)=>{
   if(value!=null&&String(value).trim()){
     dl.append(item("dt","",label),item("dd","",value));
   }
 };
 function render(){
   if(!dialog.open||destroyed)return;
   results.replaceChildren();
   const groups=groupedRoadOwnershipFeatures(features,snapshot);
   const counts=HEADINGS.map(([id])=>groups[id].length);
   summary.textContent=counts[0]+" state-controlled / highways · "+
     counts[1]+" local government · "+counts[2]+" unverified";
   const q=search.value.trim();
   for(const [key,heading] of HEADINGS){
     const section=item("details","outage-suburb outage-council");
     section.open=true;
     const councils=searchRoadCouncilGroups(groupRoadClosuresByLga(groups[key]),q);
     const sections=grouping?.value==="hazard"?
       groupRoadClosureItemsByHazard(councils.flatMap(g=>g.items)):councils;
     const total=sections.reduce((n,g)=>n+g.items.length,0);
     const header=item("summary","outage-suburb-title");
     header.append(item("span","outage-suburb-name",heading),
       item("span","outage-suburb-count",total+" closure"+(total===1?"":"s")));
     section.append(header);
     if(!total)section.append(item("p","outage-empty",q?"No matches in this section.":"No qualifying closures."));
     for(const council of sections){
       const sub=item("details","outage-suburb outage-locality");
       sub.open=false;
       const subHead=item("summary","outage-suburb-title");
       subHead.append(item("span","outage-suburb-name",council.name),
         item("span","outage-suburb-count",council.items.length));
       sub.append(subHead);
       const body=item("div","road-closure-list");
       for(const {summary:s,location} of council.items){
         const row=item("div","road-closure-item");
         const btn=item("button","outage-row-locate",s.roadName||"Unnamed road");
         btn.type="button";btn.disabled=!Array.isArray(location);
         btn.title=btn.disabled?"Map location unavailable":"Jump to official road closure";
         btn.addEventListener("click",()=>fly(location));
         row.append(btn,item("div","road-closure-caption",
           [s.locality,s.impactSubtype||s.impactType,
             s.eventDueTo||s.eventSubtype||s.eventType].filter(Boolean).join(" · ")));
         const more=item("details","outage-event");
         more.append(item("summary","","Details"));
         const dl=item("dl","outage-event-attributes");
         detail(dl,"QLDTraffic event",s.id);
         detail(dl,"Council",s.localGovernmentArea);
         detail(dl,"Cause",s.eventDueTo||s.eventSubtype||s.eventType);
         detail(dl,"Closure",s.impactSubtype||s.impactType);
         detail(dl,"Last updated",formatAgencyTimestamp(s.lastUpdated,"qldtraffic"));
         more.append(dl);
         const link=item("a","outage-source-link","QLDTraffic source");
         link.href=roadOfficialUrl(s.webLink);
         link.target="_blank";link.rel="noopener noreferrer";
         more.append(link);row.append(more);body.append(row);
       }
       sub.append(body);section.append(sub);
     }
     results.append(section);
   }
 }
 async function load({force=false}={}){
   if(loading)return loading;
   if(!force&&snapshot&&Date.now()-lastAt<10*60000){render();return;}
   loading=(async()=>{
     status.textContent="Checking official road management references…";
     try{
       const response=await fetch(URL,{cache:"no-store",signal:AbortSignal.timeout(24000)});
       if(!response.ok)throw Error("QLDTraffic reports HTTP "+response.status);
       const data=await response.json();
       if(data?.schema!==ROAD_OWNERSHIP_SCHEMA||!data.entries||
         typeof data.entries!=="object"||Array.isArray(data.entries)||
         Object.keys(data.entries).length<1)
         throw Error("Official event references unavailable");
       snapshot=data;lastAt=Date.now();
       const sourceTime=formatAgencyTimestamp(data.checkedAt,"qldtraffic");
       status.textContent="QLDTraffic operational + highways reports checked "+sourceTime+
         " · event IDs matched · map closure filter unchanged";
     }catch(error){
       // A failed or invalid report must NEVER turn unverified into local.
       snapshot=null;lastAt=0;
       status.textContent="Road classifications unavailable — all unmatched closures shown as unverified. "+
         String(error?.message??error).slice(0,110);
     }finally{loading=null;render();}
   })();
   return loading;
 }
 const open=()=>{
   if(councilDialog?.open)councilDialog.close();
   if(!dialog.open)dialog.showModal();
   render();void load();search.focus();
 };
 const dismiss=()=>dialog.close();
 const returnToCouncil=()=>{
   dialog.close();councilDialog?.showModal();
 };
 const doRefresh=async()=>{
   reload.disabled=true;
   try{
     const r=await Promise.allSettled([refresh(),load({force:true})]);
     if(r[0].status==="rejected")
       status.textContent+=" · QLDTraffic closure refresh unavailable";
   }finally{reload.disabled=false;render();}
 };
 trigger.addEventListener("click",open);
 close.addEventListener("click",dismiss);
 back.addEventListener("click",returnToCouncil);
 reload.addEventListener("click",doRefresh);
 search.addEventListener("input",render);
 grouping?.addEventListener("change",render);
 return {updateFeatures(next){features=Array.isArray(next)?next.slice():[];render();},
   updateStatus(next){
     if(next?.kind==="error"&&/source expired|old closure markers removed/i.test(next.message??""))
       {features=[];render();}
   },destroy(){
     destroyed=true;trigger.removeEventListener("click",open);
     close.removeEventListener("click",dismiss);
     back.removeEventListener("click",returnToCouncil);
     reload.removeEventListener("click",doRefresh);
     search.removeEventListener("input",render);
     grouping?.removeEventListener("change",render);
     if(dialog.open)dialog.close();
   }};
}
