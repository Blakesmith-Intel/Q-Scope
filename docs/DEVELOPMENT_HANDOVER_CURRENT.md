# V10.2.46 — CURRENT IMMUTABLE PRODUCTION BASELINE (1 November 2026)

**Operator-reported issue:** active BoM IDQ21033 and IDQ21035 lacked current verified polygons until the original GIS2Web-derived service caught up. The frontend's otherwise correct 15-minute automatic poll was too slow when an active source had no geometry. The fix uses bounded two-minute catch-up (at most nine checks per warning issue) and at most two early transport-error retries, reverts to 15-minute healthy checks, and retains fail-closed source truth. No other feed, polygon renderer, RADAR, 3-D, AEP, flood, cyclone, or UI modification.

**Evidence:** live original Queensland BoM CAP/current-index/ArcGIS and relay audits; [independent mobile WebKit and desktop Chromium missing-to-present polygon recovery tests](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/41283214838). Both recovered 2 regional and 6 detailed genuine warning polygons without a map/page restart.

**Mandatory base for further work: `v10.2.46`.** Preserve V10.2.45 at `3051662e4ad124dcdfee5c19e955b6172c70fef7`; older immutable refs are never repointed. Require operator acceptance and distinct production release/tag/restore refs for every later change. [Current baseline](PRODUCTION_BASELINE_V10.2.46.md) · [Release notes](RELEASE_NOTES_V10.2.46.md) · [Guide](OPERATOR_GUIDE_CURRENT.md).

---

# Historical V10.2.45 immutable production baseline (1 November 2026)

**Approved upgrade:** operator-tested six-frame native BoM radar recovery, source-real rolling frame append without playback timer restart, source pressure and transient tile/metadata retries, no page/camera reset and real QLD/NSW regional coverage. Both mobile WebKit and desktop Chromium independently passed 5/5 → 6/6 recovery on the actual QA route and actual newly available frame insertion. The compiled operational site is independently verified at the public root before creation of `v10.2.45` and `restore/v10.2.45`. The previous V10.2.42 freeze remains untouched.

**Mandatory development base for all subsequent work:** the newly annotated `v10.2.45` tag or exact same-commit restore ref—**never V10.2.42** or the development QA branch. New features require operator approval, all source/science/unit checks, genuine source tests, representative WebKit and desktop Chromium operational browser tests, package dry-run, public-site smoke test and a *new* immutable release tag.

**Critical regression:** a 30-minute rain loop must recover an authentic missing historical observation from 5/5 to 6/6 on the next valid source check even when no newer time exists, while new scans append in place; retain two-request source pressure, bounded 400/403/429 rules, original UTC, region isolation and map/camera continuity. No synthetic frames. Preserve science, warning polygons/zero reporting, river gauge and crossing thresholds, flood icon sizes, rainfall/AEP maps, cyclone panel, roads, outages, QFD and the four-section interface exactly.

**Current documents:** [production contract](PRODUCTION_BASELINE_V10.2.45.md) · [release notes](RELEASE_NOTES_V10.2.45.md) · [operator guide](OPERATOR_GUIDE_CURRENT.md) · [quick reference](OPERATOR_QUICK_REFERENCE_V10.2.45.md) · [restore procedure](BASELINE_RESTORE.md).

---

# Historical V10.2.42 operator-accepted baseline (1 November 2026)

**The operator confirmed the entire working production application functional on a physical iPhone at approximately 13:37 AEST, 1 November 2026.** V10.2.42 is the **documentation and release-process freeze** of the accepted V10.2.41 operational code, including V10.2.40 genuine BoM WMTS resilience and V10.2.41 Longreach camera protection. The only release-process change stops the obsolete V10.2.29 tag creator from rerunning on later deployments. There is no new data or feature behaviour.

**Start from the immutable annotated `v10.2.42` tag** (paired, at the same commit, with `restore/v10.2.42`). Do not start from an unreviewed branch, an older snippet in this historical handover, or the underlying pinned V10.2.0 code alone. All subsequent enhancement work must branch from this baseline; merge to production only after scoped tests, exact source/geometry verification, real operational mobile/desktop UI validation, operator acceptance, verified deployment and a **new** annotated tag and restore branch. Historical releases remain untouched.

**Read first:** [Current production contract](PRODUCTION_BASELINE_V10.2.42.md) · [Release notes](RELEASE_NOTES_V10.2.42.md) · [Operator guide](OPERATOR_GUIDE_CURRENT.md) · [Quick reference PDF](STORMTRACKER_LAYERS_INFORMATION.pdf) · [Baseline restore](BASELINE_RESTORE.md) · [Approved scientific contract](SCIENTIFIC_CONTRACT.md) · [No unrequested visual changes](NON_NEGOTIABLE_VISUAL_FIDELITY.md).

## Locked V10.2.42 regression and release acceptance

1. **BoM source and replay:** preserve exact authentic published radar timestamps and complete verified PNG mosaics; no invented observations. Regular five-minute polling, two-second busy retries, 60-second background error retry, in-tab manual-site retry, foreground recovery, genuine backfill and correct latest-frame follow must all remain.
2. **Regional reliability:** two in-flight image requests, bounded compressed verified WMTS PNG cache, 45-second bad-tile expiry, site+time rejection isolation and conservative HTTP 403/429 gating. A single transient 502/503/504 must not stall all Queensland sites. Test **actual six-frame multi-site loops in both WebKit and full operational browser**; isolated centre-pixel/source tests alone are insufficient.
3. **Operator camera:** automatic frame ingestion must never recenter to Brisbane or switch the selected radar. The full selected primary and camera pose survive same-tab Safari reloads for the tab lifetime. Deliberate selection/Focus/Reset/Fit still work. The accepted Longreach test checked true Latest and full reload with exact same location, range, bearing and tilt; [test run 41268669694](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/41268669694).
4. **Unchanged science/situational awareness:** Doppler, inferred 3-D, storm motion/cones, severe thunderstorm/weather warnings, honest cyclone bulletin distinction, verified 'No current warnings' negative reporting, all four menu sections, rainfall/AEP/IFD, tidal-safe flood rapid rise and crossing heights, QLDTraffic road reports, power-outage LGA counts, QFD and icon severity/geographic layering are not available for opportunistic adjustments.
5. **Release mechanics:** the Pages job uses a pinned base and approved overlays. Inspect **the generated public site**, not only GitHub `main` source, and verify both the deploy and new baseline tag+restore. `main` may advance later; the frozen tag will not. Never re-run V10.2.29/V10.2.28/V10.2.40 historical tag-creation checks on new commits. The independent Cloudflare Worker and authoritative external feeds are separate operational dependencies.
6. **Operator acceptance and documentation:** keep this handover, current guide, baseline restore record and one-page reference up to date **only for a separately accepted new release**. Prior numbered release notes remain immutable historical provenance. Never claim 24/7 autonomous monitoring where only periodic in-tab refresh exists.

### Accepted working scope

Browser-only application; Queensland plus approved NSW border radar coverage, native reflectivity and Doppler, fast 3-D/storm analysis, playback and map tools, verified BoM warning polygons, flood gauges, significant rainfall/AEP and both read-only rainfall reports, cyclone forecast visibility, road closures, Energex/Ergon outages and QFD incidents. Public map: https://blakesmith-intel.github.io/StormTracker/.

### Archive below

The sections below are the earlier engineering and release history, including timestamps and then-current claims. They remain for traceability; the header above is the authoritative 1 November V10.2.42 baseline.

---

# V10.2.39 — cross-site radar replay plus automatic latest-frame follow (1 November 2026)

V10.2.38 had two confirmed user-facing defects: one-frame loops in non-Brisbane Queensland radar sites despite a national WMTS source carrying valid six-frame histories, and failure to visibly advance the Latest frame without page reload.

Live 1 Nov 2026 source audit tested centre/corner real PNGs at 11 QLD sites, plus every tile for six successive frames in six geographically separate regions; BoM WMTS source imagery was available. Corrections in `frontend/src/bom-wmts-loop-v2.js` make negative timestamp cache scoped to site+UTC, and apply the five-minute cache only to explicit HTTP 400, not ordinary 502/503/gateway timeouts. Existing `radarFrameCache` remains reset on site selection. Operational runtime `frontend/src/live3d-operational-v9.js` follows the newest observation when already viewing Latest, preserves intentional historic scrubbing, propagates failures from background loads, and checks on Safari visibilitychange/pageshow/focus. The copied `frontend/src/live-loop-refresh-v1.js` keeps its fixed 300-second poll and 2-second busy retry, with 60-second bounded source-failure retry. No invented observations; all original pixels and observedUTC retained.

See [V10.2.39 release notes](RELEASE_NOTES_V10.2.39.md), multi-region real tile probes and mobile browser regression. Existing science, rainfall, warnings and flood controls unchanged.

---

# V10.2.38 — verified BoM radar history when published WMTS lags (1 November 2026)

