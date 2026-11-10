#!/usr/bin/env python3
"""Public-root Q-SCOPE identity overlay; never rewrite pinned QA or source tags.

This deliberately changes only human-readable page branding. Radar, Doppler,
floods, alerts, URL paths, DOM IDs, CSS class names and live data stay intact.
The old StormTracker repo and Cloudflare endpoint names are compatibility
identifiers, not public-facing brand names to migrate in this change.
"""
from argparse import ArgumentParser
from pathlib import Path

LABEL = "Q-SCOPE"
TAGLINE = "QLD Situational Awareness"
DESCRIPTION = (
    "Q-SCOPE — Queensland situational awareness for severe weather, "
    "radar, flood observations, warnings and community impacts. "
    "Independent information viewer; consult official agencies for warnings."
)


def replace_once(body: str, old: str, new: str, where: str) -> str:
    count = body.count(old)
    if count != 1:
        raise ValueError(f"{where}: expected exactly one {old!r}; found {count}")
    return body.replace(old, new, 1)


def brand_public_root(site: Path) -> None:
    main = site / "index.html"
    inside = site / "live3d-operational-v9.html"
    page = main.read_text(encoding="utf-8")
    ui = inside.read_text(encoding="utf-8")
    # Fail closed on already-branded or unexpected HTML; never double-apply.
    if "Q-SCOPE" in page or "Q-SCOPE" in ui:
        raise ValueError("Q-SCOPE branding overlay already present")
    page = replace_once(page, "<title>StormTracker</title>",
        "<title>Q-SCOPE | Queensland Situational Awareness</title>", "index title")
    page = replace_once(page,
        'title="StormTracker live weather"',
        'title="Q-SCOPE Queensland weather and hazard map"', "iframe accessibility")
    page = replace_once(page, "</head>",
        f'  <meta name="description" content="{DESCRIPTION}">\n</head>', "index description")

    ui = replace_once(ui,
        "<title>StormTracker — V9.18.0 QLD/NSW regional situation viewer</title>",
        "<title>Q-SCOPE | Queensland Situational Awareness Map</title>",
        "operational page title")
    ui = replace_once(ui,
        "<strong>StormTracker</strong><span>Live weather map</span>",
        f"<strong>{LABEL}</strong><span>{TAGLINE}</span>",
        "operator sidebar branding")
    ui = replace_once(ui,
        '<strong id="detailsTitle">StormTracker details</strong>',
        '<strong id="detailsTitle">Q-SCOPE details</strong>',
        "track details heading")
    ui = replace_once(ui,
        "Open StormTracker operator guide in a new tab",
        "Open Q-SCOPE operator guide in a new tab",
        "guide link accessibility")
    ui = replace_once(ui, "</head>",
        f'  <meta name="description" content="{DESCRIPTION}">\n</head>',
        "operational description")
    # Existing source file cache identity is otherwise stable; use an iframe
    # cache-buster because index HTML is a shell, not a source runtime.
    page = replace_once(page, '"></iframe>', '-qscope-brand-20261110-v1"></iframe>',
        "root shell iframe cache identity")

    main.write_text(page, encoding="utf-8")
    inside.write_text(ui, encoding="utf-8")
    (site / "BUILD.txt").open("a", encoding="utf-8").write(
        "Q-SCOPE QUEENSLAND OPERATOR BRANDING 2026-11-10 | "
        "V10.2.53 BASELINE SCIENCE UNCHANGED\n"
    )


if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument("--site", type=Path, required=True)
    args = parser.parse_args()
    brand_public_root(args.site)
