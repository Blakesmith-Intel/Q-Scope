#!/usr/bin/env bash
set -euo pipefail

# Source pins checked out by CI: accepted V10.2.0, sealed V9.20.2 rollback and immutable V9.18 QA. Never build root implicitly from main.
# Exactly the same deterministic package is built in PR dry-runs and Pages deploys.
set -euo pipefail
python checked/production-v10.2.0/scripts/build-nsw-radar-places.py \
  --output checked/production-v10.2.0/frontend/data/nsw-radar-places-v1.json
python - <<'PY'
import json
from pathlib import Path
p=Path("checked/production-v10.2.0/frontend/data/nsw-radar-places-v1.json")
data=json.loads(p.read_text(encoding="utf-8"))
assert data.get("schema")=="StormTrackerNSWRadarPlacesV1"
assert len(data.get("places",[]))>=500
assert p.stat().st_size<300000
PY

set -euo pipefail
production="checked/production-v10.2.0/frontend"
accepted="checked/accepted-v9.18/frontend"
preview="_site/preview/radar-history-fix"
mkdir -p _site "$preview/data" "_site/data"

# Sealed root is always generated from its immutable V10.2.0 release source.
for asset in index.html live3d-operational-v9.html app.css src 3d-models; do
  cp -a "$production/$asset" "_site/$asset"
done
cp "$production/data/nsw-radar-places-v1.json" "_site/data/"
printf 'SEALED StormTracker V10.2.0 source %s\n' \
  '047b3bd1c66b0ed5f070d2298202f46d0cd8dae2' > _site/BUILD.txt

# Apply ONLY the post-seal river-history recovery fix to the published copy.
# Checked V10.2 source remains immutable; every other production asset is
# still taken unchanged from its approved source snapshot. Do not overwrite
# accepted V9.18 or experimental V10.3 preview assets.
python - <<'PY'
from pathlib import Path
from shutil import copyfile

site = Path("_site")
source = Path("frontend/src/context-layers")
layers = site / "src/context-layers"
for filename in ("significant-rainfall-source-v1.js", "significant-rainfall-operational-v1.js", "significant-rainfall-report-v1.js", "river-gauge-notable-report-v1.js", "river-crossing-state-v1.js", "agency-source-time-v1.js", "severity-marker-layer-v1.js", "bom-recent-river-history-v1.js", "river-gauge-layer-v1.js", "river-gauge-latest-v1.js", "river-flood-thresholds-v1.js", "river-flood-stages-2026-full-v1.js", "river-gauges-operational-v1.js", "river-flood-signals-v1.js", "river-gauge-coastal-screen-v1.js", "river-official-flood-persistence-v1.js", "river-flood-events-v1.js", "river-gauges-v1.js", "river-gauge-observations-v1.js", "power-outages-v1.js", "power-outages-operational-v1.js", "power-outage-suburb-explorer-v1.js", "power-outage-suburb-model-v1.js", "outage-lga-spatial-v2.js", "outage-lga-geographic-fallback-v1.js", "incident-lga-model-v1.js", "flood-road-closures-v1.js", "flood-road-closure-filter-v1.js", "road-closure-lga-explorer-v1.js", "road-ownership-report-v1.js", "bom-qld-warning-product-catalogue-v1.js", "bom-warning-cap-source-v1.js", "bom-warning-terrain-imagery-v1.js", "bom-warning-operational-v1.js"):
    copyfile(source / filename, layers / filename)
# Hotfix ONLY the Doppler source transport module, not the sealed playback
# engine, 3-D renderer, site catalogue, timeline or Doppler science.
# Extend ONLY the existing road explorer with a separate ownership report.
# Use a verified fragment, not a replacement of the sealed dashboard HTML.
road_page=site / "live3d-operational-v9.html"
document=road_page.read_text(encoding="utf-8")
source_page=Path("frontend/live3d-operational-v9.html").read_text(encoding="utf-8")
button='<button id="openRoadTypeReport" type="button" aria-haspopup="dialog" aria-controls="roadTypeReport">Road types report</button>'
opening='<style>\n#roadTypeReport:not([open])'
ending='<dialog id="powerOutageExplorer"'
assert source_page.count(button)==1 and source_page.count(opening)==1
fragment=source_page[source_page.index(opening):source_page.index(ending)]
assert fragment.count('id="roadTypeReport"')==1
old_button='<button id="refreshRoadLgaExplorer" type="button">Refresh</button>'
assert document.count(old_button)==1 and document.count(ending)==1
assert 'id="roadTypeReport"' not in document
document=document.replace(old_button,old_button+"\n    "+button,1)
document=document.replace(ending,fragment+ending,1)
road_page.write_text(document,encoding="utf-8")

# Opt-in official warning UI: append ONLY new controls, popup and compact styles
# to the immutable foundation. Never replace other operator panels.
source_page=Path("frontend/live3d-operational-v9.html").read_text(encoding="utf-8")
road_page=site / "live3d-operational-v9.html"
document=road_page.read_text(encoding="utf-8")
label='<div class="layer-row official-bom-warnings-row">'
label_end='<div class="layer-row basemap-row">'
panel='<section id="officialBomWarningInfo"'
panel_end='<section id="floodRoadClosureInfo"'
css='<style>\n.official-bom-warnings-row'
css_end='</style>'
assert source_page.count(label)==1 and source_page.count(panel)==1 and source_page.count(css)==1
assert document.count(label)==0 and document.count(panel)==0
ui=source_page[source_page.index(label):source_page.index(label_end)]
info=source_page[source_page.index(panel):source_page.index(panel_end)]
styling=source_page[source_page.index(css):source_page.index(css_end,source_page.index(css))+len(css_end)]
base_label='<div class="layer-row basemap-row">'
base_panel='<section id="floodRoadClosureInfo"'
assert document.count(base_label)==1 and document.count(base_panel)==1
document=document.replace(base_label,ui+base_label,1)
document=document.replace(base_panel,info+base_panel,1)
document=document.replace('<dialog id="roadLgaExplorer"',styling+'\n<dialog id="roadLgaExplorer"',1)
road_page.write_text(document,encoding="utf-8")

# The on-screen affected LDMG/DDMG report belongs to the optional warning
# panel; insert it separately, never into the road closures report fragment.
document=road_page.read_text(encoding="utf-8")
report_start='<dialog id="officialBomWarningGroupsReport"'
report_end='<dialog id="detailsDialog"'
assert source_page.count(report_start)==1 and source_page.count(report_end)==1
assert document.count(report_start)==0 and document.count(report_end)==1
fragment=source_page[source_page.index(report_start):source_page.index(report_end)]
document=document.replace(report_end,fragment+report_end,1)
road_page.write_text(document,encoding="utf-8")

copyfile(Path("frontend/src/bom-doppler-intake-v3.js"),
         site / "src/bom-doppler-intake-v3.js")
# Production-only native Doppler handover stability overlay; sealed science,
# primary playback, hi-res WMTS and other operational layers are unchanged.
copyfile(Path("frontend/src/multi-doppler-display-v1.js"),
         site / "src/multi-doppler-display-v1.js")
copyfile(Path("frontend/src/native-doppler-image-v1.js"),
         site / "src/native-doppler-image-v1.js")
# Single deduplicated QLD settlement layer in production: two official
# place feeds sometimes label one remote town at its town and LGA centroid.
for name in ("qld-town-label-layer-v1.js","qld-town-label-declutter-v1.js"):
    copyfile(source / name, layers / name)
# Replace only the WMTS source-time lookup (not sealed radar renderer/3D)
# with exact 9 timestamps from BoM's own published GetCapabilities.
for name in ("bom-wmts-loop-v2.js","bom-wmts-published-times-v1.js"):
    copyfile(Path("frontend/src") / name, site / "src" / name)
copyfile(Path("frontend/favicon.svg"),site / "favicon.svg")
for relative in ("index.html","live3d-operational-v9.html"):
    page=site / relative
    data=page.read_text(encoding="utf-8")
    assert data.count("<head>")==1
    page.write_text(data.replace("<head>",
        '<head>\n<link rel="icon" type="image/svg+xml" href="./favicon.svg">',1),
        encoding="utf-8")

