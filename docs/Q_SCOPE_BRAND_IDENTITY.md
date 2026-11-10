# Q-SCOPE — Queensland Situational Awareness

**Public-facing platform name:** **Q-SCOPE**  
**Short description:** Queensland Situational Awareness  
**Long descriptor:** Queensland Weather, Hazards & Emergency Situational Awareness

## Identity and safety

Q-SCOPE is an independently maintained situational-awareness viewer bringing
together sourced radar, Doppler, flood, severe-weather, cyclone, rainfall,
infrastructure and incident information. It is **not** the Queensland Government,
BoM, QFD, an emergency operations controller, a warning issuer, or a substitute
for the official source. No official endorsement is claimed.

## Approved scope of initial rebrand

- Present **Q-SCOPE** in the live production sidebar, browser-tab titles,
  relevant screen-reader descriptions and track-details panel.
- Use **QLD Situational Awareness** as a compact sidebar descriptor, and the
  full descriptive title in browser metadata, operator documentation and README.
- Retain the existing dark-map dashboard and established radar favicon rather
  than redesigning user controls, map graphics, pin colours or the iconography.
- Rename the public application identity **only after** assembling and testing
  the original accepted site from the source-pinned build. The two production
  HTML files are the only deployed runtime files modified by the brand overlay.
- The repository and GitHub Pages project path were renamed from
  `Blakesmith-Intel/StormTracker` to `Blakesmith-Intel/Q-Scope` on
  **10 November 2026**. The new canonical public URL is
  **https://blakesmith-intel.github.io/Q-Scope/** (capital S, lowercase cope).
  Old GitHub *repository* links may redirect; do not rely on the previous
  GitHub *Pages* path redirecting.
- Preserve every existing agency source URL, Cloudflare Worker endpoint,
  source identifier, application storage key and cache protocol that is used
  to retrieve or correlate data. These are not public brand identifiers.
- Keep pinned V10.3 and archived research routes under the same relative
  `preview/` paths at the new `/Q-Scope/` project address.
- Preserve experimental V10.3 wind/hook and historical radar previews as
  explicitly separate, source-pinned research artefacts. Their historical
  internal titles do not indicate live production.

## Immutable source and next changes

The **operator-accepted V10.2.53** source is
`1466851327584b62e06172b3aa2c279afd27870e`, with immutable-by-policy
annotated tag `v10.2.53` and restore branch `restore/v10.2.53`.
GitHub refs are preserved; tag/branch deletion protection could not be
enabled by the available application permission and requires an administrator.
Never modify the source commit, tags or restore branch. Future platform
enhancements are new changes with full regression, publication checks and
operator acceptance.

**Not included here:** custom-domain purchase or an automatic redirect from the retired Pages URL,
new Cloudflare route/worker, logo artwork, color-system redesign, changes to
severe-weather scientific thresholds or promotion of unvalidated radar
wind/hook alerts. These are separately reviewed decisions.
