# StormTracker — one-page operator quick reference (V10.2.45)

**Operator-accepted production baseline: 1 November 2026.** [Open StormTracker](https://blakesmith-intel.github.io/StormTracker/) · [Print-friendly PDF](STORMTRACKER_LAYERS_INFORMATION.pdf) · [Full guide](OPERATOR_GUIDE_CURRENT.md)

| Menu | Use it for | Source / safety |
| --- | --- | --- |
| **Radar & Storm Analysis** | Primary plus up to 3 additional radars; true reflectivity dBZ; measured Doppler velocity; timeline, storm motion, 3-D inference, distance and map tools. | Six real five-minute rain scans when all are readable. Inferred 3-D/storm motion is not measured 3-D or an official warning. |
| **Severe Weather** | BoM severe thunderstorm/weather polygons, reports, verified cyclone forecasts and flood gauge/crossing markers. | A forecast track does not establish a cyclone warning. Verified empty warning feed means **No current warnings**. |
| **Rainfall Observations** | BoM totals since 9 am / 24 hours to 9 am, locations ≥50 mm, on-map rarity and Rainfall totals/AEP Notable+ reports. | AEP is location-and-duration-specific; don't treat unrated stations as low risk. |
| **Community Impacts** | Queensland unplanned road closures, Energex/Ergon power outages and QFD rescue/assistance incidents. | Check the original source agency for decisions; map counts are situational-awareness information. |

**Radar refresh:** Five-minute automatic active-tab polling, foreground recovery and source-error retry. Six genuine source-readable scans give six playback frames; an earlier source scan omitted by a transient tile failure is recovered even if no newer scan arrives. New frames append without stopping playback or moving your map. A frame count below six or blank map is **not** evidence of no rain; check source status and actual UTC.

**Map control:** Newly published frames **never** re-centre the map. The selected radar, centre, zoom, bearing and tilt remain in your tab, including a same-tab reload. A brand-new tab starts at Mt Stapylton. Radar selection, manual drag, Reset, Fit and explicit Focus move the camera when you choose them.

**When a layer looks wrong:** Check the station/radar name, observed AEST time, data-source status and selected period. Do not interpret **unavailable/unverified** as a healthy zero; consult official BoM/agency notices.

**Permanent operator rule:** No invented radar timestamps, source imagery, relocated gauges, speculative warnings or changing flood/rainfall severities to make the map look complete.

*StormTracker supports situational awareness; it is not an official warning, dispatch or emergency decision-making service.*
