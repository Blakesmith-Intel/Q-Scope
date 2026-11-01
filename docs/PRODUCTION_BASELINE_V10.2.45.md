# StormTracker V10.2.45 — immutable production baseline

**Operator-authorised release:** Sunday, 1 November 2026, Queensland AEST.
**Public application:** https://blakesmith-intel.github.io/StormTracker/
**Immutable annotated tag:** `v10.2.45`.
**Matching restore branch:** `restore/v10.2.45`.
**Accepted release evidence:** [V10.2.45 release notes](RELEASE_NOTES_V10.2.45.md); [cross-platform source-true browser CI](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/41278998110).
**Status:** The tag and restore branch must be confirmed to resolve to the **same actual published main commit**, after the public Pages release gate passes.

V10.2.45 promotes the **operator-tested QA radar reliability correction** to the public operational root. This is a new source-and-build frozen state, not an alteration to the existing V10.2.42 seal. The signed-off scope is source-verified incremental radar playback, bounded WMTS retries/pressure, in-tab missing-frame recovery, and cross-platform UI parity. Existing map/camera, radar science and other situational awareness layers retain their accepted behaviour.

## Immutable rules

1. Annotated tag `v10.2.45` and restore branch `restore/v10.2.45` must resolve to the **exact same release commit**. Neither ref may ever be moved, overwritten, reset, deleted or reused for enhancements.
2. Retain `v10.2.42` and `restore/v10.2.42` exactly at `7b9df1e4b235ed91a12eb3edd17655984643f0b2`. All older annotated tags and restore branches remain unchanged.
3. Future enhancements begin **from `v10.2.45`** (or a fresh development branch at that exact commit), never from the previous frozen version or an old QA patch. The next enhancement cannot silently change published production.
4. Preserve exact source coordinates and UTCs, no synthetic WMTS frames, truthful source failures, five-minute polling, independent in-tab recovery and honest loop counts. If six genuinely readable scans are published, the standard window should show six; otherwise show only source-verified observations and a meaningful unavailable state.
5. Maintain original mobile and desktop WebGL/viewport, Doppler and 3-D science, four-section menu, rainfall/AEP, river/flood, warnings/cyclones, road/outage/QFD and incident-report source contracts.
6. Before a subsequent production change: complete scoped code review, full source/science regressions, pinned-site packaging checks, live agency-source checks, genuine mobile and desktop operational tests, actual public Pages verification, and explicit operator acceptance. Seal *the subsequent release* under a **new** annotated tag and same-commit restore branch.
7. Roll back only through a new reviewed and verifiable release commit built from the frozen restore source. Never force-reset `main` or rewrite history.

## Release implementation

The pinned V10.2.0 scientific and UI foundation still builds deterministically; the approved V10.2.45 shared radar overlay is applied after the previously frozen FTP/AEP maintenance overlay. The final publicly served package is validated at the root URL, not inferred from a passing branch or internal QA subpath. The existing QA previews and historical sealed sources remain available.

A Git tag freezes **code, configuration, documentation and release procedure**, not live BoM/agency observations, the separately operated relay, network conditions or user browser storage. Report feed failures honestly.

**Operator guide:** [current guide](OPERATOR_GUIDE_CURRENT.md) · [quick reference](OPERATOR_QUICK_REFERENCE_V10.2.45.md) · [development handover](DEVELOPMENT_HANDOVER_CURRENT.md) · [restore procedures](BASELINE_RESTORE.md).
