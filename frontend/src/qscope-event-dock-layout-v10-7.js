// Q-SCOPE V10.7 research UI only. One map panel, two distinct layout slots:
// the existing original BoM legend must never obscure persistent alert cards.
// The numeric calculations are unit-testable and do not alter weather sources.
const PADDING=12;
const GAP=12;
const MAX_INBOX=360;
const MAX_DETAIL=445;
const MIN_NAV_CLEAR=56;
const MIN_INBOX_HEIGHT=92;

export function calculateQScopeEventDock({
  width,height,legendWidth=0,legendHeight=0,legendTop=null,
  legendBottom=null,navBottom=0
}={}){
  if(!Number.isFinite(width)||!Number.isFinite(height) ||
     width<1||height<1)throw new RangeError("Expected map panel dimensions");
  const trayWidth=Math.min(MAX_INBOX,Math.max(1,width-2*PADDING));
  const rightLegend=Math.max(0,Number(legendWidth)||0);
  const clearTop=Math.max(MIN_NAV_CLEAR,
    (Number.isFinite(navBottom)?navBottom:0)+GAP);
  // Use the map panel's actual measured width, NOT window.innerWidth:
  // a sidebar and a separately open browser pane can reduce the map width.
  const split=width>=trayWidth+rightLegend+PADDING*3+GAP;
  const footer=Number.isFinite(legendBottom)?Math.max(0,legendBottom):56;
  const reserved=Number.isFinite(legendTop)?
    Math.max(footer, height-legendTop+GAP):
    Math.max(footer,legendHeight+56+GAP);
  const inboxBottom=split?Math.max(footer,56):reserved;
  const heightBudget=Math.max(MIN_INBOX_HEIGHT,
    height-inboxBottom-clearTop-GAP);
  const inboxMaxHeight=Math.min(390,heightBudget);
  const detailTop=clearTop;
  const remainingAboveLegend=height-detailTop-reserved-GAP;
  return {
    mode:split?"split":"stacked",
    inboxLeft:split?PADDING:null,
    inboxRight:split?null:PADDING,
    inboxBottom, inboxMaxHeight,
    detailLeft:split?PADDING:null,
    detailRight:split?null:PADDING,
    detailTop,
    detailMaxHeight:Math.max(110,Math.min(520,
      split?height-detailTop-PADDING:
      (remainingAboveLegend>=190?remainingAboveLegend:height-detailTop-PADDING))),
    hideLegendWhileReview:!split&&remainingAboveLegend<190,
    maxWidth:Math.min(MAX_DETAIL,Math.max(1,width-2*PADDING))
  };
}
function setStyle(element,name,value){
  if(element.style[name]!==value)element.style[name]=value;
}
function pixel(number){return Math.round(number)+"px";}
export function attachQScopeRadarEventLayout({
  mapPanel,
  inbox=mapPanel?.querySelector?.(".qscope-wind-event-inbox"),
  detail=mapPanel?.querySelector?.(".qscope-wind-event-detail"),
  legend=mapPanel?.querySelector?.("#legendDock"),
  nav=mapPanel?.querySelector?.("#nav"),
  view=globalThis
}={}){
  if(!mapPanel||!inbox||!detail||!legend)
    throw new TypeError("Q-SCOPE radar event layout requires live map, inbox, detail and original BoM legend.");
  let destroyed=false,queued=false;
  let last=null;
  function measure(){
    if(destroyed)return null;
    const panel=mapPanel.getBoundingClientRect();
    const lr=legend.getBoundingClientRect();
    const nr=nav?.getBoundingClientRect?.();
    const shown=lr.width>0&&lr.height>0 &&
      view.getComputedStyle(legend).display!=="none";
    const arrangement=calculateQScopeEventDock({
      width:panel.width,height:panel.height,
      legendWidth:shown?lr.width:0,legendHeight:shown?lr.height:0,
      legendTop:shown?lr.top-panel.top:null,
      legendBottom:shown?panel.bottom-lr.bottom:0,
      navBottom:nr?nr.bottom-panel.top:0
    });
    last=arrangement;
    mapPanel.dataset.qscopeEventDock=arrangement.mode;
    mapPanel.dataset.qscopeEventReview=String(!detail.hidden);
    mapPanel.dataset.qscopeLegendReviewHidden=String(
      !detail.hidden && arrangement.hideLegendWhileReview);
    setStyle(inbox,"left",arrangement.inboxLeft===null?"auto":pixel(arrangement.inboxLeft));
    setStyle(inbox,"right",arrangement.inboxRight===null?"auto":pixel(arrangement.inboxRight));
    setStyle(inbox,"bottom",pixel(arrangement.inboxBottom));
    setStyle(inbox,"maxHeight",pixel(arrangement.inboxMaxHeight));
    setStyle(detail,"left",arrangement.detailLeft===null?"auto":pixel(arrangement.detailLeft));
    setStyle(detail,"right",arrangement.detailRight===null?"auto":pixel(arrangement.detailRight));
    setStyle(detail,"top",pixel(arrangement.detailTop));
    setStyle(detail,"bottom","auto");
    setStyle(detail,"maxWidth",pixel(arrangement.maxWidth));
    setStyle(detail,"maxHeight",pixel(arrangement.detailMaxHeight));
    return arrangement;
  }
  function schedule(){
    if(destroyed||queued)return;
    queued=true;
    view.requestAnimationFrame(()=>{
      queued=false;
      if(!destroyed)measure();
    });
  }
  const resize=view.ResizeObserver?
    new view.ResizeObserver(schedule):null;
  resize?.observe(mapPanel);
  resize?.observe(legend);
  resize?.observe(inbox);
  if(nav)resize?.observe(nav);
  const mutation=view.MutationObserver?
    new view.MutationObserver(schedule):null;
  mutation?.observe(detail,{attributes:true,attributeFilter:["hidden"]});
  mutation?.observe(legend,{attributes:true,attributeFilter:["data-mode","hidden"]});
  view.addEventListener("resize",schedule);
  measure();
  return {
    refresh:measure,
    get lastLayout(){return last?{...last}:null;},
    destroy(){
      destroyed=true;
      resize?.disconnect();mutation?.disconnect();
      view.removeEventListener("resize",schedule);
      delete mapPanel.dataset.qscopeEventDock;
      delete mapPanel.dataset.qscopeEventReview;
      delete mapPanel.dataset.qscopeLegendReviewHidden;
      for(const el of [inbox,detail])
        for(const key of ["left","right","top","bottom","maxHeight","maxWidth"])
          el.style[key]="";
    }
  };
}
