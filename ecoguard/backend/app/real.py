"""Real Buildings sandbox: serves the audit of real classrooms, labs and offices
from the Building Data Genome 2 data set (built by ml/real/*.py)."""
from __future__ import annotations

import gzip
import json
from functools import lru_cache

from fastapi import APIRouter, HTTPException

from .campus import ROOT
from .deep_forecast import forecast_day

REAL = ROOT / "models" / "real"
router = APIRouter(prefix="/api/real", tags=["real buildings"])


def _json(name: str) -> dict:
    p = REAL / name
    return json.loads(p.read_text()) if p.exists() else {}


@router.get("/portfolio")
def portfolio():
    """Summary of the waste audit across every real building, plus the sandbox list."""
    data = _json("portfolio.json")
    if not data:
        raise HTTPException(404, "run ml/real/waste_audit.py first")
    return data


@router.get("/models")
def models():
    """Model report cards: baseline models (ASHRAE Guideline 14 scores) and the day-ahead forecaster."""
    return {"electricity": _json("electricity_metrics.json"), "chilledwater": _json("chilledwater_metrics.json"),
            "forecaster": _json("forecaster_metrics.json")}


@lru_cache(maxsize=16)
def _bundle(building_id: str) -> dict:
    p = REAL / "sandbox" / f"{building_id}.json.gz"
    if not p.exists() or p.parent != REAL / "sandbox":
        raise HTTPException(404, "unknown building")
    with gzip.open(p, "rt") as f:
        return json.load(f, parse_constant=lambda _c: None)  # NaN in a meter gap -> null


@router.get("/buildings/{building_id}")
def building(building_id: str):
    """A full year (2017) of hourly readings for one real building, with expected use and found waste."""
    if "/" in building_id or ".." in building_id:
        raise HTTPException(400, "bad id")
    return _bundle(building_id)


@router.get("/buildings/{building_id}/forecast")
def building_forecast(building_id: str, day: int):
    """Day-ahead forecast for one day of 2017 (0 = 1 Jan) from the LSTM, next to the two simple forecasts."""
    if "/" in building_id or ".." in building_id:
        raise HTTPException(400, "bad id")
    b = _bundle(building_id)
    e = b["elec"]
    if not 7 <= day < len(e) // 24:
        raise HTTPException(400, "day must be between 7 and the last full day")
    lstm = forecast_day(e, b["temp"], b["start"], day)
    s = day * 24
    actual, yday, week = e[s:s + 24], e[s - 24:s], e[s - 168:s - 144]

    def err(p):   # typical error as a share of the day's use
        pairs = [(x, y) for x, y in zip(p or [], actual) if x is not None and y is not None]
        tot = sum(y for _, y in pairs)
        return round(sum(abs(x - y) for x, y in pairs) / tot * 100, 1) if tot and pairs else None

    return {"day": day, "actual": actual, "lstm": lstm, "yesterday": yday, "last_week": week,
            "error_pct": {"lstm": err(lstm), "yesterday": err(yday), "last_week": err(week)},
            "model_ready": lstm is not None}
