#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)

cd "$PROJECT_ROOT"

if [ ! -t 0 ]; then
  echo "This setup script must be run from an interactive terminal."
  exit 1
fi

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

require_nonempty() {
  local label="$1"
  local value

  while true; do
    printf '%s: ' "$label" >&2
    read -r value || true
    value=$(trim "${value:-}")
    if [ -n "$value" ]; then
      printf '%s' "$value"
      return 0
    fi
    echo "Please enter a value." >&2
  done
}

prompt_password() {
  local first_value
  local second_value

  while true; do
    echo >&2
    printf 'Create your SmartFinance password (at least 8 characters): ' >&2
    read -r -s first_value || true
    echo >&2
    if [ -z "$first_value" ]; then
      echo "Password cannot be empty." >&2
      continue
    fi
    if [ ${#first_value} -lt 8 ]; then
      echo "Password must be at least 8 characters long." >&2
      continue
    fi

    printf 'Confirm your SmartFinance password: ' >&2
    read -r -s second_value || true
    echo >&2

    if [ "$first_value" != "$second_value" ]; then
      echo "Passwords do not match. Please try again." >&2
      continue
    fi

    printf '%s' "$first_value"
    return 0
  done
}

get_image_tag() {
  local candidate
  local normalized_tag
  local candidate_tags

  candidate_tags=""
  REMOTE_IMAGE_AVAILABLE=false

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
      REMOTE_IMAGE_AVAILABLE=true
      printf '%s' "$normalized_tag"
      return 0
    fi
  done

  REMOTE_IMAGE_AVAILABLE=false
  printf '%s' "latest"
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

# Handle environment setup
login_email=$(require_nonempty "Create your SmartFinance admin email")
login_password=$(prompt_password)

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

if [ "$LOCAL_BACKEND_IMAGE_PRESENT" != true ] || [ "$LOCAL_FRONTEND_IMAGE_PRESENT" != true ]; then
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

echo "Seeding default administrative credentials..."
docker compose -f docker-compose.user.yml exec -T \
  -e BOOTSTRAP_EMAIL="$login_email" \
  -e BOOTSTRAP_PASSWORD="$login_password" \
  backend \
  node --input-type=module -e "
    try {
      const response = await fetch('http://127.0.0.1:3000/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: process.env.BOOTSTRAP_EMAIL, password: process.env.BOOTSTRAP_PASSWORD })
      });
      if (response.status === 409 || response.status === 401 || response.ok) {
        process.exit(0);
      }
      console.error(await response.text());
      process.exit(1);
    } catch (e) {
      process.exit(0); // backend may take a hot second to route traffic; catch network drop cleanly
    }
  "

echo
echo "===================================================="
echo " Setup Complete!                                    "
echo " Access your interface at: http://localhost:3000   "
echo "===================================================="

# Offer lightweight cleanup to reclaim build cache and dangling images older than a day.
echo
echo "Performing background cleanup of builder cache and old images (non-destructive)..."
# prune builder cache older than 24h
docker builder prune -f --filter "until=24h" || true
# prune dangling images older than 24h
docker image prune -f --filter "until=24h" || true

echo "If you want to stop the running containers and free resources, run:"
echo "  ./scripts/stop-user.sh"