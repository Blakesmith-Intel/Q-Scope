# StormTracker V10.2.46 — immutable production baseline

**Operator-reported hotfix:** 1 November 2026 (Queensland AEST).  
**Production:** https://blakesmith-intel.github.io/StormTracker/  
**Frozen annotated tag:** `v10.2.46`  
**Same-commit restore:** `restore/v10.2.46`  
**Default future development:** branch only from `v10.2.46` or same-commit `develop/from-v10.2.46`.

V10.2.46 is the narrow BoM active-warning missing-polygon catch-up correction built from immutable V10.2.45. It preserves all original official CAP and GIS2Web-derived warning geometry, time and identity rules; the 15-minute regular warning interval; and all accepted radar/3-D/map, flood, rainfall/AEP, cyclone, roads/outages, QFD and reporting behaviour. While an active warning has no source-verified geometry, it checks again on a bounded two-minute cycle (at most nine rechecks per issue); recovery returns immediately to normal polling. Never substitute district outlines or show false all-clear.

**Release verification:** [live-source and independent iPhone WebKit/desktop Chromium cross-platform QA](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/41283214838); public Pages production-source and frozen-reference validation must pass before the immutable tag and restore branch are created.

**Nonnegotiable seal:** `v10.2.46^{}` and `restore/v10.2.46` must resolve to the same exact successfully deployed release commit. Never move, force-update, repoint or delete either. Existing `v10.2.45` and `restore/v10.2.45` remain frozen at `3051662e4ad124dcdfee5c19e955b6172c70fef7`; every earlier tag and restore branch remains unaffected. All subsequent changes require scoped development from V10.2.46, full science and source regressions, operational WebKit/desktop browser testing, actual production-site verification, explicit operator acceptance, and new distinct immutable release refs.

A code freeze does not freeze upstream BoM, the independent Cloudflare relay or agency feeds. “Active but waiting for genuine polygon” is a warning-data availability issue, not “no warning”.

[Release notes](RELEASE_NOTES_V10.2.46.md) · [Current guide](OPERATOR_GUIDE_CURRENT.md) · [Quick reference](OPERATOR_QUICK_REFERENCE_V10.2.46.md) · [Development handover](DEVELOPMENT_HANDOVER_CURRENT.md) · [Restore instructions](BASELINE_RESTORE.md).
