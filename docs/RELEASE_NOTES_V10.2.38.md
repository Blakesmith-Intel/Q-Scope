# StormTracker V10.2.38 — preserve genuine BoM radar replay history when WMTS lags

Date: 1 November 2026. Targeted correction following mobile screenshots: official BoM showed 11:00 AEST; StormTracker showed Mt Stapylton 10:45 with five frames and Gladstone 10:30 with one frame at 11:10.

## Code-level cause

The WMTS adapter applied the 45-minute current-source freshness cutoff to older source-published replay frames. When the latest source was 25–40 minutes behind the wall clock, this wrongly removed earlier genuine scans from the 30-minute loop. Repeated capabilities queries during multi-frame loading also allowed the published time list to roll over halfway through replay construction.

## Change

- Use the 45-minute freshness gate only to select a current live source. Preserve up to nine genuine advertised WMTS timestamps within a 55-minute tail of the latest readable source scan, separately from the 45-minute live freshness rule. Keep longer 60/120/180-minute replay in the verified browser archive, not by hammering withdrawn upstream WMTS tiles.
- Preserve one authentic discovery snapshot for the entire load. Each image tile still must pass genuine HTTP and pixel verification. No guessed, substituted or reconstructed observed images.
- Retain the original five-minute poll, two-second busy retry, foreground check, Doppler/3-D and all existing incident, warning, flood and rainfall layers.
- Bust the iOS Safari launcher, embedded runtime and WMTS module cache keys.

## Acceptance and limitations

New regression reproduces 10:05–10:45 AEST source-published frames at 11:10 AEST, including Mt Stapylton, Gladstone and the SEQ composite. Run complete frontend suite, build and public Pages checks before confirming release.

Upstream caveat: the screenshot does not establish why BoM's new map showed 11:00 while StormTracker had older WMTS observations. This change fixes genuine history retention, not the upstream publication delay. Show real source observation times, never create scans or claim freshness without verifying the source. Existing frozen release tags remain unchanged.