The 1 November mobile incident showed Mt Stapylton 10:45 (5/5) and Gladstone 10:30 (1/1) at 11:10 AEST, versus 11:00 on BoM's updated map. The V10.2.37 auto-poll release was successfully deployed; the subsequent root cause is a separate WMTS replay-selection defect. `frontend/src/bom-wmts-loop-v2.js` used `WMTS_SOURCE_FRESHNESS_MS=45 minutes` both for identifying a current WMTS update and for accepting older source-advertised historical replay frames. A genuinely delayed source therefore lost older five-minute scans; re-querying GetCapabilities per frame could additionally race source-window rotation. **V10.2.38 separates source freshness from replay eligibility**, retains a 55-minute authentic source-advertised tail relative to the newest tile-verified timestamp (capped at nine), and passes one discovery snapshot to individual frame loads and optional cache warming. Each complete PNG tile mosaic must still pass actual source checks. Previously validated browser observations remain eligible for 60/120/180-minute windows; no synthetic or expired radar frames are substituted.

Release packaging is an additive overlay in `scripts/apply-radar-auto-refresh-v1.py` on pinned V10.2.0, with fresh Safari module keys. `frontend/tests/run-wmts-published-times-multisite-v1-tests.mjs` reproduces 10:05–10:45 source-published scans at 11:10 across Mt Stapylton/Gladstone/SEQ; previous stale-GetCapabilities negative rejection tests must remain green. `frontend/tests/run-radar-auto-refresh-v10-2-37-tests.mjs` inspects the exact runtime and production overlay, and the dedicated branch CI builds the pinned package. Browser release gate is pinned to Ubuntu 24.04 because Playwright Chromium on the new Ubuntu 26.04 runner is unsupported. Older immutable tags and source-science remain unchanged. See [V10.2.38 release notes](RELEASE_NOTES_V10.2.38.md).

**Separate upstream observation-age issue:** BoM's updated map and its public legacy WMTS can differ in publication recency; a live 11:21 AEST check found valid source-published 11:10 AEST tiles at Mt Stapylton/SEQ. This replay code fixes what the app drops but does not claim to create or accelerate observations BoM has not served on the chosen WMTS. Preserve actual source timestamps and report source failures explicitly.

---

# V10.2.37 — radar automatic refresh and missed authentic scans (31 October 2026)

Scoped maintenance on the pinned V10.2 production runtime: `frontend/src/live-loop-refresh-v1.js` keeps the five-minute cadence independent of operation duration, with 2-second retry only for deferred/busy requests and one queued follow-up for a timer/foreground check arriving during an in-flight operation. `frontend/src/live3d-operational-v9.js` returns `false` from a loader blocked by `sequenceLoading`/`!model` and uses `discoverBoundedBomReflectivityHistory(now,180,region)` for authentic recent-frame backfill (at most nine genuinely published native source times, with existing pixel verification and observed-only policy). The unchanged immediate foreground `visibilitychange` check remains active. Source check UTC, latest accepted observed UTC, outcome and error are recorded in the existing refresh note title and exposed read-only as `window.__stormtrackerRadarAutoRefreshAudit()`. Retain real source UTC; never manufacture images or backdate Doppler.

The production release uses `scripts/apply-radar-auto-refresh-v1.py` **after** `scripts/apply-ftp-aep-release-v10.py` in `.github/workflows/pages.yml`. The script patches only recognised anchors in the copied sealed runtime, copies only the scheduler module and refreshes iframe/module cache keys. Original pinned source, all frozen tags and other layers remain unchanged. See `frontend/tests/run-live-loop-refresh-v1-tests.mjs`, `frontend/tests/run-radar-auto-refresh-v10-2-37-tests.mjs`, and [release notes](RELEASE_NOTES_V10.2.37.md). The Pages run and publicly deployed JavaScript must pass post-deployment verification before sealing.

---

# V10.2.36 — current-only Cyclones presentation and multiple issued systems (30 October 2026)

The original BoM GML cyclone schema (`frontend/src/internal-cyclone-feed-v1.js`) already supports several independent source-authenticated cyclone products, each with source system ID, product ID, issued/expiry times and original issued geometries. This release **does not change that schema, validation, source endpoint, authorisation or 5-minute enabled-layer poll**. Previously the UI showed only the selected system on the shared map.

On the already assembled, fail-closed V10.2.35 production root:
1. `scripts/apply-cyclone-subsection-v1.py` moves the **same** dynamically created `internalCycloneLiveToggle` checkbox and `internalCycloneQaStatus` into a visible `cycloneCurrentOverview` under Cyclones, while original `openCycloneForecastQa` opens an inline **Details** panel for the original source selector, refresh, Focus and BoM link; the close button is renamed. DOM/UI-only.
2. `scripts/apply-cyclone-multi-systems-v1.py` adapts **only the copied production** current-cyclone presentation module to render each genuine source-confirmed system with a separate checkbox/Focus/status-card; track geometry entities all retain their respective original source IDs and system name and can be shown concurrently. A hidden system stays hidden across an updated same-system source issue, but newly verified systems default to visible. The map-source stamp reports how many original tracks are shown; disabling the overarching live source clears all cards and drawn entities. Original strict source validation, current-only expiry and unsafe/false-no-current reporting are untouched.
3. `frontend/src/cyclone-subsection-v1.css` styles the main checkbox/status, Details panel and individual cards consistently with original severe weather rows. `scripts/build-current-site.sh` applies the transforms after four-section construction and safely updates the copied current-cyclone module's browser cache key.

**Warning safety:** Each source-qualified cyclone card links to the official BoM tropical cyclone warnings page but explicitly states that cyclone **warning bulletins are separately issued and NOT VERIFIED by the forecast-track feed**. Neither per-system warning content nor separate warning areas are ingested in this release; do not infer them from tracks, names, forecast issue status or uncertainty polygons. Future actual per-system warning integration requires separate, verified source evidence and explicit operator scope.

**Testing:** Full original front-end tests; `frontend/tests/run-cyclone-inline-multisystem-v1-tests.mjs` with synthetic source-shape and JS syntax validation; exact pinned production build; real public site verification and Chrome iPhone/desktop interactions. Use mock snapshots only in isolated QA browser sessions and never on production. New freeze `v10.2.36` follows live acceptance, earlier tags stay untouchable. See [operator guide](OPERATOR_GUIDE_CURRENT.md) and [release notes](RELEASE_NOTES_V10.2.36.md).

---
# V10.2.35 operator-approved four-section navigation — 30 October 2026

The standalone presentation-only transform `scripts/apply-four-section-menu-v1.py` runs on the already verified `_site/live3d-operational-v9.html` after the V10.2.34 `apply-severe-weather-sidebar-v1.py` transform and the existing current-only cyclone sanitizer. It moves DOM fragments **without cloning or changing original data-bound input IDs** into four native, closed-by-default `details` sections: `radarStormAnalysisDetails`, existing `severeWeatherDetails`, `rainfallObservationsDetails`, and `communityImpactsDetails`. The earlier `situationalAwarenessDetails` wrapper is renamed Community Impacts after relocating its original rain/AEP and basemap controls. The original `radarPlaybackDetails` remains an open inner details element, making core playback controls accessible on first expansion. Opacity sliders move to secondary `radarDisplayAppearanceDetails`; original flood severity icon block becomes `floodGaugeLegendDetails`. Existing rainfall and QFD details remain untouched. The source station status `significantRainfallStatus` is lifted out of the folded rain legend so negative reporting remains visible. Original `basemapSelect` is moved **unchanged** inside `mapStyleDetails` in the already-existing map `#nav`. The original sidebar short-cut count widgets stay above menus. All sections open independently; no JS auto-exclusive accordion, no newly created source poller or service.

CSS is isolated to `frontend/src/four-section-menu-v1.css` (last load from the package) and the compiled browser app's version suffix changes to force Safari to fetch the fresh UI. Because the previously frozen V10.2.34 transformer is unchanged, existing regression suites still validate its source structure, while `frontend/tests/run-four-section-operational-menu-v1-tests.mjs` checks the complete V10.2.35 output in addition to existing source/regression tests. Unexpected structural changes fail closed. CI review and exact production build must pass before deploying; actual iPhone-sized and desktop browser runtime checks should verify nested controls, no duplicate IDs, no layout overflow, basemap persisted selection, source status and active-layer persistence after collapse.

**Hard invariants:** unchanged source feeds, BoM warning four-product semantics and verified negative reporting, flood threshold and rate-of-rise logic, AEP/IFD lookups, 2-D/3-D radar and Doppler, current-only cyclone source integrity, weather layer ordering, road closure geometries, outage areas, original camera controller, map time frames and all existing polling. Previous immutable tags/restore branches unchanged.

See [operator guide](OPERATOR_GUIDE_CURRENT.md), [release notes](RELEASE_NOTES_V10.2.35.md) and [wishlist](ACTIVE_WISHLIST.md).

---
# V10.2.34 — collapsible Situational Awareness Data (30 October 2026)

The approved top-level **Situational Awareness Data** card now uses a native HTML `details` disclosure, matching the Show/Hide interaction of **Severe Weather**. It is collapsed by default and independently expandable. All existing basemap, significant rainfall/AEP, unplanned road closures, power outages and QFD rescue/assistance controls are kept as direct children with identical IDs, ordering, checked states, reports, event handlers and refresh intervals. Closing this menu does **not** disable active map layers. Change is limited to the fail-closed production HTML transform, scoped CSS, browser cache version, tests and operator documentation. V10.2.33 and earlier frozen versions remain untouched.

---

# V10.2.33 operational navigation only — 30 October 2026

