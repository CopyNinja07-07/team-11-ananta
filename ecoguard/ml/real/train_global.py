"""Trains one gradient-boosted model per meter (electricity, chilled water) on every
real classroom, lab and office building in BDG2.

The model answers: "for this building, at this hour, in this weather, what is the
normal use?" It is trained on 2016 and tested on 2017, a year it never saw, and
scored per building with the ASHRAE Guideline 14 measures that energy auditors
use to accept a baseline model: CV(RMSE) and NMBE.

Usage: python train_global.py [electricity|chilledwater]
Output: models/real/<meter>_lgbm.txt, models/real/<meter>_metrics.json
"""
import json
import sys
import time
from pathlib import Path

import holidays
import lightgbm as lgb
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "real" / "rooms_hourly.parquet"
OUT = ROOT / "models" / "real"
OUT.mkdir(parents=True, exist_ok=True)

FEATURES = ["building_id", "kind", "site_id", "hour", "dow", "month", "off_day", "airTemperature", "dewTemperature",
            "cloudCoverage", "windSpeed", "temp_24h", "cdd", "hdd", "log_sqm", "yearbuilt", "floors", "profile"]
CATEGORICAL = ["building_id", "kind", "site_id"]


def holiday_set(tz_values) -> dict:
    years = [2016, 2017]
    country = {"US": holidays.US(years=years), "GB": holidays.UK(years=years), "IE": holidays.IE(years=years)}
    out = {}
    for tz in tz_values:
        c = "US" if str(tz).startswith("US/") else ("IE" if "Dublin" in str(tz) else "GB")
        out[tz] = set(country[c].keys())
    return out


def add_features(df: pd.DataFrame) -> pd.DataFrame:
    ts = df.timestamp
    df["hour"] = ts.dt.hour.astype("int8")
    df["dow"] = ts.dt.dayofweek.astype("int8")
    df["month"] = ts.dt.month.astype("int8")
    hol = holiday_set(df.timezone.cat.categories)
    day = ts.dt.date
    is_hol = np.zeros(len(df), dtype=bool)
    for tz, days in hol.items():
        m = (df.timezone == tz).to_numpy()
        is_hol[m] = day[m].isin(days).to_numpy()
    df["off_day"] = ((df.dow >= 5) | is_hol).astype("int8")
    df["cdd"] = np.clip(df.airTemperature - 18, 0, None).astype("float32")
    df["hdd"] = np.clip(15 - df.airTemperature, 0, None).astype("float32")
    df["log_sqm"] = np.log(df.sqm).astype("float32")
    return df


def profile_table(train: pd.DataFrame, meter: str) -> pd.DataFrame:
    t = train.assign(v=np.log1p(train[meter]))
    return t.groupby(["building_id", "off_day", "hour"], observed=True).v.mean().rename("profile").reset_index()


def apply_profile(df: pd.DataFrame, prof: pd.DataFrame) -> pd.DataFrame:
    out = df.merge(prof, on=["building_id", "off_day", "hour"], how="left")
    out["building_id"] = out.building_id.astype(df.building_id.dtype)
    out["profile"] = out.profile.astype("float32")
    return out


def ashrae_scores(g: pd.DataFrame, meter: str) -> pd.Series:
    y, p = g[meter].to_numpy(), g.pred.to_numpy()
    mean = y.mean()
    n = len(y)
    cv = np.sqrt(((y - p) ** 2).sum() / (n - 1)) / mean * 100 if mean > 0 else np.nan
    nmbe = (y - p).sum() / ((n - 1) * mean) * 100 if mean > 0 else np.nan
    return pd.Series({"cvrmse": cv, "nmbe": nmbe, "hours": n, "mean": mean})


def main(meter: str = "electricity"):
    t0 = time.time()
    df = pd.read_parquet(DATA, columns=["timestamp", "building_id", "site_id", "kind", "timezone", meter, "airTemperature",
                                        "dewTemperature", "cloudCoverage", "windSpeed", "temp_24h", "sqm", "yearbuilt", "floors"])
    df = df[df[meter].notna()].copy()
    df["building_id"] = df.building_id.cat.remove_unused_categories()
    df = add_features(df)
    train = df[df.timestamp.dt.year == 2016]
    test = df[df.timestamp.dt.year == 2017].copy()
    print(f"{meter}: {df.building_id.nunique()} buildings, train {len(train):,} rows, test {len(test):,} rows")

    # each building's typical use for this hour on a working day / day off, learned from 2016 only
    prof = profile_table(train, meter)
    train = apply_profile(train, prof)
    test = apply_profile(test, prof)
    prof.to_parquet(OUT / f"{meter}_profile.parquet")

    y = np.log1p(train[meter])
    # every 6th week of 2016 is held back for early stopping, so all seasons are in both sets
    val_mask = ((train.timestamp.dt.isocalendar().week % 6) == 0).to_numpy()
    dtrain = lgb.Dataset(train.loc[~val_mask, FEATURES], y[~val_mask], categorical_feature=CATEGORICAL, free_raw_data=False)
    dval = lgb.Dataset(train.loc[val_mask, FEATURES], y[val_mask], reference=dtrain, categorical_feature=CATEGORICAL)
    params = dict(objective="huber", alpha=0.9, learning_rate=0.05, num_leaves=255, min_data_in_leaf=200,
                  feature_fraction=0.85, bagging_fraction=0.7, bagging_freq=1, max_cat_to_onehot=8, cat_smooth=20,
                  max_bin=255, verbose=-1, num_threads=4)
    model = lgb.train(params, dtrain, num_boost_round=1500, valid_sets=[dval],
                      callbacks=[lgb.early_stopping(50, verbose=False), lgb.log_evaluation(100)])
    print(f"trained {model.best_iteration} rounds in {time.time() - t0:.0f} s")

    test["pred"] = np.expm1(model.predict(test[FEATURES], num_iteration=model.best_iteration)).clip(0)
    per = test.groupby("building_id", observed=True).apply(lambda g: ashrae_scores(g, meter), include_groups=False)
    per = per[per["mean"] > 0].dropna()
    kind = df.groupby("building_id", observed=True).kind.first()
    per["kind"] = kind.reindex(per.index).astype(str)
    passed = (per.cvrmse < 30) & (per.nmbe.abs() < 10)

    imp = pd.Series(model.feature_importance("gain"), index=FEATURES)
    metrics = {
        "meter": meter, "buildings": int(len(per)), "train_rows": int(len(train)), "test_rows": int(len(test)),
        "rounds": int(model.best_iteration), "train_seconds": round(time.time() - t0),
        "median_cvrmse": round(float(per.cvrmse.median()), 1), "median_nmbe": round(float(per.nmbe.median()), 1),
        "ashrae_g14_pass_pct": round(float(passed.mean() * 100), 1),
        "by_kind": {k: {"buildings": int(len(g)), "median_cvrmse": round(float(g.cvrmse.median()), 1),
                        "pass_pct": round(float(((g.cvrmse < 30) & (g.nmbe.abs() < 10)).mean() * 100), 1)}
                    for k, g in per.groupby("kind")},
        "feature_importance": {k: round(float(v / imp.sum() * 100), 1) for k, v in imp.sort_values(ascending=False).items()},
    }
    model.save_model(OUT / f"{meter}_lgbm.txt", num_iteration=model.best_iteration)
    (OUT / f"{meter}_metrics.json").write_text(json.dumps(metrics, indent=1))
    per.round(2).to_csv(ROOT / "data" / "real" / f"{meter}_per_building.csv")
    print(json.dumps({k: v for k, v in metrics.items() if k != "feature_importance"}, indent=1))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "electricity")
