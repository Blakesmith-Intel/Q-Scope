# StormTracker — document recovery and authority index
**Prepared:** 14 October 2026 (AEST). This index is curated to retain important knowledge while avoiding resurrection of obsolete build archives.

## Authoritative live repository references (clean main)

1. [README.md](../README.md) — architecture, two supported URLs, current controls and development rules.
2. [CURRENT_ACCEPTED_BASELINE.md](CURRENT_ACCEPTED_BASELINE.md) — **accepted V9.18 diagnostic** vs sealed production.
3. [HANDOVER_V9.18.0.md](HANDOVER_V9.18.0.md) — Cesium/map and source timing implementation.
4. [SCIENTIFIC_CONTRACT.md](SCIENTIFIC_CONTRACT.md) — science constraints, pixel eligibility, Doppler caveats and inference.
5. [BASELINE_RESTORE.md](BASELINE_RESTORE.md) — pinned SHA, recovery branches and no-surprise rollback.
6. [ACTIVE_WISHLIST.md](ACTIVE_WISHLIST.md) — accepted V10 priorities.
7. [RELEASE_NOTES_V9.18.0.md](RELEASE_NOTES_V9.18.0.md) and [USER_GUIDE_V9.18.0.md](USER_GUIDE_V9.18.0.md) — current production release/use.
8. [V10_MASTER_HANDOVER_2026-10-14.md](V10_MASTER_HANDOVER_2026-10-14.md), [V10_EVIDENCE_AND_NEXT_STEPS_2026-10-14.md](V10_EVIDENCE_AND_NEXT_STEPS_2026-10-14.md) — newly consolidated continuity notes.

## V10 research documents (research branch only)

- [V10_DEVELOPMENT_PLAN.md](https://github.com/Blakesmith-Intel/StormTracker/blob/feature/v10-severe-weather-candidates/docs/V10_DEVELOPMENT_PLAN.md) — source gating, iconography, modules and scientific limitations.
- [V10_AURA_HISTORICAL_VALIDATION.md](https://github.com/Blakesmith-Intel/StormTracker/blob/feature/v10-severe-weather-candidates/docs/V10_AURA_HISTORICAL_VALIDATION.md) — exact measured archive and CI evidence.
- `scripts/aura-v10-volume-audit.py`, `.github/workflows/v10-aura-evidence.yml`, `frontend/src/doppler-source-validation-v10.js`, `frontend/src/circulation-candidates-v10.js`, `frontend/tests/run-doppler-v10-validation-tests.mjs`. They **remain research-only** and are not part of the clean deployment surface.

## Legacy documentation recovered from user's prior ChatGPT Library

The following **historical** files were found and copied without rewriting their original contents into the companion transfer archive, to preserve release rationale, feature decisions and previous test methodology:
- `StormTracker_Pre_V10_Outstanding_Work.docx` — V9.16.15 pre-V10 gates; later releases supersede baseline details.
- `StormTracker_Release_Changelog_V9.16.15.docx` — historical measured-pixel and multi-radar changes.
- `StormTracker_End_User_Guide_V9.16.15.docx` — past workflow (superseded by current V9.18 guide).
- `StormTracker_V9.16.14_Technical_Handover.docx` — preserved frontend engineering map.
- `StormTracker_V9.16.14_Key_Features.docx` — historical features and layering.
- `StormTracker_Future_Development_Handover_v9.8.4.txt` — early protected architecture, polling/source history, future wishlist.
- `StormTracker_Project_Continuation_Handoff_2026-10-04.txt` — prior architecture/decision history.

Other dozens of V7–V9 operational ZIPs, installation scripts and obsolete previews remain available from prior Library/history **but intentionally not re-imported as active project instructions**. Preserve them as archival recovery artifacts only. On any discrepancy, prefer latest accepted V9.18 documents and direct source code over earlier V9.8/V9.16 assumptions.

## Coverage of recovery

Verified from GitHub: clean `main` has six workflows and eight release/current documents (before this transfer), with the accepted browser production and diagnostic sources pinned separately. The existing research branch has old workflow/test history; it must be selectively curated rather than merged wholesale.

**Project-context limitation:** ChatGPT Project file membership is managed in the ChatGPT interface. These repository Markdown files and the companion downloadable transfer bundle provide durable access; if a project-wide file attachment is desired, upload the companion ZIP or individual Markdown files into this ChatGPT Project's file area. Do not treat a Library upload alone as an automatic Project attachment.
