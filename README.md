# Q-SCOPE — Queensland Situational Awareness

**Formerly StormTracker.** A browser-based Queensland weather, hazard and emergency situational-awareness platform covering native BoM radar/Doppler, flood gauges, severe-weather warnings, cyclone outlooks, rainfall, road closures, power outages and community incidents. **Independent viewer only**, not an official government warning or dispatch authority.

**Production website:** https://blakesmith-intel.github.io/Q-Scope/ — the repository and GitHub Pages project path were renamed on 10 November 2026. Historical source tags, cloud relay routes and internally persistent identifiers are not renamed.

**Operator-accepted technical restore point:** [V10.2.53](https://github.com/Blakesmith-Intel/Q-Scope/releases/tag/v10.2.53), annotated tag `v10.2.53` and branch `restore/v10.2.53` at `1466851327584b62e06172b3aa2c279afd27870e`. Never modify or repoint an existing restore reference. Q-SCOPE's initial branding change is a separate presentation-only enhancement on top of that source.

**Branding rules and future name migration:** [Q-SCOPE identity and legacy compatibility](docs/Q_SCOPE_BRAND_IDENTITY.md). The V10.3 hook-echo and straight-line-wind alert science remains a separately pinned, **experimental** QA preview; this name change does not promote those alerts.

---

## Historical StormTracker releases and technical record

# StormTracker — V10.2.42 immutable operator-accepted production baseline

**Current accepted release (1 November 2026): V10.2.42.** The operator confirmed the working V10.2.41 application on a physical iPhone after source-verified V10.2.40 radar recovery and the V10.2.41 Longreach camera-retention correction. V10.2.42 is a **documentation, verified rollback and release-workflow freeze only**; it does not change the accepted live weather application, features or timing.

**Production:** https://blakesmith-intel.github.io/Q-Scope/  
**Frozen source:** annotated `v10.2.42` and matching immutable `restore/v10.2.42` (created only after Pages acceptance).  
**Feature development:** branch from `v10.2.42`, keep changes off production, run the full scientific/source and mobile/browser regression gates, require operator acceptance, and cut a **new** tagged release for approved enhancements. Never repoint a historical tag or restore branch.

**Start with:** [authoritative production baseline](docs/PRODUCTION_BASELINE_V10.2.42.md) · [release notes](docs/RELEASE_NOTES_V10.2.42.md) · [operator guide](docs/OPERATOR_GUIDE_CURRENT.md) · [one-page PDF](docs/STORMTRACKER_LAYERS_INFORMATION.pdf) · [development handover](docs/DEVELOPMENT_HANDOVER_CURRENT.md) · [rollback](docs/BASELINE_RESTORE.md) · [future enhancements](docs/ACTIVE_WISHLIST.md).

**Non-negotiables:** five-minute radar polling, true timestamped BoM WMTS frames, bounded failed-source recovery and multi-region isolation; user-owned camera that never resets on radar updates; approved Doppler and inferred 3-D boundaries, warning/cyclone source validation, rainfall/AEP, flood severity and crossings, outages, roads, incidents and original geography. Healthy verified zero warning feeds are **No current warnings**; unreadable/unverified feeds are **unavailable**, never fabricated all-clears. No hidden future feature changes are included.

**Scope of immutability:** Git source/build/documentation and restore refs, not live BoM data, downstream agency feeds or the separately deployed Cloudflare relay.

---

## Archived README snapshot — previous 27 October V10.2.26 release

The material below records earlier release history and is retained for provenance. Where it describes V10.2.26 as the "current" version, that is historical; the V10.2.42 documents linked above now control.

### Historical V10.2.26 documented production baseline (V10.2.25 warning functionality)

> **Current release 27 October 2026:** [Operator guide](docs/OPERATOR_GUIDE_CURRENT.md) · [current development handover](docs/DEVELOPMENT_HANDOVER_CURRENT.md) · [final documentation freeze](docs/RELEASE_NOTES_V10.2.26.md) · [BoM severe-warning feature release](docs/RELEASE_NOTES_V10.2.25.md) · [restore instructions](docs/BASELINE_RESTORE.md). **V10.2.26 is documentation-only**; it retains the exact accepted V10.2.25 optional BoM severe-warning code, previously sealed V10.2.24 maintenance functions, and immutable V10.2.0 native radar/3-D science foundation. Old tags are never overwritten.

StormTracker is a **browser-only Queensland and southern NSW border BoM radar situational-awareness viewer**. It is **not** an official warning service or an emergency decision-making tool. Original source radar reflectivity is in **dBZ**, native Doppler is radial velocity, and vertical 3-D structures and storm cones are explicitly **empirical/inferred**, not measured 3-D weather radar.

## Current stable app

**https://blakesmith-intel.github.io/Q-Scope/**

**Accepted production (27 October 2026): V10.2.26 documentation-only final freeze.** All existing V10.2.25 warning features are preserved. These include BoM IDQ21035 detailed southeast Queensland thunderstorm and IDQ21033 regional thunderstorm product filtering; source-supplied genuine warning polygons drawn beneath radar; click-to-view BoM warning details; precise official Queensland LGA/LDMG and DDMG intersection reports (no small-overlap exclusion); automatic 15-minute and manual refresh; product cancellation and update lifecycle; and verified-empty versus unavailable source status. The feature is off by default. **Live rendering against a genuine active BoM warning polygon has not been end-to-end verified:** absent upstream geometry remains unavailable, not a fabricated all-clear. For the current production acceptance and recovery points see [V10.2.26 final release notes](docs/RELEASE_NOTES_V10.2.26.md) and [operator guide](docs/OPERATOR_GUIDE_CURRENT.md).

- **V10.2.0:** Opt-in BoM source-authentic cyclone forecast-map display and historical Jasper/Alfred reference overlays, no invented uncertainty polygons, explicit live-source validity and BoM's 'Currently no tropical cyclone warnings' text only after a successfully verified empty source check. An offline FTP retrieval audit and authentic historical Fina GML decode passed. The public site's automatic live data bridge is **not operational**, so it must instead state the feed cannot be verified when unavailable. Original V10.1.1 radar/Doppler functions and recovery references remain preserved. Pinned cyclone UI source `047b3bd1c66b0ed5f070d2298202f46d0cd8dae2`; see `docs/CURRENT_ACCEPTED_BASELINE.md` for rollout verification.
- **V10.1.1:** Single simplified interface with correctly expanding full-screen map on Hide controls, rain-style synchronised native multi-site Doppler with a primary source clock, genuine per-site ±8-minute matching, Brewarrina IDR93I, plus operator-accepted continuous QLD/NSW satellite basemap, high-quality persistent 3-D on primary and additional radar sites, original full-resolution BoM data, bounded caches/CPU performance optimisations, viewport-fit diagnostics. Pin/tag/restore SHA is in `docs/CURRENT_ACCEPTED_BASELINE.md` after CI cutover.
- Earlier sealed `v10.1.0`: `11f0012170c4632bd5ef2448bf5671326fdd287e`, `restore/v10.1.0` (preserved).
- Earlier sealed `v10.0.0`: `e3f7f6d007f52e4ca48e103288bc5ffa77fac9b5`, `restore/v10.0.0` (preserved).
- Historical sealed `v9.20.1`: `efaceb59427f0b71859b15a61a6758a80d08547e`, `restore/v9.20.1`.
- Historical `v9.20.0`: `aba409fd1609e7bf7be6bf3c098b7fb6a14d89d1`; `v9.19.0`: `d317c17a6a8f706a0d867cb852db1e8d3f9ffac0`; `v9.18.0`: `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd`.
- Accepted historical V9.18 diagnostic: https://blakesmith-intel.github.io/Q-Scope/preview/radar-history-fix/
- Current incremental QA preview: https://blakesmith-intel.github.io/Q-Scope/preview/incremental-3d/live3d-operational-v9.html

## Core capabilities

- Original BoM reflectivity at native source grid, independent genuine radial Doppler (including selected additional verified sites); 1×/2×/3× timeline replay with source UTC and AEST.
- Primary radar plus up to 3 additional BoM sites; stable ≥40 dBZ inferred rounded volumetric depiction with per-site source pixel coverage and no whole-cloud flicker.
- Valid observed-pixel connected storm footprints, primary-only ST IDs, optional +90min illustrative cones, labels off by default.
- QLD original high-resolution satellite, DEA 2025 GeoMAD regional NSW and NSW official detail at close zoom, with genuine global satellite imagery filling upstream tile gaps rather than exposing blue globe.
- 3-D terrain, road closures, unplanned power outages, BoM flood signals and selected QFD incidents.
- Safe browser navigation/GPU texture retirement, bounded scan/provider caches, full-width scrollable **Memory diagnostics** with JSON copy.

## Development and documentation

- `frontend/` static Cesium browser runtime, source-science helpers and regression tests.
- `relay/` existing CORS transport-only Cloudflare Worker.
- `scripts/build-current-site.sh` production from pinned immutable source SHA, isolated QA previews.
- `docs/RELEASE_NOTES_V10.2.23.md`, `docs/OPERATOR_GUIDE_CURRENT.md`, `docs/DEVELOPMENT_HANDOVER_CURRENT.md` are current; numbered V10.1.1 instructions are historical.
- `docs/NON_NEGOTIABLE_VISUAL_FIDELITY.md`, `docs/SCIENTIFIC_CONTRACT.md`, `docs/CURRENT_ACCEPTED_BASELINE.md`, `docs/BASELINE_RESTORE.md` release invariants.
- `docs/V10_OFFICIAL_WARNING_DATA_PLAN.md`, `docs/ACTIVE_WISHLIST.md` current next work.

**Next milestones (in order):** 1. Official live BoM cyclone track spatial data, 2. official Queensland severe-thunderstorm warning polygons and NSW warnings within the installed radars' coverage, 3. V10 AURA genuine HDF5 radial-wind candidate science. **Not yet part of sealed V10.1.1.** Only real, time-valid official geometry may be presented as a warning.

## Release process

Full `npm test` (including native multiple-Doppler clock/source regression), `node --check relay/worker.js`, Pages dry-run of the exact immutable source, public `BUILD.txt` and static asset checks, then annotated tag + restore branch **only after successful deployment**. The main branch remains a development stream and is NOT automatically the production app. Older tags and recovery branches are immutable.


**V10.2.0 immutable release source:** `047b3bd1c66b0ed5f070d2298202f46d0cd8dae2`. Public `BUILD.txt` shows `SEALED StormTracker V10.2.0 source 047b3bd1c66b0ed5f070d2298202f46d0cd8dae2`; annotated tag `v10.2.0` and `restore/v10.2.0` are created and independently verified. Prior V9.20.2 refs remain unchanged. Next: authoritative BoM cyclone forecast tracks and official uncertainty polygons in isolated QA, with no inferred probabilities or fabricated warning geometry.

### Historical cyclone forecast map (development QA only)

The [/preview/incremental-3d/](https://blakesmith-intel.github.io/Q-Scope/preview/incremental-3d/) includes **Layers → Cyclone forecast · QA**. Select your own originally issued BoM `*.gml` file to view original past/forecast fixes and the **72h/120h published likely-tracks polygons** (when present). No original BoM cyclone warning geometry is hosted by StormTracker, and the layer is **NOT LIVE**. See [source and QA instructions](docs/V10_HISTORICAL_CYCLONE_FORECAST_MAP_QA_20261017.md). Sealed production V10.1.1 remains unchanged.


**17 October 2026 release automation repair:** [PR #162](https://github.com/Blakesmith-Intel/Q-Scope/pull/162) restored the successful tagged/rollback release process, using an independent post-deploy job and GitHub Git Data API. Both deployment and annotated-tag sealing passed in [run 39012793972](https://github.com/Blakesmith-Intel/Q-Scope/actions/runs/39012793972). The current cyclone interface and V10.1.1 radar baseline are unaffected.
