// Browser-only, source-faithful Cesium radar imagery handover.
//
// Keep the previous measured/inferred image visible until the incoming image
// has been added to the globe AND its queued imagery tiles have rendered.
// Never expose the bare basemap between successive radar observations.
export function createRadarImageryHandover({
  imageryLayers, scene, setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
  retireLayer = null,
  // Reuse only a bounded number of PREVIOUSLY RENDERED original-source
  // primary radar layers. Other consumers retain legacy disposal unchanged.
  maxRetainedLayers = 0
}) {
  if (!imageryLayers || !scene?.postRender) {
    throw new TypeError("Radar imagery handover needs Cesium imagery and render events");
  }
  let activeLayer = null;
  let pending = null;
  let generation = 0;
  // Provider identity is tied to the actual decoded BoM image, not a
  // timestamp label. A corrected/reloaded PNG cannot reuse stale pixels.
  const retained = new Map();
  const retainedLimit = Math.max(0, Math.min(5, Math.trunc(Number(maxRetainedLayers)||0)));
  function forgetRetained(layer) {
    if(layer?.imageryProvider && retained.get(layer.imageryProvider)===layer)
      retained.delete(layer.imageryProvider);
  }
  function retainOldLayer(layer) {
    if(!retainedLimit || !layer?.imageryProvider) {
      safeRemove(layer);
      return;
    }
    // The image stays GPU-ready but invisible, retaining the exact native
    // source pixels until that genuine frame is selected again.
    layer.alpha=0;
    layer.show=false;
    retained.delete(layer.imageryProvider);
    retained.set(layer.imageryProvider,layer);
    while(retained.size>retainedLimit) {
      const [provider,obsolete]=retained.entries().next().value;
      retained.delete(provider);
      safeRemove(obsolete);
    }
  }

  function safeRemove(layer) {
    if (!layer) return;
    forgetRetained(layer);
    try {
      if(retireLayer && retireLayer(layer))return;
      imageryLayers.remove(layer,true);
    } catch { /* view reset */ }
  }
  function cancelPending() {
    generation++;
    if (pending) {
      const abandoned = pending;
      pending = null;
      abandoned.cancel();
    }
  }
  function reset() {
    cancelPending();
    for(const layer of retained.values())safeRemove(layer);
    retained.clear();
    safeRemove(activeLayer);
    activeLayer = null;
    scene.requestRender();
  }
  function setOpacity(alpha) {
    if (activeLayer) {
      activeLayer.alpha = Math.max(0, Math.min(1, Number(alpha) || 0));
      scene.requestRender();
    }
  }

  async function replace(layer, {
    alpha = 1,
    timeoutMs = 2200,
    decodedSingleTile = false,
    beforeReveal = null,
    isCurrent = () => true
  } = {}) {
    if (!layer) throw new TypeError("Replacement radar imagery is required");
    cancelPending();
    const myGeneration = generation;
    const targetAlpha = Math.max(0, Math.min(1, Number(alpha) || 0));
    const previous = activeLayer;
    // A previously rendered ORIGINAL BoM image can be reused without
    // creating and retiring a fresh WebGL texture on every six-frame loop.
    const provider = layer.imageryProvider;
    const reusable = retainedLimit && provider ? retained.get(provider) : null;
    const fromCache = Boolean(reusable && imageryLayers.indexOf(reusable)>=0);
    if(fromCache) {
      retained.delete(provider);
      layer=reusable;
    } else if(reusable) {
      retained.delete(provider);
    }
    // The displayed observation has not changed; do not churn GPU imagery.
    if(retainedLimit && provider && previous?.imageryProvider===provider) {
      if(beforeReveal)beforeReveal();
      previous.alpha=targetAlpha;
      scene.requestRender();
      return true;
    }

    // First frame has no outgoing image to retain. All subsequent transitions
    // preserve the complete outgoing image until the new one is ready.
    if (!previous) {
      // Geometry and the first authentic radar scan appear in the SAME
      // Cesium render transaction, not on successive frames.
      layer.alpha = 0;
      imageryLayers.add(layer);
      try {
        if (beforeReveal) beforeReveal();
      } catch (error) {
        safeRemove(layer);
        scene.requestRender();
        throw error;
      }
      if (myGeneration !== generation || !isCurrent()) {
        safeRemove(layer);
        return false;
      }
      layer.alpha = targetAlpha;
      activeLayer = layer;
      scene.requestRender();
      return true;
    }

    // Nonzero alpha ensures Cesium continues loading the staged layer. It sits
    // UNDER the currently visible weather overlay and cannot flash bare map.
    layer.alpha = 0.001;
    layer.show = true;
    if(fromCache) {
      // A cached image remains in Cesium's collection, hidden beneath the
      // current genuine scan. Restore it without a second layer insertion.
      imageryLayers.raiseToTop(previous);
    } else {
      imageryLayers.add(layer, imageryLayers.indexOf(previous));
    }
    scene.requestRender();

    const ready = await new Promise(resolve => {
      let done = false;
      let frames = 0;
      let consecutiveReady = 0;
      let detach = () => {};
      let deadline;
      const finish = ok => {
        if (done) return;
        done = true;
        detach();
        clearTimeoutImpl(deadline);
        if (pending === entry) pending = null;
        resolve(ok);
      };
      const entry = { cancel: () => finish(false) };
      pending = entry;
      detach = scene.postRender.addEventListener(() => {
        if (myGeneration !== generation || !isCurrent()) {
          finish(false);
          return;
        }
        frames++;
        // Cesium's documented signal covers queued terrain and imagery
        // for this view. Two consecutive rendered frames avoid a single
        // stale true immediately after the layer was inserted.
        // A decoded native BoM SingleTile image does not depend on unrelated
        // basemap/terrain requests completing. Permit handover after THREE
        // successful render boundaries even if the global Cesium tile queue
        // is still busy with other layers. Non-predecoded imagery must pass
        // the existing global tilesLoaded test.
        const imageReady = scene.globe?.tilesLoaded === true ||
          (decodedSingleTile && frames >= 3);
        consecutiveReady = imageReady ? consecutiveReady + 1 : 0;
        if (frames >= 2 && consecutiveReady >= (decodedSingleTile ? 1 : 2)) {
          finish(true);
        } else {
          scene.requestRender();
        }
      });
      deadline = setTimeoutImpl(() => finish(false), timeoutMs);
      scene.requestRender();
    });
    if (!ready || myGeneration !== generation || !isCurrent()) {
      if(fromCache && myGeneration===generation && activeLayer!==layer)
        retainOldLayer(layer);
      else safeRemove(layer);
      scene.requestRender();
      return false;
    }
    // Atomically advance dependent 3-D storm geometry and the underlying
    // authentic 2-D raster: no browser frame should show mixed timestamps.
    // This callback is synchronous, immediately before uncovering imagery.
    try {
      if (beforeReveal) beforeReveal();
    } catch(error) {
      safeRemove(layer);
      scene.requestRender();
      throw error;
    }
    if(myGeneration !== generation || !isCurrent()) {
      safeRemove(layer);
      scene.requestRender();
      return false;
    }
    layer.alpha = targetAlpha;
    imageryLayers.raiseToTop(layer);
    activeLayer = layer;
    retainOldLayer(previous);
    scene.requestRender();
    return true;
  }

  // A decoded supplemental tile is already staged underneath its previous
  // measured scan. The primary radar's beforeReveal callback calls this
  // synchronously, so every selected source changes observation time within
  // ONE Cesium render transaction. No premature hide/reveal flicker.
  function adoptPrepared(layer,{alpha=1}={}) {
    if(!layer || imageryLayers.indexOf(layer)<0)
      throw new Error("Only a staged Cesium imagery layer may be adopted");
    cancelPending();
    const previous=activeLayer;
    layer.alpha=Math.max(0,Math.min(1,Number(alpha)||0));
    layer.show=true;
    imageryLayers.raiseToTop(layer);
    activeLayer=layer;
    if(previous && previous!==layer)safeRemove(previous);
    scene.requestRender();
    return activeLayer;
  }

  return {
    replace, reset, setOpacity, adoptPrepared,
    get currentLayer() { return activeLayer; }
  };
}
