#!/usr/bin/env bash
set -euo pipefail

# Downloads a Geofabrik map extract and preprocesses it for OSRM.
# Defaults to Germany. To use a different region (e.g. for a fast local
# smoke test), override REGION and URL:
#
#   REGION=monaco URL=https://download.geofabrik.de/europe/monaco-latest.osm.pbf \
#     ./scripts/setup-osrm.sh
#
# If you change REGION, also update the file path in the `osrm` service's
# `command` in docker-compose.yml to match.

REGION="${REGION:-germany}"
URL="${URL:-https://download.geofabrik.de/europe/germany-latest.osm.pbf}"

DATA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/osrm-data"
mkdir -p "$DATA_DIR"

PBF="$DATA_DIR/${REGION}-latest.osm.pbf"

if [ ! -f "$PBF" ]; then
  echo "Downloading $REGION map data from $URL ..."
  curl -L --fail -o "$PBF" "$URL"
else
  echo "Using cached $PBF"
fi

echo "Extracting (building the routing graph for $REGION)..."
docker run --rm -v "$DATA_DIR:/data" osrm/osrm-backend \
  osrm-extract -p /opt/car.lua "/data/${REGION}-latest.osm.pbf"

echo "Partitioning..."
docker run --rm -v "$DATA_DIR:/data" osrm/osrm-backend \
  osrm-partition "/data/${REGION}-latest.osrm"

echo "Customizing..."
docker run --rm -v "$DATA_DIR:/data" osrm/osrm-backend \
  osrm-customize "/data/${REGION}-latest.osrm"

echo
echo "Done. Start the routing server with: docker compose up -d osrm"
echo "(the 'osrm' service in docker-compose.yml expects /data/${REGION}-latest.osrm)"
