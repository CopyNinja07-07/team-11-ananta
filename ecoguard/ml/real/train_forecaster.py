"""Day-ahead forecaster: a sequence model (LSTM encoder + MLP head) that reads the
last 7 days of a building's hourly electricity with weather and calendar, and
predicts the next 24 hours. One model for all 693 real classrooms, labs and
offices in BDG2. Trained on 2016, tested on every day of 2017.

Compared against the two forecasts a facility manager would use without it:
'same as yesterday' and 'same as the same day last week'.

Runs on CPU in about 10 minutes; uses a GPU automatically if one is present.
Output: models/real/forecaster.pt, models/real/forecaster_metrics.json
"""
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch import nn

from train_global import DATA, add_features

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "models" / "real"
PAST, AHEAD = 168, 24
DEV = "cuda" if torch.cuda.is_available() else "cpu"
torch.manual_seed(7)
np.random.seed(7)


class Forecaster(nn.Module):
    def __init__(self, n_past=6, n_future=4, hidden=128):
        super().__init__()
        self.enc = nn.LSTM(n_past, hidden, num_layers=2, batch_first=True, dropout=0.1)
        self.head = nn.Sequential(nn.Linear(hidden + AHEAD * n_future, 256), nn.GELU(), nn.Dropout(0.1),
                                  nn.Linear(256, 128), nn.GELU(), nn.Linear(128, AHEAD))

    def forward(self, past, future):
        _, (h, _) = self.enc(past)
        return self.head(torch.cat([h[-1], future.flatten(1)], dim=1))


def build_arrays():
    df = pd.read_parquet(DATA, columns=["timestamp", "building_id", "timezone", "electricity", "airTemperature", "sqm"])
    df = add_features(df)
    grid = []
    for b, g in df.groupby("building_id", observed=True):
        g = g.set_index("timestamp").reindex(pd.date_range("2016-01-01", "2017-12-31 23:00", freq="h"))
        y = np.log1p(g.electricity.to_numpy(dtype="float32"))
        train_y = y[:8784]
        mu, sd = np.nanmean(train_y), np.nanstd(train_y) + 1e-3
        if not np.isfinite(mu) or np.isnan(train_y).mean() > 0.3 or np.isnan(y[8784:]).mean() > 0.3:
            continue
        idx = g.index
        temp = g.airTemperature.interpolate(limit_direction="both").to_numpy(dtype="float32")
        hour = idx.hour.to_numpy()
        off = np.where(g.off_day.isna(), idx.dayofweek >= 5, g.off_day).astype("float32")
        feats = np.stack([(y - mu) / sd, (temp - 15) / 10, np.sin(2 * np.pi * hour / 24), np.cos(2 * np.pi * hour / 24),
                          off, np.isnan(y).astype("float32")], axis=1)
        feats[:, 0] = np.nan_to_num(feats[:, 0])
        grid.append((str(b), feats.astype("float32"), y, mu, sd))
    return grid


def windows(grid, year):
    start, end = (PAST, 8784 - AHEAD) if year == 2016 else (8784, len(grid[0][1]) - AHEAD)
    P, F, Y, M = [], [], [], []
    for bi, (_, x, y, mu, sd) in enumerate(grid):
        for t in range(start, end + 1, 24):
            target = y[t:t + AHEAD]
            if np.isnan(target).mean() > 0.2:
                continue
            P.append(x[t - PAST:t])
            F.append(x[t:t + AHEAD, 1:5])
            Y.append((target - mu) / sd)
            M.append((bi, t))
    return np.stack(P), np.stack(F), np.stack(Y).astype("float32"), np.array(M)


def main():
    t0 = time.time()
    grid = build_arrays()
    print(f"{len(grid)} buildings in {time.time() - t0:.0f} s")
    Ptr, Ftr, Ytr, _ = windows(grid, 2016)
    Pte, Fte, Yte, Mte = windows(grid, 2017)
    print(f"train windows {len(Ptr):,}, test windows {len(Pte):,}")

    model = Forecaster().to(DEV)
    opt = torch.optim.AdamW(model.parameters(), lr=2e-3, weight_decay=1e-4)
    epochs, bs = 4, 512
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=3e-3, total_steps=epochs * (len(Ptr) // bs + 1))
    lossf = nn.HuberLoss(delta=1.0)
    Pt, Ft, Yt = map(torch.from_numpy, (Ptr, Ftr, np.nan_to_num(Ytr)))
    mask_t = torch.from_numpy(~np.isnan(Ytr))
    for ep in range(epochs):
        model.train()
        perm = torch.randperm(len(Pt))
        tot = 0.0
        for i in range(0, len(perm), bs):
            j = perm[i:i + bs]
            pred = model(Pt[j].to(DEV), Ft[j].to(DEV))
            m = mask_t[j].to(DEV)
            loss = lossf(pred[m], Yt[j].to(DEV)[m])
            opt.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            sched.step()
            tot += loss.item() * len(j)
        print(f"epoch {ep + 1}/{epochs}  loss {tot / len(Pt):.4f}  ({time.time() - t0:.0f} s)")

    model.eval()
    with torch.no_grad():
        pred = torch.cat([model(torch.from_numpy(Pte[i:i + 4096]).to(DEV), torch.from_numpy(Fte[i:i + 4096]).to(DEV)).cpu()
                          for i in range(0, len(Pte), 4096)]).numpy()
    # back to kWh and score per building against the two simple forecasts
    rows = []
    for bi, (b, x, y, mu, sd) in enumerate(grid):
        sel = Mte[:, 0] == bi
        if sel.sum() < 200:
            continue
        ts = Mte[sel, 1]
        actual = np.expm1(Yte[sel] * sd + mu)
        model_kwh = np.expm1(pred[sel] * sd + mu)
        yday = np.stack([np.expm1(y[t - 24:t]) for t in ts])
        week = np.stack([np.expm1(y[t - 168:t - 144]) for t in ts])
        ok = np.isfinite(actual) & np.isfinite(yday) & np.isfinite(week)
        mean = actual[ok].mean()
        cv = lambda p: float(np.sqrt(((actual[ok] - p[ok]) ** 2).mean()) / mean * 100)
        rows.append({"building": b, "model": cv(model_kwh), "yesterday": cv(yday), "last_week": cv(week)})
    res = pd.DataFrame(rows)
    metrics = {
        "buildings": int(len(res)), "train_windows": int(len(Ptr)), "test_days": int(len(Pte)), "epochs": epochs,
        "parameters": int(sum(p.numel() for p in model.parameters())), "device": DEV, "train_seconds": round(time.time() - t0),
        "median_cvrmse": {k: round(float(res[k].median()), 1) for k in ["model", "yesterday", "last_week"]},
        "model_beats_both_pct": round(float(((res.model < res.yesterday) & (res.model < res.last_week)).mean() * 100), 1),
    }
    torch.save(model.state_dict(), OUT / "forecaster.pt")
    (OUT / "forecaster_metrics.json").write_text(json.dumps(metrics, indent=1))
    print(json.dumps(metrics, indent=1))


if __name__ == "__main__":
    main()