The operator-approved scope is five sidebar changes: new separate native `#severeWeatherDetails` top-level disclosure, **BoM Severe Weather and Thunderstorm Warnings** visible label, intact flood and warning controls moved within that disclosure, current-source cyclone controls moved into the sidebar as a non-floating inline expandable panel, and renamed **Situational Awareness Data** (former Layers). No IDs, source logic, warning/cyclone processing, map layers, thresholds, or refresh cadence are changed. The production root continues to be constructed from frozen V10.2.0, with the pure navigation transform `scripts/apply-severe-weather-sidebar-v1.py` running *after* `scripts/strip-production-cyclone-qa.py`. This ensures only the original current-only cyclone panel is embedded in the sidebar. The new CSS is `frontend/src/severe-weather-sidebar-v1.css`. Every original control ID is checked for uniqueness; unknown source shape or historical cyclone UI causes the production build to fail closed. QA previews remain separate/unmodified.

Acceptance: `frontend/tests/run-severe-weather-menu-hierarchy-v1-tests.mjs`, full regression suite, exact production dry-run, public site DOM/CSS and interactive mobile check. The last successful version remains restorable using its immutable tag; V10.2.33 is to be tagged after live acceptance. See [release notes](RELEASE_NOTES_V10.2.33.md).

---
# V10.2.32 original BoM warning menu expansion — 30 October 2026

**Scope:** `frontend/live3d-operational-v9.html` menu and `frontend/src/context-layers/bom-warning-operational-v1.js` filters/report labels only, built by the existing `scripts/build-current-site.sh` overlay on the immutable pinned site. Four product codes are taken from the already monitored BoM product catalogue and are filterable independently. The report now enumerates all four, including independently verified cleared products without polygons; previously IDQ21037 and IDQ21038 were grouped as `other` and would vanish from the report when clear. No new relay endpoint or poll schedule; existing `INTERVAL_MS=15*60*1000` checks all products at once and manual ↻ is unchanged. Run `frontend/tests/run-bom-four-product-warning-menu-v1-tests.mjs` and the entire frontend regression suite, plus production dry-run before publishing. See [V10.2.32 notes](RELEASE_NOTES_V10.2.32.md).

---
# V10.2.31 BoM current-warning status verification (30 October 2026)

**Important status data-source distinction:** International WMO BoM CAP RSS is a historical feed of 500+ items, intentionally sampling 22 severe-warning links; a missing product within that sample proves NOTHING about current Queensland product status. The current authoritative per-product index is `https://www.bom.gov.au/qld/warnings.shtml`. `relay/bom-warning-qld-current-index-v1.js` requires full current-list markup, a fresh BoM-generated UTC timestamp (max 20 min) and exact product links to assign `no-active` or `listed-active`. `relay/bom-warning-product-reconcile-v1.js` prioritizes a verified CAP-issued bulletin with exact source geometry, then a verified Queensland current product listing, without presenting a stale warning as current. The front end distinguishes **No current warnings**, **current; polygon awaiting verification**, and actual source failure. A routine lag between 19:38 CAP bulletin and the original IDQ65654 spatial update was observed 30 October. Never infer a polygon from the bulletin text or map a stale one. Only forecast warning phrases/official phenomenon tokens qualify for high-end warning state; observed locally intense rain reports do not escalate an issued heavy-rain warning. Original 15-minute polling unchanged. See [release notes](RELEASE_NOTES_V10.2.31.md).

---
# V10.2.30 official hazard terms and compact dangerous-cell display — 30 October 2026

**Additive to immutable V10.2.29:** See [V10.2.30 release notes](RELEASE_NOTES_V10.2.30.md) and [current operator guide](OPERATOR_GUIDE_CURRENT.md). Source-authenticated BoM warnings are classified using official severe/high-end words and exact AMOC hazard tokens W/W+, LH/LH+, R/R+, TO. IDQ21033 remains solely an official regional warning area; high-end wording changes its status/report and restrained warning-area border, not cell identity or future tracks. Only IDQ21035's distinct original IDQ65652 cell geometry can receive a small VD marker (or compact VERY DANGEROUS marker zoomed in) when its own published feature text explicitly assigns that designation. No real IDQ65652 cells were available in the 30 October audit, so live individual-cell validation remains pending. The separate IDQ65650 threat area and all LDMG/DDMG intersections stay unchanged. The accepted stable camera Locate, window-captured map tap/report, and earlier radar/hydrology/flood/outage/road and IFD-AEP science remain untouched.

---
# V10.2.29 warning polygon navigation, reporting and detailed-cell source contract — 30 October 2026

**Current approved incremental scope:** [release notes](RELEASE_NOTES_V10.2.29.md), [operator guide](OPERATOR_GUIDE_CURRENT.md), [wishlist](ACTIVE_WISHLIST.md). BoM original geometry publication IDQ65654 regional warning area / IDQ65650 detailed threat area retains exact issue/validity matching and independently enforced source expiry. Cesium warning imagery runs above all satellite basemaps and below measured radar. The Locate control now calls `mapCamera.setView` through the already installed StormTracker camera guardian, never Cesium `viewer.camera.flyTo`. Mobile/desktop polygon taps use window capture, same as closure/outage layers, respect drag thresholds and incident marker priority, and call the identical LDMG/DDMG report function as the sidebar button. Reset/disposal removes pointer subscriptions; no background refresh changes camera position.

**Original individual storm locations:** BoM 2026 official catalogue declares `IDQ65652` as **storm location**, distinct from `IDQ65650` threat area. The relay requests `IDQ65652` from the existing public government mirror, gates all records on an authentic current `IDQ21035` issue, retains individual original feature identity, expiry and vertices and forwards a separate `stormCells` collection; threat polygons remain the only source for official LDMG/DDMG affected-area report counts. Map callouts use `VERY DANGEROUS` only for an individual IDQ65652 feature with original per-feature text explicitly stating it; CAP/bulletin-level text never assigns severity to all cells. On 30 Oct the public service returned **zero** IDQ65652 current features; live verification of cell tracks and dangerous labels is outstanding and there is no synthetic live fallback. These source-dependent cell locations are *not* algorithmic extrapolated future tracks.

**Regression and rollback:** `frontend/tests/run-bom-warning-camera-and-polygon-report-v1-tests.mjs` and `run-bom-detailed-cell-source-exact-vds-v1-tests.mjs`; original UI/browser tests; exact production dry-run and public website checks; a fresh annotated version/restore pair only after success. Earlier tags and V10.2.0 immutable radar baseline untouched.

---
# StormTracker — current development and operational handover

> **V10.2.27 live BoM CAP correction (28 Oct 2026):** See [release notes](RELEASE_NOTES_V10.2.27.md) and [operator guide](OPERATOR_GUIDE_CURRENT.md). An actual IDQ21033 WMO-BoM CAP issue used `event=Thunderstorm`, not `event=Severe Thunderstorm Warning`, with valid BoM headline/status/issue/expiry but no `polygon` or `circle` elements. The CAP source parser now recognises this product and exposes the official headline, advice and warning URL; per-product state is `geometry-unavailable` rather than `no-active`. Existing exact LDMG/DDMG intersection logic remains unchanged, and NO polygon is inferred from forecast district text. Real original BoM polygon delivery is now verified: the QDMA-authorised Queensland emergency-management `BOM Land Warnings RO` WFS-derived FeatureServer supplies source-exact `IDQ65654` current polygons. CAP issue/expiry times must match original spatial feature validity; fail closed when absent. A live test on 28 Oct 2026 matched 4 polygons to the exact IDQ21033 CAP issue and verified the first polygon's 5 LDMG and 2 DDMG official boundary intersections with no area threshold. The unchanged V10.2.26 baseline is the recovery reference; all new warning source changes are isolated. Preserve historic tags and other overlays.

> **Final current release, 27 October 2026 — V10.2.26 documentation-only seal:** The accepted operational V10.2.25 deployment at `d9620f6cbc411bfee029d9fa9d170752aa7c34f2` passed full Pages + existing Cloudflare relay pipelines. No new source/parser/science changes are approved in V10.2.26. Current references: [final documentation freeze](RELEASE_NOTES_V10.2.26.md), [V10.2.25 feature release notes](RELEASE_NOTES_V10.2.25.md), [operator guide linked from the live app](OPERATOR_GUIDE_CURRENT.md), [accepted baseline](CURRENT_ACCEPTED_BASELINE.md), [current wishlist](ACTIVE_WISHLIST.md), [restore runbook](BASELINE_RESTORE.md). Historic stage-specific notes following this heading should not be mistaken for current release instructions.
>
> **What stays untouched:** Immutable `047b3bd1c66b0ed5f070d2298202f46d0cd8dae2` V10.2.0 radar-science root; every previously approved gauge, IFD/AEP, map marker, flood stage, outage polygon, road closure and road-type report; all frozen v10.2.24 and v10.2.25 tag/restore refs. Keep the existing static-browser plus **single original** Cloudflare Worker architecture.
>
> **Operational severe warnings delivered:** Opt-in **BoM severe warnings** imagery below measured radar and existing entities. Original geographic CAP polygons only, BoM bulletin URL/issued/expiry and detailed `IDQ21035` versus regional `IDQ21033` product identity. Independent filter and per-product LDMG/DDMG report. Queensland LDMG coverage from official LGA polygon `esriSpatialRelIntersects`, DDMGs from official disaster district polygon intersection; no overlap-size discard, no inferred district from a point or prose. Auto poll 15 minutes while enabled; manual refresh bypasses wait. Product issue supersession, cancellation and time expiry clear prior polygons; loss/timeout/incomplete source is marked unavailable, not a verified zero.
>
> **Known source gate:** The registered WMO BoM CAP source was contacted successfully, but no source-verified live active severe warning polygon was captured in release QA. Do not assert that the full production live-geometry path or GIS/AXF product has been empirically validated; no fake spatial shapes as a substitute. NSW polygons withheld pending exact radar union. Live cyclone map trials postponed until a real cyclone by operator choice. Experimental wind/hook/tornado Doppler science and observed lightning remain pending.
>
> **Freezing sequence:** Deploy unchanged accepted code + docs. Verify actual Pages UI and published source code and existing Worker endpoint. Confirm historical `v10.2.25`/restore tag at `d9620f6...` remains unmodified, then seal **new** `v10.2.26` and `restore/v10.2.26` at their identical exact new release commit. Subsequent changes need new operator direction and a new version.

