#!/bin/bash
set -euo pipefail

# Brings the SmartFinance self-hosted stack up and resumes where the operator
# left off, WITHOUT seeding any administrator. Use this every time after the
# very first install: it pulls (or builds) the images, applies any pending
# database migrations, and starts the containers against the existing Postgres
# volume, so accounts and data created earlier are preserved.
#
# The first-time install lives in scripts/setup-user.sh, which delegates the
# whole bring-up to THIS script and then seeds the default administrator once.
# Re-running setup against a database that already has users would fail (the
# first-user bootstrap endpoint returns 401 once an admin exists) -- that is
# exactly why resuming is a separate, idempotent script.

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)

cd "$PROJECT_ROOT"

# When set to 1 (by setup-user.sh), suppress the standalone "stack is running"
# banner so the caller can print a single, unified completion message instead.
QUIET="${SMARTFINANCE_QUIET:-}"

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

  # Intentional word splitting: candidate_tags is a space-separated tag list.
  # shellcheck disable=SC2086
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

if [ "$QUIET" != "1" ]; then
  echo "===================================================="
  echo "        Starting SmartFinance Stack                 "
  echo "===================================================="
  echo
fi

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

# Set SMARTFINANCE_BUILD_LOCAL=1 to build images from source instead of pulling the
# published GHCR images. Use this to run local changes that are not yet released
# (a plain pull would otherwise overwrite a locally built image with the published one).
BUILD_LOCAL="${SMARTFINANCE_BUILD_LOCAL:-}"
if [ "$BUILD_LOCAL" = "1" ] || [ "$BUILD_LOCAL" = "true" ]; then
  USE_LOCAL_BUILD=true
fi

# Ensure there's reasonable free space on root before heavy pulls/builds.
ensure_free_space() {
  local min_kb=$1
  local avail_kb
  # POSIX-portable: df -Pk gives 1K blocks; "Available" is the 4th column of row 2.
  # GNU's --output=avail is not available on macOS/BSD.
  avail_kb=$(df -Pk / | awk 'NR==2 {print $4}') || avail_kb=0
  if [ -z "$avail_kb" ]; then
    return 0
  fi
  if [ "$avail_kb" -lt "$min_kb" ]; then
    echo "Low disk space on / (available: $avail_kb KB). Attempting lightweight cleanup..."
    docker builder prune -f --filter "until=24h" || true
    docker image prune -f --filter "until=24h" || true
    # re-evaluate
    avail_kb=$(df -Pk / | awk 'NR==2 {print $4}' || echo 0)
    if [ "$avail_kb" -lt "$min_kb" ]; then
      echo "Still low on disk space (available: $avail_kb KB). Please free space and re-run the script." >&2
      return 1
    fi
  fi
  return 0
}

if [ "$USE_LOCAL_BUILD" = true ]; then
  # Building from source needs the larger build headroom.
  MIN_ROOT_FREE_KB=${SMARTFINANCE_MIN_ROOT_FREE_KB_BUILD:-$((3 * 1024 * 1024))}
elif [ "$LOCAL_BACKEND_IMAGE_PRESENT" = true ] && [ "$LOCAL_FRONTEND_IMAGE_PRESENT" = true ]; then
  MIN_ROOT_FREE_KB=${SMARTFINANCE_MIN_ROOT_FREE_KB_RUNTIME:-$((512 * 1024))}
elif [ "$REMOTE_IMAGE_AVAILABLE" = true ]; then
  MIN_ROOT_FREE_KB=${SMARTFINANCE_MIN_ROOT_FREE_KB_RUNTIME:-$((512 * 1024))}
else
  MIN_ROOT_FREE_KB=${SMARTFINANCE_MIN_ROOT_FREE_KB_BUILD:-$((3 * 1024 * 1024))}
fi

if ! ensure_free_space "$MIN_ROOT_FREE_KB"; then
  exit 1
fi

# Generate a cryptographically random hex secret of the requested byte length.
# Prefers openssl, falls back to /dev/urandom. Aborts (rather than using a
# predictable static value) if no CSPRNG is available -- a repo-public signing
# key or DB password must never reach a running stack.
generate_secret() {
  local bytes=$1
  local value
  value=$(openssl rand -hex "$bytes" 2>/dev/null || true)
  if [ -z "$value" ]; then
    value=$(tr -dc 'a-f0-9' < /dev/urandom 2>/dev/null | head -c "$((bytes * 2))" || true)
  fi
  printf '%s' "$value"
}

