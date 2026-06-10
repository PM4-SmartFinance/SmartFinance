#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
cd "$PROJECT_ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or not on PATH."
  exit 1
fi

echo "Stopping SmartFinance user stack and removing orphaned containers..."
docker compose -f docker-compose.user.yml down --remove-orphans

echo "Optional: reclaim builder cache and dangling images older than 24 hours..."
read -r -p "Perform cleanup now? [y/N]: " answer || true
answer=${answer:-N}
if [[ "$answer" =~ ^[Yy]$ ]]; then
  docker builder prune -f --filter "until=24h" || true
  docker image prune -f --filter "until=24h" || true
  echo "Cleanup complete."
else
  echo "Skipped cleanup."
fi
