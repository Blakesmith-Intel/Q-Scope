# StormTracker — V10.2.42 immutable recovery baseline (1 November 2026)

**Latest operator-approved stable production:** V10.2.42, documenting and freezing the field-confirmed V10.2.41 app without any weather functionality change. [Production baseline contract](PRODUCTION_BASELINE_V10.2.42.md) · [Release notes](RELEASE_NOTES_V10.2.42.md) · [Operator guide](OPERATOR_GUIDE_CURRENT.md).

## Authoritative restore references

- The **annotated** tag `v10.2.42` must peel to the **exact same commit** as branch `restore/v10.2.42`. Verify both independently after publication; neither reference is ever repointed.
- To inspect: `git fetch origin --tags` then `git rev-parse 'v10.2.42^{}'` and `git rev-parse origin/restore/v10.2.42`; the SHAs must match. For a new feature, `git switch -c feature/<scope> v10.2.42` after replacing `<scope>` with a descriptive name.
- An **operational rollback** is performed by creating a **new** reviewed commit/PR from the frozen restore source and redeploying it, with public build/source checks and operator confirmation. Never reset `main`, force-push immutable branches or move old annotated tags.
- Preserve immutable V10.2.41 and V10.2.40 source refs and all preceding versions. The accepted site includes genuine source-verified WMTS, active-tab five-minute polling, multi-site error isolation, and camera continuity. Do not substitute older radar/Doppler science or overwrite rainfall/flood/warning controls during recovery.
- GitHub Pages is a browser **static app**. It does not freeze or roll back the separately operated `stormtracker-bom-relay` Cloudflare Worker, BoM feeds, IFD service, road/outage/river agency services or external internet. Verify all independently if restoring.
- Only a verified healthy warning source with zero active results can show **No current warnings**. Unreadable/stale observations must remain unavailable; never manufacture original radar scans or map geometry.

**Release and operator test evidence:** [V10.2.40 WMTS recovery](RELEASE_NOTES_V10.2.40.md), [V10.2.41 Longreach camera continuity](RELEASE_NOTES_V10.2.41.md), [V10.2.42 freeze](RELEASE_NOTES_V10.2.42.md); physical iPhone operator acceptance was explicitly recorded on 1 November 2026.

---

## Earlier recovery records (preserved as historical provenance)

# StormTracker — current V10.2.26 recovery and rollback reference

> **Current accepted operator release:** V10.2.26 is a **documentation-only freeze** of the fully deployed and tested V10.2.25 warning feature. Its pages bundle retains immutable original V10.2.0 radar and storm-science source. [Final release notes](RELEASE_NOTES_V10.2.26.md) · [V10.2.25 functionality](RELEASE_NOTES_V10.2.25.md) · [operator guide](OPERATOR_GUIDE_CURRENT.md). Preserve all previous tags: especially `v10.2.25` / `restore/v10.2.25` at `d9620f6cbc411bfee029d9fa9d170752aa7c34f2`. Create `v10.2.26` and `restore/v10.2.26` at the exact **new documentation commit** only after website verification. Never retag a previously accepted SHA.

## Operator-ready recovery approach

1. The normal production URL is https://blakesmith-intel.github.io/StormTracker/. The direct current [user guide](OPERATOR_GUIDE_CURRENT.md) and [handover](DEVELOPMENT_HANDOVER_CURRENT.md) document the layer toggles, no-warning/unavailable distinction and all operational constraints.
2. When rolling back to a previous accepted state, **make a new reviewed rollback/release commit from an immutable `restore/*` source**; do not force-push `main`, repoint existing tags or casually replace the V10.2.0 radar foundation.
3. V10.2.25 introduced the only new operator-visible warning feature: BoM severe thunderstorm/severe weather polygons; `IDQ21035` detailed SEQ / `IDQ21033` regional QLD filters; LGA-backed LDMG and official district intersections of any size; source-true polygon fill below radar; official click-through; 15-minute/manual refresh; removal/replacement on source-corroborated cancellation/update. The warning layer is **off by default**, so switching it off restores the prior operator view without a rollback.
4. The Cloudflare Worker `stormtracker-bom-relay` is **separate** from GitHub Pages and is not rolled back by a Pages tag. Verify the same external Worker after any rollback; preserve other routes for radar/IFD/river/crossings and any required CORS.
5. A previous clean source scan with no genuine active warning polygon can return zero; a failed, partial, or ambiguous source scan must be reported **unavailable**, not a genuine BoM all-clear. Never inject synthetic warning areas. Live active-warning polygon capture remains the one honest limitation after these releases.

---

