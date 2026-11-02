// Await each complete scene update before advancing; never overlap renders.
export function createContinuousPlayback({ count, currentIndex, showFrame, delay, onPlayingChange = () => {}, onError = () => {}, continueOnFailedCycle = false }) {
  let playing = false;
  let generation = 0;
  let pending = Promise.resolve();
  function pause() {
    playing = false;
    generation++;
    onPlayingChange(false);
    return pending;
  }
  function play() {
    if (playing || count() < 2) return pending;
    playing = true;
    const token = ++generation;
    onPlayingChange(true);
    // Queue behind a stopped render so rapid Pause/Play cannot overlap it.
    pending = pending.then(async () => {
      // A rejected image handover must not trap us endlessly on the same
      // unrenderable source frame. The last successfully displayed observation
      // stays visible; the next attempt advances to the next genuine frame.
      let cursor = currentIndex();
      let lastAccepted = cursor;
      let failedSteps = 0;
      while (playing && token === generation && count() > 1) {
        // A rolling source window can retire old scans while the player runs.
        // Rebase the private cursor to the actually displayed observation;
        // keep the failed-step cursor only when a tile could not render.
        if (currentIndex() !== lastAccepted) cursor = currentIndex();
        const startedAt = performance.now();
        const target = (cursor + 1) % count();
        const presented = await showFrame(target);
        if (!playing || token !== generation) return;
        if (presented === false) {
          cursor = target;
          failedSteps++;
          if (failedSteps >= count() * 2) {
            if (!continueOnFailedCycle)
              throw new Error("Playback stopped: consecutive radar/Doppler frames could not be presented.");
            // This is a presentation failure, not a fabricated or missing
            // observation. Retain the previous genuine image and keep the
            // playback clock alive while Cesium recovers. Bound retry pressure.
            failedSteps = 0;
            onError(new Error(
              "Radar imagery is still rendering; retaining last verified frame and retrying."
            ));
            await new Promise(resolve => setTimeout(resolve, Math.max(1000, delay())));
          }
        } else {
          cursor = currentIndex();
          failedSteps = 0;
        }
        lastAccepted = currentIndex();
        // Account for render time; never introduce an extra full-frame wait.
        const remaining = Math.max(0, delay() - (performance.now() - startedAt));
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining));
        }
      }
    }).catch(error => {
      if (token === generation) {
        pause();
        onError(error);
      }
    });
    return pending;
  }
  return { play, pause, isPlaying: () => playing };
}
