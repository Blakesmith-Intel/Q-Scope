# StormTracker V10.2.45 — verified incremental radar and six-frame recovery

**Operator approval:** 1 November 2026 (Queensland AEST), following browser testing of the isolated radar QA preview.
**Production:** https://blakesmith-intel.github.io/StormTracker/
**Source under acceptance:** radar candidate a48ed0c37a7ba192e59b5a3bc2afae69ea5378b4; comprehensive final cross-platform CI head 75fc763c00e6bcd4624fd35d916601653fc684f0; approved PR #285 merged into main at 07d39ae52ce5fa317b0f0045d39926e3a7f30bd8.
**Seal:** newly annotated `v10.2.45` and matching `restore/v10.2.45` **only after successful public production deployment and published-root verification**.

## Operator-approved scope

The shared browser radar engine now inserts newly authenticated BoM high-resolution WMTS reflectivity observations into the running playback window without resetting its playback timer, selected radar or Cesium map camera. The oldest frame retires at the correct boundary. A frame that was genuinely published but omitted because of a temporary source/tile error is recovered on a subsequent check even if the newest timestamp has not changed. Historical insertions are recomputed chronologically so track identity and time ordering stay honest. No synthetic observation, geographic substitution, fabricated timestamp, or false 6/6 count is permitted.

The source path uses a globally enforced two-request concurrent BoM WMTS tile guard on both the public root and any review subpath, a bounded single retry for transient preflight/complete-mosaic failures, exact source UTC and tile coordinates, bounded metadata retry for recoverable network/abort failures, and the existing conservative source 400/403/429 handling. Failure diagnostics retain original source time/tile and distinguish a healthy empty source from real failures. Five-minute foreground polling, foreground-reentry catch-up and existing retry cadence remain.

The QA and production routes now enable the same bounded radar recovery and graphics/memory controls. An actual iPhone screenshot of a persistent five-frame loop and a visible "BoM WMTS source time preflight failed" was the reason for this correction; earlier green root-only checks did **not** adequately represent the public preview. QA-regression coverage now checks the exact published preview path.

## Evidence and acceptance

- Verified source-true complete six-frame tile mosaics for Gympie, Gladstone and Mt Stapylton, plus bounded readable imagery checks at all 22 registered QLD/NSW radar sites.
- Seven-site mobile WebKit automatic radar refresh without unwanted navigation, canvas replacement, playback stop, source-pressure overflow or WebGL loss.
- Both mobile WebKit and desktop Chromium proved real, newly available BoM imagery could be appended to the active six-frame loop without rebuilding the entire playback.
- Both engines independently reproduced a five-frame playback caused by withholding one **already-published interior source timestamp** and verified automatic recovery to six frames with the identical authentic BoM capability snapshot and live image tiles, without a newer scan or application navigation.
- GitHub Actions review run [41278998110](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/41278998110) **passed** in all source, mobile and desktop jobs.
- The operator expressly approved promotion after viewing the corrected public QA candidate.

These proofs do not guarantee that the external BoM service can supply six complete scans on every future request; where it cannot, show only the genuinely verified frames and a truthful failure state. Never turn source downtime into a "no rain" inference.

## Frozen operational compatibility

Do not alter the already approved Doppler science, inferred 3-D, primary and supplementary radar selection, radar opacity, loops/speeds, map viewport, terrain, warning products/polygons, cyclone status, rainfall/AEP, flood gauges, roads, outages, QFD markers or reports. The independent Cloudflare relay, BoM and other live agency infrastructure remain external and are **not frozen by a Git tag**.

The accepted V10.2.42 tag and restore branch and all prior history remain at their original commits. Future enhancements **must start from `v10.2.45`** in a new feature branch, pass tests and explicit operator approval, and use a new distinct tag. No one may repoint any older seal.

For operator controls, see [the current guide](OPERATOR_GUIDE_CURRENT.md). For full release recovery rules, see [the new baseline](PRODUCTION_BASELINE_V10.2.45.md) and [restore guide](BASELINE_RESTORE.md).
