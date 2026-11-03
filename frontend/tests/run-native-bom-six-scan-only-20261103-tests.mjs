import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DOPPLER_AVAILABLE_LOOP_VALUE} from "../src/doppler-available-window-v1.js";
import {
  RAIN_ONLY_LOOP_MINUTES, buildOperationalWindowChoices
} from "../src/operational-window-choices-v1.js";

assert.deepEqual([...RAIN_ONLY_LOOP_MINUTES],[30],
  "Browser-only 60/90/120/180-minute radar archive choices must not be advertised");
const choices=buildOperationalWindowChoices({
  combinedAvailable:true,rainAvailableMinutes:[30,60,90,120,180],rainHasFrames:true
});
assert.deepEqual(choices.map(c=>c.value),[DOPPLER_AVAILABLE_LOOP_VALUE,"30"],
  "Retain independent Doppler while offering only BoM's current standard rain loop");
assert.equal(choices[0].disabled,false);
assert.equal(choices[1].disabled,false);
assert.equal(buildOperationalWindowChoices({
  combinedAvailable:false,rainAvailableMinutes:[],rainHasFrames:false
})[1].disabled,true);

const source=readFileSync(new URL("../src/radar-source.js",import.meta.url),"utf8");
const packaging=readFileSync(new URL("../../scripts/apply-radar-auto-refresh-v1.py",import.meta.url),"utf8");
const wmts=readFileSync(new URL("../src/bom-wmts-loop-v2.js",import.meta.url),"utf8");
assert.match(source,/browserNativeCorsBlocked/);
assert.match(source,/location\?\.origin===/);
assert.match(source,/officialWmtsFallbackUrl\(url\):null/);
assert.match(wmts,/20261103-bom-native-six-scans-no-cors-v1/);
assert.match(packaging,/operational-window-choices-v1\.js", site/);
assert.match(packaging,/No off-window historical downloads/);
assert.match(packaging,/six-published-scans-only-v1/);
console.log("PASS_NATIVE_BOM_SIX_SCAN_ONLY_NO_ARCHIVE_WARM_AND_NO_DOOMED_PAGES_CORS");
