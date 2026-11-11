#!/usr/bin/env python3
"""Package a reviewable isolated operator site; never edit _site or production.

Copies the actual built Q-SCOPE root (not source/QA stubs), replaces only API
host references in the PREVIEW copy to its own read-only QA Worker, and labels
the browser shell prominently as non-operational.
"""
from pathlib import Path
import shutil

ORIGINAL = "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev"
PREVIEW = "https://qscope-wind-pr328-stormtracker-bom-relay.stormtracker-bom-relay.workers.dev"
SOURCE = Path("_site")
TARGET = Path("_wind_preview_assets")
BANNER = '<div id="qscope-wind-preview-notice" role="note" ' \
    'style="position:fixed;right:8px;top:8px;z-index:1000;' \
    'pointer-events:none;background:#70212c;color:#fff;' \
    'font:700 12px Arial,sans-serif;padding:7px 11px;' \
    'border-radius:8px;box-shadow:0 1px 9px #0008">' \
    'Q-SCOPE WIND QA PREVIEW · NOT PRODUCTION</div>'

def main() -> None:
    source_build = (SOURCE / "BUILD.txt").read_text(encoding="utf-8")
    assert "BO_M WIND OBSERVATION PRODUCT" in source_build
    assert "Q-SCOPE ACCEPTED MAIN WIND EVENTS V10.6.8" in source_build
    if TARGET.exists():
        shutil.rmtree(TARGET)
    shutil.copytree(SOURCE, TARGET, ignore=shutil.ignore_patterns(
        ".git", ".DS_Store", "preview", ".wrangler"
    ))
    replaced_files = 0
    replaced_urls = 0
    for path in TARGET.rglob("*"):
        if not path.is_file() or path.suffix not in {".js", ".html", ".css"}:
            continue
        body = path.read_text(encoding="utf-8")
        count = body.count(ORIGINAL)
        if count:
            path.write_text(body.replace(ORIGINAL, PREVIEW), encoding="utf-8")
            replaced_files += 1
            replaced_urls += count
    if replaced_files < 3:
        raise ValueError("Expected original relay references missing; QA cannot route independently")

    index = TARGET / "index.html"
    html = index.read_text(encoding="utf-8")
    if html.count("</body>") != 1 or 'id="liveFrame"' not in html:
        raise ValueError("Unexpected sealed shell; no preview UI override allowed")
    index.write_text(html.replace("</body>", BANNER + "\n</body>", 1),
                     encoding="utf-8")
    obs = (TARGET / "src/context-layers/qscope-bom-wind-observations-operational-v1.js").read_text(
        encoding="utf-8"
    )
    if PREVIEW + "/qld-wind-observations" not in obs or ORIGINAL in obs:
        raise ValueError("Staging observation route still points to production relay")
    for rel in ("live3d-operational-v9.html", "src/live3d-operational-v9.js",
                "src/qscope-bom-wind-observations-v1.css"):
        if not (TARGET / rel).is_file():
            raise ValueError("Preview missing full production-equivalent operator asset: " + rel)
    with (TARGET / "BUILD.txt").open("a", encoding="utf-8") as build:
        build.write("ISOLATED PREVIEW Q-SCOPE BOM WIND PR328; " +
                    f"{replaced_urls} relay references in {replaced_files} assets; " +
                    "production root / existing production Worker untouched\n")
    print(f"ISOLATED_QSCOPE_QA_PACKAGE_PASS: {replaced_urls} relay routes in " +
          f"{replaced_files} staged files; no source or accepted production mutation")

if __name__ == "__main__":
    main()
