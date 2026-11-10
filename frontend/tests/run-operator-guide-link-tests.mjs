import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html=readFileSync(new URL("../live3d-operational-v9.html",import.meta.url),"utf8");
const style=readFileSync(new URL("../src/single-interface-v1.css",import.meta.url),"utf8");
const build=readFileSync(new URL("../../scripts/build-current-site.sh",import.meta.url),"utf8");

const linkId='id="operatorGuideLink"';
assert.equal(html.split(linkId).length-1,1,"Exactly one operator guide link in main operator HTML");
const sidebarStart=html.indexOf('<aside id="controlSidebar"');
const headingStart=html.indexOf('<header class="dashboard-heading"',sidebarStart);
const headingEnd=html.indexOf('</header>',headingStart);
const linkIndex=html.indexOf(linkId);
assert(sidebarStart>=0&&headingStart>sidebarStart&&linkIndex>headingStart&&linkIndex<headingEnd,
 "Link must be inside the existing sidebar heading, not elsewhere");
assert(html.slice(headingStart,headingEnd).includes('Live weather map'),
 "Original StormTracker heading and subtitle must remain");
const tagStart=html.lastIndexOf('<a ',linkIndex);
const tagEnd=html.indexOf('</a>',linkIndex);
const anchor=html.slice(tagStart,tagEnd+4);
assert.match(anchor,/href="https:\/\/github\.com\/Blakesmith-Intel\/Q-Scope\/blob\/main\/docs\/OPERATOR_GUIDE_CURRENT\.md"/);
assert.match(anchor,/target="_blank"/);
assert.match(anchor,/rel="noopener noreferrer"/);
assert.match(anchor,/Operator guide/);
assert(!html.slice(html.indexOf('<main id="mapPanel"'),html.indexOf('</main>')).includes(linkId),
 "Map and existing information panels must not gain overlays or guide controls");
assert(!html.slice(html.indexOf('<details id="radarPlaybackDetails"'),html.indexOf('</aside>')).includes(linkId),
 "Guide link must not interfere with layer/playback content");
assert(style.includes('body.simple-ui #controlSidebar > .dashboard-heading .operator-guide-link'),
 "Style must be scoped to the existing header");
const linkStyle=style.slice(style.indexOf('/* Discreet read-only documentation link:'));
assert(!/position\s*:\s*(fixed|absolute|sticky)/.test(linkStyle),
 "Guide link must not use any floating/overlapping positioning");
assert(!/z-index\s*:/.test(linkStyle),
 "Guide link must not interfere with map z-index or information panels");
assert(build.includes("old_heading='<span>Live weather map</span></div></header>'"),
 "Builder must insert guide into pinned production header rather than changing baseline");
assert(build.includes("guide_link_start='<a id=\"operatorGuideLink\"'"));
assert(build.includes("assert html.count(old_heading)==1"));
console.log("PASS operator guide accessible in existing heading only; no overlays, new panels or hijacked controls.");
