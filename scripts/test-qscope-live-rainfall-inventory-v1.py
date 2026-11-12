#!/usr/bin/env python3
"""Offline tests for exact BoM live flood-map station inventory merging."""
import importlib.util
from pathlib import Path
script=Path(__file__).with_name("build-qscope-live-rainfall-inventory-v1.py")
spec=importlib.util.spec_from_file_location("live_rainfall_inventory",script)
inv=importlib.util.module_from_spec(spec)
spec.loader.exec_module(inv)
page=inv.GaugePage()
page.feed('''<map name="IDQ61001.html">
 <area onmouseover='PopupRain("Auburn River TM",&#39;042123&#39;,&#39;-25.7448&#39;,&#39;150.589&#39;,&#39;65.2&#39;,&#39;&#39;,&#39;&#39;)'>
 <area onmouseover='PopupRain("Another gauge",&#39;540001&#39;,&#39;-27.5&#39;,&#39;153.4&#39;,&#39;55&#39;,&#39;&#39;,&#39;&#39;)'>
 <area onmouseover='PopupRain("NSW outside operational envelope",&#39;055202&#39;,&#39;-30.9537&#39;,&#39;150.2494&#39;,&#39;50&#39;,&#39;&#39;,&#39;&#39;)'>
 </map>''')
assert page.stations["042123"]["latitude"]==-25.7448
assert page.stations["042123"]["longitude"]==150.589
assert "055202" not in page.stations

base={"schema":inv.SCHEMA,"source":"official-section1",
      "stations":{str(600000+i):{
          "name":f"Legacy {i}","basin":"Test",
          "latitude":-25.8,"longitude":150.6} for i in range(500)}}
many={str(700000+i):{"name":f"Live {i}",
    "latitude":-26.5+(i%10)*0.1,"longitude":151} for i in range(1500)}
many["042123"]={"name":"Auburn River TM","latitude":-25.7448,"longitude":150.589}
many["600000"]={"name":"Legacy from live","latitude":-25.8,"longitude":150.6}
merged=inv.merge_inventory(base,[("widebay",many)])
assert merged["liveStationCount"]==1502
assert merged["registryStationCount"]==500
assert merged["additionalLiveStations"]==1501
assert len(merged["stations"])==2001
assert merged["stations"]["042123"]["name"]=="Auburn River TM"
assert merged["stations"]["042123"]["basin"]==""
assert merged["stations"]["600000"]["basin"]=="Test"
assert "042123" in merged["additionalLiveStationIds"]
print("PASS live BoM PopupRain 042123, leading zero IDs, source extent and merged registry")
