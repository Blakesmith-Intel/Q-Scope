// Append-only, source-true 30/60/120/180-minute radar loop planning.
// This module cannot manufacture observations or change an existing frame.
function identity(frame) {
  const utc=frame?.observedUtc;
  const epoch=Date.parse(utc);
  if(!Number.isFinite(epoch))return null;
  const inferred=Boolean(frame?.sourceMetadata?.temporalInference);
  return {utc,epoch,inferred};
}
function validSequence(frames) {
  if(!Array.isArray(frames)||!frames.length)return false;
  let last=-Infinity;
  for(const frame of frames){
    const id=identity(frame);
    if(!id||id.epoch<=last)return false;
    last=id.epoch;
  }
  return true;
}
// Returns null for recovered older scans, changed inference, site switches,
// changed loop windows, or nonmonotonic source timestamps. Those still use
// the original verified chronological rebuild; never hide a backfill.
export function planIncrementalRadarWindow(previousFrames,nextFrames){
  if(!validSequence(previousFrames)||!validSequence(nextFrames))return null;
  const previousLast=identity(previousFrames.at(-1));
  const nextLast=identity(nextFrames.at(-1));
  if(nextLast.epoch<=previousLast.epoch)return null;
  const retainedStart=previousFrames.findIndex(frame=>
    identity(frame).utc===identity(nextFrames[0]).utc
  );
  // The new window may start before the previous: only a complete fallback
  // can safely recompute such a changed timeline.
  if(retainedStart<0)return null;
  const retainedCount=previousFrames.length-retainedStart;
  if(retainedCount<1||nextFrames.length<=retainedCount)return null;
  for(let index=0;index<retainedCount;index++){
    const old=identity(previousFrames[retainedStart+index]);
    const current=identity(nextFrames[index]);
    if(old.utc!==current.utc||old.inferred!==current.inferred)return null;
    if(previousFrames[retainedStart+index]?.sourceMetadata?.region !==
       nextFrames[index]?.sourceMetadata?.region)return null;
  }
  return {
    dropped:retainedStart,
    retained:retainedCount,
    appended:nextFrames.length-retainedCount,
    appendStart:retainedCount,
    lastObservedUtc:nextLast.utc
  };
}
