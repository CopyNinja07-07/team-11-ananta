#!/usr/bin/env bash
# Downloads the YOLO11n person detector weights (5.6 MB, AGPL-3.0, Ultralytics) into models/.
set -euo pipefail
cd "$(dirname "$0")/.."
curl -fsSL -o models/yolo11n.pt https://github.com/ultralytics/assets/releases/download/v8.3.0/yolo11n.pt
echo "saved models/yolo11n.pt"
