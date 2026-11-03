# StormTracker V10.2.48 — genuine BoM WMTS tile recovery (operator visual acceptance)

**Scope:** public production radar transport reliability only. All sealed warnings, cyclone, flood, rainfall/AEP, QLD Traffic, power outage, 3-D scientific and primary/supplementary radar synchronisation behaviours are retained.

- Preserve the six authentic high-resolution BoM WMTS observations and independently verified source timestamps, without inventing missing pixels or substituting earlier imagery.
- On a temporary HTTP 403 from the existing browser relay for a specific genuine WMTS tile, attempt **one** direct browser request to the *identical* official native BoM WMTS URL: same layer, tile row/column and observation UTC. The existing two-request pressure guard and per-request deadline still apply.
- If direct BoM access is also refused, keep the prior genuine frames and retry after the existing bounded refusal cooldown. Never bypass BoM HTTP 400 or rate-limit HTTP 429 with this fallback.
- Retain verified original PNGs in the bounded browser cache, recover historical observations in the same tab, and preserve live playback and camera.
- Revalidate the actual public Pages root, module identities and source-fallback code following deployment. A new browser cache-identity suffix forces browsers to retrieve the corrected code.
- **Acceptance:** operator will visually confirm on the public site. This release note does not claim a passing desktop live-source test or a sealed immutable acceptance tag before those are verified.
