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

# 4. Database Initialization
echo "Running Prisma migrations and seeding..."
cd backend
bunx prisma migrate deploy
bunx prisma db seed
cd ..

echo ""
echo "Setup Successful!"
echo "To start development servers, run these in separate terminals:"
echo "  bun run --filter @smartfinance/backend dev"
echo "  bun run --filter @smartfinance/frontend dev"