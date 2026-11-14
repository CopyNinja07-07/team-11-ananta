"""Learn what each room *should* use, given who is in it and the weather.

Model: Huber regression per room (a linear model that ignores outliers).
Why Huber and not plain least squares: the training data contains waste
events (ACs left on etc.). Huber loss down-weights those big errors, so the
baseline learns normal behaviour instead of learning the waste as normal.

Output: models/baseline.json (coefficients the dashboard uses live).
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import HuberRegressor, LinearRegression
from sklearn.metrics import mean_absolute_error

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.features import FEATURES, build  # noqa: E402

z = pd.read_csv(ROOT / "data" / "zones.csv")
z = z[z.cut == 0]  # grid meter reads zero in a cut, nothing to learn there
z["kw"] = z.kwh * 4

ts = pd.to_datetime(z.ts)
train = z[ts < "2026-04-01"]
test = z[ts >= "2026-04-01"]

out = {"features": FEATURES, "zones": {}}
print(f"{'room':8s} {'MAE huber':>10s} {'MAE ols':>9s} {'mean kW':>8s}")
for zone, g in train.groupby("zone"):
    X, y = build(g), g.kw.values
    huber = HuberRegressor(epsilon=1.2, alpha=1e-4, max_iter=2000).fit(X, y)
    ols = LinearRegression().fit(X, y)
    gt = test[test.zone == zone]
    Xt = build(gt)
    res = y - huber.predict(X)
    # robust spread of the residual (MAD), used to turn residuals into z-scores
    mad = float(np.median(np.abs(res - np.median(res))) * 1.4826)
    out["zones"][zone] = {
        "intercept": round(float(huber.intercept_), 5),
        "coef": [round(float(c), 5) for c in huber.coef_],
        "sigma": round(max(mad, 0.02), 4),
        "standby_kw": round(float(np.percentile(g.kw[g.occ == 0], 10)), 4),
    }
    print(f"{zone:8s} {mean_absolute_error(gt.kw, huber.predict(Xt)):10.3f} "
          f"{mean_absolute_error(gt.kw, ols.predict(Xt)):9.3f} {gt.kw.mean():8.3f}")

(ROOT / "models").mkdir(exist_ok=True)
(ROOT / "models" / "baseline.json").write_text(json.dumps(out, indent=1))
print("saved models/baseline.json")
