"""Save every GET answer of a running ECOGUARD server as JSON, for the online demo.

    python frontend/scripts/snapshot_demo.py http://localhost:8000 frontend/dist-demo/demo [forecast-server]
"""
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

API, OUT = sys.argv[1].rstrip("/"), Path(sys.argv[2])
FC_API = sys.argv[3].rstrip("/") if len(sys.argv) > 3 else API   # optional second server for forecasts
OUT.mkdir(parents=True, exist_ok=True)


def name(path):  # must match demoFile() in src/lib/api.js
    return re.sub(r"[^a-zA-Z0-9]+", "_", re.sub(r"^/api/", "", path)) + ".json"


def save(path, api=None):
    with urllib.request.urlopen((api or API) + path, timeout=60) as r:
        data = json.load(r)
    (OUT / name(path)).write_text(json.dumps(data, separators=(",", ":")))
    return data


live = save("/api/live")
for p in ["/api/building", "/api/alerts", "/api/alerts?status=open", "/api/alerts?status=closed", "/api/actions",
          "/api/water/series?hours=48", "/api/wiring", "/api/forecast", "/api/savings?days=30", "/api/experiment",
          "/api/model", "/api/settings", "/api/hvac", "/api/cv/status", "/api/real/models"]:
    try:
        save(p)
    except Exception as e:  # an optional module (camera, experiment) may be off
        print("skip", p, e)
for room in live["rooms"]:
    for h in (24, 72, 168):
        save(f"/api/rooms/{room['id']}/series?hours={h}")
portfolio = save("/api/real/portfolio")
for b in portfolio.get("sandbox", []):
    bid = b.get("id") or b.get("building_id")
    q = urllib.parse.quote(str(bid), safe="")
    detail = save("/api/real/buildings/" + q)
    for day in range(8, detail["hours"] // 24):   # every day the forecast slider can show
        save(f"/api/real/buildings/{q}/forecast?day={day}", FC_API)
print(len(list(OUT.glob("*.json"))), "files in", OUT)
