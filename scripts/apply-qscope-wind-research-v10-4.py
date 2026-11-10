#!/usr/bin/env python3
"""Source-guarded, isolated Q-SCOPE V10.4 experimental radar preview.

The V10.3 science preview, sealed root, Cloudflare paths and historical releases
are not modified. This script only edits a newly copied V10.4 preview tree.
"""
from argparse import ArgumentParser
from pathlib import Path

def change(file: Path, old: str, new: str, expected: int = 1):
    s=file.read_text(encoding="utf-8")
    count=s.count(old)
    if count!=expected:
        raise ValueError(f"{file}: expected {expected} occurrences of {old!r}, got {count}")
    file.write_text(s.replace(old,new),encoding="utf-8")

def main(site: Path):
    if site.name != "wind-hook-v10-4" or site.parent.name != "preview":
        raise ValueError("QA overlay must target preview/wind-hook-v10-4 only")
    index=site/"index.html"
    html=site/"live3d-operational-v9.html"
    js=site/"src/live3d-operational-v9.js"
    dock=site/"src/severe-storm-alert-overlay-v1.js"
    change(index,"<title>StormTracker</title>",
        "<title>Q-SCOPE | Experimental Wind & Hook Research V10.4</title>")
    change(index,'title="StormTracker live weather"',
        'title="Q-SCOPE experimental radar wind and hook QA"')
    change(index,'"></iframe>',
        '-qscope-v10-4-research-only"></iframe>')
    change(html,"<title>StormTracker — V9.18.0 QLD/NSW regional situation viewer</title>",
        "<title>Q-SCOPE | Experimental Radar Evidence V10.4</title>")
    change(html,"<strong>StormTracker</strong><span>Live weather map</span>",
        "<strong>Q-SCOPE</strong><span>WIND / HOOK RESEARCH · NOT OFFICIAL WARNINGS</span>")
    change(html,'<strong id="detailsTitle">StormTracker details</strong>',
        '<strong id="detailsTitle">Q-SCOPE research details</strong>')
    change(js,'/preview/wind-hook-v10-3/','/preview/wind-hook-v10-4/',2)
    change(js,'Wind / hook radar signatures · RESEARCH',
        'Q-SCOPE wind / hook research · NOT OFFICIAL WARNINGS')
    change(dock,'caption.textContent = "RADAR ALERTS";',
        'caption.textContent = "Q-SCOPE · EXPERIMENTAL RADAR EVIDENCE";')
    change(dock,'"Radar evidence alerts"',
        '"Q-SCOPE research radar signatures, not official warnings"')
    with (site/"BUILD.txt").open("a",encoding="utf-8") as out:
        out.write("Q-SCOPE WIND / HOOK RESEARCH V10.4 — source-bounded two-scan QA; NOT PRODUCTION ALERTS; NO OFFICIAL WARNINGS\n")

if __name__=="__main__":
    parser=ArgumentParser()
    parser.add_argument("--site",required=True,type=Path)
    args=parser.parse_args()
    main(args.site)
