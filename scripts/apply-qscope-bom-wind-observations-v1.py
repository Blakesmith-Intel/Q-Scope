#!/usr/bin/env python3
"""Add the isolated BoM ground-station wind product to the generated Q-SCOPE root.

The accepted radar, Doppler, polygon, flood, rainfall and passive-wind runtime
has already been verified and assembled. This only appends one parallel
observation controller, one input group, a report and additive styles.
Do not patch the pinned production source or historical preview pages.
"""
from pathlib import Path
import re
import shutil

VERSION = "20261111-bom-wind-observations-v1"
SOURCE = Path("frontend")
SITE = Path("_site")
MODULES = (
    "src/context-layers/qscope-bom-wind-observation-model-v1.js",
    "src/context-layers/qscope-bom-wind-observations-operational-v1.js",
    "src/qscope-bom-wind-observations-v1.css",
)
UI_START = "      <!-- Official station-observed wind; separate from passive radar wind alerts. -->"
UI_END = '      <div class="layer-row basemap-row"'
DIALOG_START = "    <!-- OFFICIAL OBSERVED WIND CARD -->"
DIALOG_END = "    <!-- SIG_RAIN_CARD_START -->"
JS_IMPORT = (
    'import {initialiseOperationalBomWindObservations} from '
    '"./context-layers/qscope-bom-wind-observations-operational-v1.js?v='
    + VERSION + '";\n'
)
JS_INIT = (
    "\n// Independent measured BoM ground winds: does not modify passive "
    "wind alerts or radar.\n"
    "try{initialiseOperationalBomWindObservations({viewer});}\n"
    'catch(error){console.warn("BoM observed wind layer unavailable",error);}\n'
)

def once(body: str, old: str, new: str, name: str) -> str:
    if body.count(old) != 1:
        raise ValueError(f"BoM wind additive {name} anchor count: {body.count(old)}")
    return body.replace(old, new, 1)

def cache_bust(page: str, pattern: str, name: str) -> str:
    matches = list(re.finditer(pattern, page))
    if len(matches) != 1:
        raise ValueError(f"BoM wind {name}: expected exactly one cache reference")
    hit = matches[0]
    return page[:hit.end(1)] + "-" + VERSION + page[hit.end(1):]

