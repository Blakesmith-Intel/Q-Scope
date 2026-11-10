// Q-SCOPE experimental radar-event inbox. This is a passive research
// notification, not a BoM warning layer or an issued emergency alert.
// Source-time observations persist until the operator opens or clears them.
// No automatic camera movement, playback rewrites, audio or alert promotion.
export const Q_SCOPE_EVENT_STORAGE_KEY = "qscope:v10.5:research-radar-events";
const GROUP_DISTANCE_KM = 8;
const GROUP_WINDOW_MS = 30 * 60000;
const MAX_STORED_BYTES = 2000000;
const CATEGORY_PRIORITY = Object.freeze({
  tornadic_candidate: 3, hook_shape_only: 2, strong_radial_signature: 1
});
const CATEGORY_LABEL = Object.freeze({
  tornadic_candidate: "Hook + radial couplet candidate",
  hook_shape_only: "Possible hook-shaped echo",
  strong_radial_signature: "Strong radial-wind signature candidate"
});
function finite(n) { return typeof n === "number" && Number.isFinite(n); }
function validUtc(s) { return typeof s === "string" && Number.isFinite(Date.parse(s)); }
function distanceKm(a, b) {
  const lat = (a.latitude + b.latitude) * Math.PI / 360;
  return Math.hypot(
    (a.longitude - b.longitude) * 111.32 * Math.cos(lat),
    (a.latitude - b.latitude) * 111.32
  );
}
function uniqueEvidenceKey(e) {
  return [
    e.mode,e.radarId,e.category,e.frameUtc,e.sourceUtc,
    e.trackId,Math.round(e.latitude*1000),Math.round(e.longitude*1000)
  ].join("|");
}
function normaliseEvidence(alert, context) {
  if (!alert || !context || !["rain","doppler"].includes(context.mode) ||
      !Object.hasOwn(CATEGORY_PRIORITY, alert.category) ||
      !finite(alert.longitude) || !finite(alert.latitude) ||
      Math.abs(alert.latitude) > 85 || Math.abs(alert.longitude) > 180 ||
      !validUtc(context.frameUtc) || !validUtc(alert.observed_utc)) return null;
  const radarId = String(alert.radar_id ?? context.radarId ??
    (context.mode === "rain" ? "reflectivity" : ""));
  if (!radarId || !/^[0-9A-Za-z-]{1,20}$/.test(radarId)) return null;
  // An event's navigation must always point to a scan we really displayed
  // or decoded. No inferred/nearest frame is silently presented as original.
  if (context.frameUtc !== alert.observed_utc) return null;
  const e = {
    category: alert.category,
    mode: context.mode, frameUtc: context.frameUtc,
    sourceUtc: validUtc(alert.source_utc) ? alert.source_utc : "",
    radarId, trackId: String(alert.track_id ?? ""),
    longitude: alert.longitude, latitude: alert.latitude,
    observedUtc: alert.observed_utc,
    title: CATEGORY_LABEL[alert.category],
    caveat: String(alert.caveat ?? "Research only. Not an official BoM warning."),
    velocityKmh: finite(alert.velocity_kmh) ? alert.velocity_kmh : null,
    radialShearKmh: finite(alert.radial_shear_kmh) ? alert.radial_shear_kmh : null,
    arcDegrees: finite(alert.arc_degrees) ? alert.arc_degrees : null
  };
  e.key = uniqueEvidenceKey(e);
  return e;
}
function recoverRecords(source) {
  if (!source || typeof source !== "object" || source.version !== 1 ||
      !Array.isArray(source.events)) return [];
  const result = [];
  for (const record of source.events.slice(0, 10000)) {
    if (!record || !["pending","acknowledged","cleared"].includes(record.status) ||
        !validUtc(record.firstUtc) || !validUtc(record.latestUtc) ||
        !finite(record.longitude) || !finite(record.latitude) ||
        !Array.isArray(record.evidence) || record.evidence.length > 10000 ||
        typeof record.id !== "string" || record.id.length > 150) continue;
    const evidence = record.evidence.filter(e =>
      e && typeof e.key === "string" &&
      e.key.length < 300 && Object.hasOwn(CATEGORY_PRIORITY, e.category) &&
      validUtc(e.frameUtc) && finite(e.longitude) && finite(e.latitude) &&
      ["rain","doppler"].includes(e.mode) &&
      typeof e.radarId === "string" && typeof e.caveat === "string" &&
      typeof e.title === "string");
    if (!evidence.length) continue;
    result.push({
      id:record.id,firstUtc:record.firstUtc,latestUtc:record.latestUtc,
      latitude:record.latitude,longitude:record.longitude,
      status:record.status,evidence
    });
  }
  return result;
}
function snapshotEvent(e) {
  return {
    ...e, evidence:e.evidence.map(x=>({...x}))
  };
}
function bestEvidence(e) {
  return [...e.evidence].sort((a,b)=>
    (CATEGORY_PRIORITY[b.category] - CATEGORY_PRIORITY[a.category]) ||
    (Date.parse(b.frameUtc) - Date.parse(a.frameUtc)))[0];
}
export function createResearchRadarEventLedger({
  storage = null, storageKey = Q_SCOPE_EVENT_STORAGE_KEY
} = {}) {
  let events = [];
  let storageAvailable = Boolean(storage && typeof storage.getItem === "function" &&
    typeof storage.setItem === "function");
  if (storageAvailable) {
    try {
      const raw=storage.getItem(storageKey);
      if (raw && raw.length <= MAX_STORED_BYTES)
        events=recoverRecords(JSON.parse(raw));
    } catch (_error) {
      // Storage failures do not prevent the research UI working in memory.
      storageAvailable=false;
    }
  }
  function persist() {
    if (!storageAvailable) return false;
    try {
      const raw=JSON.stringify({version:1,events});
      if(raw.length>MAX_STORED_BYTES) {
        storageAvailable=false;return false;
      }
      storage.setItem(storageKey,raw);
      return true;
    } catch (_error) {
      storageAvailable=false;return false;
    }
  }
  function list({includeAcknowledged=false}={}) {
    return events.filter(e=>e.status==="pending" ||
      (includeAcknowledged && e.status==="acknowledged"))
      .sort((a,b)=>Date.parse(b.latestUtc)-Date.parse(a.latestUtc))
      .map(snapshotEvent);
  }
  function get(id) {
    const result=events.find(e=>e.id===id);
    return result ? snapshotEvent(result) : null;
  }
  function ingest(alerts, context) {
    let changed=0;
    for(const alert of Array.isArray(alerts)?alerts:[]) {
      const e=normaliseEvidence(alert,context);
      if(!e)continue;
      const stamp=Date.parse(e.frameUtc);
      let target=events.find(record=>
        Math.abs(Date.parse(record.firstUtc)-stamp)<=GROUP_WINDOW_MS &&
        Math.abs(Date.parse(record.latestUtc)-stamp)<=GROUP_WINDOW_MS &&
        distanceKm(record,e)<=GROUP_DISTANCE_KM
      );
      if(!target) {
        const id="radar:"+e.frameUtc+":"+Math.round(e.latitude*1000)+":"+
          Math.round(e.longitude*1000)+":"+events.length;
        target={id,firstUtc:e.frameUtc,latestUtc:e.frameUtc,
          latitude:e.latitude,longitude:e.longitude,status:"pending",evidence:[]};
        events.push(target);
      }
      if(target.evidence.some(existing=>existing.key===e.key))continue;
      target.evidence.push(e);
      if(stamp<Date.parse(target.firstUtc))target.firstUtc=e.frameUtc;
      if(stamp>Date.parse(target.latestUtc))target.latestUtc=e.frameUtc;
      changed++;
    }
    if(changed)persist();
    return changed;
  }
  function mark(id,status) {
    const event=events.find(e=>e.id===id);
    if(!event || !["acknowledged","cleared"].includes(status))return false;
    if(event.status==="cleared")return false;
    event.status=status;
    persist();
    return true;
  }
  return {
    ingest,list,get,acknowledge:id=>mark(id,"acknowledged"),
    clear:id=>mark(id,"cleared"),
    get storageAvailable(){return storageAvailable;},
    get pendingCount(){return events.filter(e=>e.status==="pending").length;},
    get archivedCount(){return events.filter(e=>e.status==="acknowledged").length;},
    bestEvidence
  };
}
function createNode(doc, tag, className, textValue) {
  const node=doc.createElement(tag);
  if(className)node.className=className;
  if(textValue!==undefined)node.textContent=textValue;
  return node;
}
function timeAest(utc) {
  return new Date(utc).toLocaleString("en-AU",{
    timeZone:"Australia/Brisbane",day:"2-digit",month:"2-digit",
    hour:"2-digit",minute:"2-digit",hour12:false
  })+" AEST";
}
function eventHeading(e) {
  const categories=[...new Set(e.evidence.map(item=>item.category))];
  const best=bestEvidence(e);
  return (categories.length>1?"Multiple radar signatures":"Radar signature")+
    " · "+best.title;
}
export function createPassiveWindEventInbox({
  container, documentRef=globalThis.document,
  storage=globalThis.localStorage, onNavigate=async()=>({ok:false,
    message:"Radar frame navigation is unavailable."})
}={}) {
  if(!container||!documentRef)throw new TypeError("Research inbox needs a map container.");
  const ledger=createResearchRadarEventLedger({storage});
  let openEventId="",showHistory=false,destroyed=false;
  const root=createNode(documentRef,"section","qscope-wind-event-inbox");
  root.setAttribute("aria-label","Q-SCOPE experimental radar event queue");
  const heading=createNode(documentRef,"div","qscope-wind-event-header");
  const title=createNode(documentRef,"strong","", "Q-SCOPE · RADAR EVENTS");
  const count=createNode(documentRef,"span","qscope-wind-event-count","");
  heading.append(title,count);
  const controls=createNode(documentRef,"div","qscope-wind-event-controls");
  const historyButton=createNode(documentRef,"button","", "History");
  historyButton.type="button";
  historyButton.addEventListener("click",()=>{
    showHistory=!showHistory;render();
  });
  const listArea=createNode(documentRef,"div","qscope-wind-event-list");
  const status=createNode(documentRef,"p","qscope-wind-event-status",
    "Experimental detection only · Not official warnings.");
  controls.append(historyButton);
  root.append(heading,controls,listArea,status);
  const details=createNode(documentRef,"section","qscope-wind-event-detail");
  details.hidden=true;
  details.setAttribute("role","dialog");
  details.setAttribute("aria-label","Q-SCOPE radar event evidence");
  container.append(root,details);
  const locationStatus=createNode(documentRef,"p","qscope-wind-event-location-status");
  function setLocationStatus(message){
    locationStatus.textContent=message;
  }
  async function focusEvidence(record,evidence){
    if(destroyed)return;
    setLocationStatus("Opening recorded radar frame and map location…");
    try {
      const result=await onNavigate(snapshotEvent(record),{...evidence});
      if(destroyed)return;
      setLocationStatus(result?.message ?? (result?.ok
        ? "Recorded frame displayed." :
        "Exact source frame is no longer available; no substitute has been shown."));
    }catch(error){
      if(!destroyed)setLocationStatus(
        "Recorded frame could not be loaded: "+String(error?.message??error));
    }
  }
  function openRecord(id) {
    const record=ledger.get(id);
    if(!record||record.status==="cleared")return;
    ledger.acknowledge(id);
    openEventId=id;
    showHistory=false;
    render();
    const updated=ledger.get(id);
    const best=bestEvidence(updated);
    if(best)void focusEvidence(updated,best);
  }
  function renderDetails(){
    const record=ledger.get(openEventId);
    details.replaceChildren();
    details.hidden=!record||record.status==="cleared";
    if(details.hidden)return;
    const headingLine=createNode(documentRef,"div","qscope-wind-event-detail-title");
    const label=createNode(documentRef,"strong","",eventHeading(record));
    const dismiss=createNode(documentRef,"button","", "Close window");
    dismiss.type="button";
    dismiss.addEventListener("click",()=>{
      openEventId="";renderDetails();render();
    });
    headingLine.append(label,dismiss);
    const meta=createNode(documentRef,"p","",
      "Recorded "+timeAest(record.firstUtc)+"–"+timeAest(record.latestUtc)+
      " · "+record.latitude.toFixed(3)+"°, "+record.longitude.toFixed(3)+"°");
    const sourceNote=createNode(documentRef,"p","",
      "Experimental observations only. BoM warnings and source imagery remain authoritative.");
    const evidenceList=createNode(documentRef,"div","qscope-wind-event-evidence");
    const sorted=[...record.evidence].sort((a,b)=>
      CATEGORY_PRIORITY[b.category]-CATEGORY_PRIORITY[a.category] ||
      Date.parse(b.frameUtc)-Date.parse(a.frameUtc));
    for(const e of sorted) {
      const article=createNode(documentRef,"article","qscope-wind-event-evidence-row");
      const label=createNode(documentRef,"strong","",e.title);
      const detailsLine=createNode(documentRef,"p","",
        "Radar "+e.radarId+" · "+timeAest(e.frameUtc)+
        (e.velocityKmh!==null?" · "+Math.abs(e.velocityKmh).toFixed(0)+" km/h radial":"")+
        (e.radialShearKmh!==null?" · "+Math.abs(e.radialShearKmh).toFixed(0)+" km/h radial shear":""));
      const note=createNode(documentRef,"p","",e.caveat);
      const view=createNode(documentRef,"button","", "View this exact frame");
      view.type="button";
      view.addEventListener("click",()=>void focusEvidence(record,e));
      article.append(label,detailsLine,note,view);
      evidenceList.appendChild(article);
    }
    const clear=createNode(documentRef,"button","qscope-wind-event-clear","Clear event");
    clear.type="button";
    clear.addEventListener("click",()=>{
      ledger.clear(record.id);openEventId="";render();
    });
    details.append(headingLine,meta,sourceNote,evidenceList,
      locationStatus,clear);
  }
  function render(){
    if(destroyed)return;
    const pending=ledger.list();
    const listed=ledger.list({includeAcknowledged:showHistory});
    root.hidden=pending.length===0 && !showHistory && !openEventId;
    count.textContent=String(pending.length)+" awaiting review";
    historyButton.textContent=showHistory?"Hide history":
      "History ("+ledger.archivedCount+")";
    listArea.replaceChildren();
    for(const record of listed){
      const item=createNode(documentRef,"article","qscope-wind-event-card");
      const open=createNode(documentRef,"button","qscope-wind-event-open",
        eventHeading(record)+" · "+record.evidence.length+
        (record.evidence.length===1?" observation":" observations")+
        " · "+timeAest(record.latestUtc));
      open.type="button";
      open.addEventListener("click",()=>openRecord(record.id));
      const clear=createNode(documentRef,"button","qscope-wind-event-dismiss",
        "Clear");
      clear.type="button";
      clear.setAttribute("aria-label","Clear event near "+
        record.latitude.toFixed(3)+", "+record.longitude.toFixed(3));
      clear.addEventListener("click",()=>{
        ledger.clear(record.id);
        if(openEventId===record.id)openEventId="";
        render();
      });
      item.append(open,clear);
      listArea.appendChild(item);
    }
    status.textContent="Automatic research observations · Remain until opened or cleared"+
      (!ledger.storageAvailable?" · Browser storage unavailable (this session only)":"")+
      " · Not official BoM warnings.";
    renderDetails();
  }
  render();
  return {
    observe(alerts,context) {
      const count=ledger.ingest(alerts,context);
      if(count)render();
      return count;
    },
    get pendingCount(){return ledger.pendingCount;},
    get events(){return ledger.list({includeAcknowledged:true});},
    get visible(){return !root.hidden;},
    openEvent:id=>openRecord(id),
    clearEvent:id=>{const ok=ledger.clear(id);if(ok)render();return ok;},
    destroy(){destroyed=true;root.remove();details.remove();}
  };
}
