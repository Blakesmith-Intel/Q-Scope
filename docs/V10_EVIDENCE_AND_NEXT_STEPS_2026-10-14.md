# V10 quantitative Doppler — verified evidence, blockers, work queue
**Evidence cutoff:** 14 October 2026 (AEST). All detection remains experimental and fail-closed.

## Desired classifications and safety case

- **Yellow**: possible damaging straight-line wind, initial **90 km/h** BoM damaging-wind screening reference, only on verified quantitative radar velocity. Radial aloft wind **does not equal** a surface gust, and any velocity exceedance requires source-specific limitations and cross-checks.
- **Orange**: possible reflectivity hook-echo **candidate** with time/pixel/source geometry coherence, not proof of rotation or a tornado.
- **Red tornado symbol**: possible tornadic circulation candidate only with defensible time-aligned inbound/outbound radial velocity couplets; never an official warning or confirmed tornado.
- **Destructive** wind and other thresholds must undergo independent verification of definition, unit scale, radar sampling limits and aloft/surface interpretation before use.
- Suppress assertions for unverified/uncalibrated radar velocity, NSW unsupported sources, invalid age, unknown sign/aliasing, missing geometry or synthetic samples. Do **not** interpret absence of a candidate as absence of a hazard.

## Measurement limitation in the live feed

`frontend/src/bom-doppler-decoder-v1.js` currently decodes a **19-colour-swatch native web image, approximately -70 to +70 km/h**. It cannot be extrapolated into reliable 90 km/h or 125 km/h quantitative observations. The V10 research validators are deliberately isolated: their unit tests show logic boundaries, not real-time scientific accuracy. Do not wire an alert from the current colour product.

## Historical evidence ledger

| Event | Archive radar/source | Verified | Not yet verified |
|---|---|---|---|
| Gympie/Cooloola — 24 Nov 2025 | Mt Kanigan **08**, NCI AURA Level 1 ODIM HDF5 | GitHub Action **38424386554** succeeded; a genuine daily archive **1,185,706,872 bytes**, **288** member volumes, **three** decoded: `8_20251124_035500.pvol.h5`, `8_20251124_040000.pvol.h5`, `8_20251124_040500.pvol.h5`; VRADH/VRADDH fields and raw ranges recorded; artifact **11828616632** | Metadata units and Nyquist; elevation/azimuth/range georeferencing; velocity polarity and dealiasing; verified circulation, damaging wind or hook detection |
| Gold Coast/Scenic Rim — 25 Dec 2023 | Mt Stapylton **66** | NCI archive filename confirmed; GitHub Action **38427917719** attempted genuine archive; failure artifact retained | ZIP exceeds current 2 GB cap; **zero** decoded actual sweeps; candidate skill unknown |
| Gold Coast/Scenic Rim — 25 Dec 2023 | Marburg **50** | NCI archive filename confirmed in same workflow; failure artifact retained | ZIP exceeds current 2 GB cap; **zero** decoded sweeps; candidate skill unknown |

**Event corroboration does not validate a radar classifier.** Existing Christmas 2023 JavaScript scenario frames/velocities are explicitly **simulated**. Prior Gympie ST0027 hook observations and unit-test pass records are not a substitute for decoded AURA spatial velocity measurement.

### Audit traces
- [Gympie AURA success run](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/38424386554)
- [Gold Coast two-radar over-limit audit run](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/38427917719)
- [Research branch at latest docs commit](https://github.com/Blakesmith-Intel/StormTracker/commit/f39fad7d2726ee8d6c66771fbfdc6bd84b25f828)
- [Detailed existing research notes](https://github.com/Blakesmith-Intel/StormTracker/blob/feature/v10-severe-weather-candidates/docs/V10_AURA_HISTORICAL_VALIDATION.md)

### Execution details

The research workflow currently tests `goldcoast-2023` and `marburg-2023` in a CI push matrix; the Python tool downloads a daily `.pvol.zip` into temporary disk, caps the stream at 2,000,000,000 bytes, then uses `zipfile`/h5py to inspect up to three selected volumes. It records each ODIM velocity quantity, gain, offset, missing sentinels, raw physical ranges and SHA-256. **The script does not yet georeference or de-alias; it does not emit observed tornado/wind detections.** The successful GitHub Node workflow checks are regression results, not AURA accuracy results.

## Work queue — complete in order

### P0-A: efficient authentic archive access
- [ ] Use HEAD/metadata for ZIP size, response headers and accepted range support. Do not assume Accept-Ranges without testing actual HTTP 206, Content-Range and byte integrity.
- [ ] Prefer NCI per-volume direct access if officially exposed; otherwise read ZIP end-of-central-directory and member directory with bounded HTTP byte ranges. Correctly handle Zip64, compression, CRC, partial response, server 200 fallback, malformed archive and retry budget.
- [ ] Select three or more **consecutive** on-event actual HDF5 scans around the requested UTC for 66 and 50 without downloading their entire multigigabyte archives.
- [ ] Record reproducible archive URLs/catalogue dates, SHA-256 of each volume, exact observed UTC and scanner software version; preserve small machine-readable evidence artifacts. Confirm licences and permitted retention.

### P0-B: scientifically valid velocity reconstruction
- [ ] Decode ODIM quantity, gain/offset, nodata/undetect, **physical units**, sweep elevation, azimuth starts/spacing, gate range, geodetic radar position, quality flags and Nyquist metadata per sweep.
- [ ] Verify physical **positive/negative radial-velocity convention** and aliasing/dealiasing against documented station/product behavior; treat unresolved or folded velocities as invalid for high-wind assertions.
- [ ] Reproject with range/elevation/azimuth geometry; align reflectivity and radial velocity from the same genuine scan and maintain source UTC. Preserve masks; never invent valid gates.
- [ ] Repeat for Gympie's three real scans and southern event sweeps; inspect physically coherent adjacent scan sequences before candidate extraction.

### P0-C: candidate scoring and repeatability
- [ ] Run tests with preserved deterministic fixtures from the observed scans; compare detected locations/times with independently supported storm windows and reported impacts. Include known-negative scans.
- [ ] Measure false positives, missed candidates, continuity, spatial registration error and limits from sample quality. Separate **potential low-level rotation** from **confirmed tornado**, and radial speeds from surface gusts.
- [ ] Version classifier thresholds and evidence artifacts, enabling reproducible reruns without re-downloading huge files.

### P1: isolated research browser preview (not production)
- [ ] Use verified, licensed, bounded browser fixtures to render candidate iconography with timestamp, source and experimental badge/legend.
- [ ] Add suppression/de-duplication, age-out logic, clear-unavailable behavior, sensitivity limits and mobile performance budgets.
- [ ] Test native reflectivity/Doppler clocks, label layering, severe-weather icon overlap, zoom/rotation/fast playback and WebGL lifecycle.
- [ ] Test only on a new preview; obtain explicit visual acceptance before any production discussion.

## Resume point

**Do now:** selective archive-member retrieval for radios 66/50 and polar metadata/aliasing verification for Gympie 08. **Do not do yet:** 90 km/h or tornado alerts in the public V9.18 viewer; merge of historic branch workflow clutter; claiming a historical detection rate from the simulated Christmas fixture.
