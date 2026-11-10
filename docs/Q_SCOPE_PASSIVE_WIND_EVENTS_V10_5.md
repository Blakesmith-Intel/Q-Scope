# Q-SCOPE V10.5 — passive radar event notifications (research preview)

**Public identity:** Q-SCOPE — Queensland Situational Awareness  
**Candidate preview URL (once verified and published):**
https://blakesmith-intel.github.io/Q-Scope/preview/wind-hook-v10-5/

**Source of science:** operator-approved immutable V10.3 evidence candidate,
subsequently source-guarded V10.4 false-positive protections. **NOT** an
official BoM/QFD warning, tornado verification or surface-gust forecast.

## Operator interaction

- The research radar evidence monitor is **automatically enabled** on the
  isolated V10.5 preview. There is **no radar-alert layer checkbox** and no
  wind-alert toggle required. The main operational Q-SCOPE application does
  **not** activate this unvalidated science.
- Each eligible pair of original source-dated radar observations is assessed
  automatically in a **single serial processing queue**, including scans the
  operator has not played. Original BoM Doppler sample decoders remain bounded.
  Each radar/site/time pair is de-duplicated; a source refresh does not
  manufacture another alert.
- An alert appears in a **persistent event inbox** and remains pending across
  radar playback, frame scrubbing, background refresh and browser reload until
  the operator **opens or explicitly clears** that event. Browser local
  storage persists pending and handled state; if disabled, persistence is
  limited to the current browser session and shown as such.
- Opening an event is the only operation that moves the user's map or playback.
  It **acknowledges the notification** and opens one event evidence window.
  The operator can see all detected types/timestamps and select **View this
  exact frame** for a specific observation. Prior acknowledged events remain
  available under History. Clear explicitly dismisses them.
- Multiple alert categories or different radar detections within **8 km**
  of one another and **30 minutes** of the source event are merged into **one
  event window**. The default observation chosen is the most informative
  (hook plus Doppler couplet, then hook shape, then strong radial-wind
  signature), never a fabricated average. Separate locations or later
  episodes remain distinct.
- Clicking an event pauses the playback, attempts the specific **genuine
  source UTC frame**, then focuses the camera on the recorded location. If
  the source frame has aged out of the currently available genuine BoM loop,
  the camera centres on the location and the UI explicitly says the exact
  frame **cannot be shown**. The viewer must never silently replace the
  original evidence with the closest or an inferred radar frame.
- No unsolicited camera jumps, sounds, flashing pins or automatic map-layer
  changes occur when a new alert arrives.

## Safety constraints retained

- All candidate categories remain experimental and labelled **not official
  warnings**. A hook shape alone never claims a tornado.
- Doppler ±70 km/h image colours cannot verify BoM **90/125 km/h surface
  gust thresholds**. None of the events asserts that they can.
- Only original source-dated, geometrically verified, non-interpolated
  Doppler observations may contribute to yellow/red. Unavailable or
  ambiguous evidence produces **no** inferred wind alert.
- Explicit user interaction is required before the viewer changes radar
  mode, timeline position or camera. Old events cannot masquerade as
  currently active weather.

## Verification and release discipline

The research-only pipeline can publish V10.5 beside the existing V10.3 and
V10.4 previews after frontend contract tests and Pages release checks. The
operational root (Q-SCOPE /Q-Scope/), accepted radar/flood/warnings behaviour,
Cloudflare Worker, and immutable V10.2.53 source and restore branch remain
untouched.

Real mobile WebKit/desktop Chromium operator tests, authentic historical
case comparison, ambiguous Doppler aliasing review and false-positive / missed
event studies remain scientific release gates. **No promotion to live
operational alerts without separate operator sign-off.**
