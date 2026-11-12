#!/usr/bin/env python3
"""Offline unit tests for BoM IDM00001 polygon conversion; no external calls."""
import importlib.util
import io
import json
import tempfile
import zipfile
from pathlib import Path

script = Path(__file__).with_name("build-bom-rainfall-forecast-districts-v1.py")
spec = importlib.util.spec_from_file_location("forecast_district_builder", script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

ring = [(150, -28), (154, -28), (154, -24), (150, -24), (150, -28)]
assert module.point_in_ring(152, -26, ring)
assert not module.point_in_ring(149, -26, ring)
assert module.point_in_polygon(152, -26, [ring])
assert not module.point_in_polygon(152, -26, [
    ring, [(151, -27), (153, -27), (153, -25), (151, -25), (151, -27)]
])
assert module.point_in_geometry(152, -26, {
    "type": "Polygon", "coordinates": [ring]})
assert not module.point_in_geometry(137, -26, {
    "type": "MultiPolygon", "coordinates": [[ring]]})

# End-to-end conversion against a synthetic IDM00001 ZIP. This verifies field
# extraction, AAC filtering, inclusion, and source authority requirements.
import shapefile
with tempfile.TemporaryDirectory() as temp:
    root = Path(temp) / "IDM00001"
    with shapefile.Writer(str(root), shapeType=shapefile.POLYGON) as writer:
        writer.field("AAC", "C", size=12)
        writer.field("DIST_NAME", "C", size=100)
        for i in range(15):
            lat = -28.0 + i * 0.6
            writer.poly([[ (150,-28.0+i*0.6), (154,-28.0+i*0.6),
                           (154,lat+0.6), (150,lat+0.6),
                           (150,lat) ]])
            writer.record("QLD_PW"+str(i+1).zfill(3), "Forecast "+str(i+1))
    raw=io.BytesIO()
    with zipfile.ZipFile(raw,"w") as z:
        for ext in (".shp",".shx",".dbf"):
            z.write(str(root)+ext,"IDM00001"+ext)
    districts = module.extract_districts(raw.getvalue())
    assert len(districts)==15
    stations = {"schema":"StormTrackerBoMQldRainfallBasinsV1",
      "stations":{str(i):{"latitude":-27.75,"longitude":152} for i in range(400)}}
    mapped=module.build(stations,districts)
    assert mapped["sourceProduct"]=="IDM00001"
    assert len(mapped["stations"])==400
    assert set(x["code"] for x in mapped["stations"].values())=={"QLD_PW001"}

print("PASS offline verified forecast-district geometry, official AAC parsing and station matching")
