"""Expected power per room, from the model trained by ml/train_baseline.py."""
import json
import os
from pathlib import Path

from .campus import ROOT
from .features import row

MODEL_PATH = Path(os.environ.get("ECOGUARD_MODEL", ROOT / "models" / "baseline.json"))


class Baseline:
    def __init__(self, path: Path = MODEL_PATH):
        self.m = json.loads(Path(path).read_text())["zones"]

    def expected_kw(self, zone: str, occ: float, temp: float, hour: float) -> float:
        z = self.m.get(zone)
        if not z:
            return 0.0
        y = z["intercept"] + sum(c * f for c, f in zip(z["coef"], row(occ, temp, hour)))
        return max(0.0, y)

    def sigma(self, zone: str) -> float:
        return self.m[zone]["sigma"]
