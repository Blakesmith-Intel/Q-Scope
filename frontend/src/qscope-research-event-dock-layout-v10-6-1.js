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
function candidate(name,x,y,width,height,preferred,obstacles,originalHeight) {
  const rect={x,y,width,height};
  const overlap=obstacles.reduce((a,entry)=>a+intersects(rect,entry.rect)*
    (entry.critical?4:1),0);
  const truncated=Math.max(0,originalHeight-height);
  const tooSmall=height<MIN_DOCK_HEIGHT ? 100000:0;
  // A collision is more damaging than showing fewer rows in a scrollable
  // alert queue; all rows remain in the DOM and keyboard reachable.
  return {...rect,name,score:overlap*30+truncated*14+preferred+tooSmall};
}
export function chooseQscopeRadarEventDock({
  width,height,contentHeight,legend=null,nav=null,truth=null,obstacles=[],
  narrow=width<=700
}={}) {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)
    return {left:10,top:70,width:320,maxHeight:180,name:"fallback"};
  const margin=narrow?8:MARGIN;
  const dockWidth=Math.min(narrow?320:360,Math.max(120,width-2*margin));
  const hMax=Math.min(Math.max(MIN_DOCK_HEIGHT,contentHeight||180),
    390,Math.max(MIN_DOCK_HEIGHT,height-2*margin));
  const topLimit=clamp(Math.max(60,nav?nav.y+nav.height+GAP:60),
    margin,Math.max(margin,height-120));
  const bottomLimit=Math.max(59,truth?height-truth.y+GAP:59);
  const usable=Math.max(0,height-topLimit-bottomLimit);
  const xLeft=margin,xRight=Math.max(margin,width-margin-dockWidth);
  const all=[];
  const visible=obstacles.filter(x=>x&&x.rect&&x.rect.width>0&&x.rect.height>0);
  if(legend)visible.push({rect:legend,critical:true});
  if(nav)visible.push({rect:nav,critical:true});
  if(truth)visible.push({rect:truth,critical:false});
  const endsAtLegend=Boolean(legend&&legend.y>topLimit+MIN_DOCK_HEIGHT);
  for(const [name,x,bias] of [
    ["lower-left",xLeft,0],["upper-left",xLeft,12],
    ["above-legend",xRight,22],["upper-right",xRight,36],
    ["lower-right",xRight,48]
  ]) {
    let maxHeight=usable;
    let top;
    if(name==="above-legend" && endsAtLegend) {
      maxHeight=Math.min(maxHeight,legend.y-topLimit-GAP);
      const h=Math.min(hMax,maxHeight);
      top=legend.y-GAP-h;
    } else {
      // Stack above the legend where their horizontal footprints overlap.
      const sameColumn=legend &&
        Math.min(x+dockWidth,legend.x+legend.width)-
        Math.max(x,legend.x)>0;
      if(name.startsWith("upper") && sameColumn)
        maxHeight=Math.min(maxHeight,legend.y-topLimit-GAP);
      const h=Math.min(hMax,maxHeight);
      top=name.startsWith("lower")?height-bottomLimit-h:topLimit;
    }
    const actualHeight=Math.max(0,Math.min(hMax,maxHeight));
    if(actualHeight<=0)continue;
    const safeTop=clamp(top,margin,Math.max(margin,height-margin-actualHeight));
    all.push(candidate(name,x,safeTop,dockWidth,actualHeight,
      bias,visible,hMax));
  }
  all.sort((a,b)=>a.score-b.score);
  const best=all[0]??{
    name:"fallback",x:margin,y:topLimit,width:dockWidth,
    height:Math.max(MIN_DOCK_HEIGHT,usable)
  };
  return {
    left:Math.round(best.x),top:Math.round(best.y),
    width:Math.round(best.width),maxHeight:Math.round(best.height),
    name:best.name,collisionArea:visible.reduce(
      (sum,v)=>sum+intersects(best,v.rect),0)
  };
}
export function attachQscopeResearchEventDock({
  map,inbox,details,documentRef=globalThis.document,win=globalThis.window
}={}){
  if(!map||!inbox||!details||!documentRef||!win)
    throw new TypeError("Q-SCOPE research layout requires map and event controls.");
  const named=[
    ["#legendDock",true],["#nav",true],
    ["#mapTruthLabel",false],["#mapTools",true],
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
    const legend=get("#legendDock"),nav=get("#nav"),truth=get("#mapTruthLabel");
    const obstacles=targets.filter(v=>
      !["#legendDock","#nav","#mapTruthLabel"].includes(v.selector))
      .map(v=>({rect:rectInMap(v.element,map,win),critical:v.critical}))
      .filter(v=>v.rect);
    const desired=Math.max(MIN_DOCK_HEIGHT,inbox.scrollHeight+2);
    const position=chooseQscopeRadarEventDock({
      width:r.width,height:r.height,contentHeight:desired,
      legend,nav,truth,obstacles,narrow:r.width<=700
    });
    // No absolute bottom/right anchoring: it caused the BoM legend to sit
    // directly across the event's open/clear actions in the V10.6 photo.
    inbox.style.bottom="auto";inbox.style.right="auto";
    inbox.style.top=position.top+"px";
    inbox.style.left=position.left+"px";
    inbox.style.width=position.width+"px";
    inbox.style.maxHeight=position.maxHeight+"px";
    inbox.dataset.placement=position.name;
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
  for(const item of targets)if(item.element)watcher?.observe(item.element);
  const mutation=typeof win.MutationObserver==="function"
    ?new win.MutationObserver(schedule):null;
  for(const item of targets)if(item.element)
    mutation?.observe(item.element,{
      attributes:true,attributeFilter:["hidden","open","class","data-mode"]
    });
  win.addEventListener("resize",schedule,{passive:true});
  win.addEventListener("orientationchange",schedule,{passive:true});
  schedule();
  return {
    reposition:place,
    destroy(){
      dead=true;
      watcher?.disconnect();mutation?.disconnect();
      win.removeEventListener("resize",schedule);
      win.removeEventListener("orientationchange",schedule);
    }
  };
}