> **V10.2.25 opt-in severe-warning deployment (27 October 2026):** [release notes](RELEASE_NOTES_V10.2.25.md) and [operator guide](OPERATOR_GUIDE_CURRENT.md). Preserve immutable original radar V10.2.0 source pin and historical V10.2.24; the new BoM warning layer is an opt-in below-radar overlay with independent 15-minute polling and source-status gating, not a modification of existing weather science. The WMO-registered BoM CAP feed and existing Cloudflare relay are the only new external dependencies. Product-coded IDQ21035 detailed SEQ and IDQ21033 regional QLD must remain distinct. Zero-area intersections are not screened by percentage, and failure to retrieve a warning source must not be represented as a verified BoM all-clear. Live source polygon presence is not yet validated during an active warning; mark that limitation and require a genuine issued warning for follow-up acceptance. Before tag sealing verify public Pages, new relay response and existing operational sources; create only a new `v10.2.25` tag and `restore/v10.2.25` branch.

> **Current approved V10.2.24 production restore point — 27 October 2026:** Operator-approved [V10.2.24 release notes](RELEASE_NOTES_V10.2.24.md) and live-linked [operator guide](OPERATOR_GUIDE_CURRENT.md) supersede the previous V10.2.23 status heading below. This new composite adds the **QLDTraffic road-types report**, exact event-ID state/local/unverified classification and the other accepted 27 October gauge/agency-time changes. Deployment must pass before the immutable `v10.2.24` annotated tag and `restore/v10.2.24` branch are sealed at the *same exact commit*. Sealed V10.2.0 radar foundation, old tags and independent Cloudflare Worker remain unchanged; do not assume `main` is the release without checking these exact references.


> **Operator-accepted V10.2.23 composite freeze (26 October 2026):** Current reference: [release notes](RELEASE_NOTES_V10.2.23.md), linked [operator guide](OPERATOR_GUIDE_CURRENT.md), and post-deployment annotated `v10.2.23`/`restore/v10.2.23` references. The underlying sealed radar-science pin remains V10.2.0; all later October 24–26 flood/crossing/rapid-rise/tidal screening fixes are controlled maintenance overlays. The dated V10.2.5 entry below remains historical, not the newest accepted release.

> **Frozen V10.2.5 production overlay (20 October 2026):** Adds automated, exact-cell authoritative BoM IFD lookup for qualifying ≥50 mm rainfall and replaces the rainfall popup's broad BoM publication-source region with coordinate-checked official BoM river basin catchments where available. The V10.2.0 radar/cyclone science pin remains unchanged. Do not alter this release while awaiting operator feedback. See [RELEASE_NOTES_V10.2.5.md](RELEASE_NOTES_V10.2.5.md).
**Baseline prepared:** 20 October 2026 (Australia/Brisbane)  
**Application:** https://blakesmith-intel.github.io/StormTracker/  
**Repository:** https://github.com/Blakesmith-Intel/StormTracker  
**For operators:** [OPERATOR_GUIDE_CURRENT.md](OPERATOR_GUIDE_CURRENT.md)  
**Status:** Documentation of the most recently validated **sealed V10.2.0 + maintenance overlay** production, **not** an instruction to rebuild from a moving source branch.

> **First rule:** Do not assume the latest code in main is the deployed application, and do not retag an older accepted release. The live application is assembled by an exact-source **pin**, a controlled maintenance overlay and a separately deployed public BoM data relay. Audit each independently.

## 1. Authoritative starting point and version identity

| Item | Accepted as of this handover |
|---|---|
| Public entry point | https://blakesmith-intel.github.io/StormTracker/ |
| Maintenance repository | Blakesmith-Intel/StormTracker |
| **Last source-changing accepted maintenance commit** | **da41da6811875eecbb2fcc4f746c3b5a25de319f** — restore rarity-text size while keeping rain droplets at two-thirds and retaining 24hrs-to-9am wording |
| **Verified deployment of that commit** | [GitHub Actions run 39305321286](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/39305321286) — success, including public-site checks and release-reference sealing |
| Separate release-gate validation | [Run 39305321512](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/39305321512) — success |
| **Immutable V10.2.0 product source pin** | **047b3bd1c66b0ed5f070d2298202f46d0cd8dae2** |
| Existing historical V10.2.0 source references | v10.2.0 and restore/v10.2.0 (preserve; do not repoint) |
| Data-only branch | **radar-ftp-feed**; among other data, stores **ifd.json** |
| Browser-side render engine | **Cesium 1.145.0**, pinned by the operator HTML |
| Transport | One existing **Cloudflare Worker** (stormtracker-bom-relay) |
| Hosting/build | **GitHub Pages** from a deterministic pipeline; GitHub Actions |
| Data-service policy | Public/official sources first; **no mandatory paid feeds** |

**Important naming:** “V10.2.0” is the underlying immutable UI/runtime pin, **not** the last date on which operator-visible code changed. The newest delivered rainfall, flood/road/outage, radar-source and UI maintenance is overlaid during production compilation. The legacy files **CURRENT_ACCEPTED_BASELINE.md**, **HANDOVER_V10.1.1.md**, and similar numbered guides document earlier pins and decisions, not the complete latest composite. This document is the **current overlay-aware handover**; retain all older documents for provenance.

**How to verify the next source state:** compare the newest successful deployment job's head SHA, the source pin in **.github/workflows/pages.yml**, the published **/BUILD.txt** and the source strings in the actual served JavaScript. A green repository build alone does not prove a publicly delivered asset is current.

## 2. Product boundaries and non-negotiable behaviour

1. **Browser-only production:** no Python, local server, container, HDF5 reader, paid subscription, or remote scientific model required of an end user. Python source collectors and offline historical QA are permitted in GitHub Actions/development only.
2. **Source fidelity:** original BoM reflectivity values and genuine source issue times are authoritative. Use **dBZ**, never rebrand reflectivity as mm/h. No invented five-minute radar frames, fake scan timestamps, arbitrary upscaling, substituted low-resolution images or misleading temporal fills.
3. **Radial wind is not a gust:** native Doppler is radial velocity relative to its radar; do not infer surface wind or a tornado diagnosis solely from displayed velocity colours.
4. **3-D is inferred:** original source 2-D reflectivity defines the estimated coloured volume. The display threshold is **≥40 dBZ**, nominal vertical exaggeration **1.0×**, using source pixel intensity; never describe it as a measured volumetric/AURA live scan.
5. **Storm tracks and illustrative cones are not BoM warnings:** numeric track IDs, estimated motion and +90-minute cones have no independent official warning status. Primary radar alone governs the accepted ST track/labels.
6. **Cautious official overlays:** road closures, unplanned outages, flood levels, QFD jobs and historical cyclone products must preserve original classifications, IDs, geometry and issued timestamps. Failures must not become “all clear”.
7. **Presentation quality:** original radar colour scale, source-resolved pixels, good satellite continuity, rapid camera gestures, map-fit compact sidebar and no whole-volume flicker. New features must not silently weaken accepted visual quality.
8. **Change isolation:** use an isolated feature branch or QA preview when altering meteorological science, feeds, source registries, camera/render loops or warning geometry. Require browser review before promoting.
9. **No new duplicate infrastructure:** use the single established relay and existing workflows where possible. Minimise needless scheduled jobs, paid data and cache layers.
10. **Maintain recovery:** source pins, annotated tags, sealed restore branches and historical preview builds must remain recoverable and immutable.

Reference contracts: [SCIENTIFIC_CONTRACT.md](SCIENTIFIC_CONTRACT.md), [NON_NEGOTIABLE_VISUAL_FIDELITY.md](NON_NEGOTIABLE_VISUAL_FIDELITY.md), [BASELINE_RESTORE.md](BASELINE_RESTORE.md).

## 3. Live system architecture

~~~text
Official BoM radar / Doppler / rainfall / flood / cyclone references
QLDTraffic, official power providers, QFD published incidents
                        |
                        v
       Existing Cloudflare Worker (CORS / source transport)
                        |
                        v
           Browser JavaScript + Cesium 1.145
       radar/doppler  |  3-D/tracks  |  GIS overlays
                        |
                        v
             GitHub Pages public operator app

Official BoM IFD 2016 point pages
          | hourly GitHub Actions verified collector
          v
   radar-ftp-feed/ifd.json  ----> browser local AEP comparison
