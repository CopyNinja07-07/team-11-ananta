"""Next-24-hour forecast for the whole block.

forecast(hour) = sum over rooms of baseline(expected people, expected temp, hour)
                 + average pump energy for that hour.

Expected people come from what the occupancy sensors saw on the same weekday
and hour over the last 4 weeks (the timetable repeats every week). Expected
temperature is the Jammu climate normal (swap in an IMD forecast later).
"""
from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .baseline import Baseline
from .campus import ZONES, normal_temp, to_ist
from .models import EnergyReading, OccupancyRecord, WaterReading

HOUR = 3600_000
WEEK = 7 * 24 * HOUR
HALF = HOUR // 2   # IST is UTC+5:30, so IST hours start at :30 UTC


def hour_start(ts: int) -> int:
    return ts - (ts + HALF) % HOUR


def occupancy_profile(db: Session, now: int) -> dict:
    rows = db.execute(
        select(OccupancyRecord.zone_id, OccupancyRecord.ts, OccupancyRecord.people)
        .where(OccupancyRecord.ts > now - 4 * WEEK)
    ).all()
    acc = defaultdict(list)
    for zone, ts, people in rows:
        t = to_ist(ts)
        acc[(zone, t.weekday(), t.hour)].append(people)
    return {k: sum(v) / len(v) for k, v in acc.items()}


def pump_profile(db: Session, now: int) -> dict:
    rows = db.execute(select(WaterReading.ts, WaterReading.pump_kwh).where(WaterReading.ts > now - 2 * WEEK)).all()
    acc = defaultdict(list)
    for ts, kwh in rows:
        acc[to_ist(ts).hour].append(kwh * 4)
    return {h: sum(v) / len(v) for h, v in acc.items()}


def forecast(db: Session, baseline: Baseline, now: int, hours: int = 24) -> list[dict]:
    prof = occupancy_profile(db, now)
    pump = pump_profile(db, now)
    start = hour_start(now) + HOUR
    out = []
    for i in range(hours):
        ts = start + i * HOUR
        t = to_ist(ts)
        temp = normal_temp(ts + HOUR // 2)
        kw = 0.0
        for zid in ZONES:
            occ = prof.get((zid, t.weekday(), t.hour), 0.0)
            # a room is either in use or not; use the typical headcount when it usually is
            kw += baseline.expected_kw(zid, round(occ), temp, t.hour + 0.5)
        kw += pump.get(t.hour, 0.0)
        out.append({"ts": ts, "kwh": round(kw, 3), "temp": round(temp, 1)})
    return out


def actual_hourly(db: Session, since: int, until: int) -> list[dict]:
    e = db.execute(
        select((EnergyReading.ts - (EnergyReading.ts + HALF) % HOUR).label("h"), func.sum(EnergyReading.kwh))
        .where(EnergyReading.ts >= since, EnergyReading.ts < until).group_by("h")
    ).all()
    p = dict(db.execute(
        select((WaterReading.ts - (WaterReading.ts + HALF) % HOUR).label("h"), func.sum(WaterReading.pump_kwh))
        .where(WaterReading.ts >= since, WaterReading.ts < until).group_by("h")
    ).all())
    return [{"ts": h, "kwh": round(k + (p.get(h) or 0), 3)} for h, k in sorted(e)]