suffix = "-river-history-nodata-v2-20261018-terrain-outline-v1-20261018-flood-gauge-refresh-v1-20261018-river-large-table-stream-v1-20261018-tidal-pattern-screen-v1-20261018-statewide-tidal-envelope-v1-20261018-inland-river-sensitive-v1-20261018-history-503-stream-deadline-v1-20261018-doppler-png-502-cooldown-v1-20261018-wmts-published-times-v1-20261018-walkerston-minor-persistence-v1-20261018-wmts-stale400-radar74-circuit-favicon-v1-20261018-qld-significant-rain-v1-20261018-richmond-real-palette-20261019-v3-wind-stability-20261019-v4-flood-freshness-20261019-10m-v1-flood-threshold-classification-20261020-v1-warilda-stage-all-gauges-v2-outage-geometry-lga-20261020-v1-bom-stage-1080-offline-v2-bom-2026-datum-verified-v1-safe-exact-station-2026-v2-datum-conflict-neutral-v1-official-2026-blank-cells-v1-single-source-2026-v1-new-beith-ahd-v2-severity-ordered-20261020-aep-keep-all-gauge-pairs-v2-20261021-flood-recovery-lifecycle-20261024-flood-crossings-station-20261024-v1-statewide-bridge-recovery-20261024-v2-crossing-report-completeness-v3-full-source-audit-v4-station-error-isolation-v5-flood-source-speed-64-v10.2.11-leading-zero-station-ids-v10.2.12-id-cache-recovery-v10.2.13-amber-theresa-bridge-v10.2.14-readable-legend-v10.2.15-flood-map-marker-size-v10.2.16-uniform-flood-map-markers-v10.2.17-source-ifd-v10.2.18-map-icons-match-legend-v10.2.19-single-flood-path-v10.2.20-final-pixel-contract-v10.2.21-safari-bitmap-v10.2.22-measured-rise-independent-tendency-v1-20261026-rolling-30min-measured-panel-v1-20261026-approaches-info-depth-20261027-v1-stale-road-depth-observation-20261027-v1-agency-time-formats-20261027-v1-road-ownership-report-20261027-v1-bom-warning-polygons-20261027-v1-live-idq21033-cap-source-20261028-v1-bom-warning-clear-report-20261028-v1-warning-imagery-promise-20261030-v1-warning-visible-20261030-v1-warning-camera-report-20261030-v1-detailed-storm-cells-source-20261030-v1-compact-vd-hazards-20261030-v1-warning-current-status-20261030-v1-four-idq-menu-20261030-v1-severe-weather-sidebar-20261030-v1-situational-collapse-20261030-v1-four-operational-sections-20261030-v1-cyclone-subsection-20261030-v1-multiple-systems-20261030-v1-unified-terrain-warning-polygon-20261102-v1"
def version_once(relative, needle):
    path = site / relative
    data = path.read_text(encoding="utf-8")
    assert data.count(needle) == 1, f"Expected one production source reference: {relative}"
    path.write_text(data.replace(needle, needle + suffix, 1), encoding="utf-8")

# Refresh the full import chain so existing browser sessions cannot silently
# reuse previously cached modules with the same query strings.
version_once("index.html", "-jasper-alfred-v1")
version_once("live3d-operational-v9.html", "-jasper-alfred-archive-v1")
version_once("live3d-operational-v9.html",
    "single-interface-v1.css?v=jasper-alfred-20261017-qa-v1")
version_once("src/live3d-operational-v9.js",
    "river-gauges-operational-v1.js?v=9.18.11-gauge-green-yellow-red-v2")
version_once("src/live3d-operational-v9.js",
    "bom-doppler-intake-v3.js?v=operational-v9-7")
version_once("src/live3d-operational-v9.js",
    "multi-doppler-display-v1.js?v=v10-wind-sites-20261017-sync-qa-v1")
version_once("src/live3d-operational-v9.js",
    "native-doppler-image-v1.js?v=9.16.14-hard-footer")
version_once("src/live3d-operational-v9.js",
    "qld-town-label-layer-v1.js?v=9.18.5-gazetteer-settle")
version_once("src/context-layers/qld-town-label-layer-v1.js",
    "qld-town-label-declutter-v1.js?v=9.16.12")
version_once("src/live3d-operational-v9.js",
    "bom-wmts-loop-v2.js?v=9.18.6-bounded-published-history")
# Background warming is optional: a rejected time should end that pass, not
# iterate nine stale source frames and spam the console. No science changes.
engine=site / "src/live3d-operational-v9.js"
data=engine.read_text(encoding="utf-8")
old='const relayUnavailable=pressureGuardActive &&\n        /HTTP (?:403|429|502|503|504)\\b/'
new='const relayUnavailable=pressureGuardActive &&\n        /HTTP (?:400|403|429|502|503|504)\\b/'
assert data.count(old)==1,"Expected one bounded radar prewarm error guard"
engine.write_text(data.replace(old,new,1),encoding="utf-8")
# Attach ONLY the new opt-in rainfall layer to the sealed operator runtime.
# This does not alter radar, cyclone, Doppler, tracking or 3D science.
rain_engine=Path("frontend/src/live3d-operational-v9.js").read_text(encoding="utf-8")
rain_import=('import {initialiseOperationalSignificantRainfall} from\n'
  '  "./context-layers/significant-rainfall-operational-v1.js?v=20261018-rain-v1";')
assert rain_engine.count(rain_import)==1
assert data.count('import {\n  initialiseOperationalQfdTechnicalRescues\n}')==1
data=data.replace('import {\n  initialiseOperationalQfdTechnicalRescues\n}',
  rain_import.replace('20261018-rain-v1','20261018-rain-v1-source-ifd-v10.2.18')+'\nimport {\n  initialiseOperationalQfdTechnicalRescues\n}',1)
rain_mount='initialiseOperationalSignificantRainfall({viewer});'
assert rain_engine.count(rain_mount)==1
mount_anchor='initialiseOperationalQfdTechnicalRescues({\n  viewer\n});'
assert data.count(mount_anchor)==1
data=data.replace(mount_anchor,mount_anchor+'\n'+rain_mount,1)

# Warning imagery remains below measured radar and independent of storm science.
warnings_import='import {initialiseOfficialBomWarningPolygons} from "./context-layers/bom-warning-operational-v1.js?v=20261102-unified-terrain-warning-polygon-v1";'
assert 'initialiseOfficialBomWarningPolygons' not in data
data=data.replace('import {\n  initialiseOperationalQfdTechnicalRescues\n}',warnings_import+'\nimport {\n  initialiseOperationalQfdTechnicalRescues\n}',1)
data=data.replace(mount_anchor,mount_anchor+'\ninitialiseOfficialBomWarningPolygons({viewer,CesiumRef:Cesium,getRadarLayer:()=>surfaceLayer,cameraController:mapCamera});',1)

# Only when the next selected UTC falls OUTSIDE the prior genuine site's
# measured 8-minute hold, give the extra site a bounded opportunity to finish
# its already warmed Cesium stage BEFORE committing the primary scan. This
# prevents a transient empty western site at each loop wrap; other steps keep
# the original 350ms wait. Source-true temporal matching remains unchanged.
handover='await waitForSecondaryWindPreparation(extrasPreparing);'
assert data.count(handover)==1,"Pinned native Doppler handover anchor changed"
data=data.replace(handover,
  'await waitForSecondaryWindPreparation(extrasPreparing, '+
  'supplementalDopplerDisplay.needsBoundaryWait(source.observedUtc) ? 2200 : 350);',1)
engine.write_text(data,encoding="utf-8")
version_once("src/context-layers/river-gauges-operational-v1.js",
    "river-gauge-layer-v1.js?v=9.18.11-flood-colour-20261015")
version_once("src/context-layers/river-gauge-layer-v1.js",
    "river-official-flood-persistence-v1.js?v=20261018-stage-persistence")
version_once("src/context-layers/river-official-flood-persistence-v1.js",
    "river-flood-thresholds-v1.js?v=20261020-new-beith-ahd-v2")
version_once("src/context-layers/river-gauge-layer-v1.js",
    "river-gauge-latest-v1.js?v=20261019-fresh-observation-v1")
version_once("src/context-layers/river-gauge-layer-v1.js",
    "river-flood-thresholds-v1.js?v=20261020-new-beith-ahd-v2")
version_once("src/context-layers/river-flood-thresholds-v1.js",
    "river-flood-stages-2026-full-v1.js?v=20261020-sls-2026-clean-v2")
version_once("src/context-layers/river-flood-signals-v1.js",
    "river-flood-thresholds-v1.js?v=20261020-new-beith-ahd-v2")
version_once("src/context-layers/river-gauge-observations-v1.js",
    "river-flood-thresholds-v1.js?v=20261020-new-beith-ahd-v2")
version_once("src/context-layers/river-gauge-layer-v1.js",
    "bom-recent-river-history-v1.js?v=9.13.1")
version_once("src/context-layers/river-gauge-layer-v1.js",
    "river-flood-signals-v1.js?v=9.13.2")
version_once("src/context-layers/river-gauge-layer-v1.js",
    "river-flood-events-v1.js?v=9.13.2")
version_once("src/context-layers/river-flood-events-v1.js",
    "river-flood-signals-v1.js?v=9.13.2")
version_once("src/context-layers/river-gauge-layer-v1.js",
    "river-gauge-observations-v1.js?v=9.12.0")
version_once("src/context-layers/river-gauge-layer-v1.js",
    "river-gauges-v1.js?v=9.12.0")
