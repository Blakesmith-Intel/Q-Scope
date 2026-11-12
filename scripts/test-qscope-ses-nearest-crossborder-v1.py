#!/usr/bin/env python3
"""Offline exact nearest-SES, border-tagging and fail-closed tests."""
import importlib.util
from pathlib import Path

script=Path(__file__).with_name("build-qscope-ses-nearest-crossborder-v1.py")
spec=importlib.util.spec_from_file_location("ses_closest",script)
nearest=importlib.util.module_from_spec(spec)
spec.loader.exec_module(nearest)

def square(west,south,east,north):
    return {"type":"Polygon","coordinates":[[
      (west,south),(east,south),(east,north),(west,north),(west,south)
    ]]}
polygons={
 "South Western Region":[square(149,-28.5,151,-27.0)],
 "South Eastern Region":[square(152,-28.5,154,-27.0)],
}
source={
 "1":{"name":"Existing within SES","latitude":-27.5,"longitude":153.0},
 "2":{"name":"NSW gauge","latitude":-29.5,"longitude":150.0},
 "3":{"name":"Queensland edge","latitude":-27.0,"longitude":154.02}
}
seed={"schema":nearest.ses.SCHEMA,"stations":{
 "1":{"latitude":-27.5,"longitude":153.0,"region":"South Eastern Region"}}}
def state(lat,lon):
    return "NSW" if lat<-29 else "QLD"

out=nearest.assign_nearest(seed,source,polygons,state_lookup=state)
assert out["matchedStationCount"]==3
assert out["unmatchedStationCount"]==0
assert out["withinRegionCount"]==1
assert out["nearestAssignedCount"]==2
assert out["crossBorderCount"]==1
assert out["stations"]["1"]["region"]=="South Eastern Region"
assert out["stations"]["2"]["region"]=="South Western Region"
assert out["stations"]["2"]["crossBorder"] is True
assert out["stations"]["2"]["state"]=="NSW"
assert out["stations"]["2"]["distanceKm"]>0
assert out["stations"]["3"]["region"]=="South Eastern Region"
assert out["stations"]["3"]["crossBorder"] is False
assert out["stations"]["3"]["state"]=="QLD"
assert nearest.classify_station("540295",{
 "name":"STEIGLITZ WHARF ALERT","latitude":-27.745278,
 "longitude":153.353611},lookup=lambda lat,lon:None)[0]=="QLD"
try:
    nearest.classify_station("540354",{"name":"TOMEWIN ALERT",
        "latitude":-28.240556,"longitude":153.378333},lookup=lambda lat,lon:None)
    raise AssertionError("Unknown NSW/QLD state should block publication")
except ValueError:
    pass
assert nearest.classify_station("017123",{
    "name":"Moomba Airport","latitude":-28.0997,"longitude":140.1956
},lookup=lambda lat,lon:"SA")[0]=="SA"
print("PASS closest official SES polygon, NSW cross-border, QLD edge and unknown-state protections")