## Historic original V10.2.0 recovery record (preserved)

> **Most recent accepted composite restore point (27 October 2026):** See [V10.2.24 release notes](RELEASE_NOTES_V10.2.24.md) and the [live-linked operator guide](OPERATOR_GUIDE_CURRENT.md). After live Pages verification, the new annotated tag `v10.2.24` and branch `restore/v10.2.24` must both resolve to the exact current composite release commit (retaining the immutable V10.2.0 radar foundation). This captures the official QLDTraffic state/local road-type report and the accepted 27 October info-panel/flood-gauge changes. Older versioned refs are preserved; the Cloudflare Worker and upstream BoM/QLDTraffic feeds are separate services, not made immutable by a Pages tag.


**Verified sealed release source:** `047b3bd1c66b0ed5f070d2298202f46d0cd8dae2` (17 October 2026), immutable annotated `v10.2.0` and `restore/v10.2.0` verified after deployment.

**Previous sealed V10.1.1 source:** `711d65a72a483b319e80711a09cfeabe2f69bbcd` — preserved as the immediate fallback.

- Public app: https://blakesmith-intel.github.io/StormTracker/
- Public source check: https://blakesmith-intel.github.io/StormTracker/BUILD.txt
- Exact marker: `SEALED StormTracker V10.2.0 source 047b3bd1c66b0ed5f070d2298202f46d0cd8dae2`
- Immutable annotated tag: `v10.2.0`
- Immediate recovery branch: `restore/v10.2.0`

The Pages workflow checks out and tests the **exact source** into `checked/production-v10.2.0`, builds a deterministic root, verifies the public BUILD marker and source assets, and **only then** creates the tag and restore branch. Never repoint sealed tags/branches.

## Older retained recovery references

| Tag and restore branch | Exact source commit |
|---|---|
| `v10.1.1` / `restore/v10.1.1` | `711d65a72a483b319e80711a09cfeabe2f69bbcd` |
| `v10.1.0` / `restore/v10.1.0` | `11f0012170c4632bd5ef2448bf5671326fdd287e` |
| `v10.0.0` / `restore/v10.0.0` | `e3f7f6d007f52e4ca48e103288bc5ffa77fac9b5` |
| `v9.20.2` / `restore/v9.20.2` | `b8be458acbae942a3bb0b530a5c17618b6d03134` |
| `v9.20.1` / `restore/v9.20.1` | `efaceb59427f0b71859b15a61a6758a80d08547e` |
| `v9.20.0` / `restore/v9.20.0` | `aba409fd1609e7bf7be6bf3c098b7fb6a14d89d1` |
| `v9.19.0` / `restore/v9.19.0` | `d317c17a6a8f706a0d867cb852db1e8d3f9ffac0` |
| `v9.18.0` / `restore/v9.18.0` | `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd` |

The V9.18.0 `/preview/radar-history-fix/` diagnostic stays pinned at `acfa0ebd3717a793369e3e887e2d1a54785620b7`.

**Rollback:** create a reviewed new release by changing the pin to the selected existing recoverable SHA, run the full validations, verify the public site, and create a **new** release reference. Do not force-push or repoint prior tags.

**V10.1.1 science:** primary UTC controls native Doppler, secondary genuine BoM scans ≤8 minutes offset; optional staged site images commit as one synchronous handover. Source time and BoM imagery remain genuine; no secondary wind drives circulation science until its geometry is validated.

**V10.1.1 UI-specific correction:** The source-pinned CSS fixes a specificity conflict between collapsed map and simple UI layout. A cache version bump updates the iframe and stylesheet; source/tests guarantee collapse fills desktop and mobile. The Doppler synchronisation and original source/3-D rendering are unchanged from V10.1.0.

**Cyclone source boundary:** Forecast panel and authentic GML import are enabled, source off until operator toggles. BoM's 'Currently no tropical cyclone warnings' is displayed only after a verified empty current-product feed; network failure must never appear as an all-clear. Live FTP-to-browser bridge and automatic `IDQ20023` bulletin pairing are not delivered in this version.


**Tag/recovery reference repair verified:** [GitHub Actions run 39012793972](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/39012793972) completed both separate Pages deployment and release-sealing jobs. The Git Data REST tag object `c7d4c95a20d2d124a5f53b5a3151dd0cad6a9598` is an **annotated tag** peeling to exact commit `047b3bd1c66b0ed5f070d2298202f46d0cd8dae2`. The restore branch matches; V10.1.1 refs were checked unchanged. Sealing can be retried without rerunning Pages. The source-pinned V10.2.0 application was not modified by this workflow hotfix.
