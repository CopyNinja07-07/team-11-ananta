"""Runs the ECOGUARD waste checks on every real classroom, lab and office building
in BDG2 (test year 2017) and writes the bundles the dashboard's Real Buildings
sandbox replays.

Checks on real meters (no labels exist, so every number is computed from the
meter itself and the trained baseline):
  * after-hours waste    use at night / weekends / holidays above what the same
                         building manages on its own best nights (10th percentile)
  * waste events         3+ hours where use is far above the model's expected use
  * HVAC after hours     chilled-water (cooling) use when the building is closed
  * cooling in the cold  cooling running while it is below 10 C outside
  * heat + cool together heating and cooling both running hard at mild weather
  * water night flow     minimum night flow far above the building's normal night
                         minimum: the classic leak signal

Output: data/real/audit.csv (all buildings), models/real/sandbox/*.json.gz (selected)
        models/real/portfolio.json (summary for the dashboard)
"""
import gzip
import json
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

from train_global import DATA, FEATURES, add_features, apply_profile

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / "models" / "real"
SANDBOX = MODELS / "sandbox"
SANDBOX.mkdir(parents=True, exist_ok=True)
RS_PER_KWH, CO2 = 7.0, 0.716


def predict(df: pd.DataFrame, meter: str) -> np.ndarray:
    path = MODELS / f"{meter}_lgbm.txt"
    if not path.exists():
        return np.full(len(df), np.nan)
    model = lgb.Booster(model_file=str(path))
    df = apply_profile(df, pd.read_parquet(MODELS / f"{meter}_profile.parquet"))
    out = np.full(len(df), np.nan)
    m = df[meter].notna().to_numpy()
    if m.any():
        x = df.loc[m, FEATURES].copy()
        # the model only knows buildings it was trained with; others get NaN
        known = x.building_id.isin(model.pandas_categorical[0]).to_numpy()
        for c, cats in zip(["building_id", "kind", "site_id"], model.pandas_categorical):
            x[c] = pd.Categorical(x[c].astype(str), categories=cats)
        p = np.expm1(model.predict(x)).clip(0)
        p[~known] = np.nan
        out[m] = p
    return out


def runs(mask: np.ndarray, min_len: int):
    """Start/end index pairs of True-runs at least min_len long."""
    out, start = [], None
    for i, v in enumerate(np.append(mask, False)):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start >= min_len:
                out.append((start, i))
            start = None
    return out


