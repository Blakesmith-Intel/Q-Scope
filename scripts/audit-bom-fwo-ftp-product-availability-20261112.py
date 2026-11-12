#!/usr/bin/env python3
"""Read-only incident audit: BoM anonymous FTP /anon/gen/fwo. No mutation."""
import ftplib
import json
import re
import socket
import time
from datetime import datetime, timezone

HOST="ftp.bom.gov.au"
DIRECTORY="/anon/gen/fwo"
CODES=("IDQ21035","IDQ21033","IDQ21037","IDQ21038")
GEOMETRY_CODES=("IDQ65650","IDQ65652","IDQ65654","IDQ65272","IDQ65277")
MAX_BYTES=1300000
def log(tag,item):
    print(tag,json.dumps(item,ensure_ascii=False,default=str),flush=True)
def inspect_file(ftp,name):
    data=bytearray()
    def push(chunk):
        if len(data)+len(chunk)>MAX_BYTES:
            raise RuntimeError("File size cap exceeded")
        data.extend(chunk)
    try:
        ftp.retrbinary("RETR "+name,push,blocksize=32768)
    except Exception as e:
        log("FWO_RETRIEVE_FAILURE",{"file":name,"error":str(e)[:180]});return
    txt=bytes(data).decode("utf-8",errors="replace")
    found={c:len(re.findall(r"\b"+re.escape(c)+r"\b",txt,re.I))
           for c in CODES+GEOMETRY_CODES if re.search(re.escape(c),txt,re.I)}
    sample=re.sub(r"\s+"," ",txt[:650]).strip()
    log("FWO_PRODUCT",{"file":name,"bytes":len(data),
        "references":found,"polygonTags":len(re.findall(r"<(?:[\w-]+:)?polygon(?:\s[^>]*)?>",txt,re.I)),
        "coordinateTags":len(re.findall(r"<(?:[\w-]+:)?coordinates?(?:\s[^>]*)?>",txt,re.I)),
        "issueMarkers":re.findall(r"(?i)(?:issued|issue date|issued at)[^\n<]{0,125}",txt)[:3],
        "preview":sample[:500]})
socket.setdefaulttimeout(13)
started=time.monotonic()
log("FWO_AUDIT_START",{"host":HOST,"directory":DIRECTORY,
  "atUtc":datetime.now(timezone.utc).isoformat()})
f=None
try:
    f=ftplib.FTP(timeout=13)
    f.connect(HOST,21,timeout=13)
    f.login("anonymous","qscope-diagnostics@example.com")
    f.cwd(DIRECTORY)
    names=f.nlst()
    names=sorted({n.rsplit("/",1)[-1] for n in names})
    regional=[n for n in names if n.upper().startswith(CODES)]
    shapes=[n for n in names if n.upper().startswith(GEOMETRY_CODES)]
    cyclone=[n for n in names if re.match(r"(?i)^ID[QDNTWSV]2(?:0|1)\d{3}",n)
        or re.search(r"(?i)(cyclone|tropical)",n)]
    log("FWO_DIRECTORY",{"totalEntries":len(names),
      "warnings":regional[:65],"geometryProducts":shapes[:65],
      "cycloneCandidateFiles":cyclone[:85],
      "qldIdqTotal":sum(n.upper().startswith("IDQ") for n in names),
      "elapsedSecs":round(time.monotonic()-started,2)})
    # Only fixed, source-qualified product IDs. No arbitrary file paths.
    targets=sorted(set(regional+shapes))
    targets=[n for n in targets if re.search(r"(?i)\.(?:txt|xml|cap\.xml|amoc\.xml|json|geojson|axf)$",n)]
    # Probe limited cyclone filenames only after source listing; never download PDF.
    targets+= [n for n in cyclone if re.search(r"(?i)\.(?:txt|xml|cap\.xml|amoc\.xml)$",n)][:12]
    for name in dict.fromkeys(targets[:36]):
        inspect_file(f,name)
    log("FWO_AUDIT_RESULT",{"retrieved":len(list(dict.fromkeys(targets[:36]))),
      "elapsedSecs":round(time.monotonic()-started,2)})
except Exception as e:
    log("FWO_AUDIT_UNAVAILABLE",{"kind":type(e).__name__,
      "error":str(e)[:220],"elapsedSecs":round(time.monotonic()-started,2)})
finally:
    if f:
        try:f.quit()
        except Exception:pass
