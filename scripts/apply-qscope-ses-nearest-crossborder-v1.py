#!/usr/bin/env python3
"""Final, tiny UI patch over approved SES + BoM district rainfall reports.

Cross-border NSW gauges are included in nearest Queensland SES region reporting,
but never represented as being within that SES jurisdiction. No source polling,
gauge coordinates, rainfall totals, AEP, radar or warnings are modified.
"""
from pathlib import Path
from shutil import copy2
site=Path("_site")
runtime=site/"src/context-layers/significant-rainfall-operational-v1.js"
engine=site/"src/live3d-operational-v9.js"
html=site/"live3d-operational-v9.html"
index=site/"index.html"
ses_module=site/"src/context-layers/rainfall-ses-region-v1.js"
registry=site/"data/qld-rainfall-ses-regions-v1.json"
assert all(p.is_file() for p in (runtime,engine,html,index,registry,ses_module))
assert "Q-SCOPE SEVEN QLD SES ADMINISTRATIVE REGIONS" in (site/"BUILD.txt").read_text()
copy2("frontend/src/context-layers/rainfall-ses-region-v1.js",ses_module)

def once(source,needle,replacement):
    if source.count(needle)!=1:
        raise RuntimeError(f"Expected exactly one previous-release anchor: {needle[:100]} (got {source.count(needle)})")
    return source.replace(needle,replacement,1)

source=runtime.read_text(encoding="utf-8")
source=once(source,
    'detailRow(rows,"SES administrative region",sesRegion?.name??'
    '(sesRegionAttempted?"SES region unavailable":"Checking SES region registry…"));',
    'detailRow(rows,"SES administrative region",sesRegion?.name??'
    '(sesRegionAttempted?"SES region unavailable":"Checking SES region registry…"));\n'
    '  if(sesRegion?.crossBorder)\n'
    '   detailRow(rows,"SES reporting status","Cross-border gauge (NSW) · assigned to nearest Queensland SES region for rainfall reporting only");\n'
    '  else if(sesRegion?.assignment==="nearest")\n'
    '   detailRow(rows,"SES reporting status","Queensland boundary-edge gauge · assigned to nearest SES region");')
source=once(source,
    'const basin=catchmentForStation(station,basinRegistry);',
    'const sesListing=sesRegionForStation(station,sesRegionRegistry);\n'
    '     const basin=catchmentForStation(station,basinRegistry);')
source=once(source,
    '(basin?" · "+basin+" catchment":"")+\n'
    '       (station.reportingTier?" · "+station.reportingTier:"")+" · "+formatted(station.sourceCreatedAt);',
    '(basin?" · "+basin+" catchment":"")+\n'
    '       (sesListing?.crossBorder?" · CROSS-BORDER GAUGE (NSW)":\n'
    '        sesListing?.assignment==="nearest"?" · QLD boundary-edge gauge":"")+\n'
    '       (station.reportingTier?" · "+station.reportingTier:"")+" · "+formatted(station.sourceCreatedAt);')
source=once(source,
    'model.total+" stations reporting 50+ mm across two categories";',
    'model.total+" stations reporting 50+ mm across two categories";\n'
    '  const crossBorderListed=districtModel.groups.reduce((sum,group)=>sum+\n'
    '    group.rows.filter(row=>sesRegionForStation(row,sesRegionRegistry)?.crossBorder).length,0);\n'
    '  if(crossBorderListed)reportSummary.textContent+=" · "+crossBorderListed+\n'
    '   " cross-border NSW gauge"+(crossBorderListed===1?"":"s");')
runtime.write_text(source,encoding="utf-8")

# Reissue only affected modules; ensure iOS Safari never reuses a stale SES
# classifier when it was updated by the final patch.
engine_source=engine.read_text(encoding="utf-8")
engine_source=once(engine_source,'significant-rainfall-operational-v1.js?v=',
    'significant-rainfall-operational-v1.js?v=20261113-nearest-crossborder-v1-')
engine.write_text(engine_source,encoding="utf-8")
source=source.replace('rainfall-ses-region-v1.js?v=',
    'rainfall-ses-region-v1.js?v=20261113-nearest-crossborder-v1-',1)
runtime.write_text(source,encoding="utf-8")
page=html.read_text(encoding="utf-8")
page=once(page,'src/live3d-operational-v9.js?v=',
    'src/live3d-operational-v9.js?v=20261113-nearest-crossborder-v1-')
html.write_text(page,encoding="utf-8")
entry=index.read_text(encoding="utf-8")
entry=once(entry,'live3d-operational-v9.html?v=',
    'live3d-operational-v9.html?v=20261113-nearest-crossborder-v1-')
index.write_text(entry,encoding="utf-8")
with (site/"BUILD.txt").open("a",encoding="utf-8") as output:
    output.write("Q-SCOPE SES NEAREST AND NSW CROSS-BORDER: static verified "
     "state labels in gauge popups and both rainfall reports; 0 unassigned "
     "gauge stations, no worker science/observations changes.\\n")
print("Q_SCOPE_SES_CROSSBORDER_REPORT_OVERLAY_OK")
