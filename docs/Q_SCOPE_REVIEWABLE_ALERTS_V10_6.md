# Q-SCOPE V10.6 — reviewable persistent radar events

**Status:** Experimental research preview only, not operational warnings  
**Research URL (after successful deployment):**
https://blakesmith-intel.github.io/Q-Scope/preview/wind-hook-v10-6/  
**Accepted operating restore point:** V10.2.53 at
`1466851327584b62e06172b3aa2c279afd27870e`. The original
`/Q-Scope/` public root, Cloudflare relay and frozen restore refs remain
untouched. Earlier V10.3, V10.4 and V10.5 preview routes remain isolated.

## Operator experience

1. **Always-on research detection:** Source-dated rain and Doppler pairs are
   evaluated independently of the playback cursor, with no "alert layer" switch.
   The old frame-scoped **RADAR EVIDENCE** panel and pins are deliberately
   hidden in V10.6; only **Q-SCOPE · RADAR EVENTS** is visible for notifications.
2. **Persistent events:** A new event creates one pending notification card.
   It remains until individually opened (acknowledged) or explicitly cleared.
   Changing the radar frame, finishing the loop or returning to the app cannot
   hide it. Related categories within 8 km and 30 min are one case window.
   Opening moves it to History, rather than destroying its stored evidence.
3. **Controlled playback:** By default the radar keeps playing when an event
   arrives. The operator may enable **Pause on new event** in the card header.
   That setting is remembered in the local browser, and can pause only
   **once for a genuinely new event** if it is a *fresh* observation
   (0–12 minutes old) and the user is currently running playback in a visible
   tab. Replayed frames, historical backlogs and additional evidence for the
   same case cannot repeatedly interrupt playback. The original five-minute
   data retrieval cadence continues.
4. **Operator opens event:** Playback pauses immediately and stays paused;
   Q-SCOPE attempts the exact original BoM UTC radar/Doppler frame and
   centres the map on the detected coordinates. This interaction never
   chooses a synthetic/nearest scan. If BoM has retired the frame, the
   recorded event stays open and the evidence snapshot is shown instead.
5. **Retained evidence:** Where source pixels are available, a bounded
   160×160 PNG crop around the event is captured at detection time and
   preserved with its precise source UTC in the event ledger.
   - Reflectivity crop: palette-reconstructed from the original measured
     BoM classification grid. **Not** a copy of BoM's original composite
     map artwork or a measured vertical structure.
   - Doppler crop: original calibrated BoM native radial-velocity RGB
     pixels. It is **not** a surface-gust speed or a verified tornadic vortex.
   - Captures of inferred, missing, conflicting or wrong-time scans are
     suppressed rather than fabricated.
   - Browser storage has a bounded total of 2 million text characters;
     if exceeding capacity, older optional thumbnail images are dropped
     **before alert/event metadata**, and the UI explicitly reports when
     a crop is unavailable. Private browsing/blocked storage falls back to
     current-session retention only.
6. **Clear:** Individual dismissal is explicit, persisted, and prevents
   original source scans from reappearing when loops repeat. Clicking Close
   on an evidence window does not delete a case; History retains it.

## Safety / release gates

This preview is a *research candidate*. Yellow radial wind, orange hook-shape,
and red hook-plus-couplet categories are **not** BoM-issued severe weather
warnings, are not verified tornados, and cannot be compared as a measured
90/125 km/h surface gust. A source-image crop is evidence, not a warning or
a substitute for current BoM products.

Automated tests cover one-time fresh-event policy, source-UTC matching,
non-interpolated evidence, exact frame selection, grouped display and
browser persistence. The V10.6 isolated preview is subject to full page
build and real mobile WebKit/desktop Chromium interaction checks; historical
Gympie/Cooloola, Christmas 2023 and ordinary non-event false-positive
validation remains required before any separate operator-approved
live operational alert integration.

**Never promote experimental alerts to the public root based solely on
successful browser/automated tests.**

## V10.6.1 operator interface repair — 10 November 2026

A real desktop screenshot showed the **original BoM 15-band reflectivity
legend obscuring a pending Q-SCOPE radar-event card**. The warning queue and
legend had independently been placed at the right/bottom corner, with the
legend above the inbox in the map's stacking context. A technically persistent
notification was therefore not actually reviewable.

The repair applies ONLY to `/preview/wind-hook-v10-6/`, without modifying its
research detection, source retrieval or persistence rules:

- Preserve the existing authoritative BoM legend and all its source colours,
  mode controls, refresh rules and original map position.
- Position the event inbox as a first-class **separate map control**, not in
  the legend's area. On wide maps prefer a free lower-left slot; on narrow
  maps stack it above the real measured legend height, with an internal
  scrollable event list.
- React to actual legend changes, map resizing, source-mode changes and
  other live map controls via bounded local ResizeObserver / MutationObserver
  logic. No polling or additional Worker calls.
- Show the explicit operator-requested evidence review as a centred,
  dismissible, scrollable window, rather than leaving it wedged below the
  legend.
- A zero-event status stays compact; a real pending alert remains accessible.
  Event action buttons must be visually unobscured and physically clickable.
- Test desktop Chromium and mobile WebKit against a real 15-band legend
  fixture, dynamic radar mode, multiple simultaneous events, and an active
  operator's event review.

No changes to the frozen V10.2.53 accepted root, the original V10.3–V10.5
research routes, Cloudflare Workers, scientific classification or BoM data
flow are authorised by this repair.
