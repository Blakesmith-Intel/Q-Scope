#!/usr/bin/env python3
"""Finalise SES rainfall station attribution by nearest official SES polygon.

Only the 35 (or current equivalent) gauges outside SES region footprints are
reassigned. Public BoM gauge IDs/coordinates are not changed. Official ABS
state/territory point queries distinguish NSW cross-border observations from
Queensland gauges. Runs in GitHub release build, never on rainfall refresh.
"""
import argparse
import concurrent.futures
import datetime as dt
import importlib.util
import json
import urllib.parse
import urllib.request
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Point, shape
from shapely.ops import transform

MODULE=Path(__file__).with_name("build-qscope-ses-rainfall-regions-v1.py")
spec=importlib.util.spec_from_file_location("official_ses_builder",MODULE)
ses=importlib.util.module_from_spec(spec)
spec.loader.exec_module(ses)

ABS_STATE_QUERY="https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/STE/MapServer/0/query"

def lookup_official_state(latitude,longitude):
    query=urllib.parse.urlencode({
        "f":"json",
        "geometry":json.dumps({"x":longitude,"y":latitude,"spatialReference":{"wkid":4326}},
                              separators=(",",":")),
        "geometryType":"esriGeometryPoint",
        "inSR":"4326",
        "spatialRel":"esriSpatialRelIntersects",
        "where":"state_code_2021 IN ('1','3','4','5','7')",
        "outFields":"state_code_2021,state_name_2021",
        "returnGeometry":"false"
    })
    req=urllib.request.Request(ABS_STATE_QUERY+"?"+query,headers={
        "User-Agent":"Q-Scope/1.0 (release-only ABS boundary lookup)",
        "Accept":"application/json"
    })
    with urllib.request.urlopen(req,timeout=30) as response:
        payload=json.loads(response.read(100001))
    if payload.get("error"):
        raise ValueError("ABS state lookup error: "+str(payload["error"])[:200])
    states=set()
    for feature in payload.get("features",[]):
        attrs={k.lower():v for k,v in feature.get("attributes",{}).items()}
        state=str(attrs.get("state_code_2021","")).strip()
        label=str(attrs.get("state_name_2021","")).strip()
        if state=="1" and label=="New South Wales":
            states.add("NSW")
        elif state=="3" and label=="Queensland":
            states.add("QLD")
        elif state=="4" and label=="South Australia":
            states.add("SA")
        elif state=="5" and label=="Western Australia":
            states.add("WA")
        elif state=="7" and label=="Northern Territory":
            states.add("NT")
        else:
            raise ValueError("Unexpected ABS state: "+repr(attrs))
    if len(states)>1:
        raise ValueError("Two official state polygons matched one gauge")
    return next(iter(states),None)

# Two known Queensland marine/coastal tide gauges may sit a few metres
# outside ABS land polygons. These narrowly pinned positions must NEVER be
# interpreted as NSW just because they fall outside a land-only boundary.
# Their inclusion here is a station/coordinate identity check, not a claim
# that the point itself lies within the ABS dry-land polygon.
QLD_COASTAL_EDGE_IDS={
    "540295":(-27.745278,153.353611), # Steiglitz Wharf Alert (Gold Coast)
    "540448":(-26.833611,153.120000), # Golden Beach Tide Alert (Sunshine Coast)
}

def classify_station(sid,station,lookup=lookup_official_state):
    lat,lon=station["latitude"],station["longitude"]
    official=lookup(lat,lon)
    if official in ("QLD","NSW","SA","NT","WA"):
        return official,"ABS state polygon"
    marker=QLD_COASTAL_EDGE_IDS.get(str(sid))
    if marker and abs(lat-marker[0])<0.001 and abs(lon-marker[1])<0.001:
        return "QLD","Verified Queensland coastal tide gauge"
    raise ValueError("Official jurisdiction unresolved for "+str(sid)+
                     " "+str(station.get("name",""))+" at "+str((lat,lon)))

def assign_nearest(initial,stations,polygons,state_lookup=lookup_official_state):
    registered=initial["stations"]
    pending=[(sid,station) for sid,station in stations.items() if sid not in registered]
    project=Transformer.from_crs("EPSG:4326","EPSG:3577",always_xy=True).transform
    shapes=[]
    for name,features in polygons.items():
        for feature in features:
            geometry=transform(project,shape(feature))
            if geometry.is_empty:
                raise ValueError("Empty SES polygon "+name)
            shapes.append((name,geometry))
    def classify(entry):
        sid,station=entry
        return sid,classify_station(sid,station,state_lookup)
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        states=dict(pool.map(classify,pending))
    for sid,station in pending:
        lat,lon=station["latitude"],station["longitude"]
        point=transform(project,Point(lon,lat))
        distances={}
        for name,geometry in shapes:
            distances[name]=min(distances.get(name,float("inf")),point.distance(geometry))
        distance,name=min((metres,name) for name,metres in distances.items())
        state,evidence=states[sid]
        registered[sid]={
            "latitude":lat,"longitude":lon,"region":name,
            "assignment":"nearest","state":state,"crossBorder":state!="QLD",
            "distanceKm":round(distance/1000,3),"stateEvidence":evidence,
        }
    if len(registered)!=len(stations):
        raise ValueError("Cannot release with unassigned gauges")
    initial["generatedUtc"]=dt.datetime.now(dt.timezone.utc).isoformat()
    initial["stateSource"]=ABS_STATE_QUERY
    initial["withinRegionCount"]=len(registered)-len(pending)
    initial["nearestAssignedCount"]=len(pending)
    initial["crossBorderCount"]=sum(bool(v.get("crossBorder")) for v in registered.values())
    initial["unmatchedStationCount"]=0
    initial["matchedStationCount"]=len(registered)
    return initial

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--stations",required=True)
    parser.add_argument("--out",required=True)
    args=parser.parse_args()
    stations=json.loads(Path(args.stations).read_text(encoding="utf-8"))
    features,source=ses.fetch_ses_regions()
    polygons=ses.validated_regions(features)
    result=ses.build(stations,polygons,source)
    result=assign_nearest(result,stations["stations"],polygons)
    path=Path(args.out)
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(result,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    print("Q_SCOPE_SES_NEAREST",result["nearestAssignedCount"],
          "CROSS_BORDER",result["crossBorderCount"],
          "COVERED",result["matchedStationCount"],
          "UNASSIGNED",result["unmatchedStationCount"])
    for sid,row in sorted(result["stations"].items()):
        if row.get("assignment")=="nearest":
            print("NEAREST_SES",sid,
                  stations["stations"][sid]["name"],
                  "STATE",row["state"],"REGION",row["region"],
                  "DISTANCE_KM",row["distanceKm"],
                  "EVIDENCE",row["stateEvidence"])

if __name__=="__main__":
    main()
