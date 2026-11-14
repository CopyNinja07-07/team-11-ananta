"""Building asset register and constants, shared with the sensor simulator
through config/campus.json (one file, so the two never disagree)."""
import json
import math
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = Path(os.environ.get("ECOGUARD_CONFIG", ROOT / "config" / "campus.json"))
CFG = json.loads(CONFIG_PATH.read_text())

BUILDING = CFG["building"]
ZONES = {z["id"]: z for z in CFG["zones"]}
WATER = CFG["water"]
TARIFF = CFG["tariff"]

IST = timezone(timedelta(hours=5, minutes=30))

# IMD normals for Jammu: (mean daily min, mean daily max) by month.
JAMMU_NORMALS = [
    (7.5, 18.6), (10.1, 21.6), (14.3, 26.6), (19.3, 33.1), (23.8, 38.3), (26.3, 39.9),
    (25.6, 34.9), (25.1, 33.5), (23.2, 33.4), (17.8, 31.1), (11.8, 26.2), (8.2, 21.0),
]


def to_ist(ms: int) -> datetime:
    return datetime.fromtimestamp(ms / 1000, tz=IST)


def normal_temp(ms: int) -> float:
    """Typical outdoor temperature for this time of year and day.
    Stands in for a weather forecast (swap for IMD / Open-Meteo in deployment)."""
    t = to_ist(ms)
    mid = (t.day - 15) / 30
    i = t.month - 1
    j = (i + (1 if mid >= 0 else 11)) % 12
    w = abs(mid)
    lo = JAMMU_NORMALS[i][0] * (1 - w) + JAMMU_NORMALS[j][0] * w
    hi = JAMMU_NORMALS[i][1] * (1 - w) + JAMMU_NORMALS[j][1] * w
    hour = t.hour + t.minute / 60
    phase = math.cos((hour - 15) / 24 * 2 * math.pi)
    return (lo + hi) / 2 + (hi - lo) / 2 * phase
