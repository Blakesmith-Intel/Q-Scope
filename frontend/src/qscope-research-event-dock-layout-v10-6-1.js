// Q-SCOPE V10.6.1 research interface only. The event queue is a map control,
// not a radar imagery layer. Place it where it never intersects the original
// BoM reflectivity/Doppler legend or another visible operator control.
// Sizing/placement is local DOM work; no radar, Worker or science changes.
const MARGIN=10, GAP=10;
const MIN_DOCK_HEIGHT=104;
function clamp(value,min,max){return Math.min(max,Math.max(min,value));}
function intersects(a,b){
  if(!a||!b)return 0;
  return Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*
    Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
}
function rectInMap(element,map,win){
  if(!element||element.hidden||!element.getBoundingClientRect)return null;
  if(win.getComputedStyle){
    const style=win.getComputedStyle(element);
    if(style.display==="none"||style.visibility==="hidden")return null;
  }
  const parent=map.getBoundingClientRect(),r=element.getBoundingClientRect();
  if(r.width<=0||r.height<=0)return null;
  return {x:r.left-parent.left,y:r.top-parent.top,
    width:r.width,height:r.height};
}
// Both forms of the research event UI live immediately UNDER the real radar
// controls (#nav). No free-floating dock and no separate centred modal.
// Reserve the native BoM legend, distance scale and visible map controls.
// A long event list/evidence record scrolls INSIDE its own fixed footprint.
function anchoredBelowRadarControls({
  width,height,nav=null,legend=null,scale=null,truth=null,compass=null,
  obstacles=[],desiredWidth,desiredHeight,capHeight
}={}) {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)
    return {left:8,top:64,width:320,maxHeight:180,name:"below-radar-controls",collisionArea:0};
  const margin=width<=700?8:MARGIN;
  const navBottom=nav?nav.y+nav.height:50;
  const anchorTop=clamp(navBottom+GAP,margin,Math.max(margin,height-margin));
  const navRight=nav?nav.x+nav.width:width-margin;
  const navLeft=nav?nav.x:margin;
  // Original operator compass is mounted by the protected camera controller.
  // Measure the actual control, or reserve its original responsive footprint
  // until mounted: top 72/right 12 (56x68), mobile top 76/right 8 (48x60).
  const originalCompass=width<=650
    ?{x:width-56,y:76,width:48,height:60}
    :{x:width-68,y:72,width:56,height:68};
  const north=compass??originalCompass;
  const sameVerticalBand=north.y<anchorTop+MIN_DOCK_HEIGHT &&
    north.y+north.height>anchorTop;
  const rightLimit=sameVerticalBand
    ?Math.min(navRight,north.x-GAP):navRight;
  const widthSafe=Math.min(desiredWidth,Math.max(0,rightLimit-margin));
  // The right end of the radar toolbar is the primary anchor. An alternate
  // alignment beneath the SAME toolbar is allowed if another map control
  // occupies the right column. Never move this dock to a lower map corner.
  const placements=[
    ["below-radar-controls",rightLimit-widthSafe,0],
    ["below-radar-controls-left",navLeft,1]
  ];
  const blockers=[legend,scale,truth,north,
    ...obstacles.map(item=>item?.rect??item)].filter(rect=>
      rect&&rect.width>0&&rect.height>0);
  let best=null;
  for(const [name,rawX,priority] of placements){
    const x=clamp(rawX,margin,Math.max(margin,rightLimit-widthSafe));
    const overlapX=rect=>
      Math.min(x+widthSafe,rect.x+rect.width)-Math.max(x,rect.x)>0;
    const inColumn=blockers.filter(overlapX);
    let top=anchorTop;
    // When an operator expands a radar/menu popup directly below the
    // toolbar, step below it only if it occupies the first part of this dock.
    // The BoM legend and map scale are never allowed to push the dock down.
    for(let pass=0;pass<inColumn.length;pass++){
      const cover=inColumn.find(rect=>
        rect!==legend&&rect!==scale&&rect!==truth&&rect!==north&&
        rect.y<=top+GAP&&rect.y+rect.height>top);
      if(!cover)break;
      top=Math.min(height-margin,cover.y+cover.height+GAP);
    }
    let available=Math.max(0,Math.min(capHeight,height-margin-top));
    let collisionArea=0;
    for(const rect of inColumn){
      if(rect.y>=top)
        available=Math.min(available,Math.max(0,rect.y-top-GAP));
      else if(rect.y+rect.height>top){
        available=0;
        collisionArea+=intersects(
          {x,y:top,width:widthSafe,height:Math.min(capHeight,height-top)},rect);
      }
    }
    const maxHeight=Math.max(0,Math.min(
      Number.isFinite(desiredHeight)?desiredHeight:capHeight,available));
    const result={
      left:Math.round(x),top:Math.round(top),
      width:Math.round(widthSafe),maxHeight:Math.floor(maxHeight),
      name,collisionArea
    };
    // A second alignment is only used if it offers materially more
    // usable space. Prefer consistent right alignment below the toolbar.
    const score=collisionArea*1000+Math.max(0,MIN_DOCK_HEIGHT-maxHeight)*50+
      Math.max(0,(desiredHeight??capHeight)-maxHeight)+priority*20;
    if(!best||score<best.score)best={...result,score};
  }
  const {score,...answer}=best;
  return answer;
}
export function chooseQscopeRadarEventDock({
  width,height,contentHeight,legend=null,scale=null,nav=null,truth=null,
  compass=null,obstacles=[],narrow=width<=700
}={}) {
  return anchoredBelowRadarControls({
    width,height,nav,legend,scale,truth,compass,obstacles,
    desiredWidth:narrow?320:360,
    desiredHeight:Math.max(MIN_DOCK_HEIGHT,contentHeight||180),
    capHeight:390
  });
}
export function chooseQscopeRadarEvidenceWindow({
  width,height,legend=null,scale=null,nav=null,truth=null,compass=null,
  inbox=null,obstacles=[]
}={}) {
  // Opening the event is an in-place EXPANSION beneath #nav, not another
  // popup to hunt for. Temporarily conceal the underlying queue in all view
  // sizes; restore it as soon as the review window is closed.
  return {...anchoredBelowRadarControls({
    width,height,nav,legend,scale,truth,compass,obstacles,
    desiredWidth:500,desiredHeight:520,capHeight:520
  }),hideInbox:true};
}

