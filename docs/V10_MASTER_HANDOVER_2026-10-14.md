# StormTracker V10 — consolidated project handover
**Prepared:** 14 October 2026 (AEST) | **Purpose:** carry forward binding user decisions, verified repository status and practical V10 starting state. No software release or scientific validation is implied.

## 1. Source of truth and release discipline

- Repository: [Blakesmith-Intel/StormTracker](https://github.com/Blakesmith-Intel/StormTracker).
- Sealed **production V9.18.0** source `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd` → https://blakesmith-intel.github.io/StormTracker/
- **User-accepted V9.18 diagnostic**, preferred working application reference: `acfa0ebd3717a793369e3e887e2d1a54785620b7`, recovery `restore/v9.18-accepted-diagnostic-20261013` → https://blakesmith-intel.github.io/StormTracker/preview/radar-history-fix/
- Cleaned `main` documentation/control HEAD at consolidation: `0abc5db75b1827e27847d1fb047ac7948d1d0b62`. **Do not assume `main` is what GitHub Pages is serving**: `.github/workflows/pages.yml` pins the supported sources.
- Preserved original pre-cleanup tree `archive/pre-cleanup-20261013` at `3633307ec502ad85359a2e4e7d41cbcac22005c4`. Historical installers and preview matrices stay in Git history, not the current working tree.
- Existing V10 experiment branch `feature/v10-severe-weather-candidates` at `f39fad7d2726ee8d6c66771fbfdc6bd84b25f828` (14 October). This research branch still contains historical documents/workflows omitted from cleaned `main`. **Selectively port and test research files; never merge the legacy branch wholesale over the cleaned repository.**
- This handover is documentation only. Do not move pinned commits/tags, change Pages deployment, re-enable old previews, or promote V10 without explicit operator acceptance.

## 2. Non-negotiable product contract

StormTracker is a **browser-only Queensland and southern-border situational-awareness viewer**. It is not the Bureau of Meteorology's official warning product or an emergency-management decision-making tool.

- Original time-stamped BoM **reflectivity imagery is measured 2-D in dBZ**, never converted to mm/h. Radar frames must be genuine source observations; no invented frames passed off as observations.
- **Doppler is radial velocity**, not storm translational speed or measured surface gust. Sign, geometry, radar, observation time, palette/sampling accuracy and velocity aliasing require validation before a numerical severe-wind claim.
- Live rounded 3-D blobs/columns are **inferred from 2-D reflectivity**, not measured echo-top height or genuine AURA volume scans. Default vertical exaggeration 1.0×; floor ≥40 dBZ; strong return display height derives from each source pixel, not whole-storm peak. BoM-colour dBZ palette, purple 60–64 dBZ and black ≥65 dBZ.
- Segmentation is based on **16+ observed connected ≥40 dBZ pixels**, allowing a tightly bounded two-pixel gap bridge while not counting synthetic gap pixels. Protect distinct strong cores. **No 6 km² minimum area gate**. Ordinary ST labels require two measured scan observations; special ≥55 dBZ / strong-connected-pixel early-visibility conditions apply. STxxxx and tracks are platform-derived, not BoM track IDs.
- Selected tracks and optional +90-minute motion cones extrapolate observed movement; the cone is not an official forecast probability polygon. Labels and points are linked and visible-state changes apply to paused frames.
- The existing Cloudflare Worker is for public-source **transport/CORS only**, not meteorological computation. Production must require no Python, FastAPI, SQLite, HDF5 engine, paid host, locally installed app, or localhost.
- One primary site owns tracked storms, Doppler and warnings; at most **three supplementary** radar windows show same-source-UTC observed reflectivity and bounded *display-only* inferred 3-D, masking coverage overlap. Supplemental sites create no extra ST tracks or Doppler. Never display old-UTC extras alongside newer primary data.
- Missing/stale data should be suppressed with clear limitations, **not replaced with fabricated readings** or interpreted as an all-clear.

## 3. Accepted V9.18 capability map

**Weather/UI:** 19 Queensland radar sites plus NSW Brewarrina, Moree, Grafton (22 coverage windows). Default Brisbane/Mt Stapylton. Clickable minimalist radar dishes; separate source-aware radar/Doppler playback, rain-only 60/120/180-minute options where genuinely available, source UTC plus AEST, approximately five-minute polling. Doppler-only imagery keeps original opacity; stale rain tracks, cones, trails and labels clear on Doppler switch. Independent reflectivity and volume opacity.

**Map and response:** Cesium 3-D terrain; Street or DEA 2025 regional GeoMAD satellite plus staged official QLD/NSW close-up detail at local zoom. Geographic labels are consistently foreground and shared QLD/NSW HTML layer, deduplicated and bounded by screen-space budgets. NSW official geocoded locality snapshot is generated during Pages build and served same-origin because the original spatial service lacks browser CORS. Fast pan/zoom, WebGL texture lifetime, flicker-free source-frame handover and satellite persistence received user acceptance on 13 October.

**Context:** QLD Traffic all-unplanned closed-to-all-traffic road incidents; current **unplanned** QLD power failures; only exceptional BoM flood/river signals under agreed rapid-rise/moderate thresholds; selected public QFD incident groups (technical rescue, road crash rescue, assist public, including large multi/mountain rescue). Interactive official source links. Missing river station-history responses are optional and serially backed off for 15 minutes; authoritative BoM bulletins remain usable.

**Known non-blockers:** Edge CDN tracking-prevention notices; clamped terrain-outline Cesium warning; isolated upstream optional river-history 502 (should not cascade). Reopen accepted navigation/performance defects only on new reproducible evidence.

## 4. Development provenance and chronology

- V9.7.2: early sealed baseline, `aef6cc4f790774b018f02f5677481b5a2bcdaa04`. V9.8.4: history/source-aware restoration and regression contracts. V9.9.x: satellite/terrain and context groundwork.
- V9.10–9.14: road closures, unplanned QLD power outages, flood-gauge exception logic, QFD incidents.
- V9.16.14/.15: measured-pixel storm grouping and track-label decluttering; four-site total radar selection. 12 October V9.16.15 library documentation is useful historical evidence, **not current production guidance**.
- V9.17: NSW radar coverage, refined regional/local satellite and 3-D source-pixel presentation.
- V9.18.0: sealed production; diagnostic follow-up fixes for mobile/desktop navigation, atomic supplemental frames, bounded supplemental inferred 3-D, geography and nonblocking river source failures. Accepted 13 October.
- V10: isolated quantitative Doppler/circulation research; no production severe-weather candidate alarms yet.

## 5. Source and module map

- `frontend/live3d-operational-v9.html`, `frontend/src/live3d-operational-v9.js`: operator shell and orchestration.
- `frontend/src/bom-wmts-loop-v2.js`, `frontend/src/bom-doppler-intake-v3.js`: official reflectivity and Doppler sources.
- `frontend/src/multi-radar-display-v9.js`, `frontend/src/radar-imagery-handover-v1.js`: measured supplementary windows and atomic frame changes.
- `frontend/src/context-layers/basemap-manager-v1.js`, `qld-town-label-layer-v1.js`, `nsw-radar-place-catalogue-v1.js`: layered geography and labels.
- `scripts/build-nsw-radar-places.py`: official local NSW point snapshot assembled during Pages build.
- `relay/worker.js`: transport-only relay.
- On the V10 research branch: `frontend/src/doppler-source-validation-v10.js`, `frontend/src/circulation-candidates-v10.js`, `frontend/tests/run-doppler-v10-validation-tests.mjs`, `scripts/aura-v10-volume-audit.py` and `.github/workflows/v10-aura-evidence.yml`.
- Main branch's current controls: `README.md`, `docs/CURRENT_ACCEPTED_BASELINE.md`, `docs/HANDOVER_V9.18.0.md`, `docs/SCIENTIFIC_CONTRACT.md`, `docs/BASELINE_RESTORE.md`, `docs/ACTIVE_WISHLIST.md`. These override stale instructions in historical V9 handovers.

## 6. How to resume safely

1. Start with this document, [V10 evidence and gates](V10_EVIDENCE_AND_NEXT_STEPS_2026-10-14.md), existing `docs/SCIENTIFIC_CONTRACT.md`, and `docs/CURRENT_ACCEPTED_BASELINE.md`.
2. Use the clean repository structure and protected accepted application code. Review/reapply only isolated V10 research modules from `feature/v10-severe-weather-candidates`; do not inherit its pre-cleanup workflow matrix.
3. Keep genuine historical AURA acquisition **offline/research-only**. Require quantity/unit validation, polar registration, velocity quality/dealiasing, consecutive timestamps and reproducible detections before any scientific claim.
4. For implementation: write deterministic tests first. Run `npm test`, `node --check relay/worker.js`, targeted candidate scientific checks and appropriate browser/WebGL stress. The last feature-branch Node workflow success alone does **not** validate archived meteorology.
5. Only then open a new isolated browser preview; desktop and mobile visual passes and explicit release permission are required before any production pin/tag change.

## 7. Current decision

Next technical dependency is **selective extraction of consecutive authentic Mt Stapylton and Marburg AURA HDF5 volumes from >2 GB daily ZIPs**, while taking Gympie's verified three-volume sample through polar georeferencing, units/sign/aliasing checks and candidate evaluation. This is R&D, not an operator-facing warning feature.

See the [legacy-document index](V10_LEGACY_DOCUMENT_INDEX_2026-10-14.md) to distinguish historical reference files from the authoritative current docs.
