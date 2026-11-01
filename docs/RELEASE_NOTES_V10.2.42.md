# StormTracker V10.2.42 — operator-accepted immutable production baseline

**Accepted:** Sunday 1 November 2026, approximately 13:37 AEST (Queensland).  
**Release type:** Documentation, release-process and baseline freeze. **No changes to operational JavaScript, BoM data processing, 3-D algorithms, map layers, or refresh behaviour relative to the operator-tested V10.2.41 application.**  
**Live URL:** https://blakesmith-intel.github.io/StormTracker/

## Acceptance and version identity

The operator explicitly confirmed **"Everything is confirmed functional"** following deployment of the V10.2.41 camera-continuity correction and the V10.2.40 verified multi-radar WMTS reliability repair. This is the new authoritative **working production baseline** for all subsequent proposals and enhancements.

V10.2.41's accepted application behaviour is carried forward unchanged. V10.2.42 changes only current documentation, the one-page operator quick reference, and a guard that stops the **already frozen V10.2.29** historical tag-creation workflow from erroneously re-running on future deployments.

## Immutable source-of-truth references

After successful public Pages deployment and acceptance verification, the **new annotated Git tag `v10.2.42` and matching `restore/v10.2.42` branch must both point to the exact same baseline commit**. Neither is to be repointed, reset, force-pushed, deleted or modified to incorporate future work. The frozen V10.2.41, V10.2.40, V10.2.39, V10.2.38 and older refs are unchanged.

The `main` branch publishes the accepted site; it is not itself immutable. Later feature branches must be created from `v10.2.42` (or the baseline-only `develop/from-v10.2.42` branch if created). New changes cannot replace production merely because a code check passes; they require source verification, relevant full regressions, operational mobile/desktop acceptance, public deployed-site verification, explicit operator approval and a **new** release tag/restore branch.

## Locked operational behaviours

- **Genuine BoM radar:** source-published timestamps and tile-verified dBZ; no invented frames, geographic substitutions or unlabelled interpolation. Default 30-minute rain replay includes six five-minute scans **when BoM actually provides all six readable observations**. The operator sees honest frame counts and timestamp/source status.
- **Automatic updates:** retain regular five-minute active-window polling; short busy retry, missing genuine-frame recovery, 60-second bounded source-error retry, foreground/page restore checks, and in-tab retry after a failed site change. Loading a new observation updates imagery/analysis, **not the camera position**.
- **Regional isolation:** bounded two-tile fetch concurrency, verified compressed PNG reuse, 45-second negative tile/time expiry, independent radar-region rejection, and no broad cooldown from a lone HTTP 403/502/503/504. A genuinely unverified observation must never be presented as available.
- **Camera:** selected radar and complete camera pose survive same-tab Safari reloads for the lifetime of the tab. A brand-new tab defaults to Brisbane Mt Stapylton. Deliberate primary selection, user navigation, Reset, Fit and explicit Focus keep their approved camera actions.
- **Scientific boundaries:** native BoM Doppler is actual radial velocity; reconstructed 3-D, storm tracks, threat cones and projected motion are inferred/investigative overlays, not measured 3-D or official warning products. Preserve 40 dBZ volume threshold, vertically exaggerated value 1.0 and pre-existing science source contracts.
- **Warnings and cyclones:** maintain approved four-section navigation, source-verified official BoM warning polygons and reports, 15-minute warning polling, cancellation behaviour, honest "No current warnings" for verified healthy zero results and **unavailable** for failed/unverified feeds. A cyclone forecast map is not itself an official warning bulletin.
- **Rainfall/AEP:** retain original BoM gauge identity, accurate geolocation, since-9-am and 24-hours-to-9-am periods, verified IFD/AEP rarity and Notable+ / totals reports; highest rarity stays visually on top.
- **Flood signals:** keep source-measured flood severity, crossing/bridge approaches and heights, verified non-tidal 0.30 m/hour rapid-rise logic, conservative handling for uncertain tidal status, stale timestamp labelling, marker removal on return to normal, and severity priority. Preserve approved icon size and symbols.
- **Community impacts:** retain approved Queensland unplanned road closures, separate local/state roads reports, Energex/Ergon outages, LGA totals, QFD technical/rescue/assist incidents and their existing source refresh and map placement.

## Evidence used to accept this baseline

- Operator acceptance on a physical iPhone, 1 November 2026, after live V10.2.40 and V10.2.41 deployment.
- The V10.2.40 genuine WMTS live seven-region WebKit replay test and operational multi-region browser QA; release notes `RELEASE_NOTES_V10.2.40.md`.
- The V10.2.41 real mobile-sized Longreach browser camera regression: selecting Longreach, loading the Latest observation and reloading the same tab retained the exact longitude, latitude, range, heading and pitch; GitHub run [41268669694](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/41268669694).
- Public Pages successful V10.2.41 production run [41269212304](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/41269212304); both V10.2.41 tag and restore branch verified to identify the same commit.
- V10.2.42 publication and exact annotated-tag/restore identity must be verified separately before considering **this document-only freeze** sealed.

## What this freeze does NOT mean

This is an **immutable source and documentation recovery point**, not a promise that BoM, upstream imagery, Cloudflare Worker, carrier networks or iPhone Safari will never fail. The external BoM/agency feeds and independently deployed `stormtracker-bom-relay` Worker are **not frozen by a GitHub tag**. No independent continuous 24/7 radar-monitoring service has been deployed as part of this freeze.

Verified zero warnings are normal negative reporting. Unavailable radar or an unreadable observation is **not** an all-clear. Always consult original issuing agencies for operational decisions.

## Current references

- [Operator guide](OPERATOR_GUIDE_CURRENT.md)
- [One-page operator quick reference (PDF)](STORMTRACKER_LAYERS_INFORMATION.pdf)
- [Current development handover](DEVELOPMENT_HANDOVER_CURRENT.md)
- [Immutable recovery procedure](BASELINE_RESTORE.md)
- [Accepted baseline record](CURRENT_ACCEPTED_BASELINE.md)
- [Later enhancements register](ACTIVE_WISHLIST.md)
- [Source policy and science boundary](SCIENTIFIC_CONTRACT.md)