export function attachQscopeResearchEventDock({
  map,inbox,details,documentRef=globalThis.document,win=globalThis.window
}={}){
  if(!map||!inbox||!details||!documentRef||!win)
    throw new TypeError("Q-SCOPE research layout requires map and event controls.");
  const named=[
    ["#legendDock",true],["#nav",true],
    ["#mapTruthLabel",false],["#mapScaleBar",true],
    ["#stormTrackerNorthCompass",true],
    ["#mapTools",true],
    ["#multiRadarPanel",true],["#mapMeasurePanel",true],
    ["#cycloneForecastQaPanel",true],
    ["#supplementalHoldNote",false],
    ["#historicalCycloneMapStamp",false],
    ["#floodRoadClosureInfo",true],["#powerOutageInfo",true],
    ["#qfdTechnicalRescueInfo",true],["#riverGaugeInfo",true]
  ];
  const targets=named.map(([selector,critical])=>({
    element:map.querySelector(selector),critical,selector
  }));
  let dead=false,scheduled=false;
  function place(){
    if(dead)return;
    const r=map.getBoundingClientRect();
    const get=selector=>rectInMap(
      targets.find(v=>v.selector===selector)?.element,map,win);
    const legend=get("#legendDock"),nav=get("#nav"),truth=get("#mapTruthLabel"),
      scale=get("#mapScaleBar"),
      compass=rectInMap(map.querySelector("#stormTrackerNorthCompass"),map,win);
    const obstacles=targets.filter(v=>
      !["#legendDock","#nav","#mapTruthLabel","#mapScaleBar",
        "#stormTrackerNorthCompass"].includes(v.selector))
      .map(v=>({rect:rectInMap(v.element,map,win),critical:v.critical}))
      .filter(v=>v.rect);
    const desired=Math.max(MIN_DOCK_HEIGHT,inbox.scrollHeight+2);
    const position=chooseQscopeRadarEventDock({
      width:r.width,height:r.height,contentHeight:desired,
      legend,scale,nav,truth,compass,obstacles,narrow:r.width<=700
    });
    // No absolute bottom/right anchoring: it caused the BoM legend to sit
    // directly across the event's open/clear actions in the V10.6 photo.
    inbox.style.bottom="auto";inbox.style.right="auto";
    inbox.style.top=position.top+"px";
    inbox.style.left=position.left+"px";
    inbox.style.width=position.width+"px";
    inbox.style.maxHeight=position.maxHeight+"px";
    inbox.dataset.placement=position.name;
    if(details.hidden){
      inbox.style.visibility="";
      return;
    }
    // Opening the evidence panel must not simply cover map controls;
    // place it independently and constrain its scroll height.
    const review=chooseQscopeRadarEvidenceWindow({
      width:r.width,height:r.height,legend,scale,nav,truth,compass,obstacles
    });
    details.style.bottom="auto";details.style.right="auto";
    details.style.transform="none";
    details.style.left=review.left+"px";
    details.style.top=review.top+"px";
    details.style.width=review.width+"px";
    details.style.maxHeight=review.maxHeight+"px";
    details.dataset.placement=review.name;
    inbox.style.visibility=review.hideInbox?"hidden":"";
    if(review.hideInbox&&inbox.contains(documentRef.activeElement)){
      details.querySelector(".qscope-wind-event-detail-title button")
        ?.focus({preventScroll:true});
    }
  }
  function schedule(){
    if(dead||scheduled)return;
    scheduled=true;
    win.requestAnimationFrame(()=>{
      scheduled=false;
      if(!dead)place();
    });
  }
  const watcher=typeof win.ResizeObserver==="function"
    ?new win.ResizeObserver(schedule):null;
  watcher?.observe(map);
  watcher?.observe(inbox);
  watcher?.observe(details);
  for(const item of targets)if(item.element)watcher?.observe(item.element);
  const mutation=typeof win.MutationObserver==="function"
    ?new win.MutationObserver(schedule):null;
  mutation?.observe(details,{
    attributes:true,attributeFilter:["hidden","class"]
  });
  for(const item of targets)if(item.element)
    mutation?.observe(item.element,{
      attributes:true,attributeFilter:["hidden","open","class","data-mode"]
    });
  // Compass can mount after the inbox; watch only its direct insertion/removal.
  const compassMutation=typeof win.MutationObserver==="function"
    ?new win.MutationObserver(records=>{
      if(records.some(record=>[...record.addedNodes,...record.removedNodes]
        .some(node=>node?.id==="stormTrackerNorthCompass")))schedule();
    }):null;
  compassMutation?.observe(map,{childList:true});
  win.addEventListener("resize",schedule,{passive:true});
  win.addEventListener("orientationchange",schedule,{passive:true});
  schedule();
  return {
    reposition:place,
    destroy(){
      dead=true;
      watcher?.disconnect();mutation?.disconnect();
      compassMutation?.disconnect();
      win.removeEventListener("resize",schedule);
      win.removeEventListener("orientationchange",schedule);
    }
  };
}
