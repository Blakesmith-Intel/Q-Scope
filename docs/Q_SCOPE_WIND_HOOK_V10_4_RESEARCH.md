# Q-SCOPE V10.4 — experimental Doppler wind and hook evidence

**Identity:** Q-SCOPE — Queensland Situational Awareness  
**Research route (only after this preview is published):**
https://blakesmith-intel.github.io/Q-Scope/preview/wind-hook-v10-4/

**Release state:** experimental, off by default, **not operational alerts**.
Do not describe or redistribute its indicators as severe-weather warnings, surface
wind measurements, verified tornadoes, or advice to activate emergency services.
The genuine source of all weather warnings remains BoM and relevant authorities.

## Previous foundation retained

This candidate is a **separate copy** of the pinned V10.3 experimental browser
preview at source `f3a07688ca02f5f0234ae6425fc1177722518c53`.
The old `/preview/wind-hook-v10-3/` remains byte-for-byte isolated from the
new experimental scripts. The V10.2.53 operator-accepted root source,
`1466851327584b62e06172b3aa2c279afd27870e`, remains frozen.
The approved V10.2.x root warning, radar, 3D, cyclone, rainfall, flood,
roads, power outages and incidents are **never** switched to these heuristics.

## V10.4 evidence corrections

- **Yellow:** At least three unique original velocity pixels of the same
  sign must be **spatially connected** (within 1.5 km step adjacency),
  not simply fall in an arbitrary 5-km display bin. Requires two distinct
  source-dated scans from the same radar, 8 minutes or less apart,
  georegistration checked, ±70 km/h image palette bounded, coherent sign,
  persistent physical location and no qualifying opposing cluster. This is
  an **observed radial-velocity signature only**, not proof of 90 km/h
  surface gusts or a particular straight-line downburst.
- **Orange:** A shape-only hook must persist on two original successive
  reflectivity timestamps within eight minutes, with the same storm track.
  No tornado conclusions follow from a hook-shaped arc.
- **Red:** Two verified original reflectivity scans, a shape candidate, and
  a nearby opposite-sign velocity couplet persisting in two separate real
  Doppler scans are required. Mixed source files with the same radar ID
  cannot form one invented velocity observation; the radar is ignored for
  that assessment if multiple valid source records compete. This is only a
  **possible tornadic radar signature**, never confirmed circulation,
  a verified tornado or an official warning.
- **Data integrity:** Duplicate geolocations, duplicated radar pixel
  indices, untrusted frame clocks, inferred/interpolated velocity,
  timestamps outside the ±8-minute pairing tolerance, and image velocities
  outside its real palette are rejected. Station-based 90/125 km/h gust
  comparisons require actual identified BoM AWS gust observations.
- **Performance:** Local spatial indexing replaces dense all-to-all Doppler
  sample searches. A pathological above-4096-samples-per-storm data group
  is conservatively not classified. The source decoder remains bounded to
  250,000 samples; no new Worker computation or paid source was introduced.

## Open scientific release gates

1. Test original Doppler image georeferencing, altitude/elevation, dealiasing
   and noise filtering against source metadata; a rendered radial palette
   cannot by itself prove the true wind vector.
2. Run original Gympie/Cooloola 2025 and Christmas 2023 cases plus ordinary
   non-event storms with blinded false-positive / false-negative review.
   The synthetic adversarial tests are **not** historical scientific proof.
3. Run full genuine mobile WebKit and desktop Chromium preview interaction
   testing, including stale frames, load failures and repeated source images.
4. Ensure no false claims about BoM 90 km/h damaging and 125 km/h destructive
   *surface* gust thresholds; these are distinct from radar radial velocity.
5. Require separate operator scientific approval before any live
   operational-layer promotion. A merged research-only preview is **not** that
   approval.

## Release safety

No existing frozen tags, existing radar previews, public root links, Cloudflare
Worker routes or data refresh pathways are modified by the research overlay.
The original browser path remains `/Q-Scope/`, and the V10.4 QA toggle
is **off on initial load**.