def audit_building(g: pd.DataFrame) -> tuple[dict, dict]:
    g = g.sort_values("timestamp").reset_index(drop=True)
    e, exp = g.electricity.to_numpy(), g.exp_elec.to_numpy()
    hour = g.hour.to_numpy()
    closed = (g.off_day.to_numpy() == 1) | (hour < 7) | (hour >= 20)
    total = float(e.sum())
    res = {}

    # after-hours: compare to the building's own best closed hours
    floor = float(np.percentile(e[closed], 10)) if closed.any() else 0.0
    ah_excess = np.where(closed, np.clip(e - floor, 0, None), 0)
    res["after_hours_kwh"] = float(ah_excess.sum())
    res["after_hours_share"] = float(e[closed].sum() / total) if total else 0
    res["closed_floor_kw"] = floor

    # model-based waste events
    events = []
    if np.isfinite(exp).any():
        # a deployed model is re-calibrated as it runs: scale the expectation by how this building
        # compared with it over the previous 14 days (past data only), so a lasting change of use
        # (a new lab, longer opening hours) is not reported as waste for months on end
        ratio = pd.Series(np.where(np.isfinite(exp) & (exp > 0) & ~closed, e / np.where(exp > 0, exp, 1), np.nan))
        scale = ratio.rolling(14 * 24, min_periods=48).median().shift(1).fillna(1.0).clip(0.6, 1.6).to_numpy()
        exp = exp * scale
        r = e - exp
        rr = r[np.isfinite(r)]
        sigma = 1.4826 * np.median(np.abs(rr - np.median(rr))) if len(rr) else 0
        flag = np.isfinite(r) & (r > np.maximum(3 * sigma, 0.15 * np.nan_to_num(exp)))
        for a, b in runs(flag, 3):
            kwh = float(r[a:b].sum())
            events.append({"start": g.timestamp[a].isoformat(), "hours": b - a, "kwh": round(kwh, 1),
                           "closed": bool(closed[a:b].mean() > 0.5), "i": a})
        res["event_kwh"] = float(sum(ev["kwh"] for ev in events))
        res["events"] = len(events)
        res["sigma"] = float(sigma)
    else:
        res.update(event_kwh=0.0, events=0, sigma=0.0)

    # HVAC checks on chilled water (cooling) and hot water (heating)
    temp = g.airTemperature.to_numpy()
    hvac = {}
    if g.chilledwater.notna().sum() > 2000:
        c = g.chilledwater.fillna(0).to_numpy()
        cfloor = float(np.percentile(c[closed], 10)) if closed.any() else 0
        hvac["cooling_total"] = float(c.sum())
        hvac["cooling_after_hours"] = float(np.where(closed, np.clip(c - cfloor, 0, None), 0).sum())
        cold = (temp < 10) & (c > np.percentile(c, 50))
        hvac["cooling_in_cold_hours"] = int(cold.sum())
        hvac["cooling_in_cold"] = float(np.where(cold, c - np.percentile(c, 10), 0).clip(0).sum())
        if g.hotwater.notna().sum() > 2000:
            h = g.hotwater.fillna(0).to_numpy()
            both = (c > np.percentile(c, 60)) & (h > np.percentile(h, 60)) & (temp > 10) & (temp < 22)
            hvac["simultaneous_hours"] = int(both.sum())
            hvac["simultaneous_energy"] = float(np.where(both, np.minimum(c - np.percentile(c, 30), h - np.percentile(h, 30)), 0).clip(0).sum())
    res["hvac"] = hvac

    # water: minimum night flow per night (1 am to 5 am)
    water = {}
    if g.water.notna().sum() > 2000:
        w = g[["timestamp", "water"]].copy()
        w["night"] = (w.timestamp - pd.Timedelta(hours=1)).dt.date
        mnf = w[(g.hour >= 1) & (g.hour < 5)].groupby("night").water.min().dropna()
        base = float(np.percentile(mnf, 10))
        day_total = w.groupby(w.timestamp.dt.date).water.sum()
        # a leak does not stop: count only runs of 3+ nights in a row well above the building's normal night floor
        thr = base + max(base, 0.05 * float(w.water.mean()))
        high = (mnf > thr).to_numpy()
        keep = np.zeros(len(mnf), dtype=bool)
        for a, b in runs(high, 3):
            keep[a:b] = True
        leak_nights = mnf[keep]
        water["mnf_threshold"] = thr
        water["mnf_base"] = base
        water["leak_nights"] = int(len(leak_nights))
        water["leak_volume"] = float(((leak_nights - base) * 24).sum())
        water["leak_share"] = float(water["leak_volume"] / max(day_total.sum(), 1e-6))
        water["mnf_series"] = [round(float(x), 2) for x in mnf.to_numpy()]
    res["water"] = water

    avoid = res["after_hours_kwh"] + sum(ev["kwh"] for ev in events if not ev["closed"])
    res["avoidable_kwh"] = avoid
    res["avoidable_pct"] = avoid / total * 100 if total else 0
    res["total_kwh"] = total
    return res, {"events": events, "exp": exp}


def clean(x):
    """JSON has no NaN: turn missing numbers into null."""
    if isinstance(x, dict):
        return {k: clean(v) for k, v in x.items()}
    if isinstance(x, list):
        return [clean(v) for v in x]
    if isinstance(x, float) and not np.isfinite(x):
        return None
    return x


def bundle(b: str, g: pd.DataFrame, res: dict, extra: dict, info: dict) -> dict:
    g = g.sort_values("timestamp").reset_index(drop=True)
    r1 = lambda a: [None if not np.isfinite(x) else round(float(x), 1) for x in a]
    out = {
        "id": b, "name": b.split("_")[-1], "site": b.split("_")[0], "kind": info["kind"], "use": info["sub_primaryspaceusage"],
        "sqm": round(float(info["sqm"])), "yearbuilt": None if pd.isna(info["yearbuilt"]) else int(info["yearbuilt"]),
        "timezone": info["timezone"], "start": g.timestamp[0].isoformat(), "hours": len(g),
        "elec": r1(g.electricity.to_numpy()), "exp": r1(extra["exp"]), "temp": r1(g.airTemperature.to_numpy()),
        "closed": [int(x) for x in ((g.off_day == 1) | (g.hour < 7) | (g.hour >= 20)).to_numpy()],
        "events": extra["events"], "summary": {k: v for k, v in res.items() if k not in ("water",)},
    }
    if g.chilledwater.notna().sum() > 2000:
        out["chw"] = r1(g.chilledwater.to_numpy())
        out["chw_exp"] = r1(g.exp_chw.to_numpy())
    if g.hotwater.notna().sum() > 2000:
        out["hw"] = r1(g.hotwater.to_numpy())
    if res["water"]:
        out["water"] = r1(g.water.to_numpy())
        out["water_audit"] = res["water"]
    return out