version_once("src/context-layers/river-gauge-observations-v1.js",
    "river-gauges-v1.js?v=9.12.0")
version_once("src/context-layers/river-gauges-operational-v1.js",
    "river-gauges-v1.js?v=9.12.0")
version_once("src/live3d-operational-v9.js",
    "flood-road-closures-operational-v1.js?v=sidebar-refresh-track-20261017-v1")
version_once("src/context-layers/flood-road-closures-operational-v1.js",
    "road-closure-lga-explorer-v1.js?v=last-refresh-20261017-v1")
version_once("src/live3d-operational-v9.js",
    "power-outages-operational-v1.js?v=council-customers-20261017-v1")
version_once("src/context-layers/power-outages-operational-v1.js",
    "power-outages-v1.js?v=background-incident-refresh-20261017-v1")
version_once("src/context-layers/power-outages-operational-v1.js",
    "power-outage-suburb-explorer-v1.js?v=council-customers-20261017-v1")
version_once("src/context-layers/power-outage-suburb-explorer-v1.js",
    "outage-lga-spatial-v2.js?v=outage-geometry-lga-20261020-v1")
# Invalidate ONLY the published flood-gauge module import chain after the
# measured history/rate fix. All other assets retain their approved cache keys.
gauge_cache_suffix="-bom-gauge-history-30to120-20261026-station-table-current-height-v2-informational-stale-rate-v1-source-evidence-expiry-v1-approaches-crossing-indicators-20261027-v1-approaches-info-depth-20261027-v1-stale-road-depth-observation-20261027-v1-agency-time-formats-20261027-v1"
for relative,needle in (
    ("index.html","-jasper-alfred-v1"+suffix),
    ("live3d-operational-v9.html","-jasper-alfred-archive-v1"+suffix),
    ("src/live3d-operational-v9.js",
        "river-gauges-operational-v1.js?v=9.18.11-gauge-green-yellow-red-v2"+suffix),
    ("src/context-layers/river-gauges-operational-v1.js",
        "river-gauge-layer-v1.js?v=9.18.11-flood-colour-20261015"+suffix),
    ("src/context-layers/river-gauge-layer-v1.js",
        "bom-recent-river-history-v1.js?v=9.13.1"+suffix),
    ("src/context-layers/river-gauge-layer-v1.js",
        "river-flood-signals-v1.js?v=9.13.2"+suffix),
    ("src/context-layers/river-gauge-layer-v1.js",
        "river-official-flood-persistence-v1.js?v=20261018-stage-persistence"+suffix),
    ("src/context-layers/river-gauge-layer-v1.js",
        "river-gauge-latest-v1.js?v=20261019-fresh-observation-v1"+suffix),
    ("src/context-layers/river-official-flood-persistence-v1.js",
        "river-flood-signals-v1.js?v=20261018-inland-rise"),
    ("src/context-layers/river-gauge-latest-v1.js",
        "river-flood-signals-v1.js?v=9.13.2"),
    ("src/context-layers/river-flood-events-v1.js",
        "river-flood-signals-v1.js?v=9.13.2"+suffix),
    ("src/context-layers/bom-recent-river-history-v1.js",
        "river-flood-signals-v1.js?v=9.13.0")
):
    path=site/relative
    data=path.read_text(encoding="utf-8")
    assert data.count(needle)==1, f"Expected one gauge source import: {relative}"
    path.write_text(data.replace(needle,needle+gauge_cache_suffix,1),
                    encoding="utf-8")

# Ensure the V10 pinned HTML uses the patched operational geometry modules.
# Both genuine closure lines and Energex outage polygons otherwise resolve to
# the obsolete, cached modules even after changes reach GitHub main.
version_once("src/live3d-operational-v9.js",
    "flood-road-closures-operational-v1.js?v=sidebar-refresh-track-20261017-v1")
version_once("src/context-layers/flood-road-closures-operational-v1.js",
    "flood-road-closures-v1.js?v=background-incident-refresh-20261017-v1")
version_once("src/context-layers/flood-road-closures-operational-v1.js",
    "flood-road-closures-v1.js?v=9.15.0-unplanned")
version_once("src/context-layers/flood-road-closures-operational-v1.js",
    "flood-road-closure-filter-v1.js?v=9.15.0-unplanned")
version_once("src/context-layers/flood-road-closures-v1.js",
    "flood-road-closure-filter-v1.js?v=9.15.0-unplanned")

# Overlay ONLY the missing manual refresh control, without replacing the
# pinned V10.2 HTML/CSS or altering its accepted operator layout.
from re import search
operator_html = Path("frontend/live3d-operational-v9.html").read_text(encoding="utf-8")
button_match=search(r'<button id="refreshRiverGaugesButton"[^>]*>[^<]*</button>',operator_html)
assert button_match, "Manual refresh control absent from maintenance source"
html_path=site / "live3d-operational-v9.html"
html=html_path.read_text(encoding="utf-8")
needle="Flood signals</label></div>"
assert html.count(needle)==1
# Replace the old rapid/tide-only legend while retaining pinned sidebar
# controls, positions, app shell and independent historical QA preview.
old_legend="<div id=\"riverGaugeSeverityLegend\" class=\"note flood-severity-legend\"><span class=\"flood-green\">●</span> Rapid above minor · <span class=\"flood-yellow\">●</span> Moderate · <span class=\"flood-red\">●</span> Major · <span class=\"flood-cyan\">●</span> Unusual tidal rise (screening)</div>"
legend_start=operator_html.index('<div id="riverGaugeSeverityLegend"')
legend_end=operator_html.index('<!-- SIG_RAIN_ROW_START -->',legend_start)
new_legend=operator_html[legend_start:legend_end].strip()
assert new_legend.count('data-flood-legend-state=')==6
assert 'data-flood-legend-state="crossing"' in new_legend
assert 'data-flood-legend-rapid-rise="true"' in new_legend
assert html.count(old_legend)==1, "Pinned production legend layout changed"
html=html.replace(old_legend,new_legend,1)
report_button=search(r'<button id="openFloodGaugeReport"[^>]*>[^<]*</button>',operator_html)
assert report_button, "Flood gauge report button absent from maintenance source"
html=html.replace(needle,"Flood signals</label>"+report_button.group(0)+
  button_match.group(0)+"</div>",1)
# Same flood controls row: the additional report action does NOT increase
# sidebar height or require a second map or a nested disclosure.

# Copy the two exact maintenance-source rainfall controls into pinned HTML;
# preserve the accepted one-screen sidebar and original panel ordering.
for start_tag,end_tag,anchor in (
  ("<!-- SIG_RAIN_ROW_START -->","<!-- SIG_RAIN_ROW_END -->",
   '<div class="layer-row qfd-rescue-row">'),
  ("<!-- SIG_RAIN_CARD_START -->","<!-- SIG_RAIN_CARD_END -->",
   '<section id="riverGaugeInfo"')):
    start=operator_html.index(start_tag)
    end=operator_html.index(end_tag,start)+len(end_tag)
    fragment=operator_html[start:end]
    assert html.count(anchor)==1
    html=html.replace(anchor,fragment+'\n    '+anchor,1)
# The new dialog is read-only and appended beside the existing rainfall modal,
# without changing any Cesium map, sidebar header, navigation or overlay.
flood_start="<!-- FLOOD_GAUGE_REPORT_START -->"
flood_end="<!-- FLOOD_GAUGE_REPORT_END -->"
assert operator_html.count(flood_start)==1 and operator_html.count(flood_end)==1
start=operator_html.index(flood_start)
end=operator_html.index(flood_end,start)+len(flood_end)
fragment=operator_html[start:end]
flood_anchor='<section id="riverGaugeInfo"'
assert html.count(flood_anchor)==1
html=html.replace(flood_anchor,fragment+'\n    '+flood_anchor,1)
# The sealed V10 shell is immutable. Patch only its EXISTING heading with
# the exact sidebar text link from the current accepted maintenance HTML.
# No new sidebar row, floating overlay, button or information panel.
guide_link_start='<a id="operatorGuideLink"'
assert operator_html.count(guide_link_start)==1
link_start=operator_html.index(guide_link_start)
link_end=operator_html.index('</a>',link_start)+len('</a>')
guide_link=operator_html[link_start:link_end]
assert html.count('<header class="dashboard-heading">')==1
assert html.count('id="operatorGuideLink"')==0
old_heading='<span>Live weather map</span></div></header>'
assert html.count(old_heading)==1
html=html.replace(old_heading,'<span>Live weather map</span></div>'+guide_link+'</header>',1)
html_path.write_text(html,encoding="utf-8")