# Reuse the secrets already written to .env so an existing Postgres volume keeps
# the same password and active login sessions survive a restart. Only generate
# fresh secrets when none exist yet (i.e. the very first start).
session_secret=$(get_env_value SESSION_SECRET || true)
if [ -z "$session_secret" ]; then
  session_secret=$(generate_secret 32)
fi
if [ -z "$session_secret" ]; then
  echo "Error: unable to generate SESSION_SECRET (no CSPRNG available). Aborting." >&2
  exit 1
fi

postgres_password=$(get_env_value POSTGRES_PASSWORD || true)
if [ -z "$postgres_password" ]; then
  postgres_password=$(generate_secret 16)
fi
if [ -z "$postgres_password" ]; then
  echo "Error: unable to generate POSTGRES_PASSWORD (no CSPRNG available). Aborting." >&2
  exit 1
fi

set_env_value "SESSION_SECRET" "$session_secret"
set_env_value "POSTGRES_PASSWORD" "$postgres_password"
set_env_value "IMAGE_TAG" "$IMAGE_TAG"

export SESSION_SECRET="$session_secret"
export POSTGRES_PASSWORD="$postgres_password"
export IMAGE_TAG="$IMAGE_TAG"

echo
if [ "$USE_LOCAL_BUILD" = true ]; then
  echo "Building images from source (SMARTFINANCE_BUILD_LOCAL set or no published image); skipping pull."
else
  echo "Checking for newer images on GHCR (pull is best-effort)..."
  # Try to pull. A failure is only acceptable when no upstream image exists for the
  # tag (we then build locally). If the manifest exists but the pull still failed,
  # it is a real error (registry auth, network, or disk) and must abort -- silently
  # booting a stale local image via --no-build would hide the problem.
  if ! docker compose -f docker-compose.user.yml pull; then
    if [ "$REMOTE_IMAGE_AVAILABLE" = true ]; then
      echo "Error: image pull failed even though upstream images exist for tag '$IMAGE_TAG'." >&2
      echo "This usually indicates a registry authentication, network, or disk problem. Aborting." >&2
      exit 1
    fi
    echo "No published images for tag '$IMAGE_TAG'; will build locally."
  fi

  # Re-evaluate the presence of the images now that the pull has finished.
  if ! docker image inspect "$BACKEND_IMAGE" >/dev/null 2>&1 || ! docker image inspect "$FRONTEND_IMAGE" >/dev/null 2>&1; then
    USE_LOCAL_BUILD=true
  fi
fi

# Build up front when needed so the migration run and the scaled-up stack all use
# the freshly built images (and so the slow build isn't interleaved with startup).
if [ "$USE_LOCAL_BUILD" = true ]; then
  echo "Building images from source (this can take several minutes)..."
  docker compose -f docker-compose.user.yml build
fi

echo "Starting core infrastructure containers..."
# Scale backend down to 0 temporarily so migrations apply before traffic starts
docker compose -f docker-compose.user.yml up -d --remove-orphans --scale backend=0

echo "Running database migrations (no-op when already up to date)..."
# Override the entrypoint with /bin/sh so we run ONLY the migration, regardless of
# what entrypoint the (possibly older, published) image ships. Passing the command
# as args would instead depend on the image's `exec "$@"` branch existing, which
# pre-release images do not have -- they would boot the full app and hang here.
docker compose -f docker-compose.user.yml run --rm --entrypoint /bin/sh backend -c "node_modules/.bin/prisma migrate deploy"

echo "Starting application stack..."
# Images are already present (pulled or built above), so never build implicitly here.
docker compose -f docker-compose.user.yml up -d --remove-orphans --no-build

# Offer lightweight cleanup to reclaim build cache and dangling images older than a day.
echo
echo "Performing background cleanup of builder cache and old images (non-destructive)..."
docker builder prune -f --filter "until=24h" >/dev/null 2>&1 || true
docker image prune -f --filter "until=24h" >/dev/null 2>&1 || true

if [ "$QUIET" != "1" ]; then
  echo
  echo "===================================================="
  echo " SmartFinance is running."
  echo " Access your interface at: http://localhost:3000"
  echo
  echo " Log in with your existing credentials."
  echo " (First time? Run ./scripts/setup-user.sh instead to create the admin.)"
  echo
  echo " To stop the stack, run:"
  echo "   ./scripts/stop-user.sh"
  echo "===================================================="
fi
