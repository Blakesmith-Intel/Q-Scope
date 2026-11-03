# StormTracker V10.2.49 — Refused genuine radar tile cache repair

Operator acceptance failure: Gympie reported 6 of 6 attempted loads but played only 4 genuine frames; Mt Stapylton played five. Loading progress was misread as acceptance, and an actual source read may fail even for an officially advertised time.

The existing Cloudflare relay used a five-minute cache TTL for upstream WMTS responses regardless of HTTP status and told browsers to cache those responses for five minutes. This could preserve a transient HTTP 403 denial long after the existing 30-second exact-tile and one-minute missing-frame recovery schedules tried again.

Correction: Cache only BoM HTTP 200–299 original PNG responses at the established five-minute TTL; never cache 300–599 responses in the worker or user browser. In the browser, after a particular genuine tile URL returns HTTP 403, its next bounded retry bypasses stale browser response caching. The existing single native BoM direct fallback, authentic UTC/tile coordinates, 15-second per-fetch budget, two-request pressure limit, verified PNG cache and ongoing source-recovery schedule are retained.

No change to source quality, sync across radar sites, 3D/volumetric logic, track chronology, warnings, flood gauges, rainfall/AEP, road closures or other approved features. Prior immutable release tags remain untouched.

Operator visual confirmation is still required after the public production release. A BoM observation truly refused by all authentic routes cannot be represented as a successfully retrieved image.
