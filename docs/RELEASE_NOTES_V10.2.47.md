# StormTracker V10.2.47 — BoM-style crisp warning polygons

**Requested and approved:** 2 November 2026 (AEST).
**Release state:** Candidate until the exact rebuilt public Pages site and mobile/desktop warnings are accepted. This note does not claim that an unverified deployment is live.
**Base:** Immutable V10.2.46 plus the separate approved current-warnings cancellation correction on `main`; all earlier tags and restore branches remain unchanged.

## 2 November 2026 15:51 AEST — operator visual rejection and correction

Operator screenshot of actual live display at 20 km scale showed a huge fuzzy yellow border despite the previous 3px/1024px tile checks passing. **Root cause: an outline baked into a Cesium imagery tile grows and blurs as the tile is resampled with camera zoom.** The QA only measured the source tile, not the final globe projection, so the earlier acceptance statement was invalid.

**Revised operator acceptance:** each original BoM polygon must be one complete **terrain-following object containing both its translucent fill and a crisp screen-fixed yellow boundary**. It must not use separately controlled fill and line layers.

**Implementation contract:** for each original source feature, construct ONE `Cesium.PrimitiveCollection` that owns both its `GroundPrimitive` fill and `GroundPolylinePrimitive` outline, using precisely the same unmodified exterior and hole coordinates. Cesium needs two GPU draws internally for a translucent terrain surface and pixel-fixed outline, but neither component has an independent operator lifecycle, feed, selector or geometry. On refresh, cancellation, hide and product selection, the ONE grouped source polygon is added/removed atomically. The fixed yellow border is 2 CSS pixels, 2.5px for source-authenticated ordinary cells and 3px for explicit VERY DANGEROUS source cells. The verified VD label is owned by that same grouped cell object; no standalone label or fabricated cell.

This replacement removes the live warning raster-stroke path rather than merely turning down its opacity. Existing imagery painter remains test-compatible but fills are no longer published as separate Cesium warning imagery. The terrain clamped polygon is always a single coherent fill/border object, with true holes and multisurface boundaries; radar/other source ingestion, polling and all science stay unchanged.

**Release gate:** original screenshot does not satisfy acceptance. A passing source tile test alone does NOT prove final rendered width: test the genuine Cesium ground primitive constructors and source geometry on mobile WebKit and desktop Chromium, then visually verify the live mobile map at the operator's original 20km view, with radar visible, before sealing an immutable production tag.

## Operator change

BoM warning polygons were source-correct but appeared as blurry orange “crayon” lines on the iPhone. The operator confirmed the three regional IDQ21033 and two detailed IDQ21035 polygons were loading correctly and approved **presentation-only** visual refinement.

- **IDQ21033 regional areas and IDQ21035 detailed warning/threat areas:** clean **golden-yellow `#F5C427`** boundaries, one fully opaque stroke, low-opacity yellow interior; keep high-end regional-warning *words* in the report rather than turning the whole warning area red.
- **Authentic IDQ65652 individual severe thunderstorm locations:** red `#DB2534` outline; distinguish these from the general yellow warning geography.
- **Explicit source-designated VERY DANGEROUS individual IDQ65652 cells only:** darker red `#BD112A` with the existing compact VD/VERY DANGEROUS callout. Neither broad-area warning text nor radar intensity can assign the cell designation.
- Use 1024-pixel instead of 512-pixel raster-source tiles for cleaner anti-aliased path boundaries when Cesium samples the warning imagery on mobile and desktop. Single stroke, no feathered halo, no glow, round joins and butt caps. The original WGS84 ring vertices and even-odd polygon fills, including holes and tiny genuine intersections, remain unmodified.
- Bump the mobile Safari and desktop module import/query cache identifiers so users get the new warning drawing code without replacing the existing camera, radar or sidebar behaviour.

## Explicitly unchanged

Original BoM CAP/GIS2Web relay and source metadata, IDQ filters and independent source identities, 15-minute healthy warning polling and bounded missing-source catch-up, cancellation/expiry checks, GIS coordinates, LDMG/DDMG intersections, radar/Doppler/inferred 3D, warning placement below radar, zoom/camera controls, rainfall/AEP, flood gauges/crossing symbols, cyclone panel, road closures, outages and QFD incident layers. No synthetic operational warning polygons and no alteration to historical immutable source refs.

The separate CAP dissemination-lag draft PR #289 remains outside this release.

## QA and deployment controls

- Renderer-level tests: `frontend/tests/run-bom-warning-crisp-golden-palette-v1-tests.mjs`; older high-end warning and iPhone Cesium promise/picking tests updated to preserve the newly approved visual contract without weakening original source authenticity.
- Independent Chromium and mobile WebKit source-tile **pixel** verification: `scripts/test-bom-crisp-warning-tiles-browser-20261102.mjs` using the production-equivalent compiled site in an isolated QA environment. Generated test polygons are **fixtures only**, never published as BoM data.
- Run full `npm test`, package build, browser QA, deploy and public-source checks. A finished GitHub action or simulator is not equivalent to physical iPhone operator acceptance.
- Only after exact public deployment verification and operator acceptance, create a **new** immutable `v10.2.47` annotated release tag and matching restore ref, preserving all historical releases.

**BoM colour-reference context:** https://www.bom.gov.au/resources/learn-and-explore/severe-weather-knowledge-centre/severe-weather-and-coastal-hazard-warning-services
