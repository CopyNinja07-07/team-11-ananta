"""ECOGUARD AI backend (FastAPI).

Run:  uvicorn app.main:app --reload
Docs: http://localhost:8000/docs
"""
from __future__ import annotations

import asyncio
import csv
import io
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from .baseline import Baseline
from .campus import BUILDING, ROOT, TARIFF, WATER, ZONES
from .db import Base, SessionLocal, engine
from .forecast import HOUR, actual_hourly, forecast, hour_start
from .models import Alert, ControlAction, EnergyReading, SavingsDaily, Setting, WaterReading, Zone
from .service import Pipeline

pipeline = Pipeline(Baseline())
pending: list[dict] = []          # manual + simulator commands waiting for the sensor gateway
sockets: set[WebSocket] = set()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        pipeline.seed(db)
    yield


app = FastAPI(title="ECOGUARD AI", version="1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------- schemas
class Node(BaseModel):
    node: str | None = None
    zone: str
    people: int
    kwh: float
    kw: float
    v_board: float
    v_room: float
    amps: float
    leak_ma: float
    source: str = "cv"


class Water(BaseModel):
    floor_l: list[float]
    pump_on: bool
    pump_l: float
    pump_kwh: float
    tank_pct: float
    sump_pct: float | None = None
    supply_on: bool | None = None
    overflow_l: float = 0


class Reading(BaseModel):
    ts: int
    temp_c: float
    grid_on: bool
    nodes: list[Node]
    water: Water
    sim: dict | None = None      # simulator-only extras (true faults), never used by the detector


class ControlIn(BaseModel):
    command: str                  # switch_off | pump_off | close_valve | work_order
    target: str
    alert_id: int | None = None


class SimIn(BaseModel):
    action: str                   # inject | cut | fix | speed | reset
    fault: str | None = None
    target: str | None = None
    value: float | None = None
    fault_id: int | None = None


# ---------------------------------------------------------------- ingest (sensor gateway)
@app.post("/api/ingest")
async def ingest(r: Reading, db: Session = Depends(get_db)):
    data = r.model_dump()
    commands = pipeline.ingest(db, data)
    out = commands + pending[:]
    pending.clear()
    if sockets:
        await broadcast({"type": "tick", "data": live_payload(db)})
    return {"ok": True, "commands": out}


async def broadcast(msg: dict):
    dead = []
    text = json.dumps(msg)
    for ws in sockets:
        try:
            await ws.send_text(text)
        except Exception:
            dead.append(ws)
    for ws in dead:
        sockets.discard(ws)


@app.websocket("/ws")
async def ws_live(ws: WebSocket):
    await ws.accept()
    sockets.add(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        sockets.discard(ws)


# ---------------------------------------------------------------- dashboard API
def live_payload(db: Session) -> dict:
    r = pipeline.latest
    if r is None:
        return {"ready": False}
    rooms = []
    for n in r["nodes"]:
        z = ZONES[n["zone"]]
        rooms.append({"id": n["zone"], "name": z["name"], "floor": z["floor"], "kind": z["kind"], "people": n["people"],
                      "cap": z["cap"], "kw": n["kw"], "expected_kw": n.get("expected_kw", 0),
                      "v_board": n["v_board"], "v_room": n["v_room"], "amps": n["amps"], "leak_ma": n["leak_ma"]})
    open_alerts = db.scalars(select(Alert).where(Alert.end.is_(None)).order_by(desc(Alert.start))).all()
    today = db.get(SavingsDaily, _date(r["ts"]))
    return {
        "ready": True, "ts": r["ts"], "temp_c": r["temp_c"], "grid_on": r["grid_on"],
        "kw": round(sum(n["kw"] for n in r["nodes"]) + r["water"]["pump_kwh"] * 4, 2),
        "rooms": rooms, "water": r["water"],
        "alerts": [alert_dict(a) for a in open_alerts],
        "today": savings_dict(today) if today else None,
        "sim": r.get("sim"),
    }


def _date(ts: int) -> str:
    from .campus import to_ist
    return to_ist(ts).strftime("%Y-%m-%d")


def alert_dict(a: Alert) -> dict:
    return {"id": a.id, "rule": a.rule, "target": a.target, "kind": a.kind, "title": a.title, "status": a.status,
            "feedback": a.feedback, "start": a.start, "last": a.last, "end": a.end, "kwh": round(a.kwh, 2),
            "litres": round(a.litres), "rupees": round(a.rupees), "co2": round(a.co2, 2), "info": a.info,
            "advice_en": a.advice_en, "advice_hi": a.advice_hi}


def savings_dict(d: SavingsDaily) -> dict:
    return {k: round(getattr(d, k), 2) if isinstance(getattr(d, k), float) else getattr(d, k)
            for k in ("date", "kwh_used", "kwh_wasted", "kwh_avoided", "litres_used", "litres_wasted", "litres_avoided",
                      "rupees_saved", "co2_avoided")}


@app.get("/api/health")
def health():
    return {"ok": True, "latest": pipeline.now}


@app.get("/api/building")
def building(db: Session = Depends(get_db)):
    zones = db.scalars(select(Zone)).all()
    return {"building": BUILDING, "tariff": TARIFF, "water": WATER,
            "zones": [{"id": z.id, "name": z.name, "floor": z.floor, "kind": z.kind, "capacity": z.capacity,
                       "equipment": z.equipment} for z in zones]}


@app.get("/api/live")
def live(db: Session = Depends(get_db)):
    return live_payload(db)


@app.get("/api/rooms/{zone_id}/series")
def room_series(zone_id: str, hours: int = 24, db: Session = Depends(get_db)):
    if zone_id not in ZONES:
        raise HTTPException(404, "unknown room")
    since = pipeline.now - hours * HOUR
    rows = db.execute(select(EnergyReading).where(EnergyReading.zone_id == zone_id, EnergyReading.ts > since)
                      .order_by(EnergyReading.ts)).scalars().all()
    from .models import OccupancyRecord
    occ = dict(db.execute(select(OccupancyRecord.ts, OccupancyRecord.people)
                          .where(OccupancyRecord.zone_id == zone_id, OccupancyRecord.ts > since)).all())
    return [{"ts": e.ts, "kw": e.kw, "expected_kw": round(e.expected_kw or 0, 3), "people": occ.get(e.ts, 0),
             "r_ohm": round((e.v_board - e.v_room) / e.amps, 3) if e.amps > 1.5 else None, "leak_ma": e.leak_ma}
            for e in rows]


@app.get("/api/wiring")
def wiring(db: Session = Depends(get_db)):
    """Heat-in-the-wall view: commissioning vs current resistance for every circuit."""
    det = pipeline.detector
    out = []
    for zid, z in ZONES.items():
        samples = list(det.r_samples.get(zid, []))
        r_now = sorted(samples[-24:])[len(samples[-24:]) // 2] if len(samples) >= 12 else None
        r0 = det.r0.get(zid, z["rWire"])
        peak_amps = (z["acUnits"] * z["acKW"] * 1000 + z["lightW"] + z["fans"] * 60 + z["pcs"] * 95) / (220 * 0.92)
        extra = max(0.0, (r_now or r0) - r0)
        out.append({"id": zid, "name": z["name"], "floor": z["floor"], "r0": round(r0, 3),
                    "r_now": round(r_now, 3) if r_now else None, "ratio": round((r_now or r0) / r0, 2),
                    "peak_amps": round(peak_amps, 1), "peak_heat_w": round(peak_amps ** 2 * extra),
                    "status": "danger" if r_now and r_now > 1.6 * r0 and extra > 0.1 else "watch" if r_now and r_now > 1.25 * r0 else "ok"})
    leak = {}
    if pipeline.latest:
        for n in pipeline.latest["nodes"]:
            f = ZONES[n["zone"]]["floor"]
            leak[f] = max(leak.get(f, 0), n["leak_ma"])
    return {"circuits": out, "earth_leak_ma": leak}


@app.get("/api/water/series")
def water_series(hours: int = 48, db: Session = Depends(get_db)):
    rows = db.scalars(select(WaterReading).where(WaterReading.ts > pipeline.now - hours * HOUR).order_by(WaterReading.ts)).all()
    return [{"ts": w.ts, "tank_pct": w.tank_pct, "sump_pct": w.sump_pct, "pump_on": w.pump_on, "pump_kwh": w.pump_kwh,
             "flow_lph": round((w.floor0_l + w.floor1_l + w.floor2_l) * 4, 1),
             "floors_lph": [round(w.floor0_l * 4, 1), round(w.floor1_l * 4, 1), round(w.floor2_l * 4, 1)]} for w in rows]


@app.get("/api/forecast")
def get_forecast(db: Session = Depends(get_db)):
    now = pipeline.now
    if not now:
        return {"forecast": [], "actual": []}
    fc = forecast(db, pipeline.baseline, now)
    act = actual_hourly(db, hour_start(now) - 24 * HOUR, hour_start(now) + HOUR)
    # how good was the method yesterday? replay the forecast as of 24 h ago against what happened
    back = forecast(db, pipeline.baseline, now - 24 * HOUR)
    a = {x["ts"]: x["kwh"] for x in act}
    pairs = [(b["kwh"], a[b["ts"]]) for b in back if b["ts"] in a]
    total_a = sum(y for _, y in pairs)
    err = sum(abs(p - y) for p, y in pairs) / total_a if total_a else None
    return {"forecast": fc, "actual": act, "yesterday_wape": round(err, 3) if err is not None else None,
            "next24_kwh": round(sum(x["kwh"] for x in fc), 1),
            "next24_rupees": round(sum(x["kwh"] for x in fc) * TARIFF["rsPerKWh"])}


@app.get("/api/alerts")
def alerts(status: str | None = None, limit: int = 200, db: Session = Depends(get_db)):
    q = select(Alert).order_by(desc(Alert.start)).limit(limit)
    if status == "open":
        q = q.where(Alert.end.is_(None))
    elif status == "closed":
        q = q.where(Alert.end.is_not(None))
    return [alert_dict(a) for a in db.scalars(q)]


@app.post("/api/alerts/{alert_id}/{feedback}")
def alert_feedback(alert_id: int, feedback: str, db: Session = Depends(get_db)):
    if feedback not in ("confirm", "dismiss"):
        raise HTTPException(400, "feedback must be confirm or dismiss")
    a = db.get(Alert, alert_id)
    if not a:
        raise HTTPException(404, "no such alert")
    a.feedback = "confirmed" if feedback == "confirm" else "dismissed"
    db.commit()
    return alert_dict(a)


@app.get("/api/labels.csv", response_class=PlainTextResponse)
def labels(db: Session = Depends(get_db)):
    """Every alert a manager confirmed or dismissed: a labelled dataset for retraining."""
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["alert_id", "rule", "target", "start", "end", "kwh", "litres", "label"])
    for a in db.scalars(select(Alert).where(Alert.feedback.is_not(None))):
        w.writerow([a.id, a.rule, a.target, a.start, a.end, round(a.kwh, 3), round(a.litres), a.feedback])
    return buf.getvalue()


@app.post("/api/control")
def control(c: ControlIn, db: Session = Depends(get_db)):
    if c.command not in ("switch_off", "pump_off", "close_valve", "work_order"):
        raise HTTPException(400, "unknown command")
    alert = db.get(Alert, c.alert_id) if c.alert_id else None
    params = {"rule": alert.rule, "due": pipeline.now + 24 * HOUR} if c.command == "work_order" and alert else {}
    cmd = pipeline.issue(db, c.command, c.target, mode="manual", alert=alert, params=params, by="dashboard")
    if alert:
        pipeline.actioned.add(f"{alert.rule}:{alert.target}")
    db.commit()
    pending.append(cmd)
    return cmd


@app.get("/api/actions")
def actions(limit: int = 100, db: Session = Depends(get_db)):
    rows = db.scalars(select(ControlAction).order_by(desc(ControlAction.id)).limit(limit))
    return [{"id": a.id, "ts": a.ts, "alert_id": a.alert_id, "target": a.target, "command": a.command, "mode": a.mode,
             "status": a.status, "avoided_kwh": round(a.avoided_kwh, 2), "avoided_l": round(a.avoided_l), "params": a.params}
            for a in rows]


@app.get("/api/savings")
def savings(days: int = 30, db: Session = Depends(get_db)):
    rows = db.scalars(select(SavingsDaily).order_by(desc(SavingsDaily.date)).limit(days)).all()[::-1]
    tot = db.execute(select(func.sum(SavingsDaily.kwh_avoided), func.sum(SavingsDaily.litres_avoided),
                            func.sum(SavingsDaily.rupees_saved), func.sum(SavingsDaily.co2_avoided),
                            func.sum(SavingsDaily.kwh_wasted), func.sum(SavingsDaily.litres_wasted),
                            func.sum(SavingsDaily.kwh_used), func.sum(SavingsDaily.litres_used))).one()
    keys = ["kwh_avoided", "litres_avoided", "rupees_saved", "co2_avoided", "kwh_wasted", "litres_wasted", "kwh_used", "litres_used"]
    return {"days": [savings_dict(d) for d in rows], "total": {k: round(v or 0, 1) for k, v in zip(keys, tot)}}


@app.get("/api/settings")
def get_settings(db: Session = Depends(get_db)):
    return pipeline.settings(db)


@app.put("/api/settings")
def put_settings(body: dict, db: Session = Depends(get_db)):
    for k, v in body.items():
        row = db.get(Setting, k)
        if row:
            row.value = v
        else:
            db.add(Setting(key=k, value=v))
    db.commit()
    return pipeline.settings(db)


@app.post("/api/sim")
def sim(c: SimIn):
    """Simulator controls for demos (inject a fault, cause a power cut, change speed)."""
    pending.append({"command": f"sim_{c.action}", "target": c.target, "params": c.model_dump()})
    return {"queued": True}


@app.get("/api/experiment")
def experiment():
    p = ROOT / "models" / "before_after.json"
    if not p.exists():
        raise HTTPException(404, "run the before-vs-after experiment first (see README)")
    return json.loads(p.read_text())


@app.get("/api/model")
def model_card():
    p = ROOT / "models" / "eval.json"
    return json.loads(p.read_text()) if p.exists() else {}


# Serve the built dashboard from the same server if it exists (one URL for demos).
DIST = Path(os.environ.get("FRONTEND_DIST", ROOT / "frontend" / "dist"))
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        f = DIST / path
        return FileResponse(f if path and f.is_file() else DIST / "index.html")
