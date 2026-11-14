"""Real Buildings sandbox: serves the audit of real classrooms, labs and offices
from the Building Data Genome 2 data set (built by ml/real/*.py)."""
from __future__ import annotations

import gzip
import json
from functools import lru_cache

from fastapi import APIRouter, HTTPException

from .campus import ROOT

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