~~~

The relay's role is to **transport or normalise public source data** and expose bounded, cached public JSON or approved source imagery. Meteorological interpretation, Cesium layers, screen controls, inferred motion/volume and AEP comparison are implemented client-side.

### Paths worth knowing

| Function | Main files |
|---|---|
| Public application entry | frontend/index.html; frontend/live3d-operational-v9.html |
| Current operational entry/runtime | frontend/src/live3d-operational-v9.js, pinned V10.2.0 version plus build overlays |
| Release assembly | scripts/build-current-site.sh; scripts/apply-ftp-aep-release-v10.py |
| Production + previews | .github/workflows/pages.yml |
| QA/release gate | .github/workflows/qa-ftp-aep-combined-release-v1.yml |
| Frontend tests | frontend/tests/; npm test executes scripts/check-frontend.mjs |
| Existing network relay | relay/worker.js; relay/wrangler.jsonc; .github/workflows/deploy-relay.yml |
| Native high-resolution BoM reflectivity | frontend/src/bom-wmts-loop-v2.js; bom-wmts-published-times-v1.js; hires-radar-loop-policy-v1.js |
| History and radar selection | frontend/src/operational-window-choices-v1.js; multi-radar-display-v9.js; independent-doppler-loop-v1.js |
| Doppler | frontend/src/bom-doppler-intake-v3.js; multi-doppler-display-v1.js; bom-doppler-georef-v1.js |
| Inferred 3-D and tracking | incremental-volume-renderer-v1.js; inferred-volume-v1.js; live3d-tracks-v1.js; tracking.js; track-threat-cone-v1.js |
| Satellite/street, labels, camera | context-layers/basemap-manager-v1.js; qld-town-label-layer-v1.js; stormtracker-camera-v1.js |
| Flood observations and icon semantics | context-layers/river-gauges-v1.js; river-gauge-layer-v1.js; river-gauge-observations-v1.js; river-flood-signals-v1.js; river-official-flood-persistence-v1.js |
| Significant rainfall source/panel | context-layers/significant-rainfall-source-v1.js; significant-rainfall-operational-v1.js |
| Location-specific rainfall rarity | context-layers/rainfall-ifd-aep-v1.js |
| Permanent IFD catalogue generator | scripts/build-native-bom-ifd-point-cells-v1.py |
| Permanent IFD collector schedule | .github/workflows/publish-verified-queensland-ifd.yml |
| Road closures / outage layers | context-layers/flood-road-closures-v1.js; flood-road-closures-operational-v1.js; power-outages-v1.js; power-outages-operational-v1.js |
| Council/suburb incident exploration | context-layers/road-closure-lga-explorer-v1.js; power-outage-suburb-explorer-v1.js; related model modules |
| QFD selected public incidents | context-layers/qfd-technical-rescues-v1.js; qfd-technical-rescues-operational-v1.js |
| Cyclones (historical/QA) | historical-cyclone-forecast-map-v1.js; official-cyclone-track-contract-v1.js; internal-cyclone-live-qa-v1.js; frontend/data/cyclone-history/ |
| Historical AURA verification (not browser live) | scripts/build_aura_3d_tracks_v1.py; frontend/3d-data/; specialised AURA audit scripts |

**Caution:** Files in main include retained development adapters and legacy implementations. A filename's existence **does not prove the module is shipped or active**. Verify the built **_site/** output and imported source graph. The old individual-site FTP raster adapter is intentionally excluded from the latest high-resolution production build.

## 4. Radar, Doppler and imagery contract

**Radar:** The operational source policy prefers **genuine native high-resolution BoM national WMTS reflectivity** (original-published times and original high-resolution data) with separately verified original FTP archive/fallback logic. The application avoids fabricated imagery or legacy low-resolution playback when original high-resolution frames are unavailable. Never generate a synthetic scan just to fill an incomplete timeline.

**Time windows:** Five-minute genuine reflectivity observations. Accepted rain-only choices are **30/60/90/120/180 minutes**, requiring respectively **6/12/18/24/36 genuine observed frames**. Extended playback windows only enable when the browser has retained complete qualifying history. **Doppler — All available** has a separate source history; no numeric fps setting is presented. Playback speeds **1×, 2×, 3×**.

**Multiple radars:** The operator can choose a primary and up to three additional radars. Default primary is **Brisbane (Mt Stapylton), radar 66**. QLD and relevant NSW border radar options are exposed by the operational site catalogue. Source time is per published observation; supplementary imagery must not block the primary. For multi-Doppler, the **primary radar is master UTC**; each additional supported radar uses its nearest authentic published scan within **±8 minutes**, with bounded staging and together-at-frame-edge display. Moree/Grafton are reflectivity-only. Brewarrina **IDR93I** is supported for display but **analysisGeorefVerified=false** until separately verified; exclude it from validated severe-wind/tornado science.

**Renderer:** The measured 2-D reflectivity and inferred 3-D graphics use BoM-aligned dBZ classes. Internal track segmentation uses connected **observed ≥40 dBZ pixels** with the documented 16-pixel/core rules. Changing inferred blob geometry, texture handling, cache eviction, opacity or town-label layering requires the existing mobile/desktop/WebGL regression suite. Distinct layers must be retired when toggled off; hidden closure lines, stale polygons, flickering Doppler and camera reset jumps are regression failures.

**Basemap:** QLD detail + regional NSW DEA imagery with global satellite fallback; separate street style, state border and place names. Avoid exposing blue unloaded map regions or placing labels underneath 3-D or radar imagery.

**Validation refs:** [WMTS_ALL_RADARS_SOURCE_PUBLISHED_TIMES_20261018.md](WMTS_ALL_RADARS_SOURCE_PUBLISHED_TIMES_20261018.md), [QUEENSLAND_RADAR_COVERAGE.md](QUEENSLAND_RADAR_COVERAGE.md), [PLAYBACK_PERFORMANCE_AND_STABILITY_AUDIT_2026-10-16.md](PLAYBACK_PERFORMANCE_AND_STABILITY_AUDIT_2026-10-16.md).

### 22 October 2026 — read-only rainfall report views

**V10.2.6 UI maintenance:** operator-verified reports remain read-only, with both controls in one two-column row, side by side. Only the buttons' HTML and layout CSS changed; rainfall quantities, AEP classification, gauge ID/geographic fidelity, on-screen dialog and map markers are preserved. Seal `v10.2.6` and `restore/v10.2.6` **only after** the actual GitHub Pages deployed sources pass final checks; do not repoint earlier version tags or recovery branches.

This maintenance adds exactly **two reports** driven by the existing significant-rainfall client feed and local AEP classifications, with **no new BoM endpoint**:
- **Rainfall totals report** in the compact two-column button row beneath the main Significant rain controls: exhaustive source-eligible 50–99.9 mm and 100+ mm lists, with the 100+ group first. Include Less rare, Unrated and pending rating stations in the measured-total group.
- **AEP Notable+ report** beside the totals button, outside the expandable local-rarity legend: all source-eligible ≥50 mm gauges meeting a verified **20%, 10%, 5%, 2% or 1% AEP design depth**, grouped from Exceptional through Notable. Do not count unknown/pending or Less rare as a verified Notable result.

Production modules: `frontend/src/context-layers/significant-rainfall-report-v1.js` (pure grouping/model and export), `significant-rainfall-operational-v1.js` (modal rendering, current reporting period, BoM issue times, source/catchment display), `frontend/live3d-operational-v9.html` (two buttons, one dialog) and `frontend/src/single-interface-v1.css` (mobile-scrollable report layout). The pinned V10.2.0 shell is rebuilt with only these accepted source overlays; **both** `scripts/build-current-site.sh` and `scripts/apply-ftp-aep-release-v10.py` must ship the report module, not just the modified operational importer.

The report MUST reuse `visibleRows` derived from actual `source.observations[period]`, with exactly the existing 50-mm qualification, original BoM station ID, raw source longitude/latitude, source issue time, and cell-verified IFD grade. **Never use rendered billboards or camera viewport to decide which stations appear.** Never guess a catchment, infer a different location from the station name, move/detach the droplet or its label, hide stations to tidy the report, substitute a neighbouring IFD cell, or treat missing IFD as ordinary rainfall. Opening a report while the map layer is off must request fresh observations and permits the same source-verified on-demand IFD retrieval. Report refresh reuses the existing current feed, not duplicate polling.

Regression: `frontend/tests/run-significant-rainfall-report-v1-tests.mjs`, the existing rainfall-source tests, all frontend `npm test` suites, Pages-build contract and public-site source verification. Review whether the report remains readable in narrow/mobile browsers and that counts change appropriately with all three clock periods and delayed IFD lookups.

### 22 October 2026 — non-obstructive operator guide access

The sole operator-guide link is the small `#operatorGuideLink` text anchor **inside the existing `#controlSidebar > .dashboard-heading`** (beside the brand). It opens `docs/OPERATOR_GUIDE_CURRENT.md` at GitHub in a separate tab (`target="_blank"`, `rel="noopener noreferrer"`). It must never become a map overlay, floating button, new sidebar row, modal, legend element or map information card. It adds no scripts, fetches, gauges or interaction handlers, and is styled without changing the fixed sidebar header height. The production shell is assembled from immutable V10.2.0 plus `scripts/build-current-site.sh` — copy the new link from the accepted maintenance HTML into the **existing pinned heading** and ship its small CSS rule, rather than modifying the frozen V10.2.0 source. Regression contract: `frontend/tests/run-operator-guide-link-tests.mjs`, production build and public Pages checks.

