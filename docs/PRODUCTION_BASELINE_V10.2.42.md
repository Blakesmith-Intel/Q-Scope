# Current production baseline: V10.2.42 (frozen)

**Authoritative as at 1 November 2026, 13:37 AEST — operator-approved and functioning on iPhone Safari.**

V10.2.42 is the **immutable documentary freeze of the working V10.2.41 application**. The V10.2.40 genuine radar WMTS recovery and V10.2.41 camera continuity are already field accepted. There are no operational-feature changes in this release.

**Public:** https://blakesmith-intel.github.io/StormTracker/  
**Frozen tag:** `v10.2.42` (annotated, immutable policy)  
**Exact restore source:** `restore/v10.2.42` (must peel to the same commit)  
**Approved code:** exact V10.2.41 operational behaviour, plus documentation and a historical V10.2.29 workflow-only re-seal guard.  
**Future work:** branch from `v10.2.42`. No later proposal is part of frozen production until independently tested, explicitly accepted and released under a new immutable version.

## Mandatory handover order

1. Read [V10.2.42 release notes](RELEASE_NOTES_V10.2.42.md), [current operator guide](OPERATOR_GUIDE_CURRENT.md), [current development handover](DEVELOPMENT_HANDOVER_CURRENT.md), [scientific contract](SCIENTIFIC_CONTRACT.md), [visual fidelity requirements](NON_NEGOTIABLE_VISUAL_FIDELITY.md) and [restore instructions](BASELINE_RESTORE.md).
2. Verify `git rev-parse v10.2.42^{}` equals the commit at `restore/v10.2.42` and retain that exact SHA as an untouched safety reference. Never force-update or repoint existing tags or restore branches.
3. Branch off `v10.2.42` for the next approved enhancement; make **only** the scoped feature change. Do not drag in speculative science, new data sources, different operating intervals, altered symbology, relocated labels or old warning/cyclone source assumptions.
4. Run all existing source/geometry/science/unit tests, full frontend regression, pinned production package build, relevant authenticated BoM or agency source checks, real operational mobile/desktop browser tests and a public-site verification. A green backend/API or single-tile test is not proof of a working map.
5. Require operator acceptance for user-visible changes. Promote with a reviewed PR, deploy to the public Pages site, verify the actual deployed files, then create **a new** annotated version tag and same-commit `restore/` branch.
6. For rollback, make a **new reviewed rollback commit from the frozen source**; do not reset `main` or rewrite any previous version. The independent Cloudflare relay and agency feeds require separate validation.

## Locked operational acceptance

- Five-minute automatic radar polling with bounded retries, authentic missing-frame backfill, site-local negative caches, conservative source refusals and correct latest-frame following.
- Map position and selected primary radar are operator-owned and never reset by new source frames; same-tab persistence survives a Safari reload.
- Existing Doppler, inferred 3-D dBZ, storm tracking, severe-weather warning and cyclone reporting, rain/AEP, flood gauges/bridges, QLDTraffic, outages, QFD incidents, reports, geography, severity ordering, four-section menu and operator guide remain unchanged.
- Verified healthy zero warnings display **No current warnings**; unavailable data never impersonates an all-clear; all storm imagery and source timestamps are genuine.

## Release integrity / honest limits

A Pages deployment is not proof that every BoM/QLDTraffic/Energex/Ergon/agency service is available at that instant. An annotated Git tag freezes code, documentation and build logic **only**; it does not freeze upstream observation servers, the independent relay or a user's browser cache. Users may need one reload after an accepted release, not after every weather update.

**Historical documentation remains in this repository for provenance**, including older headings that once claimed to be current. This file, `RELEASE_NOTES_V10.2.42.md` and `OPERATOR_GUIDE_CURRENT.md` supersede their old current-release descriptions.

**Acceptance:** User explicitly confirmed StormTracker functional on 1 November 2026. V10.2.42 sealing is complete only when Pages publication, the `v10.2.42` tag and the `restore/v10.2.42` SHA match have all been verified.
