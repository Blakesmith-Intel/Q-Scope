# Q-SCOPE — 26 November 2026 release and restore record (AEST)

Operator approved the narrow rainfall rollover correction and a new complete restore point on 26 November. **Release refs:** [qscope-2026-11-26](https://github.com/Blakesmith-Intel/Q-Scope/tree/qscope-2026-11-26) and [restore/qscope-2026-11-26](https://github.com/Blakesmith-Intel/Q-Scope/tree/restore/qscope-2026-11-26). These refs are created only when the exact release commit has successful Pages/public verification, native radar/AEP browser guard and Cloudflare Worker/live endpoint verification. See [seal workflow](https://github.com/Blakesmith-Intel/Q-Scope/actions/workflows/seal-qscope-20261126.yml). Until the refs exist and peel to the same SHA, the last verified restore point remains `qscope-2026-11-20` at `638b30e429b8a36993fd06ab50455ce808e6a9f7`. Never move historical refs.

**Scope:** retain the 20 November approved map/wallboard, seven genuine rain scans spanning 30 minutes, independent Doppler, official-only wind, flood logic, warning reissues, cyclone, outages, roads, QFD, region filters and export. Rainfall rollover invalidates the prior reporting day at 09:00 AEST (23:00 UTC), aligns rainfall cache expiry, and checks positive first-hour since-9am totals against the same station/region/source edition's last-hour total. Unsupported readings are excluded, not reported as zero, and known pending readings are retained in the current browser session until evidence of recovery. No individual gauge observation timestamp is exposed by the existing parser; this is a consistency screen, not proof of a station reset. AEP thresholds, five-minute polling and all other retrieval paths remain unchanged. Station 529090 regression uses synthetic values, not a recovered live record.

**Guard repair:** the FTP/AEP packager already copies current rainfall modules; the final overlay must verify rather than duplicate them. Preserve forecast district and SES report anchors until their overlays finish, then revalidate at report open. The real Cesium guard instruments the staged canonical /Q-Scope/ entry, not retired /StormTracker/. Do not weaken the real marker, pointer, rarity, camera, source and error assertions.

**Restore protocol:** fetch refs and compare `git rev-parse 'qscope-2026-11-26^{}'` and `git rev-parse origin/restore/qscope-2026-11-26`; both must match the seal workflow's verified commit. Use a reviewed new rollback commit, never reset main or repoint a seal. Re-deploy and verify the independently running relay; dynamic agency feeds are not frozen. Read [operator guide](OPERATOR_GUIDE_CURRENT.md) and [release record](RELEASE_NOTES_QSCOPE_20261126.md). Older records below are historical only.

---

## Verification evidence

- Prior rainfall relay deployment: [45722262002](https://github.com/Blakesmith-Intel/Q-Scope/actions/runs/45722262002) passed live checks.
- Prior Pages failure: [45722262171](https://github.com/Blakesmith-Intel/Q-Scope/actions/runs/45722262171), missing forecast-district report-open anchor.
- Prior release gate failure: [45722262093](https://github.com/Blakesmith-Intel/Q-Scope/actions/runs/45722262093), real viewer timed out because instrumentation targeted the legacy origin.
- New exact-commit results and final restore SHA: [seal workflow](https://github.com/Blakesmith-Intel/Q-Scope/actions/workflows/seal-qscope-20261126.yml). No success is asserted before all gates pass.
