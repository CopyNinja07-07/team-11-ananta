"""Camera node: counts people in a classroom from a webcam or CCTV stream and
sends the number to the ECOGUARD backend once a minute.

    python cv/camera_node.py --room CR-201 --source 0                 # laptop webcam
    python cv/camera_node.py --room LAB-1 --source rtsp://user:pass@cam-ip/stream1
    python cv/camera_node.py --room CR-101 --source classroom.mp4 --every 5

Only the count leaves the machine. Frames are never written to disk or sent.
"""
import argparse
import time

import cv2
import httpx


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--room", required=True)
    ap.add_argument("--source", default="0", help="webcam index, video file or RTSP URL")
    ap.add_argument("--api", default="http://localhost:8000")
    ap.add_argument("--every", type=float, default=60, help="seconds between counts")
    a = ap.parse_args()
    cap = cv2.VideoCapture(int(a.source) if a.source.isdigit() else a.source)
    if not cap.isOpened():
        raise SystemExit(f"cannot open {a.source}")
    while True:
        ok, frame = cap.read()
        if not ok:
            print("stream ended")
            break
        ok, jpg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        del frame
        try:
            r = httpx.post(f"{a.api}/api/cv/count", files={"image": ("frame.jpg", jpg.tobytes(), "image/jpeg")},
                           data={"zone": a.room}, timeout=20).json()
            print(f"{time.strftime('%H:%M:%S')}  {a.room}: {r.get('people')} people ({r.get('ms')} ms)")
        except httpx.HTTPError as e:
            print("backend unreachable:", e)
        time.sleep(a.every)


if __name__ == "__main__":
    main()
