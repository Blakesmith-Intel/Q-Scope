# StormTracker V10.2.47 — operator-approved source freeze

**Operator acceptance:** 2 November 2026 (AEST). Operator confirmed the unified, terrain-following BoM warning polygons and instructed: “Now freeze it like Han Solo”.

## Exact frozen code state (no floating branches)

- Repository: `Blakesmith-Intel/StormTracker`
- Accepted source SHA: `bda792ff8747c30082b6b978c953187006f4a19e`
- Tree SHA: `a9d09089803424288ae023781b21e42e3a2e101c`
- New release tag: `v10.2.47` (must peel to exact accepted source SHA; never force, move or overwrite)
- Exact recovery ref: `restore/v10.2.47` (already created and verified at the accepted SHA)
- Additional frozen snapshot: `release/v10.2.47-operator-approved-freeze-20261102` (already created and verified at the accepted SHA)
- Original source: operator-approved PR #291, merged into `main`.

## Accepted source features

The original source-verified BoM IDQ21033 regional and IDQ21035 detailed warning polygons are displayed as coherent **single, terrain-following objects**: an authentic translucent fill and a precisely coincident **2-CSS-pixel**, screen-fixed golden-yellow ground outline with no oversized scaled-raster border. The same source polygon rings and holes power fill and outline. Genuine individual cells use red, and only a specifically source-designated VERY DANGEROUS cell uses the deeper red + same-owned label. Filtering, map camera, map picking and refresh/expiry/removal share the approved object lifecycle.

**Do not touch** radar/Doppler/3D, rainfall/AEP, flood gauges, official warnings ingest, QFD incidents, cyclone layers, outage/road layers, underlying warning source geometry, existing polling/negative reporting and existing radar/map controls. All historic frozen releases and tags must remain unchanged. Further enhancements should fork from this exact accepted SHA, not from a floating unknown `main`.

## Evidence of tested candidate

- [PR #291](https://github.com/Blakesmith-Intel/StormTracker/pull/291) merged as the accepted commit above.
- [Exact candidate WebKit + Chromium real-terrain-globe tests](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/41398215504) both passed.
- At approximately 20 km and farther zoom: iPhone-sized mobile WebKit produced 4 physical pixels on a 2× Retina viewport (equivalent to 2 CSS pixels), while desktop Chromium produced 2 physical pixels at both zooms.
- Original source ring vertices and interior holes unchanged. Source test fixtures were QA-only.
- Source regression, frontend review, cyclone package dry-run and Richmond QA succeeded on the accepted candidate commit.

## Important independent deployment status

The Pages push deployment for accepted `bda792f` failed during the *Build pinned V10.2.0 plus QA-approved FTP/AEP production overlay* step before the Pages upload/deploy steps (GitHub Actions run `41398575519`). **The code freeze and tag protect the source; they do NOT prove that the public GitHub Pages URL is serving this new code.** A separate successful Pages deployment and exact-public-root verification are required before calling this a verified *deployed* V10.2.47 production build.

The approved source must not be silently replaced with a different build to solve a deployment problem. Correct/validate the publishing pipeline separately without modifying this frozen source, then record successful public-source verification against the exact accepted build.

## Immutability contract

- Create the annotated tag only on the exact SHA above, check for an existing tag and **fail closed** if it points anywhere else.
- Never force push, rebase or update any `restore/`, `release/` or `v10.2.*` historical refs.
- This operations-only manifest and seal workflow live on an `ops/` branch so frozen source, its immutable tag and both recovery branches remain byte-for-byte unchanged.