style_source=Path("frontend/src/single-interface-v1.css").read_text(encoding="utf-8")
start=style_source.index("/* One-row flood gauge refresh:")
end=style_source.index("/* Historical cyclone forecast",start)
style=style_source[start:end]
assert "#refreshRiverGaugesButton" in style
style_path=site / "src/single-interface-v1.css"
with style_path.open("a",encoding="utf-8") as out:
    out.write("\n"+style)
    rain_style=style_source[style_source.index("/* Significant rainfall adds one compact row"):]
    assert ".significant-rainfall-row" in rain_style
    out.write("\n"+rain_style)

assert "initialiseOperationalSignificantRainfall({viewer})" in (
    site / "src/live3d-operational-v9.js").read_text()
assert "significantRainfallPeriod" in (
    site / "live3d-operational-v9.html").read_text()
assert "qualifiesRainfallSnapshot" in (
    layers / "significant-rainfall-source-v1.js").read_text()
assert 'id="openFloodGaugeReport"' in html
assert 'id="floodGaugeReport"' in html
assert 'id="floodGaugeReportRows"' in html
assert "buildNotableFloodGaugeReport" in (
    layers / "river-gauges-operational-v1.js").read_text()
assert "sourceFeatures" in (
    layers / "river-gauge-layer-v1.js").read_text()
assert "bindRiverGaugeManualRefresh(" in (
    layers / "river-gauges-operational-v1.js").read_text()
assert "recentNextAttemptAt" in (layers / "river-gauge-layer-v1.js").read_text()
assert "retainConfirmedFloodStations(" in (layers / "river-gauge-layer-v1.js").read_text()
assert "retainLatestGaugeObservations(" in (layers / "river-gauge-layer-v1.js").read_text()
assert "10 * 60 * 1000" in (layers / "river-gauges-v1.js").read_text()
assert "groupOutagesByVerifiedGeometry(" in (
    layers / "power-outage-suburb-explorer-v1.js").read_text()
assert "esriGeometryPolygon" in (layers / "outage-lga-spatial-v2.js").read_text()
assert "HISTORICAL_EXACT_ID_EXCEPTIONS" in (
    layers / "river-flood-thresholds-v1.js").read_text()
assert "BOM_2026_CLASSIFICATIONS" in (
    layers / "river-flood-thresholds-v1.js").read_text()
assert (layers / "river-gauge-latest-v1.js").exists()
assert (layers / "river-flood-thresholds-v1.js").exists()
assert (layers / "river-flood-stages-2026-full-v1.js").exists()
assert 'BOM_2026_CLASSIFICATIONS' in (layers / "river-flood-stages-2026-full-v1.js").read_text()
assert "STORMTRACKER_CLASSIFICATION_UNVERIFIED" in (layers / "river-flood-events-v1.js").read_text()
assert "canonicalBomRiverStationNumber(" in (layers / "river-gauges-v1.js").read_text()
assert "canonicaliseLegacyBoMStationCache(" in (layers / "river-gauge-layer-v1.js").read_text()
assert "OFFICIAL_FLOOD_STORAGE_KEY" in (layers / "river-official-flood-persistence-v1.js").read_text()
assert "STORMTRACKER_OBSERVATION_STALE" in (layers / "river-gauges-operational-v1.js").read_text() or "observationStale" in (layers / "river-gauges-operational-v1.js").read_text()
assert "publishedReflectivityTimes()" in (
    site / "src/bom-wmts-loop-v2.js").read_text() or (
    "publishedTimes()" in (site / "src/bom-wmts-loop-v2.js").read_text())
assert "parsePublishedReflectivityTimes" in (
    site / "src/bom-wmts-published-times-v1.js").read_text()
assert "WMTS_SOURCE_FRESHNESS_MS" in (
    site / "src/bom-wmts-loop-v2.js").read_text()
assert "unavailableTime.reject(observedUtc,region)" in (
    site / "src/bom-wmts-loop-v2.js").read_text()
assert "sourceFailures=new Map()" in (
    site / "src/bom-doppler-intake-v3.js").read_text()
assert "createDopplerFrameFailureCooldown" in (
    site / "src/bom-doppler-intake-v3.js").read_text()
assert "committedUtc=utc" in (
    site / "src/multi-doppler-display-v1.js").read_text()
assert "SECONDARY_WIND_PROVIDER_CACHE_SIZE=8" in (
    site / "src/multi-doppler-display-v1.js").read_text()
assert "stillMatches(s,frame)" in (
    site / "src/multi-doppler-display-v1.js").read_text()
assert "holdIsValid(s,utc)" in (
    site / "src/multi-doppler-display-v1.js").read_text()
assert "NATIVE_DOPPLER_ANNOTATION_START_ROW = 480" in (
    site / "src/native-doppler-image-v1.js").read_text()
assert "for (let col = 0; col < size; col++)" in (
    site / "src/native-doppler-image-v1.js").read_text()
assert "NATIVE_DOPPLER_STRICT_PALETTE_START_ROW" not in (
    site / "src/native-doppler-image-v1.js").read_text()
assert "if(maskAnnotationRows && isNativeDopplerDisplayAnnotationRow(row))continue;" not in (
    site / "src/native-doppler-image-v1.js").read_text()
assert "sameMappedRuralPlace(" in (
    site / "src/context-layers/qld-town-label-layer-v1.js").read_text()
assert "sameMappedRuralPlace(" in (
    site / "src/context-layers/qld-town-label-declutter-v1.js").read_text()
assert "75000" in (site / "src/bom-doppler-intake-v3.js").read_text()
assert "recentFloodHistoryGap" in (layers / "bom-recent-river-history-v1.js").read_text()
assert "if(explicitlyTidal && !classified && !lastConfirmed && !crossingReached)return null" in (layers / "bom-recent-river-history-v1.js").read_text()
assert "if(!classified && !lastConfirmed && !inland && !crossingReached)return null" in (layers / "bom-recent-river-history-v1.js").read_text()
assert "FLOOD_SIGNAL_MAX_INTERVAL_MS = 120 * 60 * 1000" in (layers / "river-flood-signals-v1.js").read_text()
assert "Rate unavailable — insufficient recent observations" in (layers / "river-gauges-operational-v1.js").read_text()
assert "const measuredRate=latestMeasuredRiseRate(" in (layers / "river-flood-events-v1.js").read_text()
assert ".slice(0,64)" in (layers / "river-gauge-layer-v1.js").read_text()
assert "inspectBomRecentWaterLevelTable" in (layers / "bom-recent-river-history-v1.js").read_text()
assert "noData" in (layers / "river-gauge-layer-v1.js").read_text()
assert 'const feature = idKey ? byId.get(idKey) : null' in (layers / "river-gauge-observations-v1.js").read_text()
assert 'uniqueNameIndex' not in (layers / "river-gauge-observations-v1.js").read_text()
assert 'STORMTRACKER_RAPID_RISE' in (layers / "river-flood-events-v1.js").read_text()
assert 'FLOOD_MARKER_COLORS' in (layers / "river-gauge-layer-v1.js").read_text()
assert 'crossing:"#f5a21b"' in (layers / "river-gauge-layer-v1.js").read_text()
assert 'state:"crossing"' in (layers / "river-flood-events-v1.js").read_text()
assert "observedTidalOscillation(" in (layers / "river-flood-signals-v1.js").read_text()
assert "NON_TIDAL_RAPID_RISE_M_PER_H = 0.30" in (layers / "river-flood-signals-v1.js").read_text()
assert "COASTAL_UNCERTAIN_RAPID_RISE_M_PER_H = 1.40" in (layers / "river-flood-signals-v1.js").read_text()
assert "gaugeRiseScreeningZone(" in (layers / "river-flood-signals-v1.js").read_text()
assert "INLAND_COAST_BUFFER_KM = 125" in (layers / "river-gauge-coastal-screen-v1.js").read_text()
assert "rateMatches && !tidal" in (layers / "river-flood-signals-v1.js").read_text()
map_marker=(layers / "river-gauge-layer-v1.js").read_text()
assert "riverGaugeMapMarkerDimensions()" in map_marker
assert "RIVER_GAUGE_MAP_MARKER_SIZE=Object.freeze({width:38,height:42})" in map_marker
assert "const urgent=" not in map_marker
assert "width: mapMarkerDimensions.width" in map_marker
assert "height: mapMarkerDimensions.height" in map_marker
assert "entity.stormTrackerFloodBillboard = {" in map_marker
assert "createRiverGaugeMapMarkerBitmap(state,rapidRise)" in map_marker
assert 'canvas.width=160;canvas.height=176;' in map_marker
assert 'canvas.toDataURL("image/png")' in map_marker
assert "markerImages.set(key,createRiverGaugeMapMarkerBitmap(state,rapidRise))" in map_marker
gpu_source=(layers / "severity-marker-layer-v1.js").read_text()
assert "FLOOD_PRIMITIVE_MARKER_SIZE=Object.freeze({width:38,height:42})" in gpu_source
assert 'options.sizeInMeters=false;' in gpu_source
assert 'delete options.scaleByDistance;' in gpu_source
assert 'options.scale=1;' in gpu_source
assert 'width="80" height="88" viewBox="0 0 80 88"' in map_marker
assert "billboard: {" not in map_marker[map_marker.index("function render("):map_marker.index("async function refresh(")], "Flood render must not create duplicate Cesium billboards"
assert "width: 38" not in map_marker
panel=(layers / "river-gauges-operational-v1.js").read_text()
assert "riverGaugePanelAppearance(summary)" in panel
assert 'icon.src=createRiverGaugeMarkerImage(state,rapid)' in panel
assert 'uniform-v10.2.22-safari-bitmap' in panel, 'Published mobile flood icon module must have the latest cache key'
assert 'data-flood-legend-state="crossing"' in html
assert 'flood-legend-grid' in html
assert 'flood-legend-grid' in style_source
assert "icon.src=appearance.image" in panel
assert "summary.tidalScreened" in panel
assert "#riverGaugeInfo .river-gauge-key img" in style
assert '#riverGaugeInfo[data-gauge-state="major"] .map-info-kicker' in style
assert 'blue' not in ""  # No flood classification or colour can override source IDs.

