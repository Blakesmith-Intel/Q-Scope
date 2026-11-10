// Browser-side demand shaping for OPTIONAL per-station BoM history.
// Zero additional Worker endpoints, polling services or changed data pathways.
// Current official height bulletins, flood severity and ten-minute refresh
// are independent and NEVER wait for this queue.
export const RIVER_HISTORY_PULSE_SIZE = 4;
export const RIVER_HISTORY_PULSE_SPACING_MS = 60_000;
export const RIVER_HISTORY_WINDOW_MS = 10 * 60_000;
export const RIVER_HISTORY_WINDOW_LIMIT = 24;

// Each browser session spends at most 4 station-history calls per minute and
// 24 per ten-minute window. Previously one pass could burst 64 almost at once.
// A budget-exhausted queue retains its candidates; nothing is marked safe.
export function createRiverHistoryBudget(){
  let start=null;
  let spent=0;
  let nextPulseAt=0;
  function resetIfNeeded(at){
    if(start===null || at<start || at-start>=RIVER_HISTORY_WINDOW_MS){
      start=at;
      spent=0;
    }
  }
  function allowance(at=Date.now()){
    resetIfNeeded(at);
    const quota=Math.max(0,RIVER_HISTORY_WINDOW_LIMIT-spent);
    const eligibleAt=Math.max(nextPulseAt,
      quota?at:start+RIVER_HISTORY_WINDOW_MS);
    return {
      count:at>=eligibleAt?Math.min(RIVER_HISTORY_PULSE_SIZE,quota):0,
      nextAt:eligibleAt,
      remaining:quota,
      spent
    };
  }
  function consume(count,at=Date.now()){
    const before=allowance(at);
    if(!Number.isInteger(count)||count<0||count>before.count)
      throw new Error("River history request budget exceeded");
    if(!count)return;
    spent+=count;
    nextPulseAt=at+RIVER_HISTORY_PULSE_SPACING_MS;
  }
  return {allowance,consume};
}
