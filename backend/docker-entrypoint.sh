#!/bin/sh
set -e

if [ -f "node_modules/.bin/prisma" ]; then
  echo "Running database migrations..."
  node_modules/.bin/prisma migrate deploy
fi

exec node dist/index.js