assert '"source_response_too_large"' in (layers / "bom-recent-river-history-v1.js").read_text()
power = (layers / "power-outages-v1.js").read_text()
assert "styleTerrainClampedPowerOutagePolygon(entity.polygon,unplannedColour)" in power
assert "entity.polygon\n          .outline =\n          true;" not in power
with (site / "BUILD.txt").open("a", encoding="utf-8") as record:
    record.write("RIVER-HISTORY MAINTENANCE HOTFIX 2026-10-18 (source main)\n")
    record.write("STATEWIDE TIDAL REFERENCE RAPID-RISE THRESHOLD 1.40 M_PER_H 2026-10-18\n")
    record.write("INLAND RAPID RISE 0.30 M_PER_H COASTAL 1.40 M_PER_H 125 KM 2026-10-18\n")
    record.write("RIVER-HISTORY NO-DATA V2 2026-10-18 (200 empty, source-format guarded)\n")
    record.write("TERRAIN-SAFE OUTAGE POLYGONS 2026-10-18 (Cesium outline disabled)\n")
    record.write("MANUAL FLOOD GAUGE REFRESH 2026-10-18 (compact Layers control)\n")
    record.write("FLOOD 10-MIN AUTO + FORCE MANUAL, LATEST VERIFIED HEIGHT, SEPARATE FLOOD CLASS 2026-10-19\n")
    record.write("BOUNDED STREAMING BOM RIVER TABLES 2026-10-18 (source main)\n")
    record.write("DOPPLER HISTORICAL PNG 502 RETRY COOLDOWN 75 SECONDS 2026-10-18\n")
    record.write("DOPPLER MULTISITE STABLE HANDOVER AND 112KM SOUTH COVERAGE 2026-10-19\n")
    record.write("DOPPLER FULL 128KM SOUTH FULL-PANEL PALETTE SCREENING + RURAL LABEL DEDUP 2026-10-19\n")
    record.write("RICHMOND REAL PIXEL PALETTE TOLERANCE ALL ROWS NO ROW 438 EXCLUSION 2026-10-19\n")
    record.write("RICHMOND DOPPLER CACHE VERSION V3 2026-10-19\n")
    record.write("DOPPLER MULTISITE SOURCE-STABLE STAGING EIGHT-FRAME LOOP CACHE 2026-10-19\n")
    record.write("WMTS ALL RADARS SOURCE-PUBLISHED TIME DIMENSION 2026-10-18 (no speculative timestamp probes)\n")
    record.write("WALKERSTON 533142 MINOR 2.75M STALE FLOOD CLASS PERSISTENCE 2026-10-18\n")
    record.write("ALL RADARS WMTS STALE TIME 400 ONE-TILE PREFLIGHT + IDR74 PNG SOURCE COOLDOWN 2026-10-18\n")
    record.write("FIRST-PARTY SVG FAVICON 2026-10-18\n")
    record.write("SOURCE-VERIFIED QLD SIGNIFICANT RAINFALL 9AM/1HR ORANGE 50-99.9 RED 100+ 2026-10-18\n")
    record.write("OPTIONAL RIVER HISTORY 503 MITIGATION 2026-10-18 (skip tagged tides, inland recovery, four serial requests, streamed deadline)\n")
    record.write("BOM ALL-GAUGE FLOOD PERSISTENCE ID-ONLY JOIN AND BLUE-RISE MODIFIER 2026-10-18\n")
    record.write("BOM TIDAL FALSE FLASH-RISE SUPPRESSION 2026-10-18 (source-tag and measured oscillation)\\n")
    record.write("MATCHING FLOOD GAUGE INFORMATION PANEL ICONS AND SEVERITY 2026-10-18\\n")
PY
# V10.2.1-current-source production UI hygiene. Never alter the immutable
# V10.2 base, morning flood/power fixes, or any historical QA preview.
python3 scripts/strip-production-cyclone-qa.py --site _site \
  --panel-source frontend/src/operational-cyclone-panel-v1.js
# The CURRENT cyclone panel is now an INLINE child of a separate Severe
# Weather sidebar disclosure. Never alter the archived cyclone preview,
# the accepted data source, map rendering or any existing listener ID.
python3 scripts/apply-severe-weather-sidebar-v1.py --site _site \
  --css-source frontend/src/severe-weather-sidebar-v1.css
grep -Fq 'id="severeWeatherDetails"' _site/live3d-operational-v9.html
grep -Fq 'id="situationalAwarenessDetails"' _site/live3d-operational-v9.html
grep -Fq '<summary class="section-title">◫ Situational Awareness Data</summary>' _site/live3d-operational-v9.html
grep -Fq 'SITUATIONAL AWARENESS DATA DISCLOSURE V10.2.34' _site/BUILD.txt
# V10.2.35 user-approved UI-only rearrangement runs on the verified V10.2.34
# site. It moves original controls, not listeners or scientific source modules.
python3 scripts/apply-four-section-menu-v1.py --site _site \
  --css-source frontend/src/four-section-menu-v1.css
grep -Fq 'FOUR-SECTION OPERATOR MENU V10.2.35' _site/BUILD.txt
# Present the original source-bound cyclone live checkbox and source status
# beside the Cyclones heading. The existing Details panel retains the real
# focus, source selector, refresh and BoM controls (no source logic changes).
python3 scripts/apply-cyclone-subsection-v1.py --site _site \
  --css-source frontend/src/cyclone-subsection-v1.css
grep -Fq 'CYCLONE SUBSECTION INLINE PRIMARY CONTROLS V10.2.36' _site/BUILD.txt
grep -Fq 'id="cycloneCurrentOverview"' _site/live3d-operational-v9.html
grep -Fq 'currentOverview.replaceChildren(line,status)' _site/src/internal-cyclone-live-qa-v1.js
# Current BoM GML feed already accepts multiple unique verified cyclone systems.
# Draw each separately with original geometry and show per-system BoM warning
# SOURCE LINKS (never derive a warning from the forecast track).
python3 scripts/apply-cyclone-multi-systems-v1.py --site _site
grep -Fq 'MULTI CYCLONE ORIGINAL TRACKS AND SEPARATE WARNING LINKS V10.2.36' _site/BUILD.txt
grep -Fq 'systemCards.id="internalCycloneSystems"' _site/src/internal-cyclone-live-qa-v1.js
# The scientific app import must fetch the current UI module on mobile,
# rather than a cached original V10.2.0 QA module.
python3 - <<'PYMULTICYCLONE'
from pathlib import Path
p=Path('_site/src/live3d-operational-v9.js')
s=p.read_text(encoding='utf-8')
old='./internal-cyclone-live-qa-v1.js?v=internal-original-gml-qa1'
assert s.count(old)==1, 'Cyclone verified original source import contract changed'
p.write_text(s.replace(old,
    './internal-cyclone-live-qa-v1.js?v=multi-issued-cyclones-20261030-v1',1),
    encoding='utf-8')
PYMULTICYCLONE
node --check _site/src/internal-cyclone-live-qa-v1.js
node --check _site/src/operational-cyclone-panel-v1.js
for menu in radarStormAnalysisDetails severeWeatherDetails rainfallObservationsDetails communityImpactsDetails; do
  grep -Fq "id=\"$menu\"" _site/live3d-operational-v9.html
