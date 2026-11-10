// Q-SCOPE V10.6 experimental radar-event inbox. This is a passive research
// notification, not a BoM warning layer or an issued emergency alert.
// Source-time observations persist until the operator opens or clears them.
// No automatic camera movement, playback rewrites, audio or alert promotion.
export const Q_SCOPE_EVENT_STORAGE_KEY = "qscope:v10.5:research-radar-events"; // Shared with v10.5 to recover existing events.
export const Q_SCOPE_PAUSE_PREFERENCE_KEY = "qscope:v10.6:pause-on-new-research-event";
const MAX_SNAPSHOT_CHARS = 90000;
function verifiedSnapshot(snapshot, frameUtc, mode) {
  if (!snapshot || typeof snapshot.dataUrl!=="string" ||
      !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(snapshot.dataUrl) ||
      snapshot.dataUrl.length>MAX_SNAPSHOT_CHARS ||
      snapshot.mode!==mode || snapshot.observedUtc!==frameUtc ||
      typeof snapshot.label!=="string" || snapshot.label.length>260) return null;
  return {dataUrl:snapshot.dataUrl,label:snapshot.label,
    observedUtc:frameUtc,mode};
}
const GROUP_DISTANCE_KM = 8;
const GROUP_WINDOW_MS = 30 * 60000;
const MAX_STORED_BYTES = 2000000;
const CATEGORY_PRIORITY = Object.freeze({
  tornadic_candidate: 3, hook_shape_only: 2, strong_radial_signature: 1
});
// Radar signature review priority, NOT a surface-wind magnitude, a verified
// tornado classification, or an official BoM warning. Retain original source
// categories for exact detection provenance and persisted event compatibility.
export const RESEARCH_RADAR_EVENT_TYPES = Object.freeze({
  strong_radial_signature:{
    severity:"wind",rank:1,
    label:"POSSIBLE STRAIGHT-LINE WIND",
    priority:"WIND SIGNATURE · REVIEW",
    evidence:"Strong radial-wind signature (wind type and surface gust unverified)"
  },
  hook_shape_only:{
    severity:"hook",rank:2,
    label:"HOOK ECHO",
    priority:"HOOK SHAPE · ELEVATED REVIEW",
    evidence:"Possible hook-shaped reflectivity echo (rotation not confirmed)"
  },
  tornadic_candidate:{
    severity:"couplet",rank:3,
    label:"HOOK + VELOCITY COUPLET",
    priority:"COMBINED SIGNAL · HIGH-PRIORITY REVIEW",
    evidence:"Hook shape with persistent Doppler couplet candidate (tornado not confirmed)"
  }
});
const CATEGORY_LABEL = Object.freeze(Object.fromEntries(
  Object.entries(RESEARCH_RADAR_EVENT_TYPES).map(([key,value])=>[
    key,value.evidence
  ])
));
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
    arcDegrees: finite(alert.arc_degrees) ? alert.arc_degrees : null,
    snapshot: verifiedSnapshot(alert.snapshot,context.frameUtc,context.mode)
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
      typeof e.title === "string").map(e=>({
        ...e,snapshot:verifiedSnapshot(e.snapshot,e.frameUtc,e.mode)
      }));
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
        // Preserve the actual alert/evidence ledger over optional image crops.
        const withCrops=events.flatMap(record=>record.evidence)
          .filter(e=>e.snapshot);
        for(const evidence of withCrops) {
          evidence.snapshot=null;
          if(JSON.stringify({version:1,events}).length<=MAX_STORED_BYTES)
            break;
        }
        const compact=JSON.stringify({version:1,events});
        if(compact.length>MAX_STORED_BYTES) {
          storageAvailable=false;return false;
        }
        storage.setItem(storageKey,compact);
        return true;
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
      const existing=target.evidence.find(existing=>existing.key===e.key);
      if(existing) {
        // Improve the existing historical event if a native source crop was
        // not yet available when the first alert arrived. No new notification.
        if(!existing.snapshot && e.snapshot) {
          existing.snapshot=e.snapshot;
          changed++;
        }
        continue;
      }
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
export function radarEventPresentation(e) {
  const best=bestEvidence(e);
  const selected=RESEARCH_RADAR_EVENT_TYPES[best?.category]??
    RESEARCH_RADAR_EVENT_TYPES.strong_radial_signature;
  const hasWind=e.evidence.some(item=>
    item.category==="strong_radial_signature");
  const mixed=hasWind&&best?.category!=="strong_radial_signature";
  return {...selected,
    summary:selected.label+(mixed?" + RADIAL WIND SIGNATURE":""),
    // Preserve labels for multiple evidence types in the ONE grouped window.
    observationCount:e.evidence.length
  };
}
function eventHeading(e) {
  const presentation=radarEventPresentation(e);
  return presentation.summary+" · "+presentation.priority;
}
const RADAR_SIGNATURE_GLYPHS=Object.freeze({
  wind:"≋",hook:"↶",couplet:"⟳"
});
function signatureIdentity(doc,presentation,kind) {
  const bar=createNode(doc,"div","qscope-wind-signature-identity");
  bar.dataset.severity=presentation.severity;
  const emblem=createNode(doc,"span","qscope-wind-signature-emblem",
    RADAR_SIGNATURE_GLYPHS[presentation.severity]);
  emblem.setAttribute("aria-hidden","true");
  const summary=createNode(doc,"div","qscope-wind-signature-summary");
  summary.append(
    createNode(doc,"strong","",presentation.summary),
    createNode(doc,"span","qscope-wind-signature-priority",
      presentation.priority+" · EXPERIMENTAL")
  );
  bar.append(emblem,summary);
  return bar;
}
export function createPassiveWindEventInbox({
  container, documentRef=globalThis.document,
  storage=globalThis.localStorage, onNewEvent=()=>{}, onNavigate=async()=>({ok:false,
    message:"Radar frame navigation is unavailable."})
}={}) {
  if(!container||!documentRef)throw new TypeError("Research inbox needs a map container.");
  const ledger=createResearchRadarEventLedger({storage});
  let openEventId="",showHistory=false,destroyed=false;
  let pauseOnNewEvent=false;
  try { pauseOnNewEvent=storage?.getItem(Q_SCOPE_PAUSE_PREFERENCE_KEY)==="true"; }
  catch { /* Session-only setting when storage is blocked. */ }
  const root=createNode(documentRef,"section","qscope-wind-event-inbox");
  root.setAttribute("aria-label","Q-SCOPE experimental radar event queue");
  const heading=createNode(documentRef,"div","qscope-wind-event-header");
  const title=createNode(documentRef,"strong","", "Q-SCOPE · RADAR EVENTS · RESEARCH");
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
  const pauseLabel=createNode(documentRef,"label","qscope-wind-event-pause-setting");
  const pauseCheckbox=createNode(documentRef,"input");
  pauseCheckbox.type="checkbox";
  pauseCheckbox.checked=pauseOnNewEvent;
  pauseCheckbox.addEventListener("change",()=>{
    pauseOnNewEvent=Boolean(pauseCheckbox.checked);
    try {storage?.setItem(Q_SCOPE_PAUSE_PREFERENCE_KEY,String(pauseOnNewEvent));}
    catch {/* Leave live preference usable for this session. */}
  });
  pauseLabel.append(pauseCheckbox,documentRef.createTextNode(" Pause on new event"));
  controls.append(pauseLabel,historyButton);
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
    const presentation=radarEventPresentation(record);
    details.dataset.severity=presentation.severity;
    const headingLine=createNode(documentRef,"div","qscope-wind-event-detail-title");
    const label=createNode(documentRef,"strong","",eventHeading(record));
    const dismiss=createNode(documentRef,"button","", "Close window");
    dismiss.type="button";
    dismiss.addEventListener("click",()=>{
      openEventId="";renderDetails();render();
    });
    headingLine.append(label,dismiss);
    const identity=signatureIdentity(documentRef,presentation,"detail");
    const meta=createNode(documentRef,"p","",
      "Recorded "+timeAest(record.firstUtc)+"–"+timeAest(record.latestUtc)+
      " · "+record.latitude.toFixed(3)+"°, "+record.longitude.toFixed(3)+"°");
    const sourceNote=createNode(documentRef,"p","",
      "Radar signature review priority only · Not a confirmed surface wind gust, tornado, road impact or official BoM warning. Original BoM products remain authoritative.");
    const evidenceList=createNode(documentRef,"div","qscope-wind-event-evidence");
    const sorted=[...record.evidence].sort((a,b)=>
      CATEGORY_PRIORITY[b.category]-CATEGORY_PRIORITY[a.category] ||
      Date.parse(b.frameUtc)-Date.parse(a.frameUtc));
    for(const e of sorted) {
      const article=createNode(documentRef,"article","qscope-wind-event-evidence-row");
      article.dataset.severity=RESEARCH_RADAR_EVENT_TYPES[e.category]?.severity??"wind";
      const label=createNode(documentRef,"strong","",
        RESEARCH_RADAR_EVENT_TYPES[e.category]?.evidence??e.title);
      const detailsLine=createNode(documentRef,"p","",
        "Radar "+e.radarId+" · "+timeAest(e.frameUtc)+
        (e.velocityKmh!==null?" · "+Math.abs(e.velocityKmh).toFixed(0)+" km/h radial":"")+
        (e.radialShearKmh!==null?" · "+Math.abs(e.radialShearKmh).toFixed(0)+" km/h radial shear":""));
      const note=createNode(documentRef,"p","",e.caveat);
      const view=createNode(documentRef,"button","", "View this exact frame");
      view.type="button";
      view.addEventListener("click",()=>void focusEvidence(record,e));
      if(e.snapshot) {
        const snapshot=createNode(documentRef,"figure","qscope-wind-evidence-snapshot");
        const image=createNode(documentRef,"img");
        image.src=e.snapshot.dataUrl;
        image.alt="Retained historical source scan crop at detected event location";
        image.loading="lazy";
        const description=createNode(documentRef,"figcaption","",e.snapshot.label+
          " · original frame "+e.snapshot.observedUtc+
          ". This retained crop remains available when BoM's live loop expires.");
        snapshot.append(image,description);
        article.append(label,detailsLine,note,snapshot,view);
      } else {
        const explanation=createNode(documentRef,"p","qscope-wind-no-snapshot",
          "Source image not retained; the exact live BoM frame may expire.");
        article.append(label,detailsLine,note,explanation,view);
      }
      evidenceList.appendChild(article);
    }
    const clear=createNode(documentRef,"button","qscope-wind-event-clear","Clear event");
    clear.type="button";
    clear.addEventListener("click",()=>{
      ledger.clear(record.id);openEventId="";render();
    });
    details.append(headingLine,identity,meta,sourceNote,evidenceList,
      locationStatus,clear);
  }
  function render(){
    if(destroyed)return;
    const pending=ledger.list();
    const listed=ledger.list({includeAcknowledged:showHistory});
    // Passive by default. Completely remove the queue from the map when
    // there are neither pending observations nor historical events to view.
    // Previous opt-in pause preference remains in storage even while hidden.
    // Never hide an explicitly opened evidence window.
    root.hidden=pending.length===0&&ledger.archivedCount===0&&!openEventId;
    root.dataset.empty=String(pending.length===0 &&
      ledger.archivedCount===0 && !showHistory && !openEventId);
    count.textContent=String(pending.length)+" awaiting review";
    historyButton.textContent=showHistory?"Hide history":
      "History ("+ledger.archivedCount+")";
    listArea.replaceChildren();
    for(const record of listed){
      const presentation=radarEventPresentation(record);
      const item=createNode(documentRef,"article","qscope-wind-event-card");
      item.dataset.severity=presentation.severity;
      const open=createNode(documentRef,"button","qscope-wind-event-open");
      const identity=signatureIdentity(documentRef,presentation,"compact");
      const eventMeta=createNode(documentRef,"span","qscope-wind-card-meta",
        record.evidence.length+
        (record.evidence.length===1?" radar observation":" radar observations")+
        " · "+timeAest(record.latestUtc));
      open.append(identity,eventMeta);
      // Use the ACTUAL retained scan crop, never illustrative radar pixels,
      // fake arrows or AI imagery masquerading as an observed signature.
      const original=bestEvidence(record)?.snapshot;
      if(original){
        const sourceThumb=createNode(documentRef,"img","qscope-wind-card-source");
        sourceThumb.src=original.dataUrl;
        sourceThumb.alt="Retained source radar image at the detected time";
        sourceThumb.loading="lazy";
        open.appendChild(sourceThumb);
      }
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
    status.textContent="Priority reflects experimental radar signatures, not confirmed impact or official BoM severity · Remain until opened or cleared"+
      (!ledger.storageAvailable?" · Browser storage unavailable (this session only)":"")+
      " · Not official BoM warnings.";
    renderDetails();
  }
  render();
  return {
    observe(alerts,context) {
      const idsBefore=new Set(ledger.list().map(event=>event.id));
      const count=ledger.ingest(alerts,context);
      if(count)render();
      // Only a genuinely NEW pending event can pause. Extra evidence in the
      // same event, loop replays, cleared alerts and acknowledgements cannot.
      const added=ledger.list().filter(event=>!idsBefore.has(event.id));
      if(pauseOnNewEvent)for(const event of added)
        onNewEvent(snapshotEvent(event),context);
      return count;
    },
    get pauseOnNewEvent(){return pauseOnNewEvent;},
    setPauseOnNewEvent(value){
      pauseOnNewEvent=Boolean(value);
      pauseCheckbox.checked=pauseOnNewEvent;
      try {storage?.setItem(Q_SCOPE_PAUSE_PREFERENCE_KEY,String(pauseOnNewEvent));}
      catch {}
    },
    get pendingCount(){return ledger.pendingCount;},
    get events(){return ledger.list({includeAcknowledged:true});},
    get visible(){return !root.hidden;},
    openEvent:id=>openRecord(id),
    clearEvent:id=>{
      const ok=ledger.clear(id);
      if(ok){
        if(openEventId===id)openEventId="";
        render();
      }
      return ok;
    },
    destroy(){destroyed=true;root.remove();details.remove();}
  };
}
