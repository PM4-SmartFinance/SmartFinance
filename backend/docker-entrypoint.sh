#!/bin/sh
set -e

# When a command is passed (e.g. `docker compose run backend <cmd>`), run it
# instead of the default migrate-seed-serve boot sequence. Escape hatch for
# one-off container tasks.
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
