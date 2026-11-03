# V10.2.50 — Genuine radar frame retention and 403 mosaic completion

**Operator evidence:** November 3, 2026 desktop image of StormTracker with Gympie primary and Gladstone supplemental, source-incomplete five-frame playback, later dropping to four on refresh. Earlier six-step loading progress is not proof six original PNG mosaics were successfully assembled.

## Scope of source fix
- An HTTP 403 on one authentic BoM WMTS PNG tile is isolated to that tile; other original tiles from the same observed UTC are still retrieved and retained in the existing bounded verified-PNG cache.
- A 400 for unpublished source or 429 rate limit still stops the bounded mosaic; there is no synthetic or substituted image. The refused 403 tile itself is not retried within the same mosaic attempt.
- On the next scheduler-managed recovery, already verified PNG neighbours are reused; only the source-refused original tile is requested again.
- The existing accepted genuine on-screen observations are included in the automatic history window even if the asynchronous IndexedDB read returns fewer older observations.
- An automatic partial retrieval cannot overwrite a longer currently playing genuine loop with fewer frames. Playback, 3D map, camera and supplementary site alignment are preserved pending genuine-source recovery.
- New Pages cache identity and public code checks ensure the actual root serves this runtime. The original full-fidelity native BoM WMTS product, cadence, six-frame objective and every sealed warning, flood, rainfall, community impact and map control remain untouched.

## Acceptance
Frontend regression, source contract, native PNG cache recovery and production-equivalent build have passed. Live public site and operator visual six-of-six acceptance remain separate checks; do not claim an immutable accepted seal until confirmed. If BoM itself continues to deny a genuinely unavailable tile, StormTracker cannot generate an authentic sixth scan.