### 22 October 2026 — location-specific IFD lookup throughput and persistence

Rainfall classification maintenance after V10.2.7 (no modifications to frozen tags): the frontend immediately renders measured qualifying rainfall with any exact-cell, source-verified IFD references retained in browser localStorage. An independent 15-minute catalogue check merges the shared persistent `radar-ftp-feed/ifd.json` without blocking initial map rendering or overwriting newer verified local point records. Only still-missing cells are queried on demand; selected-period stations are sorted by measured rainfall descending, with ≥50 mm eligibility preserved and no neighbour/catchment/geographic substitution.

The browser queue permits **six concurrent** requests (formerly three), keeps the **22-second request timeout / five-minute failed-cell cooldown**, reprioritises not-yet-started requests after period changes, and batches Cesium marker redraws within **250 ms** instead of redrawing after every result. Successful source-verified point data is retained in localStorage across visits; browsers blocking storage continue to work in-memory. Other browsers use the shared hourly GitHub catalogue and existing Cloudflare official-source cache. The hourly collector processes **up to 48 cells with six workers** (formerly 30 and four), preserving append-only and exact-cell checks. BoM's actual request limits are not assumed; review 429/503 responses and reduce concurrency if they increase.

**24hrs to 9am** uses the existing fixed **1,440-minute** BoM IFD threshold, never reconstructed from hourly readings or neighbouring cells. Existing station IDs/coordinates, source timestamps, map attachments, storm layers and rainfall reports remain unchanged. Test: `frontend/tests/run-significant-rainfall-source-v1-tests.mjs`.

## 5. Significant rainfall — accepted current contract

