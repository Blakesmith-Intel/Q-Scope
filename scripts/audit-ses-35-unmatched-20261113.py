#!/usr/bin/env python3
"""One-time diagnostic report for BoM QLD-network gauges outside SES regions.

DOES NOT assign any SES region or change production data. Displays the public
station names/coordinates and distance to the nearest official SES polygon.
"""
import argparse
import datetime as dt
import importlib.util
import json
import math
from pathlib import Path

from shapely.geometry import Point, shape
from shapely.ops import nearest_points

ROOT=Path(__file__).parent
PATH=ROOT/"build-qscope-ses-rainfall-regions-v1.py"
spec=importlib.util.spec_from_file_location("ses_boundaries",PATH)
ses=importlib.util.module_from_spec(spec)
spec.loader.exec_module(ses)

def haversine_km(lat1,lon1,lat2,lon2):
    r=math.pi/180
    h=math.sin((lat2-lat1)*r/2)**2 + math.cos(lat1*r)*math.cos(lat2*r)*math.sin((lon2-lon1)*r/2)**2
    return 12742*math.asin(min(1,math.sqrt(h)))

def audit(stations,polygons,mapped):
    shapes=[(name,shape(geometry)) for name,items in polygons.items() for geometry in items]
    rows=[]
    for sid,station in sorted(stations.items()):
        if sid in mapped:
            continue
        lat,lon=station["latitude"],station["longitude"]
        point=Point(lon,lat)
        nearest=[]
        for name,polygon in shapes:
            # Shapely nearest point uses planar geographic degree units; distance
            # below is only approximate and must NOT be used for assignment.
            _,close=nearest_points(point,polygon)
            km=haversine_km(lat,lon,close.y,close.x)
            nearest.append((km,name,close.y,close.x))
        km,name,closest_lat,closest_lon=min(nearest)
        rows.append(dict(id=sid,name=station["name"],latitude=lat,longitude=lon,
            nearestSESRegion=name,approximateDistanceKm=round(km,3),
            nearestBoundaryLat=round(closest_lat,6),
            nearestBoundaryLon=round(closest_lon,6)))
    return sorted(rows,key=lambda row:(row["approximateDistanceKm"],row["id"]))

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--stations",required=True)
    parser.add_argument("--json-out",required=True)
    args=parser.parse_args()
    reg=json.loads(Path(args.stations).read_text(encoding="utf8"))
    features,source=ses.fetch_ses_regions()
    boundaries=ses.validated_regions(features)
    result=ses.build(reg,boundaries,source)
    rows=audit(reg["stations"],boundaries,result["stations"])
    assert len(rows)==result["unmatchedStationCount"],"Audit and build unmatched counts disagree"
    output=dict(auditUtc=dt.datetime.now(dt.timezone.utc).isoformat(),
        officialSESPolygonSource=source,
        totalStations=len(reg["stations"]),matched=result["matchedStationCount"],
        unmatched=len(rows),rows=rows)
    Path(args.json_out).write_text(json.dumps(output,indent=2,ensure_ascii=False)+"\n",encoding="utf8")
    print("AUDIT_SES_UNMATCHED_COUNT",len(rows))
    for row in rows:
        print("SES_UNMATCHED",f"id={row['id']}",
          f"name={row['name']!r}",f"lat={row['latitude']}",f"lon={row['longitude']}",
          f"nearest={row['nearestSESRegion']!r}",
          f"approx_km_to_boundary={row['approximateDistanceKm']}")
    buckets={
        "less than 100 metres":sum(r["approximateDistanceKm"]<0.1 for r in rows),
        "100 metres to 1 km":sum(0.1<=r["approximateDistanceKm"]<1 for r in rows),
        "1 to 5 km":sum(1<=r["approximateDistanceKm"]<5 for r in rows),
        "5 to 20 km":sum(5<=r["approximateDistanceKm"]<20 for r in rows),
        "20+ km":sum(r["approximateDistanceKm"]>=20 for r in rows)
    }
    print("SES_UNMATCHED_DISTANCE_BANDS",json.dumps(buckets))
    print("SES_UNMATCHED_AUDIT_FINISHED",args.json_out)

if __name__=="__main__":
    main()
