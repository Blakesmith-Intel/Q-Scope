# StormTracker V10.2.41 — Operator camera continuity during radar refresh

1 November 2026, Queensland.

## Operator-reported defect
With Longreach selected and the map positioned over Longreach, loading a newly published frame caused the view to jump back to the Mt Stapylton default. This is unacceptable for situational awareness even when genuine radar data is loading normally.

## Root-cause boundary
The source runtime sets Mt Stapylton as the initial default and calls `resetView()` at application startup. Explicit radar changes and the reset button legitimately call the same function. Frame processing itself does **not** call `resetView()`, so a same-tab application restart or delayed initialisation can unexpectedly apply the default without any operator intent. A reload/reinitialisation is a plausible cause, not proven from the screenshot alone.

## Narrow correction
- Store the operator-selected physical radar ID and full camera target (latitude/longitude, range, heading, pitch, target height) in safe bounded **per-tab sessionStorage**.
- On same-tab Safari reload/iframe restart, restore only a known radar ID and validated recent view (for the lifetime of that operator tab). A genuinely new tab still defaults to Mt Stapylton as previously approved.
- Do not let asynchronous model/terrain startup call `resetView()` after the operator has changed the camera or selected a different radar.
- Save after real camera gestures, selected-radar changes, radar marker re-centre, and explicit Reset, and on tab pagehide. No camera reposition is added to automatic refresh.
- Keep all existing user-triggered camera actions: primary-radar selection, Fit selected radars, explicit Reset, manual pan/zoom/rotation/tilt, and specific warning focus behaviour.
- No changes to BoM source, genuine radar timestamps, Doppler, science, map geography, flood gauges, AEP, warning layers, operator controls, five-minute polling or 60-second background retry.

## Tests and acceptance
Unit tests validate Longreach session restoration, exact camera pose and expiry/invalid-data behaviour. The pinned production package verifies the new module, restored-selection code, startup protection and cache-busted entrypoints. Mobile-sized browser QA must select Longreach, set an operator camera pose, exercise foreground refresh and latest image loading, reload the same tab, and prove both selected radar and full camera pose are unchanged. Physical iPhone Safari acceptance remains an operator verification, not something a headless runner can claim.

V10.2.40 and all earlier tagged/restore releases remain immutable.
