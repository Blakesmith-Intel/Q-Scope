// Q-SCOPE experimental alert playback policy: never stop an operational
// or historical replay unless the operator enabled a pause and a genuinely
// new, source-dated research event arrives within the fresh observation window.
export const FRESH_RESEARCH_EVENT_MAX_AGE_MS=12*60*1000;
export function shouldPauseForNewResearchEvent({
  event,nowMs=Date.now(),isPlaying=false,isHidden=false,
  isNavigating=false,isResearch=false
}={}){
  const stamp=Date.parse(event?.latestUtc??"");
  const age=nowMs-stamp;
  return Boolean(isResearch && isPlaying && !isHidden && !isNavigating &&
    Number.isFinite(age) && age>=0 &&
    age<=FRESH_RESEARCH_EVENT_MAX_AGE_MS);
}
