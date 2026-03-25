#!/usr/bin/env bash
# Stop hook: remind about tests and check for debugger statements
# Non-blocking — prints hints but does not fail

set -uo pipefail

# Get files changed since last commit (staged + unstaged + untracked)
changed_files=$(git diff --name-only HEAD 2>/dev/null; git diff --name-only --cached 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null)
changed_files=$(echo "$changed_files" | sort -u | grep -E '\.(ts|tsx|js|jsx|mjs)$' || true)

[[ -z "$changed_files" ]] && exit 0

hints=()

# Check for debugger statements and console.log in changed files
while IFS= read -r file; do
  [[ ! -f "$file" ]] && continue

  if grep -nE '^\s*(debugger|console\.(log|debug|info|warn)\()' "$file" 2>/dev/null | head -3; then
    hints+=("⚠ Debugger/console statement found in $file")
  fi
done <<< "$changed_files"

# Check for missing test files
while IFS= read -r file; do
  [[ ! -f "$file" ]] && continue
  # Skip test files, config files, and type definitions
  [[ "$file" =~ \.(test|spec)\.(ts|tsx|js|jsx)$ ]] && continue
  [[ "$file" =~ \.(config|d)\.(ts|js|mjs)$ ]] && continue
  [[ "$file" =~ __tests__/ ]] && continue

  # Only check source files in src/ directories
  [[ ! "$file" =~ /src/ ]] && continue

  # Derive possible test file paths
  base="${file%.*}"
  ext="${file##*.}"
  test_candidates=(
    "${base}.test.${ext}"
    "${base}.spec.${ext}"
  )

  has_test=false
  for candidate in "${test_candidates[@]}"; do
    [[ -f "$candidate" ]] && has_test=true && break
  done

  if [[ "$has_test" == "false" ]]; then
    hints+=("⚠ No test file found for $file")
  fi
done <<< "$changed_files"

# Print hints if any
if [[ ${#hints[@]} -gt 0 ]]; then
  echo ""
  echo "── Pre-stop hints ──"
  for hint in "${hints[@]}"; do
    echo "  $hint"
  done
  echo ""
fi

exit 0
