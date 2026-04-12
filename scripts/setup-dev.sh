#!/bin/bash
set -e

echo "Setting up SmartFinance Development Environment..."

# 1. Install Dependencies
echo "Installing dependencies with Bun..."
bun install

# 2. Setup Database Environment
if [ ! -f backend/.env ]; then
  echo "Configuring backend development environment..."
  cp backend/.env.dev backend/.env
else
  echo "Backend .env already exists."
fi

# 3. Start Development Database
echo "Starting local PostgreSQL container..."
docker compose -f docker-compose.dev.yml up -d

# Wait for database to be healthy
echo "Waiting for PostgreSQL to be ready..."
for i in {30..1}; do
  if docker exec smartfinance-postgres-1 pg_isready -U smartfinance > /dev/null 2>&1; then
    echo "✓ Database is ready"
    break
  fi
  if [ $i -eq 1 ]; then
    echo "❌ Database failed to start!"
    exit 1
  fi
  sleep 1
done

# 4. Database Initialization
echo "Running Prisma migrations..."
cd backend
if ! bunx --bun prisma migrate deploy; then
  echo "❌ Migrations failed!"
  exit 1
fi

echo "Seeding development data..."
if ! bun run prisma/seed.ts; then
  echo "❌ Seeding failed!"
  exit 1
fi

echo "Verifying seed data..."
if ! bun run ../scripts/debug-auth.ts > /dev/null 2>&1; then
  echo "⚠️  Warning: Could not verify seed data."
  echo "Run: bun run scripts/debug-auth.ts"
fi
cd ..

echo ""
echo "✅ Setup Successful!"
echo ""
echo "To start development servers, run these in separate terminals:"
echo "  bun run --filter @smartfinance/backend dev"
echo "  bun run --filter @smartfinance/frontend dev"
echo ""
echo "Dev Login:"
echo "  Email:    dev@smartfinance.local"
echo "  Password: password123"