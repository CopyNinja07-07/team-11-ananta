"""Camera occupancy: counts people in a classroom photo with a YOLO person detector.

Privacy by design (DPDP Act 2023): a frame is decoded in memory, people are
counted, and the frame is thrown away. Only the number is stored. The boxes are
returned to the caller so the person who uploaded the photo can check the count,
and are never saved.

YOLO (ultralytics) is optional: `pip install -r requirements-cv.txt`. Without it
the endpoint answers 503 and everything else keeps working on the room sensors.
"""
from __future__ import annotations

import os
import time
from functools import lru_cache

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from .campus import ROOT, ZONES

router = APIRouter(prefix="/api/cv", tags=["camera occupancy"])
WEIGHTS = os.environ.get("YOLO_WEIGHTS", str(ROOT / "models" / "yolo11n.pt"))
CONF = float(os.environ.get("YOLO_CONF", "0.35"))


@lru_cache(maxsize=1)
def _model():
    try:
        from ultralytics import YOLO
    except ImportError as e:  # optional dependency
        raise HTTPException(503, "camera module not installed: pip install -r requirements-cv.txt") from e
    if not os.path.exists(WEIGHTS):
        raise HTTPException(503, f"YOLO weights not found at {WEIGHTS} (see cv/README.md)")
    return YOLO(WEIGHTS)


def count_people(image_bytes: bytes) -> dict:
    import cv2
    import numpy as np

    frame = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(400, "not an image")
    t0 = time.perf_counter()
    res = _model().predict(frame, classes=[0], conf=CONF, imgsz=640, verbose=False)[0]   # class 0 = person
    ms = (time.perf_counter() - t0) * 1000
    h, w = frame.shape[:2]
    boxes = [{"x": round(float(b[0]) / w, 4), "y": round(float(b[1]) / h, 4), "w": round(float(b[2] - b[0]) / w, 4),
              "h": round(float(b[3] - b[1]) / h, 4), "conf": round(float(c), 2)}
             for b, c in zip(res.boxes.xyxy.tolist(), res.boxes.conf.tolist())]
    del frame                                            # nothing is kept
    return {"people": len(boxes), "boxes": boxes, "ms": round(ms), "width": w, "height": h}


def attach(app_state):
    """Wire the endpoint to the running pipeline (to store the count as an occupancy record)."""

    @router.get("/status")
    def status():
        try:
            _model()
            return {"ready": True, "weights": os.path.basename(WEIGHTS), "conf": CONF}
        except HTTPException as e:
            return {"ready": False, "reason": e.detail}

    @router.post("/count")
    async def count(image: UploadFile = File(...), zone: str | None = Form(None)):
        """Count people in one photo. If a room is given, the count is stored for that room."""
        data = await image.read()
        if len(data) > 8 * 1024 * 1024:
            raise HTTPException(413, "image too large (8 MB max)")
        out = count_people(data)
        if zone:
            if zone not in ZONES:
                raise HTTPException(404, "unknown room")
            out["stored"] = app_state.store_occupancy(zone, out["people"], ZONES[zone]["cap"])
        return out

    return router
