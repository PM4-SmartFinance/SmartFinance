#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)

cd "$PROJECT_ROOT"

print_help() {
  cat <<'EOF'
SmartFinance could not start because Docker or its dependencies are missing.

Please make sure Docker is installed and running, then try again.
Official documentation: https://github.com/PM4-SmartFinance/SmartFinance/wiki
EOF
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

check_dependency() {
  if ! command_exists "$1"; then
    echo "Missing required command: $1"
    print_help
    exit 1
  fi
}

trim() {
  printf '%s' "$1" | sed 's/^ *//; s/ *$//'
}

get_env_value() {
  local key="$1"
  if [ -f "$PROJECT_ROOT/.env" ]; then
    awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$PROJECT_ROOT/.env"
  fi
}

set_env_value() {
  local key="$1"
  local value="$2"
  local temp_file
  temp_file=$(mktemp)

  if [ ! -f "$PROJECT_ROOT/.env" ]; then
    : > "$PROJECT_ROOT/.env"
  fi

  awk -v key="$key" -v value="$value" '
    BEGIN { found = 0 }
    $0 ~ "^" key "=" { print key "=" value; found = 1; next }
    { print }
    END { if (!found) print key "=" value }
  ' "$PROJECT_ROOT/.env" > "$temp_file"

  mv "$temp_file" "$PROJECT_ROOT/.env"
}

get_image_tag() {
  local candidate
  local normalized_tag
  local candidate_tags

  candidate_tags=""

  if command_exists git && [ -d .git ]; then
    candidate=$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null || true)
    if [ -n "$candidate" ]; then
      candidate_tags="$candidate"
    fi

    while IFS= read -r candidate; do
      [ -n "$candidate" ] || continue
      case " $candidate_tags " in
        *" $candidate "*) ;;
        *) candidate_tags="$candidate_tags $candidate" ;;
      esac
    done <<EOF
$(git tag --sort=-v:refname --list 'v*' 2>/dev/null || true)
EOF
  fi

  candidate_tags="$candidate_tags latest"

  for candidate in $candidate_tags; do
    normalized_tag=$(printf '%s' "$candidate" | sed 's/^[vV]//')
    if docker manifest inspect "ghcr.io/pm4-smartfinance/smartfinance/backend:${normalized_tag}" >/dev/null 2>&1 \
      && docker manifest inspect "ghcr.io/pm4-smartfinance/smartfinance/frontend:${normalized_tag}" >/dev/null 2>&1; then
      printf '%s' "$normalized_tag"
      return 0
    fi
  done

  printf '%s' "latest"
}

remote_image_available_for_tag() {
  local tag="$1"
  docker manifest inspect "ghcr.io/pm4-smartfinance/smartfinance/backend:${tag}" >/dev/null 2>&1 \
    && docker manifest inspect "ghcr.io/pm4-smartfinance/smartfinance/frontend:${tag}" >/dev/null 2>&1
}

echo "===================================================="
echo "      Setting up SmartFinance Production Stack      "
echo "===================================================="
echo

check_dependency docker

if ! docker compose version >/dev/null 2>&1; then
  echo "Error: Docker Compose plugin is required."
  print_help
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Error: Docker daemon is not running."
  print_help
  exit 1
fi

# Determine image tag from the newest upstream-published release tag.
IMAGE_TAG=$(get_image_tag)
echo "Target deployment version tag: $IMAGE_TAG"
echo "Using published image tag: $IMAGE_TAG"

BACKEND_IMAGE="ghcr.io/pm4-smartfinance/smartfinance/backend:${IMAGE_TAG}"
FRONTEND_IMAGE="ghcr.io/pm4-smartfinance/smartfinance/frontend:${IMAGE_TAG}"

LOCAL_BACKEND_IMAGE_PRESENT=false
LOCAL_FRONTEND_IMAGE_PRESENT=false
if docker image inspect "$BACKEND_IMAGE" >/dev/null 2>&1; then
  LOCAL_BACKEND_IMAGE_PRESENT=true
fi
if docker image inspect "$FRONTEND_IMAGE" >/dev/null 2>&1; then
  LOCAL_FRONTEND_IMAGE_PRESENT=true
fi

REMOTE_IMAGE_AVAILABLE=false
if remote_image_available_for_tag "$IMAGE_TAG"; then
  REMOTE_IMAGE_AVAILABLE=true
fi

USE_LOCAL_BUILD=false

# Ensure there's reasonable free space on root before heavy pulls/builds.
ensure_free_space() {
  local min_kb=$1
  local avail_kb
  avail_kb=$(df --output=avail / | tail -1 | tr -d '[:space:]') || avail_kb=0
  if [ -z "$avail_kb" ]; then
    return 0
  fi
  if [ "$avail_kb" -lt "$min_kb" ]; then
    echo "Low disk space on / (available: $avail_kb KB). Attempting lightweight cleanup..."
    docker builder prune -f --filter "until=24h" || true
    docker image prune -f --filter "until=24h" || true
    # re-evaluate
    avail_kb=$(df --output=avail / | tail -1 | tr -d '[:space:]' || echo 0)
    if [ "$avail_kb" -lt "$min_kb" ]; then
      echo "Still low on disk space (available: $avail_kb KB). Please free space and re-run the script." >&2
      return 1
    fi
  fi
  return 0
}

if [ "$LOCAL_BACKEND_IMAGE_PRESENT" = true ] && [ "$LOCAL_FRONTEND_IMAGE_PRESENT" = true ]; then
  MIN_ROOT_FREE_KB=${SMARTFINANCE_MIN_ROOT_FREE_KB_RUNTIME:-$((512 * 1024))}
