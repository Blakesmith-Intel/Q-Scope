# StormTracker relay efficiency — operator-approved scoped transport changes

**Baseline to preserve:** operator-confirmed frozen v10.2.52, SHA
`083e5df47c95430553d60ca5dcad810272b907fe`, and subsequent
operator-approved presentation release `b47faf3e42fabff317ec9794a7c70537b091ec23`.

**Mandate:** reduce repeated Worker parsing/upstream traffic and latency without
changing sources, source URLs, source station IDs, flood science, other alerts,
radar frame identity/resolution, polling intervals, or operator controls.

## Existing read paths (source-preserving)

| Product | Approved upstream/retrieval | Efficiency policy |
|---|---|---|
| QLD flood heights | existing 12 BoM river bulletin products via /river-height-bulletins, 10-minute app refresh | Retain official source, partial-product handling and existing 60s response/BoM transport TTL. Combine *simultaneous identical* GETs within the Worker isolate only. |
| QLD flood gauge metadata | original BoM GIS station catalogue, loaded once per browser session | Keep 60s browser self-abort and existing 300s upstream cache. Same-time duplicate reads can share one Worker execution. |
| BoM station history and bridge/approaches | per-station original BoM IDQ65388–IDQ65399 history tables | **New:** cache only *parsed, verified, exact-station* history responses for 60s in the existing Worker Cache API. Only parsed success is cached; 403, 429, 502/503/504, invalid IDs, missing tables, etc. never enter this cache. In addition, in-flight identical GETs are shared. Browser TTL on verified results 60s to avoid compounding history delay; original upstream BoM page 300s cache remains unchanged. |
| BoM severe warning polygons | original /bom-official-warning-polygons | No source/cadence/content/cache policy change. Simultaneous identical reads can coalesce, subject to explicit cache bypass. |
| BoM rainfall and IFD | existing /qld-significant-rainfall and /qld-ifd-point routes | No source/cadence/cache policy change. Same-time identical text reads may coalesce; force and no-store requests are untouched. |
| QLDTraffic road closures and ownership | existing /flood-road-closures, /flood-road-closures-v9-15, /road-ownership-report | Retain current 5m fresh/2h last-good behaviour and report content; combine identical concurrent reads only. |
| Essential Energy legacy transport | existing /essential-energy-outages | Retain original provider and cache behaviour; combine identical concurrent reads only. Energex and Ergon remain on their original direct ArcGIS client routes. |
| WMTS capabilities and FTP live manifest | existing /wmts-native-capabilities and /ftp-live-manifest | Optional concurrent text-request coalescing only; no cached-frame or UTC changes. |
| Native radar, Doppler, WMTS tiles, FTP frames | existing BoM URLs, genuine published frame identities, existing transport/CDN caching | **No new sharing/caching and no changes to raster request paths.** |

The text-only in-flight coalescer is bounded to 48 keys, scoped to the
*exact URL, method and Origin*, never stores results beyond an in-flight
call, and bypasses force/no-store/no-cache. It changes neither source nor
refresh interval. Existing browser source-specific request deduplication is
retained.

The optional station-history parsed cache is **only** the already deployed
`stormtracker-bom-relay`; it introduces no new Worker, provider or paid
service. Existing station-catalogue/height bulletin and time alignment remain
the source of truth. Cache is per Cloudflare data centre: only measured
same-point repeat requests will show HIT; no global cache hit rate is assumed.

## Measurements and readiness

- Exact station history responses expose
  `X-StormTracker-Relay-Cache: MISS/HIT/COALESCED/UNCACHED`,
  `X-StormTracker-Relay-Ms`, and where present,
  `X-StormTracker-Observation-Age-Sec`.
- Other coalescible text routes expose `SOURCE` or `COALESCED`
  for non-forced requests. Existing `Cache-Control` and response shapes
  are retained.
- A `MISS` here means no **parsed** history response was reused. It does
  **not** prove an actual BoM origin subrequest: Cloudflare may satisfy the
  original upstream fetch from its existing cache.
- Cloudflare Cache API is best-effort. If unavailable, malformed, or throwing,
  immediately use the unchanged live BoM source. Never accept stale cache
  beyond 60 seconds, cache a service error, invent a zero river reading or
  turn missing telemetry into a negative flood warning.
- Compare p50/p95 `X-StormTracker-Relay-Ms`, MISS/HIT rates, published
  observation age and Cloudflare Worker invocations/CPU in the operator's
  dashboard before and after rollout. Do not assert measured savings from
  test-only results.
- Follow deployment/boM quality checks in `.github/workflows/deploy-relay.yml`
  and main Pages package checks. A successful merged PR is **not** proof the
  Cloudflare production Worker has deployed; inspect its dedicated workflow.
- Do not tag or overwrite v10.2.52. Treat the new state as unsealed until
  operator confirms healthy production.

## Fail-safe release gates

Full 200+ frontend regressions including exact BoM station identity,
river-history parsing, 30–120 minute rise rates, tidal screening, crossing
recovery, severe-warning and radar integrity. New test
`run-relay-efficient-read-v1-tests.mjs` proves same-time-only coalescing,
same-source routes, explicit force bypass, verified 60-second cache,
CORS separation, no error cache and raster exclusion. Run the **existing**
Cloudflare production deployment workflow, and verify no changes to approved
science or sources.

**No changes to previously approved product retrieval pathways are authorised.**
