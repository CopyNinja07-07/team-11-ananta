"""The pipeline that runs for every 15-minute reading:

   store readings -> run detector -> sync alerts (+ advice) -> auto control
   -> update daily savings -> return commands for the building's relays

Kept separate from the web layer so it can be tested without HTTP.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .advice import advise
from .baseline import Baseline
from .campus import BUILDING, TARIFF, WATER, ZONES, to_ist
from .detector import RULES, Detector, severity
from .models import (Alert, Building, ControlAction, Device, EnergyReading, OccupancyRecord, SavingsDaily, Setting,
                     User, WaterReading, Zone)

HOUR = 3600_000

DEFAULT_SETTINGS = {
    "auto_mode": True,            # act on its own after the grace period
    "grace_min": 15,              # time a manager gets to dismiss before auto action
    "auto_work_orders": True,     # raise maintenance tickets for leaks, wiring, pump faults
    "maintenance_hours": 24,      # how long staff usually take to fix a ticket
    "language": "en",
    "scheduled_shutdown": False,  # at closing time, switch off every room that is already empty
    "closing_hour": 19,
}


class Pipeline:
    def __init__(self, baseline: Baseline):
        self.baseline = baseline
        self.detector = Detector(baseline)
        self.alert_rows: dict[str, int] = {}   # detector key -> alerts.id
        self.actioned: set[str] = set()
        self.ticketed: set[str] = set()
        self.now = 0
        self.latest: dict | None = None

    # ------------------------------------------------------------------ setup
    def seed(self, db: Session) -> None:
        # The detector starts empty after a restart, so an alert left open in the
        # database would never close. End it at its last reading; it re-opens on
        # the next reading if the problem is still there.
        for row in db.scalars(select(Alert).where(Alert.end.is_(None))):
            row.end = row.last
            if row.status == "open":
                row.status = "resolved"
        db.commit()
        if db.get(Building, BUILDING["id"]):
            return
        db.add(Building(id=BUILDING["id"], name=BUILDING["name"], city=BUILDING["city"], floors=len(BUILDING["floors"])))
        for z in ZONES.values():
            equipment = {k: z[k] for k in ("lightW", "fans", "acKW", "acUnits", "pcs", "heaterW", "standbyW", "inverter")}
            db.add(Zone(id=z["id"], building_id=BUILDING["id"], name=z["name"], floor=z["floor"], kind=z["kind"],
                        capacity=z["cap"], equipment=equipment))
            db.add(Device(id=f"esp32-{z['id']}", zone_id=z["id"], kind="energy_node"))
            db.add(Device(id=f"cam-{z['id']}", zone_id=z["id"], kind="camera"))
            db.add(Device(id=f"relay-{z['id']}", zone_id=z["id"], kind="relay"))
        db.add(Device(id="esp32-water", kind="water_node"))
        db.add(Device(id="relay-pump", kind="relay"))
        for f in range(3):
            db.add(Device(id=f"valve-F{f}", kind="valve"))
        db.add_all([User(name="Estate Officer", role="admin"), User(name="Facility Manager", role="facility_manager"),
                    User(name="Electrician", role="maintenance"), User(name="Plumber", role="maintenance")])
        for k, v in DEFAULT_SETTINGS.items():
            db.add(Setting(key=k, value=v))
        db.commit()

    def settings(self, db: Session) -> dict:
        s = dict(DEFAULT_SETTINGS)
        s.update({r.key: r.value for r in db.scalars(select(Setting))})
        return s

    # ------------------------------------------------------------------ ingest
    def ingest(self, db: Session, r: dict) -> list[dict]:
        ts = r["ts"]
        self.now = ts
        cfg = self.settings(db)
        hour = to_ist(ts).hour + to_ist(ts).minute / 60
        total_kwh = 0.0
        for n in r["nodes"]:
            exp = self.baseline.expected_kw(n["zone"], n["people"], r["temp_c"], hour)
            n["expected_kw"] = round(exp, 3)
            db.add(EnergyReading(zone_id=n["zone"], ts=ts, kwh=n["kwh"], kw=n["kw"], expected_kw=exp, v_board=n["v_board"],
                                 v_room=n["v_room"], amps=n["amps"], leak_ma=n["leak_ma"],
                                 t_in=n.get("t_in"), rh=n.get("rh"), ac_kw=n.get("ac_kw")))
            db.add(OccupancyRecord(zone_id=n["zone"], ts=ts, people=n["people"], source=n.get("source", "cv")))
            total_kwh += n["kwh"]
        w = r["water"]
        db.add(WaterReading(ts=ts, temp_c=r["temp_c"], grid_on=r["grid_on"], floor0_l=w["floor_l"][0], floor1_l=w["floor_l"][1],
                            floor2_l=w["floor_l"][2], pump_on=w["pump_on"], pump_l=w["pump_l"], pump_kwh=w["pump_kwh"],
                            tank_pct=w["tank_pct"], sump_pct=w.get("sump_pct"), supply_on=w.get("supply_on")))
        total_kwh += w["pump_kwh"]

        day = self._day(db, ts)
        day.kwh_used += total_kwh
        day.litres_used += sum(w["floor_l"])

        # --- detection
        before = {k: (a.kwh, a.litres) for k, a in self.detector.open.items()}
        open_alerts = self.detector.update(r)
        for a in open_alerts:
            k0, l0 = before.get(a.key, (0.0, 0.0))
            day.kwh_wasted += a.kwh - k0
            day.litres_wasted += a.litres - l0
            self._sync_alert(db, a)
        for a in self.detector.closed:
            if a.key in self.alert_rows and a.end is not None:
                row = db.get(Alert, self.alert_rows.pop(a.key))
                row.end = a.end
                if row.status == "open":
                    row.status = "resolved"
                self.actioned.discard(a.key)
                self.ticketed.discard(a.key)
        self.detector.closed.clear()

        # --- control
        commands = self._auto_control(db, cfg, open_alerts, day)
        commands += self._scheduled(db, cfg, r, day)
        db.commit()
        self.latest = r
        return commands

    def _scheduled(self, db: Session, cfg: dict, r: dict, day: SavingsDaily) -> list[dict]:
        """Scheduled mode: once a day at closing time, switch off non-essential loads in rooms nobody is in.
        A room with people in it is never touched; it is picked up later by the empty-room rule."""
        t = to_ist(self.now)
        if not cfg.get("scheduled_shutdown") or t.hour != cfg.get("closing_hour", 19) or t.minute != 0 or not r.get("grid_on", True):
            return []
        cmds = []
        for n in r["nodes"]:
            standby = ZONES[n["zone"]]["standbyW"] / 1000
            if n["people"] == 0 and n["kw"] > standby + 0.1:
                cmds.append(self.issue(db, "switch_off", n["zone"], mode="scheduled", day=day))
        return cmds

    def _day(self, db: Session, ts: int) -> SavingsDaily:
        key = to_ist(ts).strftime("%Y-%m-%d")
        d = db.get(SavingsDaily, key)
        if d is None:
            d = SavingsDaily(date=key, kwh_used=0, kwh_wasted=0, kwh_avoided=0, litres_used=0, litres_wasted=0,
                             litres_avoided=0, rupees_saved=0, co2_avoided=0)
            db.add(d)
            db.flush()
        return d

    def _sync_alert(self, db: Session, a) -> None:
        rid = self.alert_rows.get(a.key)
        row = db.get(Alert, rid) if rid else None
        if row is None:
            rule = RULES[a.rule]
            row = Alert(rule=a.rule, target=a.target, kind=rule["kind"], title=rule["title"], start=a.start, status="open")
            db.add(row)
            db.flush()
            self.alert_rows[a.key] = row.id
        row.last, row.kwh, row.litres = a.last, a.kwh, a.litres
        row.rupees, row.co2 = a.rupees, a.co2
        row.info = dict(a.info)
        row.advice_en, row.advice_hi = advise(a.rule, a.target, a.info, a.start)
        row.severity = severity(a.rule, a.info)

    # ------------------------------------------------------------------ control
    def _auto_control(self, db: Session, cfg: dict, open_alerts, day: SavingsDaily) -> list[dict]:
        cmds = []
        for a in open_alerts:
            # only act on what is true right now (an alert stays open 30 min after it clears)
            if a.key in self.actioned or a.last != self.now:
                continue
            row = db.get(Alert, self.alert_rows[a.key])
            if row.feedback == "dismissed":
                continue
            age_min = (self.now - a.start) / 60000
            rule = RULES[a.rule]
            action = None
            if cfg["auto_mode"] and rule["auto"] and age_min >= cfg["grace_min"]:
                if rule["auto"] == "close_valve" and not a.info.get("lph", 0) > 40:
                    action = None   # small drips: no need to shut a valve, raise a ticket instead
                else:
                    action = rule["auto"]
            if action:
                cmds.append(self.issue(db, action, a.target, mode="auto", alert=row, day=day))
            # the repair ticket goes out at once; the relay/valve/pump action still waits for the grace period
            needs_ticket = a.rule in ("wall_heat", "earth_leak", "night_flow", "overflow", "dry_run")
            if cfg["auto_work_orders"] and needs_ticket and a.key not in self.ticketed:
                cmds.append(self.issue(db, "work_order", a.target, mode="auto", alert=row, day=day,
                                       params={"rule": a.rule, "due": self.now + cfg["maintenance_hours"] * HOUR}))
                self.ticketed.add(a.key)
            if action or (not rule["auto"] and a.key in self.ticketed):
                self.actioned.add(a.key)
        return [c for c in cmds if c]

    def issue(self, db: Session, command: str, target: str, mode: str = "manual", alert: Alert | None = None,
              day: SavingsDaily | None = None, params: dict | None = None, by: str = "system") -> dict:
        avoided_kwh, avoided_l = estimate_avoided(command, alert, self.now)
        act = ControlAction(ts=self.now, alert_id=alert.id if alert else None, target=target, command=command, mode=mode,
                            status="sent", params=params or {}, avoided_kwh=avoided_kwh, avoided_l=avoided_l, issued_by=by)
        db.add(act)
        if alert is not None and command != "work_order":
            alert.status = "actioned"
        day = day or self._day(db, self.now)
        day.kwh_avoided += avoided_kwh
        day.litres_avoided += avoided_l
        rs = avoided_kwh * TARIFF["rsPerKWh"] + avoided_l / 1000 * TARIFF["rsPerKL"]
        day.rupees_saved += rs
        day.co2_avoided += avoided_kwh * TARIFF["kgCO2PerKWh"]
        db.flush()
        return {"id": act.id, "command": command, "target": target, "params": params or {}}


def estimate_avoided(command: str, alert: Alert | None, now: int) -> tuple[float, float]:
    """Rough live estimate of what an action saves, shown on the dashboard.
    The before-vs-after experiment measures the real number."""
    if alert is None:
        return 0.0, 0.0
    info = alert.info or {}
    t = to_ist(now)
    h = t.hour + t.minute / 60
    if command == "switch_off":
        if 9 <= h < 16:
            hours = 1.0          # daytime: usually someone walks in for the next class within the hour
        else:
            to_guard = max(0.0, 22 - h)
            to_morning = (24 - h) + 9 if h >= 9 else 9 - h
            hours = 0.5 * (to_guard or to_morning) + 0.5 * to_morning   # half the time the 10 pm guard round catches it
        return info.get("extra_kw", 0) * min(hours, 16), 0.0
    if command == "pump_off" and alert.rule == "overflow":
        return WATER["pumpKW"] * 0.75, WATER["pumpLpm"] * 45
    if command == "pump_off" and alert.rule == "dry_run":
        return WATER["pumpKW"] * 0.75 * 12, 0.0
    if command == "close_valve":
        return 0.0, info.get("lph", 0) * 24
    if command == "ac_setpoint":
        return info.get("extra_kw", 0) * 4, 0.0     # rest of the class session at 24 C
    return 0.0, 0.0
