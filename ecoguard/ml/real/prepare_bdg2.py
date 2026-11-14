"""Turns the Building Data Genome 2 (BDG2) files into one tidy hourly table for
classrooms, labs and offices.

BDG2 is an open data set of 1,636 real non-residential buildings with two years
(2016-2017) of hourly meter readings: electricity, chilled water (cooling),
hot water (heating), water and on-site weather. We keep only the building types
that match our block: college classrooms, labs, other classrooms and offices.

Input : data/real/bdg2/*.csv   (see download_bdg2.sh)
Output: data/real/rooms_hourly.parquet  one row per building-hour
        data/real/buildings.csv         the buildings we kept, with metadata
"""
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "real" / "bdg2"
OUT = ROOT / "data" / "real"

KEEP = {
    "College Classroom": "classroom", "Classroom": "classroom", "Primary/Secondary Classroom": "classroom",
    "Academic": "classroom", "College Laboratory": "lab", "Research": "lab", "Office": "office", "office": "office",
}
METERS = ["electricity", "chilledwater", "hotwater", "water"]


def load_meter(name: str, ids: list[str]) -> pd.DataFrame:
    head = pd.read_csv(SRC / f"{name}_cleaned.csv", nrows=0).columns
    cols = ["timestamp"] + [c for c in head if c in set(ids)]
    df = pd.read_csv(SRC / f"{name}_cleaned.csv", usecols=cols, parse_dates=["timestamp"])
    long = df.melt(id_vars="timestamp", var_name="building_id", value_name=name).dropna()
    long[name] = long[name].astype("float32")
    return long


def main():
    meta = pd.read_csv(SRC / "metadata.csv")
    meta["kind"] = meta.sub_primaryspaceusage.map(KEEP)
    meta = meta[meta.kind.notna() & meta.electricity.notna() & meta.sqm.notna()].copy()
    ids = meta.building_id.tolist()
    print(f"{len(ids)} classroom, lab and office buildings with electricity meters")

    df = load_meter("electricity", ids)
    for m in METERS[1:]:
        part = load_meter(m, ids)
        df = df.merge(part, on=["timestamp", "building_id"], how="left")
        print(f"  {m}: {part.building_id.nunique()} buildings")

    # drop meter rows that are clearly broken: long runs of exact zeros on a building that is normally on
    df = df.sort_values(["building_id", "timestamp"])
    med = df.groupby("building_id").electricity.transform("median")
    df = df[(med > 1) & (df.electricity >= 0)]
    zero = (df.electricity == 0).astype(int)
    run = zero.groupby((zero != zero.shift()).cumsum()).transform("size") * zero
    df = df[run < 24].copy()

    df["site_id"] = df.building_id.str.split("_").str[0]
    w = pd.read_csv(SRC / "weather.csv", parse_dates=["timestamp"])
    w = w[["timestamp", "site_id", "airTemperature", "dewTemperature", "cloudCoverage", "windSpeed"]]
    w = w.sort_values(["site_id", "timestamp"])
    for c in ["airTemperature", "dewTemperature", "cloudCoverage", "windSpeed"]:
        w[c] = w.groupby("site_id")[c].transform(lambda s: s.interpolate(limit=6).ffill().bfill())
    w["temp_24h"] = w.groupby("site_id").airTemperature.transform(lambda s: s.rolling(24, min_periods=1).mean())
    df = df.merge(w, on=["timestamp", "site_id"], how="left")

    m = meta.set_index("building_id")
    df["kind"] = df.building_id.map(m.kind)
    df["sqm"] = df.building_id.map(m.sqm).astype("float32")
    df["yearbuilt"] = df.building_id.map(m.yearbuilt).astype("float32")
    df["floors"] = df.building_id.map(m.numberoffloors).astype("float32")
    df["timezone"] = df.building_id.map(m.timezone)
    for c in ["building_id", "site_id", "kind", "timezone"]:
        df[c] = df[c].astype("category")

    df.to_parquet(OUT / "rooms_hourly.parquet", index=False)
    kept = meta[meta.building_id.isin(df.building_id.unique())]
    kept[["building_id", "site_id", "kind", "sub_primaryspaceusage", "sqm", "yearbuilt", "numberoffloors", "timezone", "lat", "lng",
          "chilledwater", "hotwater", "water"]].to_csv(OUT / "buildings.csv", index=False)
    print(f"saved {len(df):,} building-hours from {df.building_id.nunique()} buildings "
          f"({kept.kind.value_counts().to_dict()})")


if __name__ == "__main__":
    main()
