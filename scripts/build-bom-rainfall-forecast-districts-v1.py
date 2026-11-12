#!/usr/bin/env python3
"""Derive Queensland gauge -> BoM forecast district from IDM00001 shapefile.

Runs ONLY during a release build, not during rainfall refresh. The source
polygons are never published. Never substitute BoM rainfall districts (IDM00004),
rainfall station-number prefixes or flood-map publishing regions.
"""
import argparse
import datetime as dt
import ftplib
import io
import json
import re
import zipfile
from pathlib import Path

SOURCE_HOST = "ftp.bom.gov.au"
SOURCE_DIR = "/anon/home/adfd/spatial"
SOURCE_ZIP = "IDM00001.zip"
SCHEMA = "QscopeBomForecastDistrictStationRegistryV1"

def point_in_ring(lon, lat, ring):
    inside = False
    j = len(ring) - 1
    for i, (x1, y1) in enumerate(ring):
        x2, y2 = ring[j]
        if (y1 > lat) != (y2 > lat):
            x = (x2 - x1) * (lat - y1) / (y2 - y1) + x1
            if lon < x:
                inside = not inside
        j = i
    return inside

def point_in_polygon(lon, lat, polygon):
    # Even/odd treatment handles interior holes and islands independently of
    # shapefile ring winding conventions.
    return sum(point_in_ring(lon, lat, ring) for ring in polygon) % 2 == 1

def point_in_geometry(lon, lat, geometry):
    if geometry["type"] == "Polygon":
        return point_in_polygon(lon, lat, geometry["coordinates"])
    if geometry["type"] == "MultiPolygon":
        return any(point_in_polygon(lon, lat, polygon)
                   for polygon in geometry["coordinates"])
    return False

def download_idm00001():
    output = io.BytesIO()
    with ftplib.FTP(timeout=45) as connection:
        connection.connect(SOURCE_HOST, 21)
        connection.login()
        connection.cwd(SOURCE_DIR)
        connection.retrbinary("RETR " + SOURCE_ZIP, output.write)
    binary = output.getvalue()
    if not 1000 < len(binary) < 15_000_000:
        raise ValueError("Unexpected BoM IDM00001 source size")
    return binary

def extract_districts(binary):
    # pyshp: small, read-only shapefile parser used in a one-time CI build.
    import shapefile
    with zipfile.ZipFile(io.BytesIO(binary)) as zipped:
        names = zipped.namelist()
        shp = next((n for n in names if n.lower().endswith(".shp")), None)
        if not shp:
            raise ValueError("BoM IDM00001 zip does not contain a shapefile")
        root = shp[:-4]
        extensions = {ext: next((n for n in names if n.lower() == (root + ext).lower()), None)
                      for ext in (".shp", ".shx", ".dbf")}
        if any(v is None for v in extensions.values()):
            raise ValueError("Incomplete BoM IDM00001 shapefile")
        reader = shapefile.Reader(
            shp=io.BytesIO(zipped.read(extensions[".shp"])),
            shx=io.BytesIO(zipped.read(extensions[".shx"])),
            dbf=io.BytesIO(zipped.read(extensions[".dbf"])),
            encoding="utf-8", encodingErrors="replace")
        districts = []
        for row in reader.iterShapeRecords():
            attrs = {k.lower(): v for k, v in row.record.as_dict().items()}
            code = str(attrs.get("aac", "")).strip().upper()
            name = str(attrs.get("dist_name", "")).strip()
            if not re.fullmatch(r"QLD_PW\d+", code):
                continue
            if not name:
                raise ValueError("Unnamed Queensland forecast district " + code)
            geometry = row.shape.__geo_interface__
            if geometry["type"] not in ("Polygon", "MultiPolygon"):
                raise ValueError("Unexpected geometry for " + code)
            districts.append((code, name, geometry))
    codes = [code for code, _, _ in districts]
    if len(set(codes)) != len(codes):
        raise ValueError("Duplicate Queensland district codes in IDM00001")
    if len(districts) != 15:
        raise ValueError(f"Expected 15 Queensland forecast districts, received {len(districts)}")
    return districts

def build(station_registry, districts):
    if station_registry.get("schema") != "StormTrackerBoMQldRainfallBasinsV1":
        raise ValueError("Invalid verified BoM station registry")
    matches = {}
    ambiguous = []
    for station_id, station in station_registry["stations"].items():
        latitude, longitude = station.get("latitude"), station.get("longitude")
        if not isinstance(latitude, (float, int)) or not isinstance(longitude, (float, int)):
            continue
        found = [(code, name) for code, name, geo in districts
                 if point_in_geometry(longitude, latitude, geo)]
        if len(found) > 1:
            ambiguous.append(station_id)
            continue
        if len(found) == 1:
            code, name = found[0]
            matches[station_id] = dict(latitude=latitude, longitude=longitude,
                                       code=code, name=name)
    if ambiguous:
        raise ValueError(f"Overlapping forecast-district stations: {ambiguous[:10]}")
    # Fail closed on missing/garbled source rather than claim unverified districts.
    if len(matches) < 350:
        raise ValueError(f"Only {len(matches)} gauge locations matched official BoM districts")
    return {
        "schema": SCHEMA,
        "sourceProduct": "IDM00001",
        "source": "Bureau of Meteorology Public Weather Forecast Districts",
        "sourceUrl": f"ftp://{SOURCE_HOST}{SOURCE_DIR}/{SOURCE_ZIP}",
        "generatedUtc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "districts": [{"code": code, "name": name} for code, name, _ in
                      sorted(districts, key=lambda r: r[1])],
        "stations": matches,
        "matchedStationCount": len(matches),
        "unmatchedStationCount": len(station_registry["stations"]) - len(matches),
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--stations", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    stations = json.loads(Path(args.stations).read_text(encoding="utf-8"))
    districts = extract_districts(download_idm00001())
    result = build(stations, districts)
    destination = Path(args.out)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(result, separators=(",", ":"), ensure_ascii=False) + "\n",
                           encoding="utf-8")
    print("BOM_FORECAST_DISTRICTS", len(districts), "GAUGES_MATCHED",
          result["matchedStationCount"], "UNMATCHED", result["unmatchedStationCount"])

if __name__ == "__main__":
    main()