done
grep -Fq 'id="mapStyleDetails"' _site/live3d-operational-v9.html
grep -Fq '<summary class="section-title">Community Impacts</summary>' _site/live3d-operational-v9.html
grep -Fq '<summary class="section-title">Rainfall Observations</summary>' _site/live3d-operational-v9.html
! grep -Fq 'id="situationalAwarenessDetails"' _site/live3d-operational-v9.html
grep -Fq 'BoM Severe Weather and Thunderstorm Warnings' _site/live3d-operational-v9.html
grep -Fq 'SEVERE WEATHER SIDEBAR HIERARCHY 2026-10-30 V10.2.33' _site/BUILD.txt
node --check _site/src/operational-cyclone-panel-v1.js
grep -Fq 'createOperationalCyclonePanel' _site/src/live3d-operational-v9.js
! grep -Fq 'createHistoricalCycloneForecastQA' _site/src/live3d-operational-v9.js
! grep -Fq 'cycloneUseJasper' _site/live3d-operational-v9.html
! grep -Fq 'cycloneUseAlfred' _site/live3d-operational-v9.html
! grep -Fq 'cycloneGmlFile' _site/live3d-operational-v9.html
test ! -d _site/data/cyclone-history
test ! -f _site/src/historical-cyclone-forecast-map-v1.js
grep -Fq 'PRODUCTION ACTIVE-ONLY CYCLONES 2026-10-18' _site/BUILD.txt
node --check _site/src/live3d-operational-v9.js
node --check _site/src/context-layers/river-gauges-operational-v1.js
node --check _site/src/context-layers/river-official-flood-persistence-v1.js
node --check _site/src/context-layers/river-gauge-latest-v1.js
node --check _site/src/context-layers/river-flood-thresholds-v1.js
node --check _site/src/context-layers/river-flood-stages-2026-full-v1.js
node --check _site/src/context-layers/outage-lga-spatial-v2.js
node --check _site/src/context-layers/power-outage-suburb-explorer-v1.js
grep -Fq 'flood-freshness-20261019-10m-v1' _site/index.html
grep -Fq '10 * 60 * 1000' _site/src/context-layers/river-gauges-v1.js
grep -Fq 'STORMTRACKER_CLASSIFICATION_UNVERIFIED' _site/src/context-layers/river-flood-events-v1.js
grep -Fq 'canonicalBomRiverStationNumber(' _site/src/context-layers/river-gauges-v1.js
grep -Fq 'canonicaliseLegacyBoMStationCache(' _site/src/context-layers/river-gauge-layer-v1.js
grep -Fq "WALKERSTON 533142 MINOR 2.75M STALE FLOOD CLASS PERSISTENCE 2026-10-18" _site/BUILD.txt
grep -Fq "retainConfirmedFloodStations(" _site/src/context-layers/river-gauge-layer-v1.js
grep -Fq "last-confirmed-bom-flood-class" _site/src/context-layers/river-flood-signals-v1.js
node --check _site/src/context-layers/significant-rainfall-source-v1.js
node --check _site/src/context-layers/significant-rainfall-operational-v1.js
grep -Fq 'SOURCE-VERIFIED QLD SIGNIFICANT RAINFALL 9AM/1HR ORANGE 50-99.9 RED 100+' _site/BUILD.txt
grep -Fq 'significantRainfallPeriod' _site/live3d-operational-v9.html
grep -Fq 'initialiseOperationalSignificantRainfall({viewer})' _site/src/live3d-operational-v9.js
node --check _site/src/bom-doppler-intake-v3.js
node --check _site/src/multi-doppler-display-v1.js
node --check _site/src/native-doppler-image-v1.js
node --check _site/src/context-layers/qld-town-label-layer-v1.js
node --check _site/src/context-layers/qld-town-label-declutter-v1.js
node --check _site/src/bom-wmts-loop-v2.js
node --check _site/src/bom-wmts-published-times-v1.js
grep -Fq 'WMTS ALL RADARS SOURCE-PUBLISHED TIME DIMENSION 2026-10-18' _site/BUILD.txt
grep -Fq 'wmts-published-times-v1-20261018' _site/src/live3d-operational-v9.js
grep -Fq 'ALL RADARS WMTS STALE TIME 400 ONE-TILE PREFLIGHT + IDR74 PNG SOURCE COOLDOWN' _site/BUILD.txt
grep -Fq 'FIRST-PARTY SVG FAVICON 2026-10-18' _site/BUILD.txt
grep -Fq 'WMTS_SOURCE_FRESHNESS_MS' _site/src/bom-wmts-loop-v2.js
grep -Fq 'sourceFailures=new Map()' _site/src/bom-doppler-intake-v3.js
grep -Fq 'wmts-stale400-radar74-circuit-favicon-v1-20261018' _site/src/live3d-operational-v9.js
grep -Fq 'href="./favicon.svg"' _site/index.html
grep -Fq 'href="./favicon.svg"' _site/live3d-operational-v9.html
test -s _site/favicon.svg
grep -Fq 'stopOnPermanent:true' _site/src/bom-wmts-loop-v2.js
grep -Fq 'DOPPLER HISTORICAL PNG 502 RETRY COOLDOWN 75 SECONDS' _site/BUILD.txt
grep -Fq 'createDopplerFrameFailureCooldown' _site/src/bom-doppler-intake-v3.js
grep -Fq 'doppler-png-502-cooldown-v1-20261018' _site/src/live3d-operational-v9.js
grep -Fq 'OPTIONAL RIVER HISTORY 503 MITIGATION 2026-10-18' _site/BUILD.txt
grep -Fq 'if(explicitlyTidal && !classified && !lastConfirmed && !crossingReached)return null' _site/src/context-layers/bom-recent-river-history-v1.js
grep -Fq 'if(!classified && !lastConfirmed && !inland && !crossingReached)return null' _site/src/context-layers/bom-recent-river-history-v1.js
grep -Fq '.slice(0,64)' _site/src/context-layers/river-gauge-layer-v1.js
grep -Fq 'id="refreshRiverGaugesButton"' _site/live3d-operational-v9.html
grep -Fq '#refreshRiverGaugesButton' _site/src/single-interface-v1.css
node --check _site/src/context-layers/river-gauge-layer-v1.js
node --check _site/src/context-layers/river-flood-signals-v1.js
node --check _site/src/context-layers/river-gauge-coastal-screen-v1.js
grep -Fq 'INLAND RAPID RISE 0.30 M_PER_H COASTAL 1.40 M_PER_H 125 KM' _site/BUILD.txt
node --check _site/src/context-layers/river-flood-events-v1.js
node --check _site/src/context-layers/river-gauges-v1.js
grep -Fq 'forecast_site_classification' _site/src/context-layers/river-gauges-v1.js
grep -Fq 'const feature = idKey ? byId.get(idKey) : null' _site/src/context-layers/river-gauge-observations-v1.js
! grep -Fq 'uniqueNameIndex' _site/src/context-layers/river-gauge-observations-v1.js
grep -Fq 'STORMTRACKER_RAPID_RISE' _site/src/context-layers/river-flood-events-v1.js
grep -Fq 'FLOOD_MARKER_COLORS' _site/src/context-layers/river-gauge-layer-v1.js
grep -Fq 'Bridge deck and supports' _site/src/context-layers/river-gauge-layer-v1.js
grep -Fq 'data-flood-legend-state="crossing"' _site/live3d-operational-v9.html
grep -Fq 'flood-legend-grid' _site/src/single-interface-v1.css
grep -Fq 'icon.src=createRiverGaugeMarkerImage(state,rapid)' _site/src/context-layers/river-gauges-operational-v1.js
grep -Fq 'state:"crossing"' _site/src/context-layers/river-flood-events-v1.js
grep -Fq 'BOM ALL-GAUGE FLOOD PERSISTENCE ID-ONLY JOIN' _site/BUILD.txt
grep -Fq 'BOM TIDAL FALSE FLASH-RISE SUPPRESSION 2026-10-18' _site/BUILD.txt
grep -Fq 'MATCHING FLOOD GAUGE INFORMATION PANEL ICONS AND SEVERITY 2026-10-18' _site/BUILD.txt
grep -Fq 'icon.src=appearance.image' _site/src/context-layers/river-gauges-operational-v1.js
grep -Fq '#riverGaugeInfo .river-gauge-key img' _site/src/single-interface-v1.css
grep -Fq 'observedTidalOscillation(' _site/src/context-layers/river-flood-signals-v1.js
grep -Fq 'rateMatches && !tidal' _site/src/context-layers/river-flood-signals-v1.js
node --check _site/src/context-layers/river-gauge-observations-v1.js
node --check _site/src/context-layers/bom-recent-river-history-v1.js
node --check _site/src/context-layers/power-outages-v1.js
node --check _site/src/context-layers/power-outages-operational-v1.js

# Identical recipe to the previously accepted QA preview:
# main frontend supplies path-activated rescue guards, accepted SHA
# overlays the tested radar, 3-D, basemap and river corrections.
for asset in index.html live3d-operational-v9.html app.css src 3d-models; do
  cp -a "frontend/$asset" "$preview/$asset"
