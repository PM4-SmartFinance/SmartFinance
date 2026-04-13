#!/usr/bin/env bash
# Stop hook: warn about debugger statements and missing tests
set -uo pipefail

changed=$({ git diff --name-only HEAD 2>/dev/null; git diff --name-only --cached 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null; } | sort -u | grep -E '\.(ts|tsx|js|jsx)$' || true)
[[ -z "$changed" ]] && exit 0

hints=()

while IFS= read -r f; do
  [[ ! -f "$f" ]] && continue
  if grep -qnE '^\s*(debugger|console\.(log|debug)\()' "$f" 2>/dev/null; then
    hints+=("⚠ debugger/console.log in $f")
  fi
done <<< "$changed"

while IFS= read -r f; do
  [[ ! -f "$f" || "$f" =~ \.(test|spec|config|d)\. || ! "$f" =~ /src/ ]] && continue
  base="${f%.*}"; ext="${f##*.}"
  [[ -f "${base}.test.${ext}" || -f "${base}.spec.${ext}" ]] && continue
  hints+=("⚠ No test file for $f")
done <<< "$changed"

if [[ ${#hints[@]} -gt 0 ]]; then
  printf '\n── Pre-stop hints ──\n'
  printf '  %s\n' "${hints[@]}"
  echo ""
fi
exit 0
