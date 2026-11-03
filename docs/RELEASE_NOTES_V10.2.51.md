# V10.2.51 — Source-published BoM rain radar playback only

**Date:** 3 November 2026  
**Status:** Candidate until merged, publicly verified and operator visually accepted.

## Operator decision
All three selected sites showed six consecutive, genuine, high-resolution BoM observations after the V10.2.50 tile-recovery correction. The separate 60/90/120/180-minute browser archive is no longer required and could provoke old-tile errors after an idle session.

## Behaviour
- Present **one rain-radar duration: 30 minutes** (up to six real five-minute BoM source timestamps). The separate **Doppler — All available** mode is unchanged.
- Do not start optional background historical archive warming in standard rain mode. Retain the existing accepted current-frame cache and recovery.
- On GitHub Pages, do not issue a direct `api.bom.gov.au` request that is predictably blocked by CORS after a relay 403. Preserve the exact-source URL and cooldown/recovery through the existing approved relay.
- Never fabricate, interpolate, relabel or substitute a missing radar observation as a genuine measured source scan.
- Keep native BoM PNG fidelity, primary plus up to three supplementary sites, timestamp alignment, 3-D processing, operator camera, live five-minute checks and 1×/2×/3× playback.
- The console's `river-recent-history` HTTP 503s are a **separate flood-history service issue**; this release does not modify flood gauge behaviour, warning polygons, AEP or other situational-awareness layers.

## Evidence and release constraints
PR #296 updates the shipped Pages cache identity so browser sessions use the new code, adds production-equivalent checks, and retains the historical immutable release tags. No previous release is rewritten. A successful CI check alone does not establish genuine live six-of-six operator acceptance. Record the public release SHA and request actual operator visual confirmation before creating another immutable accepted baseline.