done
cp "$production/data/nsw-radar-places-v1.json" "$preview/data/"
for filename in power-outages-operational-v1.js river-gauges-operational-v1.js flood-road-closures-operational-v1.js; do
  cp "$accepted/src/context-layers/$filename" "$preview/src/context-layers/"
  grep -Fq 'suppressHoverGpuPicking' "$preview/src/context-layers/$filename"
done
for filename in river-gauge-layer-v1.js basemap-manager-v1.js; do
  cp "$accepted/src/context-layers/$filename" "$preview/src/context-layers/"
done
for filename in storm-track-trail-visibility-v1.js multi-radar-display-v9.js radar-imagery-handover-v1.js supplemental-radar-volume-v1.js live3d-operational-v9.js; do
  cp "$accepted/src/$filename" "$preview/src/"
done
cp "$accepted/index.html" "$preview/"
cp "$accepted/live3d-operational-v9.html" "$preview/"
# Retain the accepted QA's original cone and networking code even after the
# next-baseline candidate advances these files on the maintenance branch.
for filename in adaptive-threat-cone-v1.js radar-source.js; do
  cp "$accepted/src/$filename" "$preview/src/"
done
cp "$accepted/src/operational-dashboard-v9-1.css" "$preview/src/"
printf 'ACCEPTED V9.18 diagnostic source %s\n' \
  'acfa0ebd3717a793369e3e887e2d1a54785620b7' > "$preview/BUILD.txt"

grep -Fq 'for(const target of candidates)' "$preview/src/context-layers/river-gauge-layer-v1.js"
grep -Fq 'adoptPrepared(entry.layer' "$preview/src/multi-radar-display-v9.js"
grep -Fq 'SUPPLEMENTAL_VOLUME_MAX_GLYPHS=1500' "$preview/src/supplemental-radar-volume-v1.js"
grep -Fq 'BOUNDED_RADAR_RECOVERY_QA' "$preview/src/live3d-operational-v9.js"
grep -Fq '/preview/radar-history-fix/' "$preview/src/radar-source.js"
grep -Fq '9.18.11-serial-gateway' "$preview/src/context-layers/river-gauges-operational-v1.js"
grep -Fq 'pixeltrack-prod-r1' "_site/index.html"
node --check "$preview/src/live3d-operational-v9.js"
node --check "_site/src/live3d-operational-v9.js"
test -s "$preview/data/nsw-radar-places-v1.json"
test -s "_site/data/nsw-radar-places-v1.json"
# V10.2.0 is now the public baseline. Do not keep a mutable candidate
# preview alongside the sealed root; historical accepted V9.18 QA stays.
grep -Fq 'PUBLISHED_PRODUCTION_RUNTIME' "_site/src/live3d-operational-v9.js"
grep -Fq 'persistentSatelliteCoverage:' "_site/src/live3d-operational-v9.js"
grep -Fq 'credibleMeasuredMotionAtObservation' "_site/src/adaptive-threat-cone-v1.js"
grep -Fq 'shouldPrepareSupplementalForPlayback' "_site/src/live3d-operational-v9.js"
grep -Fq 'minimumMeasuredReanchorKm:0.15' "_site/src/live3d-operational-v9.js"
grep -Fq 'id="sidebarToggle"' "_site/live3d-operational-v9.html"
grep -Fq 'id="trackLabelsScopeNote"' "_site/live3d-operational-v9.html"
grep -Fq '"#e53935"' "_site/src/context-layers/river-gauge-layer-v1.js"
grep -Fq '"#2db76f"' "_site/src/context-layers/river-gauge-layer-v1.js"
grep -Fq 'const suppressHoverGpuPicking' "_site/src/context-layers/power-outages-operational-v1.js"
grep -Fq 'const suppressHoverGpuPicking' "_site/src/context-layers/flood-road-closures-operational-v1.js"
grep -Fq 'const suppressHoverGpuPicking' "_site/src/context-layers/river-gauges-operational-v1.js"
grep -Fq 'isNetworkGuardPreview' "_site/src/radar-source.js"
node --check "_site/src/live3d-operational-v9.js"
node --check "_site/src/context-layers/basemap-manager-v1.js"
node --check "_site/src/radar-source.js"
node --check "_site/src/adaptive-threat-cone-v1.js"
# Optional ongoing delta-preview test route, independent of the
# immutable V10.2.0 production root. Archived V9.19.0 remains recoverable.
delta="_site/preview/incremental-3d"
mkdir -p "$delta/data"
for asset in index.html live3d-operational-v9.html app.css src 3d-models; do
  cp -a "frontend/$asset" "$delta/$asset"
done
cp "$production/data/nsw-radar-places-v1.json" "$delta/data/"
# Genuine BoM/Qld historical Koji and Yasi records are QA-only. NEVER
# publish them in the source-pinned live app as a current warning layer.
test -s "frontend/data/cyclone-history/koji-2026.json"
test -s "frontend/data/cyclone-history/yasi-2011.json"
for cyclone in alfred-2025 narelle-2026 jasper-2023; do
  test -s "frontend/data/cyclone-history/$cyclone.json"
done
cp -a "frontend/data/cyclone-history" "$delta/data/"
printf 'EXPERIMENTAL incremental 3-D QA source %s; separate from pinned V9.20.2 production\n' "$(git rev-parse HEAD)" > "$delta/BUILD.txt"
grep -Fq 'INCREMENTAL_VOLUME_PREVIEW' "$delta/src/live3d-operational-v9.js"
grep -Fq 'createIncrementalVolumeRenderer' "$delta/src/incremental-volume-renderer-v1.js"
grep -Fq 'incremental:INCREMENTAL_VOLUME_PREVIEW' "$delta/src/live3d-operational-v9.js"
node --check "$delta/src/incremental-volume-renderer-v1.js"
node --check "$delta/src/supplemental-radar-volume-v1.js"
node --check "$delta/src/live3d-operational-v9.js"
test -s "$delta/data/nsw-radar-places-v1.json"
test -s "$delta/data/cyclone-history/koji-2026.json"
test -s "$delta/data/cyclone-history/yasi-2011.json"
for cyclone in alfred-2025 narelle-2026 jasper-2023; do
  test -s "$delta/data/cyclone-history/$cyclone.json"
done
grep -Fq 'Koji 2026' "$delta/data/cyclone-history/koji-2026.json"
grep -Fq 'Yasi 2011' "$delta/data/cyclone-history/yasi-2011.json"
node --check "$delta/src/historical-cyclone-overlay-v1.js"
node --check "$delta/src/historical-cyclone-replay-v1.js"
# Independently pinned V10.3 wind/hook research preview. This MUST NOT
# replace the immutable V10.2.0 root or either existing historical QA route.
wind_source="checked/wind-hook-v10.3-qa/frontend"
wind_preview="_site/preview/wind-hook-v10-3"
test "$(git -C checked/wind-hook-v10.3-qa rev-parse HEAD)" = "f3a07688ca02f5f0234ae6425fc1177722518c53"
mkdir -p "$wind_preview/data"
for asset in index.html live3d-operational-v9.html app.css src 3d-models assets; do
  test -e "$wind_source/$asset"
  cp -a "$wind_source/$asset" "$wind_preview/"
done
cp "$production/data/nsw-radar-places-v1.json" "$wind_preview/data/"
cp -a "$wind_source/data/cyclone-history" "$wind_preview/data/"
echo "EXPERIMENTAL V10.3 wind-hook original radar QA source f3a07688ca02f5f0234ae6425fc1177722518c53; production sealed V10.2.0 untouched" > "$wind_preview/BUILD.txt"
grep -Fq 'wind-hook-v10-3/' "$wind_preview/src/live3d-operational-v9.js"
grep -Fq 'assessV10RadarFrame' "$wind_preview/src/live3d-operational-v9.js"
grep -Fq 'createOperationalCyclonePanel' "$wind_preview/src/live3d-operational-v9.js"
grep -Fq 'if (!windHookResearchEnabled) return' "$wind_preview/src/live3d-operational-v9.js"
grep -Fq 'createHistoricalCycloneForecastQA' "$wind_preview/src/live3d-operational-v9.js"
grep -Fq 'Original BoM' "$wind_preview/src/internal-cyclone-live-qa-v1.js"
grep -Fq '#F6D94F' "$wind_preview/src/wind-hook-research-v10.css"
grep -Fq '#FF963F' "$wind_preview/src/wind-hook-research-v10.css"
grep -Fq '#D83045' "$wind_preview/src/wind-hook-research-v10.css"
for icon in v10-gust.svg v10-hook.svg v10-tornado.svg; do
  test -s "$wind_preview/assets/$icon"
