"""Day-ahead forecast with the deep model trained on real buildings.

models/real/forecaster.pt is an LSTM (ml/real/train_forecaster.py) that learned,
from 582 real classrooms, labs and offices in BDG2, how the last 7 days of a
building's hourly electricity turn into the next 24 hours. Every building is
scaled to its own average first, so the one model works for any building.

torch is optional. Without it, forecast_day() returns None and the page shows
only the simple forecasts.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta
from functools import lru_cache

from .campus import ROOT

PAST, AHEAD = 168, 24
WEIGHTS = ROOT / "models" / "real" / "forecaster.pt"


@lru_cache(maxsize=1)
def _model():
    try:
        import torch
        from torch import nn
    except ImportError:
        return None
    if not WEIGHTS.exists():
        return None

    class Forecaster(nn.Module):   # same layers as ml/real/train_forecaster.py
        def __init__(self, n_past=6, n_future=4, hidden=128):
            super().__init__()
            self.enc = nn.LSTM(n_past, hidden, num_layers=2, batch_first=True, dropout=0.1)
            self.head = nn.Sequential(nn.Linear(hidden + AHEAD * n_future, 256), nn.GELU(), nn.Dropout(0.1),
                                      nn.Linear(256, 128), nn.GELU(), nn.Linear(128, AHEAD))

        def forward(self, past, future):
            _, (h, _) = self.enc(past)
            return self.head(torch.cat([h[-1], future.flatten(1)], dim=1))

    m = Forecaster()
    m.load_state_dict(torch.load(WEIGHTS, map_location="cpu", weights_only=True))
    m.eval()
    return torch, m


def _calendar(t: datetime, temp: float | None) -> list[float]:
    temp = 15.0 if temp is None else temp
    return [(temp - 15) / 10, math.sin(2 * math.pi * t.hour / 24), math.cos(2 * math.pi * t.hour / 24),
            1.0 if t.weekday() >= 5 else 0.0]


def forecast_day(elec: list, temp: list, start: str, day: int) -> list[float] | None:
    """Forecast the 24 hours of `day` (0 = first day of the series) from the 7 days before it.
    elec, temp: hourly lists (None for a gap). start: ISO time of elec[0]."""
    loaded = _model()
    if loaded is None:
        return None
    torch, model = loaded
    t0 = datetime.fromisoformat(start)
    s = day * 24
    if s < PAST or s + AHEAD > len(elec):
        return None
    logs = [math.log1p(max(v, 0)) for v in elec if v is not None]   # the year's own scale, as in training
    if len(logs) < PAST // 2:
        return None
    mu = sum(logs) / len(logs)
    sd = (sum((v - mu) ** 2 for v in logs) / len(logs)) ** 0.5 + 1e-3
    past = []
    for i in range(s - PAST, s):
        y = elec[i]
        z = (math.log1p(max(y, 0)) - mu) / sd if y is not None else 0.0
        past.append([z, *_calendar(t0 + timedelta(hours=i), temp[i]), 0.0 if y is not None else 1.0])
    fut = [_calendar(t0 + timedelta(hours=i), temp[i]) for i in range(s, s + AHEAD)]
    with torch.no_grad():
        out = model(torch.tensor([past], dtype=torch.float32), torch.tensor([fut], dtype=torch.float32))[0].tolist()
    return [round(math.expm1(v * sd + mu), 2) for v in out]
