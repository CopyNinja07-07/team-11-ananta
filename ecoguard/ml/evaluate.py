"""Score the detector against the simulator's ground truth.

Replays data/zones.csv + data/water.csv through backend/app/detector.py,
exactly as the live system sees them, then matches alerts to faults in
data/faults.csv. Generate a fresh year with a seed the model never saw:
    cd sensors && node generate.mjs 365 99
    cd ml && python evaluate.py
"""
import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.baseline import Baseline  # noqa: E402
from app.campus import IST  # noqa: E402
from app.detector import Detector  # noqa: E402

MATCH = {
    "lights_left_on": ["empty_room"], "ac_left_on": ["empty_room"], "pcs_left_on": ["empty_room"],
    "heater_left_on": ["empty_room"], "comeback": ["empty_room"], "overcool": ["overcool", "over_use"],
    "door_open": ["door_open", "over_use"],
    "loose_joint": ["wall_heat"], "leak": ["night_flow", "earth_leak"], "cistern": ["night_flow"],
    "float_fail": ["overflow"], "dry_run": ["dry_run"],
}


def to_ms(s: pd.Series) -> pd.Series:
    # pandas may store datetimes in s, ms, us or ns depending on version, so pin the unit first
    return pd.to_datetime(s).dt.tz_localize(IST).dt.as_unit("ms").astype("int64")


def replay(data: Path) -> Detector:
    z = pd.read_csv(data / "zones.csv")
    w = pd.read_csv(data / "water.csv")
    z["ms"] = to_ms(z.ts)
    w["ms"] = to_ms(w.ts)
    det = Detector(Baseline())
    zg = {ms: g for ms, g in z.groupby("ms")}
    for row in w.itertuples(index=False):
        g = zg[row.ms]
        det.update({
            "ts": int(row.ms), "temp_c": float(row.temp), "grid_on": row.cut == 0,
            "nodes": [{"zone": n.zone, "people": int(n.occ), "kw": n.kwh * 4, "v_board": n.vdb, "v_room": n.vroom,
                       "amps": n.amps, "leak_ma": n.leak_ma, "t_in": n.t_in, "rh": n.rh, "ac_kw": n.ac_kw}
                      for n in g.itertuples(index=False)],
            "water": {"floor_l": [row.f0_l, row.f1_l, row.f2_l], "pump_on": bool(row.pump_on), "pump_l": row.pump_l,
                      "pump_kwh": row.pump_kwh, "tank_pct": row.tank_pct, "overflow_l": row.overflow_l},
        })
    return det


def main(data: Path = ROOT / "data") -> dict:
    det = replay(data)
    alerts = det.closed + list(det.open.values())
    for a in alerts:
        a.end = a.end or a.last
    f = pd.read_csv(data / "faults.csv")
    f["start_ms"] = to_ms(f.start)
    f["end_ms"] = to_ms(f.end.fillna(f.start.max()))
    hour = 3600_000

    def hits(fr):
        return sorted((a for a in alerts if a.rule in MATCH[fr.type] and a.target == fr.target
                       and a.start <= fr.end_ms + hour and a.end >= fr.start_ms), key=lambda a: a.start)

    by_type = {}
    for fr in f.itertuples(index=False):
        s = by_type.setdefault(fr.type, {"n": 0, "no_waste": 0, "caught": 0, "delays": [], "waste_kwh": 0.0, "waste_l": 0.0})
        if fr.waste_kwh < 0.05 and fr.waste_l < 5:   # nothing measurable to catch
            s["no_waste"] += 1
            continue
        s["n"] += 1
        s["waste_kwh"] += fr.waste_kwh
        s["waste_l"] += fr.waste_l
        h = hits(fr)
        if h:
            s["caught"] += 1
            s["delays"].append(max(0, (h[0].start - fr.start_ms) / hour))

    by_rule = {}
    for a in alerts:
        ok = any(a.rule in MATCH[fr.type] and a.target == fr.target and a.start <= fr.end_ms + hour and a.end >= fr.start_ms
                 for fr in f.itertuples(index=False))
        s = by_rule.setdefault(a.rule, {"alerts": 0, "correct": 0})
        s["alerts"] += 1
        s["correct"] += ok

    caught = sum(s["caught"] for s in by_type.values())
    total = sum(s["n"] for s in by_type.values())
    correct = sum(s["correct"] for s in by_rule.values())
    out = {
        "faults_with_waste": total, "alerts": len(alerts),
        "recall": round(caught / total, 3), "precision": round(correct / len(alerts), 3),
        "by_fault": {k: {"n": s["n"], "caught": s["caught"], "recall": round(s["caught"] / s["n"], 2) if s["n"] else None,
                         "median_delay_h": round(float(pd.Series(s["delays"]).median()), 2) if s["delays"] else None,
                         "waste_kwh": round(s["waste_kwh"]), "waste_l": round(s["waste_l"])} for k, s in sorted(by_type.items())},
        "by_rule": {k: {**s, "precision": round(s["correct"] / s["alerts"], 2)} for k, s in sorted(by_rule.items())},
    }
    (ROOT / "models" / "eval.json").write_text(json.dumps(out, indent=1))
    return out


if __name__ == "__main__":
    import sys
    r = main(Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "test")
    print(f"recall {r['recall']}  precision {r['precision']}  ({r['faults_with_waste']} faults, {r['alerts']} alerts)")
    for k, v in r["by_fault"].items():
        print(f"  {k:15s} {v['caught']:3d}/{v['n']:<3d} delay {v['median_delay_h']}h")
    for k, v in r["by_rule"].items():
        print(f"  {k:12s} precision {v['precision']}  ({v['alerts']} alerts)")
