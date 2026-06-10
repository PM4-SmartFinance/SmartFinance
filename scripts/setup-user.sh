#!/bin/bash
set -euo pipefail

# First-time install for the SmartFinance self-hosted stack.
#
# This brings the stack up (delegated to scripts/start-user.sh, which pulls or
# builds images, migrates the database, and starts the containers) and then
# seeds a single default administrator on the fresh database.
#
# Run this ONCE, on a brand new database. On every subsequent start -- after a
# reboot, or after `./scripts/stop-user.sh` -- use ./scripts/start-user.sh
# instead. Re-running setup against a database that already has users would fail:
# the first-user bootstrap endpoint returns 401 once an administrator exists, and
# we deliberately do not re-inject a default user over a configured installation.

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)

cd "$PROJECT_ROOT"

echo "===================================================="
echo "      Setting up SmartFinance Production Stack      "
echo "===================================================="
echo

# Admin bootstrap credentials. A documented default is used so first-time
# self-hosters always know how to log in. Override with BOOTSTRAP_EMAIL /
# BOOTSTRAP_PASSWORD for a stronger, non-default credential. The completion banner
# instructs the user to change this password immediately after first login.
DEFAULT_ADMIN_EMAIL="${BOOTSTRAP_EMAIL:-admin@smartfinance.local}"
DEFAULT_ADMIN_PASSWORD="${BOOTSTRAP_PASSWORD:-changeme123}"

# Bring the whole stack up. start-user.sh owns dependency checks, image
# resolution, .env secrets, migrations, and container startup; SMARTFINANCE_QUIET
# suppresses its standalone banner so we can print a single first-time banner.
SMARTFINANCE_QUIET=1 "$SCRIPT_DIR/start-user.sh"

echo
echo "Seeding default administrative credentials (waiting for backend to boot)..."
# Reference data (currencies, date dim) is seeded unconditionally by the backend
# entrypoint on a fresh DB before it accepts traffic, so the first-user bootstrap
# POST finds the default currency and creates the admin as the first ADMIN.
# The bootstrap logic lives in scripts/bootstrap-admin.mjs and is piped over stdin
# so it is shared verbatim with the Windows setup script.
if ! docker compose -f docker-compose.user.yml exec -T \
  -e BOOTSTRAP_EMAIL="$DEFAULT_ADMIN_EMAIL" \
  -e BOOTSTRAP_PASSWORD="$DEFAULT_ADMIN_PASSWORD" \
  backend \
  node --input-type=module < "$SCRIPT_DIR/bootstrap-admin.mjs"; then
  echo >&2
  echo "Seeding the default administrator failed." >&2
  echo "If this database already has users, do not run setup again -- use" >&2
  echo "./scripts/start-user.sh to resume the existing installation instead." >&2
  exit 1
fi

echo
echo "===================================================="
echo " Setup Complete!"
echo " Access your interface at: http://localhost:3000"
echo
echo " Log in with the default administrator credentials:"
echo "   Email:    $DEFAULT_ADMIN_EMAIL"
echo "   Password: $DEFAULT_ADMIN_PASSWORD"
echo
echo " IMPORTANT: This is a well-known default password. Change it"
echo " IMMEDIATELY after your first login (Settings > Profile)."
echo
echo " To start the stack again later (without re-seeding), run:"
echo "   ./scripts/start-user.sh"
echo " To stop the stack, run:"
echo "   ./scripts/stop-user.sh"
echo "===================================================="