def main():
    df = pd.read_parquet(DATA)
    df = df[df.timestamp.dt.year == 2017].copy()
    df = add_features(df)
    df["exp_elec"] = predict(df, "electricity")
    df["exp_chw"] = predict(df, "chilledwater")
    info = pd.read_csv(ROOT / "data" / "real" / "buildings.csv").set_index("building_id")
    scores = pd.read_csv(ROOT / "data" / "real" / "electricity_per_building.csv").set_index("building_id")

    rows, results = [], {}
    for b, g in df.groupby("building_id", observed=True):
        if len(g) < 6000:
            continue
        res, extra = audit_building(g)
        results[b] = (res, extra)
        h = res["hvac"]
        rows.append({"building_id": b, "kind": info.kind.get(b), "sqm": info.sqm.get(b), "total_kwh": res["total_kwh"],
                     "after_hours_share": res["after_hours_share"], "after_hours_kwh": res["after_hours_kwh"],
                     "event_kwh": res["event_kwh"], "events": res["events"], "avoidable_kwh": res["avoidable_kwh"],
                     "avoidable_pct": res["avoidable_pct"], "cvrmse": scores.cvrmse.get(b, np.nan),
                     "has_cooling": bool(h), "cooling_after_hours_share": h.get("cooling_after_hours", 0) / h["cooling_total"] if h.get("cooling_total") else np.nan,
                     "simultaneous_hours": h.get("simultaneous_hours", np.nan), "has_water": bool(res["water"]),
                     "leak_nights": res["water"].get("leak_nights", np.nan), "leak_share": res["water"].get("leak_share", np.nan)})
    audit = pd.DataFrame(rows)
    audit.to_csv(ROOT / "data" / "real" / "audit.csv", index=False)

    # pick the sandbox set: well-modelled buildings of each kind, favouring ones with cooling and water meters
    good = audit[audit.cvrmse < 35].copy()
    good["score"] = good.has_cooling * 2 + good.has_water * 3 + (good.avoidable_pct > 10) + np.random.default_rng(7).random(len(good))
    pick = []
    for kind, n in [("classroom", 14), ("lab", 10), ("office", 14)]:
        pick += good[good.kind == kind].sort_values("score", ascending=False).head(n).building_id.tolist()
    for b in pick:
        g = df[df.building_id == b]
        data = bundle(b, g, *results[b], info.loc[b])
        with gzip.open(SANDBOX / f"{b}.json.gz", "wt") as f:
            json.dump(clean(data), f, separators=(",", ":"))

    def stats(s):
        return {"median": round(float(s.median()), 1), "p75": round(float(s.quantile(0.75)), 1)}
    portfolio = {
        "buildings": int(len(audit)), "by_kind": audit.kind.value_counts().to_dict(),
        "total_kwh": round(float(audit.total_kwh.sum())), "avoidable_kwh": round(float(audit.avoidable_kwh.sum())),
        "avoidable_pct": stats(audit.avoidable_pct), "after_hours_share_pct": stats(audit.after_hours_share * 100),
        "avoidable_rupees_if_jammu": round(float(audit.avoidable_kwh.sum() * RS_PER_KWH)),
        "avoidable_co2_t": round(float(audit.avoidable_kwh.sum() * CO2 / 1000)),
        "cooling_buildings": int(audit.has_cooling.sum()),
        "cooling_after_hours_share_pct": stats(audit.cooling_after_hours_share.dropna() * 100),
        "simultaneous_heat_cool_buildings": int((audit.simultaneous_hours > 100).sum()),
        "water_buildings": int(audit.has_water.sum()), "buildings_with_leak_nights": int((audit.leak_nights > 5).sum()),
        "by_kind_avoidable_pct": {k: round(float(g.avoidable_pct.median()), 1) for k, g in audit.groupby("kind")},
        "sandbox": [{"id": b, "kind": info.kind[b], "use": info.sub_primaryspaceusage[b], "sqm": round(float(info.sqm[b])),
                     "avoidable_pct": round(float(results[b][0]["avoidable_pct"]), 1), "cooling": bool(results[b][0]["hvac"]),
                     "water": bool(results[b][0]["water"])} for b in pick],
    }
    (MODELS / "portfolio.json").write_text(json.dumps(portfolio, indent=1))
    print(json.dumps({k: v for k, v in portfolio.items() if k != "sandbox"}, indent=1))
    print(f"sandbox bundles: {len(pick)}")


if __name__ == "__main__":
    main()
