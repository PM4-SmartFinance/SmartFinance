@echo off
echo Setting up SmartFinance Development Environment...

echo Installing dependencies...
call bun install

if not exist backend\.env (
    copy backend\.env.dev backend\.env
)

echo Starting dev database...
docker compose -f docker-compose.dev.yml up -d

echo Initializing database...
cd backend
call bunx --bun prisma migrate deploy
call bunx --bun prisma db seed
cd ..

echo Setup complete. Refer to Wiki for dev server commands.
pause