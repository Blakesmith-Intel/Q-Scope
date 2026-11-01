# StormTracker V10.2.46 — source-verified active BoM warning polygon recovery

**Release:** Sunday 1 November 2026 (Queensland AEST).  
**Public:** https://blakesmith-intel.github.io/StormTracker/  
**Immutable release:** annotated `v10.2.46` and matching `restore/v10.2.46`, only after actual production-site verification.

## Operator-reported incident

At 16:44–16:45 AEST, IDQ21033 regional and IDQ21035 detailed SEQ warnings were officially active but displayed “active; awaiting updated BoM polygon” without mapped warning boundaries. At 16:50 AEST the original government GIS2Web-derived sources and current production relay returned two genuine IDQ65654 regional warning polygons and six original IDQ65650 detailed warning polygons. Original CAP and GIS issue times agreed within four seconds.

The original warning frontend recognised the current hazard but waited the normal 15-minute polling interval even while warning polygons were missing. The gap during genuine source publication delay required manual Refresh, creating a situational-awareness hazard. No V10.2.45 radar code changed the warning source or geometry code.

## Correction

The healthy warning-feed polling interval remains **15 minutes**, unchanged. When an official warning is active but its original verified GIS warning polygons are unavailable, the map automatically rechecks the authoritative feed **every two minutes for at most nine checks per warning issue**. A temporary transport failure receives at most two early rechecks. Once verified geometry arrives, normal 15-minute polling resumes. The polygon is never guessed, geocoded from prose, retained after source expiry, or presented as an invented storm-cell track. Source-unavailable status is never a healthy “No current warnings” result.

**No changes** to the relay or official geometry parser, original BoM polygons, mapping/priority/symbology, separate IDQ product filters, LDMG/DDMG reports, radar/Doppler/3-D, rainfall/AEP, flood, cyclone, road/outage/QFD, map state or their approved refresh intervals.

## Evidence and freeze

- Real Queensland BoM warning listing, source-exact GIS and live relay audit all confirmed the 2 + 6 published original polygons.
- The actual pinned production-package, full StormTracker frontend/radar/cyclone/source regressions passed.
- Mobile WebKit and desktop Chromium independently reproduced active warnings without polygons and automatically recovered the **original 2 regional and 6 detailed source polygons** without manually refreshing, replacing the Cesium canvas or restarting the map. Product filtering stayed independent.
- [Cross-platform browser acceptance suite](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/41283214838).
- Upstream polygon publication can still be delayed or interrupted. The correction reduces the frontend recovery delay; it cannot invent missing source geometry or guarantee network availability.

All prior annotated tags and restore branches, especially V10.2.45 at `3051662e4ad124dcdfee5c19e955b6172c70fef7`, remain untouched. Future enhancements start from the new `v10.2.46` seal, after verified public production release.

[Operator guide](OPERATOR_GUIDE_CURRENT.md) · [Current frozen baseline](PRODUCTION_BASELINE_V10.2.46.md) · [Restore instructions](BASELINE_RESTORE.md).
