import assert from 'node:assert/strict';
import { createContinuousPlayback } from '../src/continuous-playback-v1.js';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let index = 0, active = 0, maxActive = 0;
const shown = [];
const changes = [];
let stop;
const completed = new Promise(resolve => { stop = resolve; });
const playback = createContinuousPlayback({
  count: () => 3, currentIndex: () => index, delay: () => 1,
  showFrame: async next => {
    active++;
    maxActive = Math.max(maxActive, active);
    await sleep(2);
    index = next;
    shown.push(next);
    active--;
    if (shown.length === 7) { playback.pause(); stop(); }
  },
  onPlayingChange: value => changes.push(value)
});
playback.play();
playback.play();
await completed;
await playback.pause();
assert.deepEqual(shown, [1, 2, 0, 1, 2, 0, 1]);
assert.equal(maxActive, 1);
assert.equal(playback.isPlaying(), false);
const pausedCount = shown.length;
await sleep(10);
assert.equal(shown.length, pausedCount);
assert.equal(changes.filter(Boolean).length, 1);
// Pausing and immediately restarting while a render is still pending stays serial.
let release, started;
const firstStarted = new Promise(resolve => { started = resolve; });
let renders = 0, overlaps = 0;
const blocked = createContinuousPlayback({
  count: () => 2, currentIndex: () => 0, delay: () => 1,
  showFrame: async () => {
    if (++renders > 1) overlaps++;
    started();
    await new Promise(resolve => { release = resolve; });
    renders--;
  }
});
blocked.play();
await firstStarted;
blocked.pause();
blocked.play();
blocked.pause();
release();
await blocked.pause();
assert.equal(overlaps, 0);
let errors = 0;
const failed = createContinuousPlayback({count:()=>2,currentIndex:()=>0,delay:()=>1,showFrame:async()=>{throw Error('failed');},onError:()=>errors++});
await failed.play();
assert.equal(errors, 1);
assert.equal(failed.isPlaying(), false);
let oneRendered = false;
const single = createContinuousPlayback({count:()=>1,currentIndex:()=>0,delay:()=>1,showFrame:async()=>{oneRendered=true;}});
await single.play();
assert.equal(oneRendered, false);
// A single failed original-source imagery handover must not trap playback at
// that index on every pass; the old visible scan is retained and the next
// genuine scheduled source index is attempted.
let cursor=0;
const attempts=[];
let finishAttempts;
const sixAttempts=new Promise(resolve=>{finishAttempts=resolve;});
const skipFailed=createContinuousPlayback({
  count:()=>5,currentIndex:()=>cursor,delay:()=>1,
  showFrame:async next=>{
    attempts.push(next);
    if(next!==2)cursor=next;
    if(attempts.length>=6) {
      skipFailed.pause();
      finishAttempts();
    }
    return next!==2;
  }
});
skipFailed.play();
await sixAttempts;
await skipFailed.pause();
assert.deepEqual(attempts,[1,2,3,4,0,1],
  "a transient failed source frame should not be retried forever");

// A temporarily slow Cesium image handover must not turn Pause into Play or
// permanently disable future original-source attempts. The existing default
// fail-stop behaviour above remains unchanged for other playback consumers.
let retries=0, recovered=0, slowIndex=0, warnings=0;
const resilientStates=[];
let resolveRecovery;
const recoveredFrames=new Promise(resolve=>{resolveRecovery=resolve;});
const resilient=createContinuousPlayback({
  count:()=>3,currentIndex:()=>slowIndex,delay:()=>1,
  continueOnFailedCycle:true,
  showFrame:async next=>{
    retries++;
    if(retries<=6)return false; // two complete unsuccessful image cycles
    slowIndex=next;
    if(++recovered===2){resilient.pause();resolveRecovery();}
    return true;
  },
  onPlayingChange:state=>resilientStates.push(state),
  onError:()=>warnings++
});
resilient.play();
await recoveredFrames;
await resilient.pause();
assert.equal(recovered,2,"Playback must resume real frames after delayed handovers");
assert.equal(warnings,1,"One bounded warning per failed playback cycle");
assert.deepEqual(resilientStates,[true,false],
  "No intermediate Play transition during genuine-image retries");

console.log('Continuous playback checks passed including skipped tile handovers and no overlapping renders.');
