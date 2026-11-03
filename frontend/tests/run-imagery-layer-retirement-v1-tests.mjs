import assert from "node:assert/strict";
import {createDeferredImageryRetirement} from "../src/imagery-layer-retirement-v1.js";
let clock=1000,frameCallback=null,scheduled=[],removed=[],destroyed=[];
const layers=new Set();
const imageryLayers={
  remove(layer,flag){removed.push([layer.id,flag]);return layers.delete(layer);}
};
const scene={
  postRender:{addEventListener(cb){frameCallback=cb;return ()=>{frameCallback=null;};}},
  requestRender(){}
};
const retire=createDeferredImageryRetirement({
  imageryLayers,scene,now:()=>clock,graceMs:500,
  schedule(cb,ms){assert.equal(ms,500);scheduled.push(cb);return scheduled.length;},
  cancel(){}
});
const layer={id:"source-frame-1",destroy(){destroyed.push(this.id);},
  isDestroyed(){return destroyed.includes(this.id);}};
layers.add(layer);
assert.equal(retire.retire(layer),true);
assert.deepEqual(removed,[["source-frame-1",false]],
  "Removed from rendering without immediately destroying WebGL textures");
assert.equal(retire.retire(layer),false,"No double-retirement");
assert.deepEqual(destroyed,[]);
frameCallback();
assert.deepEqual(destroyed,[],"One postRender boundary is insufficient");
frameCallback();
assert.deepEqual(destroyed,[],"Even two boundaries cannot bypass grace time");
clock+=510;
// A later Cesium postRender MUST NOT directly free GPU layers even after
// both safe boundaries and the grace period have elapsed.
frameCallback();
assert.deepEqual(destroyed,[],
  "Old radar GPU images must not be destroyed from inside postRender");
scheduled.shift()();
assert.deepEqual(destroyed,["source-frame-1"],
  "After safe boundaries and grace, obsolete layer GPU resources destroyed");
assert.equal(retire.snapshot().pending,0);
const layer2={id:"source-frame-2",destroy(){destroyed.push(this.id);}};
layers.add(layer2);
retire.retire(layer2);
retire.destroy();
assert.deepEqual(destroyed,["source-frame-1","source-frame-2"]);
assert.equal(frameCallback,null,"Post-render handler is removed on destroy");
console.log("PASS deferred weather imagery retirement detaches immediately, retires after 2 frames + grace, and cleans up.");