def main() -> None:
    if not (SITE / "BUILD.txt").is_file():
        raise ValueError("The accepted production site must be assembled first")
    marker = (SITE / "BUILD.txt").read_text(encoding="utf-8")
    if "Q-SCOPE ACCEPTED MAIN WIND EVENTS V10.6.8" not in marker:
        raise ValueError("Accepted passive-wind addon must remain in place")
    if "BO_M WIND OBSERVATION PRODUCT" in marker:
        raise ValueError("The BoM observation overlay is already installed")

    original_html = (SOURCE / "live3d-operational-v9.html").read_text(encoding="utf-8")
    if original_html.count(UI_START) != 1 or original_html.count(UI_END) != 1:
        raise ValueError("Observation menu component is missing")
    if original_html.count(DIALOG_START) != 1 or original_html.count(DIALOG_END) != 1:
        raise ValueError("Observation report component is missing")
    menu = original_html[original_html.index(UI_START):original_html.index(UI_END)]
    dialog = original_html[original_html.index(DIALOG_START):original_html.index(DIALOG_END)]
    needed = ('showBomWindObservations', 'openBomWindGustReport',
              'bomWindObservationsStatus', 'bomWindGustReportRows')
    for control in needed:
        if menu.count(control) + dialog.count(control) < 1:
            raise ValueError(f"Missing required observed-wind control {control}")
    for file in MODULES:
        if not (SOURCE / file).is_file():
            raise ValueError(f"Missing isolated BoM wind module {file}")

    html_path = SITE / "live3d-operational-v9.html"
    js_path = SITE / "src/live3d-operational-v9.js"
    index_path = SITE / "index.html"
    html = html_path.read_text(encoding="utf-8")
    js = js_path.read_text(encoding="utf-8")
    index = index_path.read_text(encoding="utf-8")
    # The accepted production builder already sources the official-warning
    # menu fragment from frontend. That fragment may include this new WIND row.
    # Reuse it once: never add a second checkbox or detach it from Severe Weather.
    has_menu = 'id="showBomWindObservations"' in html
    if "showBomWindObservations" in js or "showBomWindObservations" in index:
        raise ValueError("Unexpected pre-existing wind runtime")
    if 'id="bomWindGustReport"' in html or 'id="bomWindObservationInfo"' in html:
        raise ValueError("Observation report mounted before isolated release overlay")
    if has_menu:
        for control in ("showBomWindObservations", "openBomWindGustReport",
                        "bomWindObservationsStatus"):
            if html.count('id="' + control + '"') != 1:
                raise ValueError("Duplicated source-derived wind menu ID " + control)
        if not (html.index('id="severeWeatherDetails"') <
                html.index('id="showBomWindObservations"') <
                html.index('id="rainfallObservationsDetails"')):
            raise ValueError("Wind control is not inside the approved Severe Weather menu")
    if not all(item in js for item in (
        "PUBLISHED_PRODUCTION_RUNTIME",
        "initialiseOperationalSignificantRainfall({viewer})",
        "qscopeOperationalWindEvents.queueWindow(mode,frames.length)")):
        raise ValueError("Expected operator-accepted runtime not found")
    if "id=\"severeWeatherDetails\"" not in html or (
        'id="officialBomWarningsStatus"' not in html):
        raise ValueError("Expected severe-weather source status not found")

    # The report and observations appear in the existing severe-weather area.
    # Never alter warning controls themselves or move basemap/navigation.
    status = re.search(r'<div id="officialBomWarningsStatus"[^>]*>[^<]*</div>', html)
    if not status or html.count('id="officialBomWarningsStatus"') != 1:
        raise ValueError("Original BoM warning status anchor missing")
    if not has_menu:
        html = html[:status.end()] + "\n" + menu.rstrip() + html[status.end():]
    html = once(html, DIALOG_END, dialog + DIALOG_END, "report placement")
    stylesheet = (
        '<link rel="stylesheet" href="./src/qscope-bom-wind-observations-v1.css?v='
        + VERSION + '">'
    )
    html = once(html, "</head>", "  " + stylesheet + "\n</head>", "isolated stylesheet")
    html = cache_bust(
        html, r'(src="\./src/live3d-operational-v9\.js\?v=[^"]+)',
        "operator module"
    )
    index = cache_bust(
        index, r'(src="\./live3d-operational-v9\.html\?v=[^"]+)',
        "outer frame"
    )
    original_runtime = js
    js = JS_IMPORT + js
    js = once(
        js, 'initialiseOperationalSignificantRainfall({viewer});',
        'initialiseOperationalSignificantRainfall({viewer});' + JS_INIT,
        "post-rainfall observation mount",
    )
    assert js.replace(JS_IMPORT, "", 1).replace(JS_INIT, "", 1) == original_runtime, (
        "Existing accepted runtime changed outside the isolated observation addon"
    )
    for control in ("showBomWindObservations", "openBomWindGustReport",
                    "bomWindObservationInfo", "bomWindGustReport"):
        if html.count('id="' + control + '"') != 1:
            raise ValueError("Missing/duplicated observed wind control " + control)
    for control in ("showOfficialBomWarnings", "openOfficialBomWarningGroups",
                    "showRiverGauges", "showSignificantRainfall", "resetButton"):
        if html.count('id="' + control + '"') != 1:
            raise ValueError("Accepted weather or navigation control changed " + control)

    for file in MODULES:
        dest = SITE / file
        dest.parent.mkdir(exist_ok=True, parents=True)
        shutil.copyfile(SOURCE / file, dest)
    html_path.write_text(html, encoding="utf-8")
    js_path.write_text(js, encoding="utf-8")
    index_path.write_text(index, encoding="utf-8")
    with (SITE / "BUILD.txt").open("a", encoding="utf-8") as build:
        build.write("BO_M WIND OBSERVATION PRODUCT " + VERSION +
                    " | ON-DEMAND STATION PEAKS | PASSIVE ALERTS UNTOUCHED\n")

if __name__ == "__main__":
    main()