elif [ "$REMOTE_IMAGE_AVAILABLE" = true ]; then
  MIN_ROOT_FREE_KB=${SMARTFINANCE_MIN_ROOT_FREE_KB_RUNTIME:-$((512 * 1024))}
else
  MIN_ROOT_FREE_KB=${SMARTFINANCE_MIN_ROOT_FREE_KB_BUILD:-$((3 * 1024 * 1024))}
fi

if ! ensure_free_space "$MIN_ROOT_FREE_KB"; then
  exit 1
fi

# Hardcoded Default Setup
DEFAULT_ADMIN_EMAIL="admin@smartfinance.local"
DEFAULT_ADMIN_PASSWORD="changeme123"

session_secret=$(get_env_value SESSION_SECRET || true)
if [ -z "$session_secret" ]; then
  session_secret=$(openssl rand -hex 32 2>/dev/null || tr -dc 'a-f0-9' < /dev/urandom | head -c 64 || echo "static_fallback_secret_32_chars_long")
fi

postgres_password=$(get_env_value POSTGRES_PASSWORD || true)
if [ -z "$postgres_password" ]; then
  postgres_password=$(openssl rand -hex 16 2>/dev/null || tr -dc 'a-f0-9' < /dev/urandom | head -c 32 || echo "static_db_password")
fi

set_env_value "SESSION_SECRET" "$session_secret"
set_env_value "POSTGRES_PASSWORD" "$postgres_password"
set_env_value "IMAGE_TAG" "$IMAGE_TAG"

export SESSION_SECRET="$session_secret"
export POSTGRES_PASSWORD="$postgres_password"
export IMAGE_TAG="$IMAGE_TAG"

echo
echo "Checking for newer images on GHCR (pull is best-effort)..."
# Try to pull, but don't fail the script if the remote tag is missing or pull fails.
USE_LOCAL_BUILD=false
if ! docker compose -f docker-compose.user.yml pull; then
  echo "Warning: pulling images failed; continuing with local images if available."
fi

# Re-evaluate the presence of the images now that the pull has finished
if ! docker image inspect "$BACKEND_IMAGE" >/dev/null 2>&1 || ! docker image inspect "$FRONTEND_IMAGE" >/dev/null 2>&1; then
  USE_LOCAL_BUILD=true
fi

echo "Starting core infrastructure containers..."
# Scale backend down to 0 temporarily so migrations apply before traffic starts
docker compose -f docker-compose.user.yml up -d --remove-orphans --scale backend=0

echo "Running production database migrations..."
docker compose -f docker-compose.user.yml run --rm --entrypoint /bin/sh backend -c "node_modules/.bin/prisma migrate deploy"

echo "Starting application stack..."
if [ "$USE_LOCAL_BUILD" = true ]; then
  docker compose -f docker-compose.user.yml up -d --remove-orphans --build
else
  docker compose -f docker-compose.user.yml up -d --remove-orphans --no-build
fi

echo "Seeding default administrative credentials (waiting for backend to boot)..."
docker compose -f docker-compose.user.yml exec -T \
  -e BOOTSTRAP_EMAIL="$DEFAULT_ADMIN_EMAIL" \
  -e BOOTSTRAP_PASSWORD="$DEFAULT_ADMIN_PASSWORD" \
  backend \
  node --input-type=module -e "
    import pg from 'pg';
    import { PrismaClient } from '@prisma/client';
    import { PrismaPg } from '@prisma/adapter-pg';
    
    async function seedUser() {
      // 1. Inject required foundational data
      try {
        const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
        const adapter = new PrismaPg(pool);
        const prisma = new PrismaClient({ adapter });

        await prisma.dimCurrency.upsert({
          where: { code: 'CHF' },
          update: {},
          create: { code: 'CHF', name: 'Swiss Franc', format: \"CHF 1'234.56\" }
        });
        await prisma.\$disconnect();
      } catch (e) {
        console.error('Failed to inject base currency:', e.message);
      }

      // 2. Wait for API and create user
      let attempts = 15;
      while (attempts > 0) {
        try {
          const response = await fetch('http://localhost:3000/api/v1/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: process.env.BOOTSTRAP_EMAIL, password: process.env.BOOTSTRAP_PASSWORD })
          });
          
          if (response.status === 409 || response.status === 401 || response.ok) {
            console.log('✓ Default admin user verified/seeded successfully.');
            process.exit(0);
          }
          console.error('Server error:', await response.text());
          process.exit(1);
        } catch (e) {
          attempts--;
          if (attempts === 0) {
            console.error('Timeout: Backend API did not become available.');
            process.exit(1);
          }
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
    seedUser();
  "

echo
echo "===================================================="
echo " Setup Complete!                                    "
echo " Access your interface at: http://localhost:3000   "
echo
echo " Please log in with the default credentials:"
echo "   Email:    $DEFAULT_ADMIN_EMAIL"
echo "   Password: $DEFAULT_ADMIN_PASSWORD"
echo
echo " IMPORTANT: Please change this password immediately"
echo " after your first login!"
echo "===================================================="

# Offer lightweight cleanup to reclaim build cache and dangling images older than a day.
echo
echo "Performing background cleanup of builder cache and old images (non-destructive)..."
docker builder prune -f --filter "until=24h" >/dev/null 2>&1 || true
docker image prune -f --filter "until=24h" >/dev/null 2>&1 || true

echo "If you want to stop the running containers and free resources, run:"
echo "  ./scripts/stop-user.sh"