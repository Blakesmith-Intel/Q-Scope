# StormTracker browser relay

This Cloudflare Worker is a deliberately narrow transport relay for StormTracker.

It:
- accepts only GET/HEAD/OPTIONS;
- accepts browser requests only from `https://blakesmith-intel.github.io`;
- relays the BOM reflectivity WMTS endpoint used by StormTracker;
- relays the existing BOM Doppler endpoints used by StormTracker;
- exposes `/flood-road-closures` for Queensland road closures;
- fetches QLDTraffic server-side and returns only events that are simultaneously:
  - `Published`;
  - explicitly flood-related in structured TMR fields; and
  - `impact_type = Closures`;
- rejects restrictions, rain-only events, crashes, roadworks, special events and free-text flood keyword matches;
- adds CORS headers so the browser application can consume the approved data.

## QLDTraffic road-closure source

V9.10.0 reads the public TMR GeoJSON feed at `https://data.qldtraffic.qld.gov.au/events_v2.geojson`.

No QLDTraffic API key is required. The relay applies the shared StormTracker fail-closed classifier and returns only current, published, explicitly flood-related road closures. A five-minute fresh cache and two-hour last-known-good fallback protect the operational layer from temporary upstream failures.

The Worker does **not** perform storm segmentation, tracking, modelling, inference or 3-D processing. All weather science remains in the StormTracker browser application.

## One production Doppler transport

All approved Queensland BoM Doppler sites and Brewarrina NSW `IDR93I` use the existing Worker `stormtracker-bom-relay` through `/radar`, `/radar-history` and `/radar-frame`. The product allowlist stays strict and UTC comes from the genuine BoM source. Moree and Grafton are rain-only. **No separate NSW preview Worker is required.** The sealed V10 production UI remains independently source-pinned.

## Official Queensland wind observations (26 November 2026)

`/qld-wind-observations` continues to serve `QScopeBoMWindObservationsV1` from the single official BoM IDQ60920 XML product. `todayMaximumGustKmh` is the source-published maximum since midnight AEST; the additive nullable `todayMaximumGustUtc` is parsed from that maximum element's own timestamp and normalized to UTC, separately from `observedUtc` (latest observation). Missing peak timestamps are null; no station-history requests, synthetic peaks, new endpoints or cache policy changes. The existing production relay workflow includes changes to the shared wind parser in its push path filter.
