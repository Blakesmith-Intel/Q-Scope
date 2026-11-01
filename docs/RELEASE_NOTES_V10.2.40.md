# StormTracker V10.2.40 — National BoM WMTS Safari/source reliability

1 November 2026. Corrects multi-radar load failures shown in the operator's iPhone screenshots at 12:12–12:14 AEST on 1 November (Bowen, Richmond, Greenvale, Mt Isa, Mornington Island; Townsville loop stalled at 11:30 AEST).

## Source versus browser evidence
At 12:18 AEST official BoM WMTS GetCapabilities advertised nine source UTC observations from 01:30 through 02:10 (11:30–12:10 AEST). Authentic 200 PNG tiles were verified for all nine times at both first and central tiles at Brisbane Mt Stapylton, Townsville, Bowen, Richmond, Greenvale, Mt Isa, Mornington Island and Gladstone. Source publication and app operator playback differed; do not describe the failure as missing BoM imagery.

## Targeted repairs
- Retry any genuinely advertised recent source timestamp if the three newest advertised scans have not-yet-readable tiles. Never probe invented time offsets; retain 45-minute source freshness requirement. Select newest source tile that actually verifies.
- Shorten a transient HTTP 400 negative tile/time cache from five minutes to 45 seconds; keep region-local timestamp rejection. After cache expiry newly published tiles can be retried without reloading Safari.
- Bound mobile WMTS requests to two concurrent tiles. One isolated 403 or 502/503/504 does not block every radar; three timely 403 refusals or an explicit HTTP 429 still apply a finite source-pressure cooldown. One concurrent WebKit run observed an actual isolated 403 from the relay's upstream response, motivating this safeguard.
- Reuse up to 96 exact-time source-verified compressed BoM PNG blobs across neighbouring regions; images are decoded from verified bytes on reuse. This avoids large repeated tile downloads with a modest compressed-memory cap.
- Prevent late completion of a previous radar's background cache warming from writing into another primary radar's timestamp cache.
- On manual radar-site load error, visibly retain the error and schedule in-tab recovery after 50 seconds (45-second source-negative cooldown has expired). Keep five-minute automatic polling, two-second busy rechecks and one-minute source-error retry, with foreground reconciliation.

## Quality gates
- Unit: genuine fallback after four newer source 400s; 45-second and region-local negative caching; 503 isolation; prior 400/403/cancelled source safeguards; no fabricated observations.
- Build: verify actual pinned Pages runtime contains WMTS changes, copied radar-source/pressure guard and Safari cache-busting module identity.
- Browser: live published six-frame mosaics across reported failing regions in mobile-size Chromium operational UI and mobile WebKit source decoder. Physical iPhone Safari and observed multi-cycle field monitoring still require operator acceptance. Never claim those have been run when only GitHub-hosted browsers have been used.
- No changes to approved 3-D science, per-gauge flood data, AEP, severe warnings, incidents, geography, radar opacity or five-minute poll interval.

Rollback to v10.2.39 using its untouched immutable tag/restore branch if regression detected. V10.2.28 warning release remains correctly frozen and is not re-sealed.
