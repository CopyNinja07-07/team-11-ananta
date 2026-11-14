"""Waste detector. It only sees meter readings, never the simulator's truth.

Three layers:
  1. Learned baseline: is a room using more than it should for the people in it?
  2. Physics rules: empty room drawing power, water flowing at 3 am,
     tank full but pump still running, pump running with no water coming out.
  3. Hidden waste: wiring resistance from board-vs-room voltage (heat in the
     wall) and earth-leakage current (damp wall), cross-checked with water.

update() takes one 15-minute reading for the whole building and returns
the list of alerts that are open after it.
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from statistics import median

from .baseline import Baseline
from .campus import TARIFF, ZONES, to_ist

STEP_MIN = 15

RULES = {
    "empty_room": {"title": "Power used in an empty room", "kind": "energy", "auto": "switch_off"},
    "over_use": {"title": "Using much more than expected", "kind": "energy", "auto": None},
    "overcool": {"title": "AC set too cold", "kind": "energy", "auto": "ac_setpoint"},
    "door_open": {"title": "AC fighting an open door or window", "kind": "energy", "auto": None},
    "wall_heat": {"title": "Heat building up inside the wall wiring", "kind": "hidden", "auto": None},
    "earth_leak": {"title": "Current leaking to earth (damp wall or bad insulation)", "kind": "hidden", "auto": None},
    "night_flow": {"title": "Water flowing when the building is empty", "kind": "water", "auto": "close_valve"},
    "overflow": {"title": "Overhead tank overflowing", "kind": "water", "auto": "pump_off"},
    "dry_run": {"title": "Pump running but no water coming out", "kind": "water", "auto": "pump_off"},
}


def severity(rule: str, info: dict) -> str:
    """high: safety risk or fast loss; medium: clear money loss; low: small or slow."""
    if rule in ("wall_heat", "dry_run", "overflow") or (rule == "earth_leak" and info.get("leak_ma", 0) >= 30):
        return "high"
    if rule == "night_flow":
        return "high" if info.get("inside_wall") else "medium" if info.get("lph", 0) > 40 else "low"
    if rule in ("empty_room", "over_use", "overcool", "door_open"):
        return "medium" if info.get("extra_kw", 0) >= 1.0 else "low"
    return "medium"


@dataclass
class Alert:
    id: int
    rule: str
    target: str
    start: int
    last: int
    kwh: float = 0.0
    litres: float = 0.0
    info: dict = field(default_factory=dict)
    end: int | None = None
    is_new: bool = True

    @property
    def key(self) -> str:
        return f"{self.rule}:{self.target}"

    @property
    def rupees(self) -> float:
        return self.kwh * TARIFF["rsPerKWh"] + self.litres / 1000 * TARIFF["rsPerKL"]

    @property
    def co2(self) -> float:
        return self.kwh * TARIFF["kgCO2PerKWh"]


class Detector:
    def __init__(self, baseline: Baseline, next_id: int = 1):
        self.baseline = baseline
        self.open: dict[str, Alert] = {}
        self.closed: list[Alert] = []
        self.next_id = next_id
        self.last_restore = -10**15
        self.was_cut = False
        self.r0: dict[str, float] = {}
        self.r_samples: dict[str, deque] = {}
        self.floor_flow = [deque(maxlen=12) for _ in range(3)]
        self.streak: dict[str, int] = {}

    def _streak(self, key: str, cond: bool, need: int) -> bool:
        self.streak[key] = self.streak.get(key, 0) + 1 if cond else 0
        return self.streak[key] >= need

    def _fire(self, ts: int, seen: set, rule: str, target: str, **info) -> Alert:
        key = f"{rule}:{target}"
        seen.add(key)
        a = self.open.get(key)
        if a is None:
            a = Alert(self.next_id, rule, target, ts, ts)
            self.next_id += 1
            self.open[key] = a
        else:
            a.is_new = False
        a.last = ts
        a.kwh += info.pop("kwh", 0.0)
        a.litres += info.pop("litres", 0.0)
        a.info.update(info)
        return a

    def update(self, r: dict) -> list[Alert]:
        ts = r["ts"]
        t = to_ist(ts)
        hour = t.hour + t.minute / 60
        temp = r["temp_c"]
        cut = not r["grid_on"]
        seen: set[str] = set()
        if self.was_cut and not cut:
            self.last_restore = ts
        self.was_cut = cut

        nodes = r["nodes"]
        # ---------- energy (the grid meter reads ~0 in a cut, so skip then) ----------
        if not cut:
            for n in nodes:
                zid, cfg = n["zone"], ZONES[n["zone"]]
                exp = self.baseline.expected_kw(zid, n["people"], temp, hour)
                sigma = self.baseline.sigma(zid)
                extra = n["kw"] - exp
                # after a power cut, inverter rooms recharge their battery (~0.6 kW for a few hours).
                # That is the cost of the outage, not someone leaving things on, so don't blame the room.
                if cfg["inverter"] and (ts - self.last_restore) < 8 * 3600_000:
                    extra -= 0.65

                empty_waste = n["people"] == 0 and extra > max(0.2, 4 * sigma)
                if self._streak(f"e:{zid}", empty_waste, 2):
                    after_cut = (ts - self.last_restore) / 60000 < 60
                    self._fire(ts, seen, "empty_room", zid, kwh=extra / 4, extra_kw=round(extra, 2),
                               cause=guess_cause(cfg, extra, temp, after_cut))

                # HVAC: the room's wall sensor (indoor temperature) and the AC circuit's own current clamp
                t_in, ac_kw = n.get("t_in"), n.get("ac_kw")
                hvac_issue = False
                if t_in is not None and ac_kw is not None and cfg["acUnits"]:
                    rated = cfg["acUnits"] * cfg["acKW"]
                    cold = n["people"] > 0 and ac_kw > 0.3 and t_in < 21.5
                    if self._streak(f"c:{zid}", cold, 2):
                        # BEE: every degree below 24 C costs about 6% more AC energy; a 17-18 C setpoint costs ~30-40%
                        xkw = ac_kw * min(0.45, 0.06 * (24 - t_in) + 0.1)
                        self._fire(ts, seen, "overcool", zid, kwh=xkw / 4, t_in=round(t_in, 1), ac_kw=round(ac_kw, 2), extra_kw=round(xkw, 2))
                        hvac_issue = True
                    door = n["people"] > 0 and ac_kw >= 0.95 * rated and t_in > 27 and temp > 30
                    if self._streak(f"d:{zid}", door, 4):
                        xkw = ac_kw * 0.35
                        self._fire(ts, seen, "door_open", zid, kwh=xkw / 4, t_in=round(t_in, 1), ac_kw=round(ac_kw, 2), extra_kw=round(xkw, 2))
                        hvac_issue = True

                over = n["people"] > 0 and not hvac_issue and extra > max(0.6, 6 * sigma) and extra / max(exp, 0.1) > 0.35
                if self._streak(f"o:{zid}", over, 4):
                    self._fire(ts, seen, "over_use", zid, kwh=extra / 4, extra_kw=round(extra, 2), expected_kw=round(exp, 2))

                # wiring resistance R = (V at board - V at room) / I, only when current is measurable
                samples = self.r_samples.setdefault(zid, deque(maxlen=96))
                if n["amps"] > 1.5:
                    samples.append((n["v_board"] - n["v_room"]) / n["amps"])
                    if zid not in self.r0 and len(samples) >= 40:
                        self.r0[zid] = median(samples)
                if len(samples) >= 12:
                    r_now = median(list(samples)[-24:])
                    r0 = self.r0.get(zid, cfg["rWire"])
                    if r_now > r0 * 1.6 and r_now - r0 > 0.1:
                        extra_r = r_now - r0
                        heat_w = n["amps"] ** 2 * extra_r
                        peak_amps = (cfg["acUnits"] * cfg["acKW"] * 1000 + cfg["lightW"] + cfg["fans"] * 60 + cfg["pcs"] * 95) / (220 * 0.92)
                        self._fire(ts, seen, "wall_heat", zid, kwh=heat_w / 4000, r_now=round(r_now, 3), r0=round(r0, 3),
                                   heat_w=round(heat_w, 1), peak_heat_w=round(peak_amps ** 2 * extra_r), peak_amps=round(peak_amps, 1))

        # earth leakage, worst circuit on each floor, above 15 mA for 2 hours
        for f in (0, 1, 2):
            ma = max(n["leak_ma"] for n in nodes if ZONES[n["zone"]]["floor"] == f)
            if self._streak(f"l:{f}", ma > 15, 8):
                self._fire(ts, seen, "earth_leak", f"F{f}", leak_ma=ma)

        # ---------- water ----------
        w = r["water"]
        empty = all(n["people"] == 0 for n in nodes)
        for f, litres in enumerate(w["floor_l"]):
            buf = self.floor_flow[f]
            buf.append(litres * 4 if empty else None)
            vals = [x for x in buf if x is not None]
            # a leak never drops to zero: look at the *minimum* flow over 3 empty hours
            min_flow = min(vals) if len(vals) >= 8 else 0.0
            if min_flow > 6:
                big = min_flow > 40
                damp = f"earth_leak:F{f}" in self.open
                if big and damp:
                    cause = "Leak, and the wall on this floor is getting damp (earth leakage rising): likely a pipe leaking inside the wall"
                elif big:
                    cause = "Pipe leak (steady flow)"
                else:
                    cause = "Running toilet cistern or dripping tap"
                self._fire(ts, seen, "night_flow", f"F{f}", litres=min_flow / 4, lph=round(min_flow, 1), cause=cause, inside_wall=big and damp)

        if self._streak("ovf", w["pump_on"] and w["tank_pct"] >= 99.5, 1):
            self._fire(ts, seen, "overflow", "TANK", litres=w.get("overflow_l") or w["pump_l"], kwh=w["pump_kwh"])
        if self._streak("dry", w["pump_on"] and w["pump_l"] < 1, 2):
            self._fire(ts, seen, "dry_run", "PUMP", kwh=w["pump_kwh"])

        # close alerts whose condition has been clear for 30 minutes
        for key in list(self.open):
            a = self.open[key]
            if key not in seen:
                a.is_new = False
                if ts - a.last >= 30 * 60000:
                    a.end = a.last
                    self.closed.append(self.open.pop(key))
        return list(self.open.values())


def guess_cause(cfg: dict, extra_kw: float, temp: float, after_cut: bool) -> str:
    """Use the asset register to say what is probably on. Size of the extra load
    tells us a lot: an AC is ~1.6 kW, a lab of PCs ~2 kW, lights+fans ~1 kW."""
    parts = []
    if after_cut:
        parts.append("came back on by itself after the power cut")
    if cfg["acUnits"] and extra_kw > cfg["acKW"] * 0.6:
        parts.append("AC still running")
    elif cfg["kind"] == "lab" and extra_kw > 1:
        parts.append("lab PCs left on")
    elif cfg["heaterW"] and extra_kw > 1.5 and temp < 15:
        parts.append("room heater left on")
    else:
        parts.append("lights and fans left on")
    return ", ".join(parts)