**Observed totals source:** BoM [Queensland Rainfall and River Conditions](https://www.bom.gov.au/qld/flood/), seven regional original rainfall HTML maps: **gulf, north, tvl2mck, widebay, seast, west, border**. The existing Worker route **/qld-significant-rainfall** parses original BoM map popup values by **station ID**, coordinates, mm total, period and published UTC source time. Duplicate station IDs are deduplicated; a regional failure is recorded explicitly, not converted to 0 mm. Operator map shows **≥50 mm** stations even if no rarity data is available.

**Three UI choices and backend period keys:**

| Operator text (20 Oct acceptance) | Stable internal key | Authoritative reading |
|---|---|---|
| **Since 9 am** | since9am | Original BoM cumulative measurement since 09:00 AEST *reporting-day start* (overnight when before next 09:00) |
| **Last hour** | lastHour | Original BoM latest 1-hour map value |
| **24hrs to 9am** | last24Hours | Original BoM completed 24-hour rainfall-map value for the preceding 09:00-to-09:00 period |

**9 am rollover regression:** Valid “Since 9 am” readings published after **midnight** and before **09:00 AEST** belong to the previous day's reporting start, *even though the source page's calendar date is today*. Never reject those readings merely because page-day differs from rainfall-start-day. Covered by Mountain Creek **540220**, **101.0 mm at approximately 04:00 AEST**, a **19-hour** since-9am window in deterministic tests. Source freshness still applies. Exact observation totals must come from BoM; that value is a test case/operator-supplied example, **not a frozen current live observation**. The 24-hour product is independently published: do not sum or subtract other periods to derive it.

**Appearance:** Orange measured-rainfall droplet **50–99.9 mm**, red **≥100 mm**. SVG droplet path itself is scaled to **two-thirds**; the **rarity text and its rectangular background remain full original size**. Latest accepted asset uses a **98×40** billboard and full-size label. The droplet contains **no amount text**. Popup retains exact mm, period, BoM station ID, timestamp, reference and AEP details. Dropdown, popup and status all use **24hrs to 9am**, while internal API key stays **last24Hours**.

**Freshness/refresh:** Browser rainfall fetch every **300,000 ms (5 min)** while visible; manual refresh supported. Existing relay caches upstream regional pages for around **300 s** and rejects outdated source pages beyond **90 min**. Client 9am snapshots additionally require matching report-day start. **IFD catalogue is downloaded separately** and reconsidered after **15 min** during enabled rainfall fetches; browser page reload reads a remote persisted reference, **not** a rebuild.

### Rarity computation (not flooding severity)

- Separate official rainfall design reference: [BoM 2016 Design Rainfall](https://www.bom.gov.au/water/designRainfalls/revised-ifd/?multipoint). Recorded mm is **never** replaced with design depth.
- Lookup: geographic **0.025° keyed cell** in permanent **ifd.json**. The exact same keying algorithm is in Python builder and JavaScript IFD comparer; assess validity before changing cell resolution or reference geolocation. **Do not silently assign nearest-town references.**
- Durations: **60 to 1440 minutes** in official verified point tables. 1h = 60, completed day = 1440, since-9am = true current accumulation duration. Duration between reference rows uses documented **logarithmic interpolation**, not invented spatial data.
- Order: **20, 10, 5, 2, 1% AEP** (respectively **Notable/Unusual/Rare/Very rare/Exceptional**). Muted **Less rare** means below the 20% local threshold; **Unrated** means missing/invalid verified comparison. Neither is a safe/hazard-free status.
- Annual chance is a rainfall frequency statistic **not** flood impact, river classification or guaranteed recurrence interval.

### Reference-catalogue persistence and future updates

**State is permanent in GitHub** on **radar-ftp-feed/ifd.json**; not rebuilt when the browser refreshes. The publishing workflow runs at approximately **10 minutes past each hour UTC** and also runs for changes to the collector, regression test or workflow. It:

1. Reads previously published **ifd.json** from the **data branch**; **refuses to proceed if prior catalogue absent**.
2. Optionally gets current station IDs/coordinates from the existing rainfall relay, including ordinary/dry stations.
3. Retrieves up to **30** missing, replacement or due-for-reverification BoM first-party point tables per run, with bounded concurrency.
4. Validates duration and probability monotonicity; retains previously verified data on missing source, parse failure or transient BoM failure.
5. Performs an **append-only key-set check** before publication; successfully revalidated entries may update depths and verification metadata while their reference cell stays in place.
6. Marks newer first-party entries with source/coordinate reference and **verifiedUtc**; checks existing first-party cells again after **30 days**, at bounded rate while missing records are being filled.
7. Publishes the merged verified catalogue back to **radar-ftp-feed** without overwriting unrelated FTP archives on concurrent branch advancement.

**Observed catalogue snapshot:** **163 stored geographic cells** after successful 20 October release validation; approximately **59 directly first-party BoM IFD cells** and **104 earlier verified ARR-derived references**, retained pending first-party replacement. **This is NOT a complete statewide IFD grid or complete lifetime inventory of all gauge locations.** Count is time-sensitive; read the current JSON rather than assuming 163 forever. The collector discovers stations from current published observation pages and cannot guarantee reference data for future gauges that never appear. The user explicitly requires that the eventual complete *collected* catalogue **persist** and that revised official values be incorporated where verified. Do not claim statewide completeness without a genuine geographic coverage audit.

**Risks to review before expanding:**
- source site may rate-limit and page format may change; official page includes non-depth rows such as **winter factors** that must be discarded;
- a reference cell is a geographic bin keyed at 0.025°, not proof an entire broad locality is identical to one measured point;
- hourly collection is **bounded** and revision rechecks cannot promise instant update on the date BoM revises an official table;
- retained older ARR-derived values must preserve source attribution until replaced with a genuinely retrieved BoM value;
- no arbitrary default AEP, neighbouring grid extrapolation or fabricated all-green result for failed sources.

**Regression entry points:** **scripts/test_bom_ifd_point_cells_20261020.py** and **frontend/tests/run-significant-rainfall-source-v1-tests.mjs**. Test failed fetch retention, published checksum/key preservation, official-only parsing, 09:00 rollover across midnight, 1h vs since9am vs 24hrs-to9am, 50/100 mm boundaries, and the **small droplet/full-size rarity label** separately.

## 6. Flood gauges, road closures, outages and QFD

### Flood signals

The current BoM gauge poll interval is **10 minutes**, and a manual **Refresh** control exists. Station readings, BoM flood classifications/levels and any recent-history assessment must join by **exact BoM/AWRC source station ID**, not station names or nearest locality. Gauge thresholds/datum must correspond to each **actual source observation's datum**; never compare incompatible metres without a documented transformation.

**Recovery maintenance (24 October 2026; V10.2.9):** a newer, fresh source water level below the same station's **verified minor flood stage** clears the marker even if its bulletin includes a cached old flood-class label. Stale or missing data must not be mistaken for recovery. For threshold-free/non-tidal gauges, a qualifying measured rapid rise records the same station's directly observed **pre-rise height** in the existing `FLOOD_EVENTS_STORAGE_KEY` browser cache; this is explicitly a provisional pre-rise reference, not a BoM flood stage or an invented climatological normal. Display a blue arrow only while actually rising rapidly; continue an **elevated** blue icon without an arrow while higher than the reference. Require **two distinct fresh falling/stable source observations at least 15 minutes apart** within a bounded reference-relative margin before clearing; repeated source timestamps do not count. Original geographic coordinates, tidal exclusions, station IDs, 10-minute polling, stale-observation flags and official severity layering remain unchanged. Persist event evidence through short partial bulletins; drop evidence beyond 48 hours without a current source observation rather than showing indefinitely. Regression: `frontend/tests/run-flood-recovery-lifecycle-v1-tests.mjs` plus existing signal, event, and integration suites.\n\n**Operator symbology:** minor **green**, moderate **yellow**, major **red**. Independently measured rapid-rise potential **blue up-arrow below minor**, optional up-arrow modifier on flood-level icons. Above-minor classified sites persist when valid/current even if the trend is steady or falling; do not remove until authoritative classification/verified observation changes or the source is too stale. Rapid rise is not an official flash flood warning. Screening for tidal influences is essential and may err conservatively; genuine official flood classification takes priority. River recent-history requests may return typed optional **not_published** or upstream **502/source_response_too_large**: preserve genuine current bulletins and don't invent a hydrograph.

Useful refs: [FLOOD_GAUGE_ID_AND_ICONS_20261018.md](FLOOD_GAUGE_ID_AND_ICONS_20261018.md), [WALKERSTON_533142_MINOR_GAUGE_DISAPPEARANCE_20261018.md](WALKERSTON_533142_MINOR_GAUGE_DISAPPEARANCE_20261018.md), docs/BOM_2026_FLOOD_CLASSIFICATION_AUDIT.json, docs/BOM_2026_GAUGE_COVERAGE_AUDIT.json.

### 24 October 2026 — Notable flood gauge and road crossing report (v10.2.10)

`frontend/src/context-layers/river-gauge-notable-report-v1.js` is a pure report builder over **all** source-matched river height observations exposed by `createRiverGaugeLayer().sourceFeatures`, never only filtered map icons. Selection: BoM moderate/major flood stage (station-specific actual measured stage preferred over possibly repeated old bulletin class); OR latest source-measured height at/above an exact-station published B (bridge), C (causeway), or X (crossing) height. One row per station; current source timestamp required within the existing 90-minute flood-signal freshness window; source identifiers/positions remain untouched. Source levels are obtained from BoM's public Section 5 register (05 January 2022) through the **existing Cloudflare Worker** `/river-crossing-heights` endpoint, with 24-hour upstream cache. The parser recognises only the documented B/C/X types, ignores roads/approaches/weirs/dams/tides, and fails closed if the official upstream data or reference count is invalid; no nearby/derived crossing levels are permitted. Historical datum/source-age limitations are made prominent; **crossing reference reached** must never be represented as a verified road closure.

UI: a compact inline flood report button and a mobile responsive, on-screen, read-only dialog, no map selection changes, source issue time for each row, manual refresh and normal 10-minute updating. BoM crossing catalogue is an additional reference only, not an additional per-gauge request. `frontend/tests/run-river-notable-crossing-report-v1-tests.mjs` verifies parser, categories, inclusion below minor, station ID mismatch, stale evidence, safe fallback, HTML and data flow.

### Road closures and power outages

Use published **QLDTraffic** events for all-traffic unplanned closures, not simply events containing a flooding keyword. Preserve both **point icons and mapped road geometries**. Turning a layer off must remove **lines and markers**, not leave invisible or orphaned geometry. The power layers include QLD outage provider polygons with shading (including any supported Essential Energy areas in scope), not points only; keep council-level outage counts/customer estimates tied to genuine source records. Planned outages do not belong in the **unplanned** layer. Source refresh timestamps should be visible independently of whether markers are enabled. Only trust provider-published polygons; geometry fallback decisions must be validated.

### QFD assistance / rescue

The sidebar exposes selected public QFD **RESCUE TECHNICAL**, **RESCUE ROAD CRASH** and **ASSIST PUBLIC** categories. The QFD public GroupedType may be coarse and incident locations approximate. Do not interpret excluded classes as zero current jobs, or treat QFD public GIS as dispatch data.

## 7. Cyclones, forecasts and other science status

**Production:** The **Cyclones** panel provides preserved historical reference cases (e.g. Jasper 2023 and Alfred 2025 **observed tracks**) and local import/QA of genuinely **issued** BoM forecast GML. Original BoM 72-hour/120-hour likely-track uncertainty areas are displayed **only if present** in the supplied official product. Do not manufacture uncertainty polygons, combine observed historical fixes into a pretend original forecast, treat warning/watch footprints as a forecast cone or label historical overlays “live”.

**Current limitation:** a fully validated, automatically updating public live BoM cyclone GML source bridge is **not delivered**. Network failure must say **unable to verify warnings**, never “no warnings”. A verified empty current source is required for that latter status. The original Fina sample's forecast positions and areas were decoded for QA, but historical decode success does **not** prove Queensland live ingestion.

**Other future work:** Genuine official Queensland severe-thunderstorm warning polygons (and NSW portions within radar coverage), clearly distinguished from inferred StormTracker detections; authenticated consecutive **AURA HDF5** sweeps and aliasing/georeferencing for historical damaging-wind/hook/tornado candidate science; optional public-data lightning likelihood only if accurately represented as **not a strike feed**. Keep current production unaffected until scientifically validated and operator approved.

See [V10_CYCLONE_LIVE_SOURCE_MAPPING_20261017.md](V10_CYCLONE_LIVE_SOURCE_MAPPING_20261017.md), [V10_GENUINE_CYCLONE_FINA_FORECAST_DECODER_20261017.md](V10_GENUINE_CYCLONE_FINA_FORECAST_DECODER_20261017.md), [ACTIVE_WISHLIST.md](ACTIVE_WISHLIST.md).

## 8. Routine operations and monitoring

| Data/process | Expected cadence / trigger | Source of truth and action on fault |
|---|---|---|
| Rainfall observations | Every **5 minutes** while layer on and page visible; manual refresh | BoM regional issue time; report partial/stale source, never a 0-mm invented reading |
| Reference catalogue client check | At most approximately every **15 minutes** during rainfall fetch | Persisted **radar-ftp-feed/ifd.json**, retain previously verified reference while temporary fetch fails |
| IFD catalogue expansion/reverification | Hourly GitHub workflow, **30** bounded attempts, month-old first-party rechecks | Data branch file + workflow logs; don't erase prior catalogue; incomplete coverage permitted |
| BoM flood gauge observations | Approximately every **10 minutes**, plus manual refresh | Source station ID, published observation/classification and datum; optional history must not suppress valid current bulletin |
| Native radar times | Actual BoM source-published times; reflectivity nominal **5-minute frames** | WMTS capabilities and verified tile; no invented timestamp; 400 may mean stale/unpublished time |
| Multi-site Doppler | Genuine published scans, bounded primary-clock matching | Per-site BoM source clock. A missing scan is a gap, not a licence to substitute another observation |
| Outages / road closures | Source/provider schedules; the UI displays last check time | Compare source published update, boundary/line and active-status details; avoid guessing fixed cross-provider cadence |
| QFD public incidents | Source update/age as shown in panel | Public grouped categories, approximate locations |
| Main static deployment | On accepted main push via **pages.yml**, subject to full validations | Successful Pages deploy **and** public BUILD/source QA |
| Existing Worker deployment | On configured **deploy-relay.yml** source-path changes or manual invocation | Worker job success, CORS/source route smoke |
 
**Common observed upstream faults:** WMTS time-dimension **HTTP 400**, intermittent radar/Doppler **403/502**, limited BoM optional gauge-history **502**, partial rainfall region failures, provider stale geometries. They are diagnostic/source faults, **not** proof that the hazard has stopped. Use bounded retries/cooldowns already implemented rather than increasing request pressure.

## 9. Safe developer workflow (start here)

**Before editing:**

1. Read **this handover**, **OPERATOR_GUIDE_CURRENT.md**, **CURRENT_ACCEPTED_BASELINE.md**, **SCIENTIFIC_CONTRACT.md**, **NON_NEGOTIABLE_VISUAL_FIDELITY.md** and the most relevant module's regression tests.
2. Confirm the latest **successful** public Pages run, **/BUILD.txt** source pin, current main SHA, Worker deployed version and if relevant the data-branch version of **ifd.json**.
3. Identify whether the proposed change belongs to (a) immutable pinned V10.2.0 source (**do not edit in place**), (b) main maintenance overlay, (c) existing Cloudflare relay, (d) scheduled data publisher, or (e) isolated historical/experimental QA.
4. Make a **small, isolated, reviewable** change; do not launch parallel redundant deployments or touch unrelated layers. Do not bypass true source validation by using synthetic data in production.
5. Update the **specific regression** to lock the behaviour and verify the final built artifact, not only the source in main.

**Local/CI checks (where environment supports them):**

~~~bash
npm test
node --check relay/worker.js
node --check frontend/src/context-layers/significant-rainfall-operational-v1.js
node frontend/tests/run-significant-rainfall-source-v1-tests.mjs
python3 scripts/test_bom_ifd_point_cells_20261020.py
~~~

For production-equivalent validation, use the existing workflow and script sequence already declared in **pages.yml** and **qa-ftp-aep-combined-release-v1.yml**. The former checks out immutable historical and V10.2.0 source revisions, runs regression suites, builds **_site/**, applies the authorised overlay and verifies the served Pages marker and source. The release gate also performs browser-based and public BoM source tests. Live BoM probes are sometimes unavailable because of the **upstream**, so distinguish a true contract regression from a transient external source failure; don't label a failed test success.

**Acceptance matrix:**

| Area changed | Must prove before production |
|---|---|
| Rainfall UI | Exact 9am/1h/24hrs-to9am wording; icon/drop-only 2/3; full-size rarity tag; click/popup and mobile |
| Rainfall data | Exact BoM station IDs and totals, source timestamp, 9am reset, 90-minute stale cutoff, 50/100 bands, region failures explicit |
| IFD catalogue | Existing cells retained; official provenance for replacement; 0.025° key; no fabricated depths; revalidation test; public JSON loads |
| Radar/Doppler | Authentic PNG/source times, no 400 cascade, no low-res frame leakage, correct selected loop counts; multiradar sync and boundaries |
| 3-D/render/camera | Eligible ≥40 dBZ echoes present, no flicker/black map/WebGL crash, no satellite gaps, desktop & mobile pan/zoom |
| Flood gauges | Exact station ID, source datum, minor/moderate/major persistence, rising arrow lifecycle and tide exclusions, manual + interval |
| Roads/outages | Official geometry and icons show, polygons shaded, toggling off removes both points and line/polygon graphics |
| Cyclone/warnings | Issued/valid source times, original geometry only, empty-feed vs error semantics, separate historical label |
| Whole site | Short/long viewport sidebar; hide/show controls; actual released assets/cache keys; baseline recovery points preserved |

**Publishing:** Main pushes currently trigger production Pages workflow; use an isolated branch/preview for science or broad UI changes. Review Actions job status for **deploy** and post-deployment **seal**, inspect the public site on mobile/desktop, verify matching source and incident markers, then record **exact successful run ID, commit and changed files** in this handover. Do not claim delivered production based only on a Git commit or passing unit tests.

## 10. Release history, rollback and recovery

The sealed original source is at **047b3bd1c66b0ed5f070d2298202f46d0cd8dae2**, with annotated **v10.2.0** and **restore/v10.2.0** preserving it. Current maintenance additions are built **on top**, and they require their own exact commit and Pages run record (see section 1).

Older tested anchors are maintained as recorded in [BASELINE_RESTORE.md](BASELINE_RESTORE.md), including:
- V10.1.1: **711d65a72a483b319e80711a09cfeabe2f69bbcd**
- V10.1.0: **11f0012170c4632bd5ef2448bf5671326fdd287e**
- V10.0.0: **e3f7f6d007f52e4ca48e103288bc5ffa77fac9b5**
- V9.20.2: **b8be458acbae942a3bb0b530a5c17618b6d03134**
- V9.18 diagnostic source: **acfa0ebd3717a793369e3e887e2d1a54785620b7**

**Rollback procedure:** Identify the last accepted **full composite** (immutable base + overlay + Worker/data branch dependencies); choose an earlier tested source/pin; create a reviewed **new release** through standard QA and deployment; verify live site and source behaviour. **Never move/reuse an old tag or force-push a historical restore branch.** Do not restore frontend UI blindly while leaving incompatible new relay or reference schema live. A GitHub Pages rollback does **not** roll back the independent Cloudflare Worker or data-only branch: check those separately.

### Preserve these working invariants

- Main can contain experimental/maintenance code; the build retains its immutable application pin.
- Pages contains retained historic previews under their own paths; do not overwrite accepted diagnostic previews.
- CSS/module assets are cache-busted when shipping UI changes, but an unrelated global cache purge is not a substitute for correct paths.
- Browser stores bounded genuine historical radar frames; application/source caches must avoid exhausting WebGL memory.
- Each missing source needs a visible status and trustworthy fallback or explicit **unavailable**, never “zero”.
- Do not overwrite **radar-ftp-feed/ifd.json** with empty/outdated data or prune old verified cells.
- Shared public source terms/attribution and permitted redistribution are separate from technical ability to fetch: investigate before publishing live BoM-issued warning GML publicly.

## 11. Outstanding work and known limitations (20 October 2026)

| Priority | Status and required next step |
|---|---|
| **Permanent rainfall IFD catalogue** | **Active expansion, incomplete.** Verify the final gauge registry and geographic coverage, especially **Unrated** stations; continue official source-verified collection/revalidation without destructive rebuild or town-level guess. |
| **Live Queensland cyclone forecast ingestion** | **Not complete.** Implement a permitted, reliably transportable official current issued product; honour actual forecast fixes/uncertainty geometry and source validity; isolate QA from production. |
| **Official thunderstorm warning overlays** | Future phase: original BoM QLD warning polygon sources plus NSW regions within mapped radar coverage; no synthetic warnings. |
| **Genuine Doppler severe-wind candidate research** | Historical consecutive AURA measurements, validated geographic registration, velocity-alias checking, event-based performance assessment before any operational classifier. Brewarrina candidate science remains excluded while georegistration is provisional. |
| **Upstream source resilience** | Continue contract-based mitigation for BoM 400/403/502, river history 502, provider geometry and data freshness. Any new caching must retain original source time. |
| **Operational performance** | Test prolonged desktop/mobile pan/zoom/playback, texture retirement, GPU memory, overlay disable/re-enable, secondary Doppler flicker and full-screen controls before widening scope. |

Do not claim the IFD catalogue is geographically **complete** merely because the collector has caught up with current live rainfall observations. Full spatial completeness needs an independent BoM coverage audit; a station that hasn't recently reported rainfall may not yet be in the input registry.

## 12. Handover checklist for the next developer

- [ ] Read the operator guide and the non-negotiable science/visual fidelity contracts.
- [ ] Confirm successful **Pages run**, maintenance commit, actual public build marker and source asset revisions.
- [ ] Verify the source pin and historical annotated tags/restore branches unchanged.
- [ ] Check relay health separately; do not infer it from the static Pages status.
- [ ] If rainfall is touched, inspect **BoM source vs station ID/period/timestamp**, and **ifd.json** preservation separately.
- [ ] If flooding is touched, ensure gauge observation datum and flood threshold reference are genuinely compatible, especially stations with tidal characteristics.
- [ ] Validate **radar** genuine frame counts, **Doppler** source clock, **3-D** original dBZ and no map/texture regression.
- [ ] Run relevant frontend Python/Node tests, production-equivalent browser QA and a live mobile/desktop smoke test.
- [ ] Publish through the existing workflows; check both **deploy and seal** jobs, then document the successful commit, run and operator acceptance.
- [ ] Keep pending milestones and limitations explicit. Historical samples and algorithmic candidates are **never live official warnings**.

**Document maintenance rule:** For each operator-approved production change, update this current handover and (where user-visible) [OPERATOR_GUIDE_CURRENT.md](OPERATOR_GUIDE_CURRENT.md). Keep old numbered handovers **historical**; do not erase provenance. The handover's last source-changing SHA is a **snapshot as of 20 October 2026**, not a claim that future main/deployments will forever have that SHA.

## Final severity overlay priority — accepted 20 October 2026

Overlapping BoM flood icons and significant rainfall rarity icons now use separate Cesium CustomDataSource draw tiers ordered across **both layers** through `context-layers/severity-marker-layer-v1.js` and `dataSources.raiseToTop`. Flood priority: unverified, rapid rise, minor, moderate, major. Rainfall priority: Unrated, Less rare, Notable, Unusual, Rare, Very rare, Exceptional. Within matching rainfall rarity, larger measured totals are added later. This corrects actual Cesium billboard overlap without unsupported z-index or changes to station data, thresholds, marker geometry, controls or refresh. Covered by `run-severity-marker-layer-v1-tests.mjs` and revised flood integration suite. Freeze recovery ref: `restore/production-severity-2026-10-20` after CI verification.


## 26 October 2026 — latest operator-accepted composite freeze V10.2.23

The operator confirmed the current flood gauges and requested no further feature development. This release includes all accepted AEP/rainfall, radar, incident, flood-marker, crossing and tidal-screening overlays from the GitHub main branch at the new release reference. The unmodified sealed V10.2.0 science source remains the public composite's underlying pin. See [RELEASE_NOTES_V10.2.23.md](RELEASE_NOTES_V10.2.23.md) for the exact scope, source-quality obligations and restoration rules. The site's existing **Operator guide ↗** link opens [OPERATOR_GUIDE_CURRENT.md](OPERATOR_GUIDE_CURRENT.md), updated for 26 October, with no new UI. **Wait for the Pages deploy job and public-asset checks to pass before creating the annotated `v10.2.23` tag and `restore/v10.2.23` recovery branch.** Check that both point to the release commit. Do not rewrite previous annotated tags or frozen branches, and do not infer the status of the independent Cloudflare relay or data branch from GitHub Pages alone.


## 1 November 2026 — V10.2.40 operational WMTS recovery

The screenshots at 12:12–12:14 AEST showed BoM timestamp/readability failures in Safari and a stale Townsville frame. Live at 12:18 AEST all nine genuine published WMTS timestamps, 11:30–12:10 AEST, returned 200 PNG at central/corner points at eight QLD radar regions. See `docs/RELEASE_NOTES_V10.2.40.md` for scoped recovery changes, source evidence and outstanding physical iOS acceptance. A healthy native source does not guarantee a healthy browser loader; the deployed package and repeated switching must be tested separately. Keep 5-minute active polling and 50-second recovery after operator site-load error. No fabricated timestamps or different-data fallbacks.
