#!/usr/bin/env bash
# PostToolUse hook: lint and format files changed by Claude
# Receives space-separated file paths as arguments

set -euo pipefail

# Exit silently if no files provided
[[ $# -eq 0 ]] && exit 0

files_to_lint=()
files_to_format=()

for file in "$@"; do
  # Skip if file doesn't exist (was deleted)
  [[ ! -f "$file" ]] && continue

  case "$file" in
    *.ts|*.tsx|*.js|*.jsx|*.mjs)
      files_to_lint+=("$file")
      files_to_format+=("$file")
      ;;
    *.json|*.md|*.yml|*.yaml|*.css|*.scss)
      files_to_format+=("$file")
      ;;
  esac
done

# Run ESLint on lintable files
if [[ ${#files_to_lint[@]} -gt 0 ]]; then
  bunx eslint --fix "${files_to_lint[@]}" 2>&1 || true
fi

# Run Prettier on formattable files
if [[ ${#files_to_format[@]} -gt 0 ]]; then
  bunx prettier --write "${files_to_format[@]}" 2>&1 || true
fi
