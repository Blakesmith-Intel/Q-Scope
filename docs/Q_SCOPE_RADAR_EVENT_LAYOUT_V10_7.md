# Q-SCOPE V10.7 — persistent radar alerts / original BoM legend collision fix

**Isolated research preview:** https://blakesmith-intel.github.io/Q-Scope/preview/wind-hook-v10-7/ (after publishing)

## Operator-reported regression (10 November 2026)

A desktop photograph shows the authentic BoM reflectivity legend covering
**Q-SCOPE · RADAR EVENTS**, including a pending-event card, with geographic
town-name labels visible across the alert area.

Root cause established from source:
- The existing `#legendDock` is anchored bottom-right (bottom 56px on desktop,
  48px on mobile) with `z-index:var(--stormtracker-control-z)` = 3000.
- V10.6 placed `.qscope-wind-event-inbox` in the *same* bottom-right corner
  at z=34. Town labels use a geographic-label plane around z=2000.
- Earlier browser tests only verified the event card fit inside the **viewport**,
  not that it was unobscured by the **actual BoM legend** or map labels.

## Approved UX, preserved

- Persistent queue rather than a frame-by-frame alert layer.
- Compact idle 0-event status; pause-on-new-event remains optional and saved.
- Once a real event arrives the queue remains visible until clicked or cleared.
- All related signatures remain in one event, with retained authentic-source
  evidence crops and operator-controlled exact UTC frame navigation.
- Clicking an event is the only automatic camera/frame move; playback pauses.
- Research-only labels and BoM source caveats unchanged.

## Scoped V10.7 correction

- Give the alert the same map-control plane as other controls, **above** the
  original legend and geographic labels; do not modify the BoM legend itself.
- Calculate separation using the **map panel's actual dimensions**, the
  dynamically sized reflectivity/Doppler legend and the navigation bar.
- **Wide map:** persistent alert dock bottom-left; BoM legend remains
  bottom-right, horizontally separated.
- **Narrow map/mobile:** persistent alert dock immediately **above** the
  original BoM legend, maintaining a gap when the legend resizes.
- **Reviewing evidence:** one high-priority detail window opens below the
  map-navigation bar. The queue temporarily steps aside; on exceptionally
  short maps, the legend is temporarily hidden only during explicit event
  review and restored on close.
- DOM resize/mode observers reposition only map UI; no new source requests,
  worker work, map animation changes, radar processing or alert heuristics.

## Release discipline

The new UI is published *only* at `/preview/wind-hook-v10-7/`, separately
copied from V10.6. All six prior previews are retained. Operational root
`/Q-Scope/`, frozen V10.2.53 source `1466851327584b62e06172b3aa2c279afd27870e`,
original BoM radar source overlays, warning polygons and Cloudflare relay
remain unchanged.

V10.7 browser QA uses the real radar legend CSS and tests measured
bounding-box nonintersection, click access and map-panel width/legend
mode changes in desktop Chromium and mobile WebKit.

**Experimental detection science is not operationally validated and
these alerts remain research-only.**
