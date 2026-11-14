#!/usr/bin/env bash
# Downloads the Building Data Genome 2 files we use (about 310 MB) into data/real/bdg2.
# Source: https://github.com/buds-lab/building-data-genome-project-2 (CC BY 4.0)
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p data/real/bdg2
B=https://media.githubusercontent.com/media/buds-lab/building-data-genome-project-2/master/data
for f in metadata/metadata.csv weather/weather.csv \
         meters/cleaned/electricity_cleaned.csv meters/cleaned/chilledwater_cleaned.csv \
         meters/cleaned/hotwater_cleaned.csv meters/cleaned/water_cleaned.csv; do
  echo "downloading $(basename "$f")"
  curl -fsSL -o "data/real/bdg2/$(basename "$f")" "$B/$f"
done
