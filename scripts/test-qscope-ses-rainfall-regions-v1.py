#!/usr/bin/env python3
"""Offline geometry/contract regression; never contacts SES or BoM."""
import importlib.util
from pathlib import Path
script=Path(__file__).with_name("build-qscope-ses-rainfall-regions-v1.py")
spec=importlib.util.spec_from_file_location("ses_region_builder",script)
ses=importlib.util.module_from_spec(spec)
spec.loader.exec_module(ses)
box=[(150,-28),(154,-28),(154,-25),(150,-25),(150,-28)]
assert ses.point_in_ring(152,-26,box)
assert not ses.point_in_ring(149,-26,box)
assert ses.point_in_polygon(152,-26,[box])
hole=[(151,-27),(153,-27),(153,-26),(151,-26),(151,-27)]
assert not ses.point_in_polygon(152,-26.5,[box,hole])
assert ses.point_in_geometry(152,-26,{"type":"MultiPolygon","coordinates":[[box]]})
assert ses.normalize_region("south eastern region")=="South Eastern Region"
assert ses.normalize_region("Brisbane")=="Brisbane Region"
features=[]
for i,name in enumerate(ses.REGIONS):
    bottom=-28+i*2.5
    poly=[(149,bottom),(153,bottom),(153,bottom+2.5),(149,bottom+2.5),(149,bottom)]
    features.append({"type":"Feature","properties":{"SES_Region":name},
                     "geometry":{"type":"Polygon","coordinates":[poly]}})
regions=ses.validated_regions(features)
assert len(regions)==7
stations={}
for i in range(400):
    index=i%7
    stations[str(500000+i)]={"latitude":-26.75+index*2.5,"longitude":150}
registry={"schema":"StormTrackerBoMQldRainfallBasinsV1","stations":stations}
result=ses.build(registry,regions,"official-fixture")
assert result["matchedStationCount"]==400
assert len(set(x["region"] for x in result["stations"].values()))==7
try:
    ses.validated_regions(features[:-1])
    raise AssertionError("Missing official SES region erroneously accepted")
except ValueError:
    pass
print("PASS official seven SES region geometry, station matching and source contracts")
