#!/usr/bin/env python3
"""Release-time inventory of the ACTUAL BoM flood-map rainfall gauge source.

The older 2022 section1.shtml rainfall-station register is incomplete compared
with station IDs displayed in live regional rainfall maps. Harvest the exact
BoM PopupRain station ID/latitude/longitude from the same seven public maps as
the existing Cloudflare worker, then merge the non-conflicting stations with
the frozen, trusted 2022 registry. No browser polling or changes to the relay.
"""
import argparse
import concurrent.futures
import datetime as dt
import html.parser
import json
import math
import re
import urllib.request
from pathlib import Path

BASE="https://www.bom.gov.au/qld/flood/"
REGIONS=("gulf","north","tvl2mck","widebay","seast","west","border")
SCHEMA="StormTrackerBoMQldRainfallBasinsV1"
HANDLER=re.compile(
    r'(?:PopupRain|Flood\.popupRain)\s*\(\s*"([^"]+)"\s*,\s*'
    r"'(\d{4,7})'\s*,\s*'(-?[\d.]+)'\s*,\s*'(-?[\d.]+)'\s*,",
    re.I
)

class GaugePage(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stations={}
        self.conflicts=[]
    def handle_starttag(self,tag,attrs):
        if tag.lower()!="area":return
        attributes=dict(attrs)
        handler=attributes.get("onmouseover","") or ""
        match=HANDLER.search(handler)
        if not match:return
        name,id_,latitude,longitude=match.groups()
        lat,lon=float(latitude),float(longitude)
        # Match the existing Q-Scope live rainfall parser geographic scope.
        # BoM regional maps include NSW sites further south that the app
        # intentionally does not display. Those cannot block this catalogue.
        if not (-29.8<=lat<=-9 and 137<=lon<=154.6):
            return
        record={"name":name.strip(),"latitude":lat,"longitude":lon}
        previous=self.stations.get(id_)
        if previous and (abs(previous["latitude"]-lat)>0.004 or
                         abs(previous["longitude"]-lon)>0.004):
            self.conflicts.append((id_,previous,record))
        else:
            self.stations[id_]=record

def request_region(region):
    if region not in REGIONS:raise ValueError("Unknown BoM flood-map region")
    url=BASE+region+".shtml"
    req=urllib.request.Request(url,headers={
        "User-Agent":"Mozilla/5.0 (compatible; Q-Scope gauge catalogue CI verification)",
        "Accept":"text/html",
    })
    with urllib.request.urlopen(req,timeout=45) as response:
        if response.status!=200:raise RuntimeError("BoM rainfall source HTTP "+str(response.status))
        raw=response.read(3_500_001)
        if len(raw)>3_500_000:raise ValueError("BoM rainfall map exceeds safety limit: "+region)
    page=GaugePage()
    page.feed(raw.decode("utf-8","replace"))
    if page.conflicts:
        raise ValueError("Same BoM station ID has conflicting coordinates in "+region+": "+
                         repr(page.conflicts[:3]))
    if len(page.stations)<10:
        raise ValueError("Insufficient BoM rainfall stations found in "+region+": "+str(len(page.stations)))
    return region,page.stations

def merge_inventory(base,regional):
    if base.get("schema")!=SCHEMA or len(base.get("stations",{}))<500:
        raise ValueError("Unverified BoM original station register")
    stations={k:dict(v) for k,v in base["stations"].items()}
    live,conflicting={},[]
    for region,records in regional:
        for id_,record in records.items():
            previous=live.get(id_)
            if previous and (abs(previous["latitude"]-record["latitude"])>0.004 or
                             abs(previous["longitude"]-record["longitude"])>0.004):
                conflicting.append((id_,region,previous,record))
            else:
                live[id_]=record
    if conflicting:raise ValueError("Conflicting station locations across BoM regions "+str(conflicting[:8]))
    added=[]
    for id_,record in live.items():
        old=stations.get(id_)
        if old:
            # Keep original verified station coordinates only when consistent
            # with current publication, otherwise trust the LIVE source.
            if (abs(old["latitude"]-record["latitude"])<=0.004 and
                abs(old["longitude"]-record["longitude"])<=0.004):continue
            # Since we use this inventory for SES/forecast attribution only,
            # current published coordinates are authoritative.
            stations[id_]={**old,**record}
        else:
            stations[id_]={"basin":"","source":"BoM live flood-map rainfall gauge",
                           **record}
            added.append(id_)
    if len(live)<400:
        raise ValueError(f"Live BoM rainfall map inventory unexpectedly small ({len(live)})")
    missed=[id_ for id_ in live if id_ not in stations]
    if missed:raise ValueError("Live inventory not covered: "+repr(missed[:10]))
    return {
        "schema":SCHEMA,
        "source":base.get("source"),
        "liveSource":BASE,
        "regions":list(REGIONS),
        "generatedUtc":dt.datetime.now(dt.timezone.utc).isoformat(),
        "stations":stations,
        "liveStationCount":len(live),
        "registryStationCount":len(base["stations"]),
        "additionalLiveStations":len(added),
        "additionalLiveStationIds":sorted(added),
        "excludedConflictingIds":base.get("excludedConflictingIds",[]),
    }

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--base",required=True)
    parser.add_argument("--out",required=True)
    parser.add_argument("--require-station",default="")
    args=parser.parse_args()
    original=json.loads(Path(args.base).read_text(encoding="utf-8"))
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        inventories=list(executor.map(request_region,REGIONS))
    for name,stations in inventories:
        print("LIVE_BO_M_RAINFALL_REGION",name,"GAUGES",len(stations))
    result=merge_inventory(original,inventories)
    station_id=args.require_station.strip()
    if station_id:
        if station_id not in result["stations"]:
            raise ValueError(f"Required observed gauge {station_id} missing from source inventory")
        print("LIVE_REQUIRED_STATION",station_id,
              json.dumps(result["stations"][station_id],sort_keys=True))
    destination=Path(args.out)
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps(result,separators=(",",":"),ensure_ascii=False)+"\n",
                           encoding="utf-8")
    print("LIVE_RAINFALL_INVENTORY",len(result["stations"]),
          "SOURCE_MAP_STATIONS",result["liveStationCount"],
          "ADDITIONAL",result["additionalLiveStations"])

if __name__=="__main__": main()
