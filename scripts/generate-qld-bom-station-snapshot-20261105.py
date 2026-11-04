#!/usr/bin/env python3
"""One-time verified official BoM QLD river-height station location snapshot.

Source: BoM Queensland Flood Warning River Height Station Index, section 3.
Use for coordinates and exact IDs ONLY. NEVER package heights or classifications.
"""
import json,re,html,sys,urllib.request
from pathlib import Path

URL="https://www.bom.gov.au/qld/flood/networks/section3.shtml"
OUT=Path("frontend/data/qld-bom-river-station-locations-v1.json")
req=urllib.request.Request(URL,headers={"User-Agent":"StormTracker verified static flood location recovery (public BoM data)","Accept":"text/html"})
with urllib.request.urlopen(req,timeout=30) as response:
    raw=response.read().decode("utf-8","replace")
clean=html.unescape(re.sub(r"<[^>]*>","",raw))
# Exact source station ID and published degree/minute/second coordinates.
# Some BoM 2022 entries contain seconds=60; arithmetic handles normal rollover.
pattern=re.compile(r"(?m)^\s*(\d{6})\s+(?:(\d{6})\s+)?(.+?)\s+(\d{6})S\s+(\d{7})E\s*$")
seen={}
def decimal(dms,degrees):
    head=int(dms[:degrees]);minute=int(dms[degrees:degrees+2]);sec=int(dms[degrees+2:])
    if minute>60 or sec>60:return None
    return head+(minute*60+sec)/3600
for m in pattern.finditer(clean):
    station,awrc,remainder,lat_dms,lon_dms=m.groups()
    lat=decimal(lat_dms,2);lon=decimal(lon_dms,3)
    if lat is None or lon is None:continue
    lat=-lat
    if not (-30<=lat<=-9 and 137<=lon<=154.1):continue
    fields=re.split(r"\s{2,}",remainder.strip())
    name=fields[0].strip()
    if not name or station in seen:continue
    seen[station]={
      "type":"Feature","id":"bom:"+station,
      "geometry":{"type":"Point","coordinates":[round(lon,6),round(lat,6)]},
      "properties":{
        "bom_stn_num":station,"awrc_stateid":awrc or "",
        "name":name,"state":"QLD",
        "lat":round(lat,6),"long":round(lon,6),
        "location_types":"","forecast_site_classification":"",
        "basin":"","agency":"Bureau of Meteorology"
      }}
assert len(seen)>=1000,f"Refusing incomplete official BoM index: {len(seen)} exact locations"
for critical in ("544019","533142","544024","044116"):
    assert critical in seen, f"Official source missing expected station {critical}"
payload={"type":"FeatureCollection","source":URL,"stationIndexDate":"2022-01-05",
    "locationUseOnly":True,"features":[seen[k] for k in sorted(seen)]}
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps(payload,separators=(",",":"),ensure_ascii=False)+"\n",encoding="utf-8")
print("BO_M_STATION_SNAPSHOT_OK",len(seen),"bytes",OUT.stat().st_size,
  "CunnamullaWeir",seen["544019"]["geometry"]["coordinates"])
