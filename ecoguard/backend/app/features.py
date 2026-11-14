"""Feature building shared by training and evaluation.

build() is used for training on whole tables, row() for one live reading.
Keep the two in sync. Only things a real building would know go in here:
headcount (from occupancy sensors or the timetable), outdoor temperature,
and the clock. The meter reading is the target, never a feature.
"""
import numpy as np
import pandas as pd

FEATURES = [
    "on", "occ", "cool30", "cool25", "heat13", "daylit",
    *[f"h{h}" for h in range(24)],
]


def build(df: pd.DataFrame, occ_col: str = "occ", temp_col: str = "temp") -> pd.DataFrame:
    ts = pd.to_datetime(df["ts"])
    hour = ts.dt.hour + ts.dt.minute / 60
    occ = df[occ_col].astype(float)
    on = (occ > 0).astype(float)
    t = df[temp_col].astype(float)
    X = pd.DataFrame({
        "on": on,
        "occ": occ,
        "cool30": on * np.clip(t - 30, 0, None),
        "cool25": on * np.clip(t - 25, 0, None),
        "heat13": on * np.clip(13 - t, 0, None),
        "daylit": on * ((hour >= 10) & (hour < 15)).astype(float),
    })
    # hour-of-day dummies only matter when the room is empty (standby pattern)
    for h in range(24):
        X[f"h{h}"] = ((ts.dt.hour == h) & (on == 0)).astype(float)
    return X[FEATURES]


def row(occ: float, temp: float, hour: float) -> list[float]:
    """Same features for a single live reading (used by the detector)."""
    on = 1.0 if occ > 0 else 0.0
    f = [
        on, float(occ),
        on * max(0.0, temp - 30), on * max(0.0, temp - 25), on * max(0.0, 13 - temp),
        on * (1.0 if 10 <= hour < 15 else 0.0),
    ]
    h = int(hour)
    f += [1.0 if (i == h and not on) else 0.0 for i in range(24)]
    return f
