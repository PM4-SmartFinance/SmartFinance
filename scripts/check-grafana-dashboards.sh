#!/usr/bin/env bash
# Verify every datasource reference in committed Grafana dashboards
# resolves to a UID that the provisioning yaml actually defines.
#
# Catches the failure mode where a dashboard exported from Grafana
# carries an auto-generated datasource UID that nothing provisions,
# producing "datasource was not found" at runtime.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DASH_DIR="$ROOT/grafana/dashboards"
DS_FILE="$ROOT/grafana/provisioning/datasources/prometheus.yml"

command -v jq >/dev/null || { echo "jq required" >&2; exit 2; }

allowed_uids="$(grep -E '^\s*uid:' "$DS_FILE" | awk '{print $2}' | sort -u)"
[ -n "$allowed_uids" ] || { echo "no uid defined in $DS_FILE" >&2; exit 1; }

fail=0
for f in "$DASH_DIR"/*.json; do
  refs="$(jq -r '.. | objects | .datasource? // empty | (.uid // .name) // empty' "$f" \
          | grep -v '^-- Grafana --$' | sort -u)"
  for ref in $refs; do
    if ! grep -qx "$ref" <<<"$allowed_uids"; then
      echo "FAIL $(basename "$f"): references unknown datasource '$ref'"
      fail=1
    fi
  done
done

[ $fail -eq 0 ] && echo "ok: all dashboard datasource refs resolve"
exit $fail
