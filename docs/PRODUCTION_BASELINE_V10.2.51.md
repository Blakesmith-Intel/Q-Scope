# StormTracker V10.2.51 — official production recovery baseline

**Release:** V10.2.51 — 3 November 2026  
**Operator decision:** Freeze the completed six-scan radar feed as the official restore point.  
**Source-of-truth SHA:** `a641e0407287c826382bf5e47cf4dee59a97821a`  
**Restore branch:** `restore/v10.2.51`  
**Annotated tag:** `v10.2.51` (created by one-time verified release seal, never repointed)  
**Production site:** https://blakesmith-intel.github.io/StormTracker/  
**Verified Pages deployment:** https://github.com/Blakesmith-Intel/StormTracker/actions/runs/41641906435  
**Native BoM and AEP release gate:** https://github.com/Blakesmith-Intel/StormTracker/actions/runs/41639744038

## Frozen technical contract

- Rain playback uses **one standard 30-minute loop**, with **up to six** consecutive *genuine* five-minute BoM-published source observations; absent or refused scans are never invented, relabelled, interpolated or concealed.
- The UI excludes earlier 60/90/120/180-minute browser archives and disables optional warming of old frames. The normal five-minute polling, foreground update, real missed-frame recovery, and playing-loop no-shrink protections from V10.2.50 remain.
- The approved native high-resolution original BoM WMTS imagery remains at source quality; one refused tile does not discard unrelated authentic pixels. The Pages build does not attempt a direct API fetch predictably blocked by BoM CORS after a relay denial.
- Original published UTC observation ordering, primary plus up to three supplementary radar-site alignment, map/site/camera continuity, Doppler-only option, playback speeds, rainfall / AEP, 3-D volumetric analysis, storm tracks and cones are preserved.
- All previously accepted warning polygons and IDQ21033/IDQ21035 source isolation, flood gauges, road closures, power outage and QFD incident layers remain unchanged. Flood `river-recent-history` 503 errors are independent of this radar release.

## Release and rollback safety

The exact SHA above is the **proven application source**. The documented release workflow independently confirms the successful Pages run, the published page / source module signatures, and an existing same-commit restore branch before creating the new annotated tag. **Neither the tag nor the restore branch may ever be moved or overwritten.** Historical V10.2.46 and earlier tags/branches are also untouched.

For a new enhancement:

```bash
git fetch origin --tags
git switch -c feature/<new-scope> v10.2.51
```

For emergency recovery, create a **new reviewed rollback PR** from `v10.2.51` or `restore/v10.2.51`, then rerun full production verification and request visual operator acceptance. Do not force-reset main or rewrite frozen refs. The original external BoM, relay, AEP and agency source services are independent and not frozen by this source snapshot.

**Evidence limits:** CI and public-source verification prove the delivered code and assets. BoM can temporarily refuse tiles upstream; no software seal guarantees six available source frames every minute.
