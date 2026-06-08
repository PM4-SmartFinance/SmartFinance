#!/bin/sh
set -e

# When a command is passed (e.g. `docker compose run backend prisma migrate deploy`),
# run it instead of the default boot sequence. The setup scripts use this to apply
# migrations before any traffic is served, without overriding the image entrypoint.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

echo "Running database migrations..."
node_modules/.bin/prisma migrate deploy

CURRENCY_COUNT=$(node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT COUNT(*) FROM \"DimCurrency\"')
  .then(r => { console.log(r.rows[0].count); pool.end(); })
  .catch(() => { console.log('0'); pool.end(); });
")

if [ "$CURRENCY_COUNT" = "0" ]; then
  echo "Fresh database detected, seeding..."
  node dist/prisma/seed.js
fi

exec node dist/index.js