done
node --check "$wind_preview/src/live3d-operational-v9.js"
node --check "$wind_preview/src/severe-storm-v10.js"
node --check "$wind_preview/src/doppler-persistence-v10-3.js"
grep -Fq 'syncIndependentDopplerResearch' "$wind_preview/src/live3d-operational-v9.js"
grep -Fq 'previousDopplerState' "$wind_preview/src/live3d-operational-v9.js"
grep -Fq 'two sequential measured velocity scans' "$wind_preview/src/severe-storm-alert-overlay-v1.js"
node --check "$wind_preview/src/operational-cyclone-panel-v1.js"
# All three previews remain separate. QA is prohibited from the root runtime.
! grep -Fq 'isWindHookQaPreview' "_site/src/live3d-operational-v9.js"
test "$(find _site/preview -mindepth 1 -maxdepth 1 -type d | wc -l)" -eq 3

# Exact accepted V10.2.0 optimised renderer and memory bounds are deployed
# from the PINNED source, never from the evolving maintenance/QA branch.
grep -Fq 'const INCREMENTAL_VOLUME_PREVIEW =' "_site/src/live3d-operational-v9.js"
grep -Fq 'incrementalVolumeRenderer.upsert(pixelIndex,category,nextSpecs' "_site/src/live3d-operational-v9.js"
grep -Fq 'const showTrackVolumes = !INCREMENTAL_VOLUME_PREVIEW' "_site/src/live3d-operational-v9.js"
grep -Fq 'const retainedVolume=INCREMENTAL_VOLUME_PREVIEW' "_site/src/live3d-operational-v9.js"
grep -Fq 'function upsert(key,category,specs,create,patch)' "_site/src/incremental-volume-renderer-v1.js"
grep -Fq 'function pruneSites(selectedIds=[])' "_site/src/supplemental-radar-volume-v1.js"
grep -Fq 'v9.20.0-optimised-3d-prod' "_site/index.html"
grep -Fq 'v9.20.0-optimised-3d-prod' "_site/live3d-operational-v9.html"
node --check "_site/src/incremental-volume-renderer-v1.js"
node --check "_site/src/supplemental-radar-volume-v1.js"
node --check "_site/src/volume-display-opacity-v1.js"

# V10.2.0 preserves secondary-site volumetric display, real BoM >=40 dBZ only.
grep -Fq 'selectSupplementalVolumeSampleIndices' "_site/src/supplemental-radar-volume-v1.js"
grep -Fq 'hashSupplementalPixel' "_site/src/supplemental-volume-sampling-v1.js"
grep -Fq 'secondarySiteGlyphs' "_site/src/live3d-operational-v9.js"
grep -Fq 'v9.20.1-secondary-3d-fix' "_site/live3d-operational-v9.html"
grep -Fq 'v9.20.1-secondary-3d-fix' "_site/index.html"
node --check "_site/src/supplemental-volume-sampling-v1.js"

# V10.2.0 retains accepted QLD/NSW satellite continuity and quality lock.
grep -Fq 'GLOBAL_SATELLITE_FALLBACK' "_site/src/context-layers/basemap-manager-v1.js"
grep -Fq 'createGlobalSatelliteFallbackProvider' "_site/src/context-layers/basemap-manager-v1.js"
grep -Fq 'streetLayer.show=true' "_site/src/context-layers/basemap-manager-v1.js"
grep -Fq 'global-satellite-blue-gap-20261016-v1' "_site/src/live3d-operational-v9.js"
grep -Fq 'satellite-blue-gap-qa-v1' "_site/live3d-operational-v9.html"
grep -Fq 'satellite-blue-gap-qa-v1' "_site/index.html"
grep -Fq 'createVolumeCategoryProfileCache' "_site/src/live3d-operational-v9.js"
grep -Fq 'stageTotalBudgetMs' "_site/src/multi-radar-display-v9.js"
node --check "_site/src/context-layers/basemap-manager-v1.js"
node --check "_site/src/volume-category-profile-cache-v1.js"

# V10 accepted operator controls and genuine secondary-site native Doppler.
grep -Fq 'id="multiRadarDopplerStatus"' "_site/live3d-operational-v9.html"
grep -Fq 'single-interface-v1.css' "_site/live3d-operational-v9.html"
grep -Fq 'multisite-native-wind-v1' "_site/index.html"
grep -Fq 'createSupplementalDopplerDisplay' "_site/src/live3d-operational-v9.js"
grep -Fq 'MAX_SECONDARY_WIND_OFFSET_MINUTES=8' "_site/src/multi-doppler-display-v1.js"
node --check "_site/src/multi-doppler-display-v1.js"

# V10.2.0 source-clock atomic multi-site Doppler: the same prepare-then-
# commit boundary as rain radar, original BoM site UTC and Brewarrina IDR93I.
grep -Fq 'supplementalDopplerDisplay.prepare(source.observedUtc)' "_site/src/live3d-operational-v9.js"
grep -Fq 'supplementalDopplerDisplay.commit(source.observedUtc)' "_site/src/live3d-operational-v9.js"
grep -Fq 'function commit(utc)' "_site/src/multi-doppler-display-v1.js"
grep -Fq 'SECONDARY_WIND_FRAME_SYNC_WAIT_MS=350' "_site/src/multi-doppler-display-v1.js"
grep -Fq 'committedUtc=utc' "_site/src/multi-doppler-display-v1.js"
grep -Fq 'holdIsValid(s,utc)' "_site/src/multi-doppler-display-v1.js"
grep -Fq 'SECONDARY_WIND_PROVIDER_CACHE_SIZE=8' "_site/src/multi-doppler-display-v1.js"
grep -Fq 'needsBoundaryWait(source.observedUtc) ? 2200 : 350' "_site/src/live3d-operational-v9.js"
grep -Fq 'wind-stability-20261019-v4' "_site/src/live3d-operational-v9.js"
grep -Fq 'NATIVE_DOPPLER_ANNOTATION_START_ROW = 480' "_site/src/native-doppler-image-v1.js"
! grep -Fq 'NATIVE_DOPPLER_STRICT_PALETTE_START_ROW' "_site/src/native-doppler-image-v1.js"
grep -Fq 'richmond-real-palette-20261019-v3' "_site/index.html"
grep -Fq 'richmond-real-palette-20261019-v3' "_site/src/live3d-operational-v9.js"
! grep -Fq 'if(maskAnnotationRows && isNativeDopplerDisplayAnnotationRow(row))continue;' "_site/src/native-doppler-image-v1.js"
grep -Fq 'sameMappedRuralPlace(' "_site/src/context-layers/qld-town-label-layer-v1.js"
grep -Fq 'IDR93I' "_site/src/border-radar-sites-v1.js"

# V10.2.0 original source-issued cyclone forecast panel is deployed opt-in,
# with strictly separate "no cyclone" and "unable to verify" status.
grep -Fq 'id="openCycloneForecastQa"' "_site/live3d-operational-v9.html"
grep -Fq 'id="cycloneForecastQaPanel"' "_site/live3d-operational-v9.html"
grep -Fq 'createOperationalCyclonePanel' "_site/src/live3d-operational-v9.js"
! grep -Fq 'createHistoricalCycloneForecastQA' "_site/src/live3d-operational-v9.js"
grep -Fq 'createInternalCycloneLiveQA' "_site/src/live3d-operational-v9.js"
grep -Fq '"No current warnings"' "_site/src/internal-cyclone-live-qa-v1.js"
grep -Fq 'Cyclone forecast feed unavailable' "_site/src/internal-cyclone-live-qa-v1.js"
grep -Fq 'validateInternalCycloneSnapshot' "_site/src/internal-cyclone-live-qa-v1.js"
grep -Fq 'INCREMENTAL_VOLUME_PREVIEW' "_site/src/live3d-operational-v9.js"
node --check "_site/src/internal-cyclone-live-qa-v1.js"
node --check "_site/src/internal-cyclone-feed-v1.js"
node --check "_site/src/operational-cyclone-panel-v1.js"
test ! -f "_site/src/historical-cyclone-forecast-map-v1.js"
test ! -d "_site/data/cyclone-history"

# Regression: Hide controls must remove both sidebar grid tracks, not shrink map.
grep -Fq 'body.simple-ui #app.sidebar-collapsed' "_site/src/single-interface-v1.css"
grep -Fq 'grid-template-rows:minmax(0,1fr)' "_site/src/single-interface-v1.css"
grep -Fq 'full-map-controls-gauge-severity-v4' "_site/live3d-operational-v9.html"
grep -Fq 'hide-controls-full-map-v1' "_site/index.html"

# Post-regression production marker: only present after the build has passed.
printf '%s\n' 'FLOOD RECOVERY V10.2.9 — SOURCE-VERIFIED BELOW-MINOR CLEAR + STATION PRE-RISE REFERENCE 2026-10-24' >> _site/BUILD.txt

printf '%s\n' 'FLOOD CROSSING REPORT V10.2.10 — SOURCE-ID ONLY MODERATE MAJOR BRIDGE CAUSEWAY REFERENCES 2026-10-24' >> _site/BUILD.txt
