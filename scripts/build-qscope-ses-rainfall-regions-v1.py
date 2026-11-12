#!/usr/bin/env python3
"""Build a static rainfall gauge -> official Queensland SES Region registry.

Authoritative spatial boundary: Queensland Emergency Services SES Regions
(ArcGIS layer 8 of QFES_Boundaries), corroborated against the current SES
regional headquarters register (updated 9 July 2026). This is a release-only
build step, NOT a live gauge polling dependency. No nearest-centre heuristics.
"""
import argparse
import datetime as dt
import json
import urllib.parse
import urllib.request
from pathlib import Path

SCHEMA = "QscopeQldSESRegionStationRegistryV1"
REGIONS = (
    "Brisbane Region", "Central Region", "Far Northern Region",
    "North Coast Region", "Northern Region", "South Eastern Region",
    "South Western Region",
)
LAYER_URLS = (
    "https://gis.fire.qld.gov.au/arcgis/rest/services/Foundation/QFES_Boundaries/MapServer/8",
    "https://gisext.qfes.qld.gov.au/arcgis/rest/services/Foundation/QFES_Boundaries/MapServer/8",
)
OFFICIAL_SES_REGIONS = "https://www.ses.qld.gov.au/ses-locations"
SOURCE_LAYER = "SES Regions (layer 8)"

def point_in_ring(lon, lat, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        x1,y1=ring[i][:2]
        x2,y2=ring[j][:2]
        if (y1 > lat) != (y2 > lat):
            x = (x2 - x1)*(lat - y1)/(y2-y1) + x1
            if lon < x: inside = not inside
        j=i
    return inside

def point_in_polygon(lon,lat,rings):
    return sum(point_in_ring(lon,lat,ring) for ring in rings) % 2 == 1

def point_in_geometry(lon,lat,geometry):
    geom_type=geometry.get("type")
    coordinates=geometry.get("coordinates",[])
    if geom_type=="Polygon":
        return point_in_polygon(lon,lat,coordinates)
    if geom_type=="MultiPolygon":
        return any(point_in_polygon(lon,lat,polygon) for polygon in coordinates)
    return False

def normalize_region(raw):
    name=" ".join(str(raw or "").strip().split())
    name=name.replace("South-East", "South East").replace("South-West", "South West")
    candidates={item.casefold():item for item in REGIONS}
    candidates.update({item[:-7].casefold():item for item in REGIONS})
    return candidates.get(name.casefold())

def fetch_ses_regions():
    params=urllib.parse.urlencode({
        "where":"1=1",
        "outFields":"SES_Region,OBJECTID",
        "returnGeometry":"true",
        "outSR":"4326",
        "f":"geojson",
    })
    errors=[]
    for source in LAYER_URLS:
        try:
            url=source+"/query?"+params
            request=urllib.request.Request(url,headers={
                "User-Agent":"Q-Scope/1.0 (public SES region mapping; release-time only)",
                "Accept":"application/geo+json,application/json",
            })
            with urllib.request.urlopen(request,timeout=40) as reply:
                if reply.status!=200: raise ValueError(f"HTTP {reply.status}")
                length=reply.headers.get("Content-Length")
                if length and int(length)>15_000_000: raise ValueError("SES spatial feed too large")
                raw=reply.read(15_000_001)
            if len(raw)>15_000_000:raise ValueError("SES spatial feed too large")
            payload=json.loads(raw)
            if payload.get("type")!="FeatureCollection" or not payload.get("features"):
                raise ValueError("SES service returned no GeoJSON features: "+str(payload)[:250])
            return payload["features"],source
        except Exception as error:
            errors.append(f"{source}: {type(error).__name__}: {error}")
    raise RuntimeError("Official SES polygon service unavailable: "+"; ".join(errors))

def validated_regions(features):
    polygons={}
    unknown=set()
    for feature in features:
        props=feature.get("properties") or {}
        raw_name=props.get("SES_Region")
        if raw_name is None:
            raw_name=next((val for key,val in props.items()
                           if key.casefold()=="ses_region"),None)
        name=normalize_region(raw_name)
        if not name:
            unknown.add(str(raw_name))
            continue
        geom=feature.get("geometry")
        if not geom or geom.get("type") not in ("Polygon","MultiPolygon"):
            raise ValueError(f"Official SES region {name} has unsupported geometry")
        polygons.setdefault(name,[]).append(geom)
    if unknown or set(polygons)!=set(REGIONS):
        raise ValueError(f"Official SES region mismatch: unknown={sorted(unknown)} received={sorted(polygons)} expected={REGIONS}")
    return polygons

def build(station_registry,polygons,source):
    if station_registry.get("schema")!="StormTrackerBoMQldRainfallBasinsV1":
        raise ValueError("Unexpected source station registry")
    matches,ambiguous={},[]
    for sid,station in station_registry.get("stations",{}).items():
        lat,lon=station.get("latitude"),station.get("longitude")
        if not isinstance(lat,(int,float)) or not isinstance(lon,(int,float)):
            continue
        regions=[name for name,geometries in polygons.items()
                 if any(point_in_geometry(lon,lat,geom) for geom in geometries)]
        if len(regions)>1:
            ambiguous.append(sid)
        elif len(regions)==1:
            matches[sid]={"latitude":lat,"longitude":lon,"region":regions[0]}
    if ambiguous: raise ValueError(f"SES boundaries overlap for gauges {ambiguous[:20]}")
    if len(matches)<350:raise ValueError(f"Only {len(matches)} stations could be source-matched")
    if len(set(item["region"] for item in matches.values()))!=7:
        raise ValueError("Rain gauge station matching does not cover all seven SES regions")
    return {
        "schema":SCHEMA,
        "source":source,
        "sourceLayer":SOURCE_LAYER,
        "officialSESRegions":OFFICIAL_SES_REGIONS,
        "generatedUtc":dt.datetime.now(dt.timezone.utc).isoformat(),
        "regions":list(REGIONS),
        "stations":matches,
        "matchedStationCount":len(matches),
        "unmatchedStationCount":len(station_registry["stations"])-len(matches),
    }

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--stations",required=True)
    parser.add_argument("--out",required=True)
    args=parser.parse_args()
    registry=json.loads(Path(args.stations).read_text(encoding="utf-8"))
    features,source=fetch_ses_regions()
    polygons=validated_regions(features)
    output=build(registry,polygons,source)
    path=Path(args.out)
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(output,separators=(",",":"),ensure_ascii=False)+"\n",
                    encoding="utf-8")
    print("Q_SCOPE_OFFICIAL_SES_REGIONS",len(polygons),
          "SES_STATIONS_MATCHED",output["matchedStationCount"],
          "UNMATCHED",output["unmatchedStationCount"],"SOURCE",source)

if __name__=="__main__": main()
