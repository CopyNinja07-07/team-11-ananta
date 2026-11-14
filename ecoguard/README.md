# ECOGUARD AI: energy and water waste detector for buildings

Team 11 (Viltrumites), Ananta Hackathon 2026, SMVDU.

ECOGUARD watches one academic block (classrooms, a computer lab and offices)
and finds every kind of connected energy and water waste inside it: rooms left
running when empty, ACs overcooling, the pump overflowing the roof tank or
running dry, leaks and running cisterns, and the waste nobody sees at all,
heat building up in loose wiring joints inside the walls. It tells the
facility manager in plain English or Hindi what is wrong and what it costs,
and it can act on its own (switch a room off, stop the pump, close a leaking
floor's valve, raise a repair ticket).

## What is in here

```
config/campus.json    the building: rooms, equipment, tank, pump, tariff (one file, shared)
sensors/              virtual building + virtual ESP32 nodes (Node.js)
  sim/                simulator: people, Jammu weather, power cuts, wiring, water, faults
  gateway.mjs         sends readings to the backend every 15 sim-minutes, applies commands
  generate.mjs        writes a year of readings + ground truth to CSV for training
  experiment.mjs      before vs after: same year, same faults, with and without ECOGUARD
backend/              FastAPI + SQLAlchemy (SQLite by default, PostgreSQL/TimescaleDB via DATABASE_URL)
  app/detector.py     the detector (learned baseline + physics rules + hidden-waste checks)
  app/service.py      ingest pipeline, auto-control, work orders, savings
  app/forecast.py     next-24-hour forecast
  app/advice.py       plain-language advice, English and Hindi
ml/                   training and evaluation scripts
models/               trained baseline, detector report card, before-vs-after result
frontend/             React + Tailwind + Recharts dashboard
docs/                 design pack and technical explainer
```

## Run it

Needs Python 3.11+ and Node 20+.

```bash
# 1. backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --port 8000          # API docs at http://localhost:8000/docs

# 2. dashboard (second terminal)
cd frontend
npm install
npm run dev                                # http://localhost:5173

# 3. the building (third terminal)
cd sensors
node gateway.mjs --api http://localhost:8000 --speed 2 --start 2026-04-13
```

`--speed` is real seconds per 15 simulated minutes. Use `--speed 0 --days 14` to
fill two weeks of history in a few seconds, then restart with `--speed 2`.

For a single URL (demo day): `cd frontend && npm run build`, and the backend
serves the dashboard at http://localhost:8000.

## Retrain and re-test

```bash
cd sensors && node generate.mjs 365 11                    # training year
cd ../ml && python train_baseline.py                      # -> models/baseline.json
cd ../sensors && DATA_DIR=../data/test node generate.mjs 365 99   # unseen test year
cd ../ml && python -c "import evaluate; from pathlib import Path; print(evaluate.main(Path('../data/test')))"
```

Before vs after (start a backend with an empty database first):

```bash
cd backend && DATABASE_URL=sqlite:///./exp.db uvicorn app.main:app --port 8001
cd sensors && node experiment.mjs --api http://localhost:8001 --start 2025-07-07 --days 364
```

## Results

See `models/eval.json` and `models/before_after.json`, and the Savings page of the dashboard.
