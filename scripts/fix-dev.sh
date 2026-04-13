#!/bin/bash
set -euo pipefail

REPORT_FILE="scripts/fix-dev-report.txt"

echo "Repairing SmartFinance development environment..."

echo "Capturing environment versions..."
{
	echo "Generated at: $(date -Iseconds)"
	echo "Repository root: $(pwd)"
	echo "Branch: $(git branch --show-current 2>/dev/null || true)"
	echo "Commit: $(git rev-parse --short HEAD 2>/dev/null || true)"
	echo "Bun: $(bun --version)"
	echo "Docker Server: $(docker version --format '{{.Server.Version}}' 2>/dev/null || true)"
	echo "Docker Client: $(docker version --format '{{.Client.Version}}' 2>/dev/null || true)"
	echo "Docker Compose: $(docker compose version --short 2>/dev/null || docker compose version 2>/dev/null || true)"
} > "$REPORT_FILE"

echo "Version report written to $REPORT_FILE"

echo "Removing generated dependencies..."
rm -rf node_modules backend/node_modules frontend/node_modules

echo "Reinstalling dependencies with Bun..."
bun install

echo "Restarting development database..."
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d --wait

echo "Running Prisma migrations..."
cd backend
bunx --bun prisma migrate deploy

echo "Seeding development data..."
if ! bun run prisma/seed.ts; then
	echo "Seeding failed! Check database and try again."
  cd ..
  exit 1
fi

cd ..

echo "Restarting test database..."
COMPOSE_PROJECT_NAME=smartfinance-test bun run --filter @smartfinance/backend test:db:down || true
COMPOSE_PROJECT_NAME=smartfinance-test bun run --filter @smartfinance/backend test:db:up

echo "Verifying build and tests..."
bun run --filter @smartfinance/backend build
bun run --filter @smartfinance/backend test

echo ""
echo "Development environment is ready."
echo "Version report: $REPORT_FILE"
