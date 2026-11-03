# V10.2.51 — Source-published BoM rain radar playback only

**Date:** 3 November 2026  
**Status:** Operator-approved official immutable restore point. Deployed source commit `a641e0407287c826382bf5e47cf4dee59a97821a`; official annotated tag `v10.2.51` and same-SHA `restore/v10.2.51` are verified by the one-time production seal workflow.

## Operator decision
All three selected sites showed six consecutive, genuine, high-resolution BoM observations after the V10.2.50 tile-recovery correction. The separate 60/90/120/180-minute browser archive is no longer required and could provoke old-tile errors after an idle session.

## Behaviour
- Present **one rain-radar duration: 30 minutes** (up to six real five-minute BoM source timestamps). The separate **Doppler — All available** mode is unchanged.
- Do not start optional background historical archive warming in standard rain mode. Retain the existing accepted current-frame cache and recovery.
- On GitHub Pages, do not issue a direct `api.bom.gov.au` request that is predictably blocked by CORS after a relay 403. Preserve the exact-source URL and cooldown/recovery through the existing approved relay.
- Never fabricate, interpolate, relabel or substitute a missing radar observation as a genuine measured source scan.
- Keep native BoM PNG fidelity, primary plus up to three supplementary sites, timestamp alignment, 3-D processing, operator camera, live five-minute checks and 1×/2×/3× playback.
- The console's `river-recent-history` HTTP 503s are a **separate flood-history service issue**; this release does not modify flood gauge behaviour, warning polygons, AEP or other situational-awareness layers.

## Production acceptance and immutable restore
PR #296 established the source-only six-scan build; the CI-only PR #297 fixed stale historical comparisons without modifying radar. The exact production commit passed the public Pages source verification in [run 41641906435](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/41641906435), and the native BoM / AEP gate passed in [run 41639744038](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/41639744038). The operator then explicitly approved freezing the production radar feed on 3 November 2026.

**Never move `v10.2.51` or `restore/v10.2.51`.** Both identify the exact accepted source commit above. Future enhancements and any rollback must be new, reviewed, deployed and verified separately; previous immutable tags remain untouched. This freezes software, not source availability at BoM or other external agency services. See [official restore baseline](PRODUCTION_BASELINE_V10.2.51.md) and [restore procedures](BASELINE_RESTORE.md).
