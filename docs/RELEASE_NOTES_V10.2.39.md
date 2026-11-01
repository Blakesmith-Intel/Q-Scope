# StormTracker V10.2.39 — multi-site history and automatic live-follow reliability

**1 November 2026.** Follow-up to screenshots showing Mt Stapylton with a six-frame 30-minute loop while other Queensland locations displayed one frame, and reports that new radar observations did not appear until manual page reload.

## Confirmed technical findings

BoM's national WMTS published seven genuine observation timestamps between 11:00 and 11:30 AEST; corner and centre tiles were HTTP 200 PNG across 11 Queensland radar regions. Separate full-mosaic QA retrieved every tile for six consecutive frames at Mt Stapylton, Gladstone, Gympie, Cairns, Mackay and Mount Isa.

The operational frontend contained several defects:
1. A failed BoM WMTS region/timestamp was quarantined globally by timestamp, potentially poisoning independently valid site regions.
2. Transient discovery/probe failures (including HTTP 502/503) were quarantined as though BoM withdrew the timestamp.
3. On automatic refresh, a viewer already at the latest frame retained the previous observation index, so even successful new data could remain invisible until manual reload.
4. A successful tile decode was treated as refreshed even when Cesium rejected the actual map-frame handover. A later poll could then see the updated in-memory timeline and skip retries despite still showing old pixels.
5. Background runSourceLoad caught errors and returned without signalling failure to the polling scheduler. Genuine source discovery failures also returned with a keepCurrent status but no retry.
6. iOS Safari foreground catch-up was dependent only on visibilitychange, although page restoration can produce pageshow/focus.

## Corrections

- Scope timestamp failure quarantine to region and original source UTC. Only explicit HTTP 400 gets a five-minute negative cache; transient source errors remain eligible for retry.
- Preserve legitimate six-frame BoM windows. No missing tile, substituted pixel, invented timestamp or fallback observation is accepted.
- When already viewing the latest frame and automatic refresh loads newer authentic frames, advance to newest. Respect an operator's intentionally scrubbed historical position.
- Keep existing five-minute active-window polling, two-second busy retry, and add bounded 60-second source-error retry, without resetting the normal cadence.
- Reconcile when Safari resumes via visibilitychange, pageshow or focus. iOS may suspend background JavaScript; no browser-only system can promise network polling while physically suspended.
- Leave BoM observation time, 3-D scientific algorithms, independent Doppler, flood, warning, rainfall, incident, and other UI layers intact.

## Release gates

Mandatory: full frontend regression and pinned build; actual mobile Chromium operator site-switching across multiple Queensland sites to six measured frames; 60-second retry regression; real source WMTS full-mosaic six-frame verification; published Pages JS/BUILD verification and new immutable tag and restore branch. Physical iOS Safari and sustained multi-cycle refresh still warrant field acceptance. Do not declare reliability proven merely from individual tiles.

Do not rewrite earlier frozen tags or deploy a failed gate.
