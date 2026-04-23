#!/bin/sh

set -eu

HOOK_PATH=".husky/commit-msg"

if [ ! -f "$HOOK_PATH" ]; then
  echo "ERROR: $HOOK_PATH not found"
  exit 1
fi

TMP_FILE=$(mktemp)
PASS_COUNT=0
FAIL_COUNT=0

cleanup() {
  rm -f "$TMP_FILE"
}

trap cleanup EXIT

run_case() {
  case_name="$1"
  expected_exit="$2"
  message="$3"

  printf '%s\n' "$message" >"$TMP_FILE"

  set +e
  sh "$HOOK_PATH" "$TMP_FILE" >/dev/null 2>&1
  actual_exit=$?
  set -e

  if [ "$actual_exit" -eq "$expected_exit" ]; then
    PASS_COUNT=$((PASS_COUNT + 1))
    echo "PASS: $case_name"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo "FAIL: $case_name"
    echo "  expected exit: $expected_exit"
    echo "  actual exit:   $actual_exit"
    echo "  message:       $message"
  fi
}

run_case "accepts valid scoped commit" 0 "feat(backend): [KAN-10] implement RBAC middleware"
run_case "accepts valid no-scope commit" 0 "ci: [KAN-10] add workflow"
run_case "accepts hyphenated scope" 0 "chore(ci-cd): [KAN-10] align pipeline naming"
run_case "accepts merge commit bypass" 0 "Merge branch 'feature/KAN-10-rbac' into develop"
run_case "accepts revert commit bypass" 0 "Revert \"feat(backend): [KAN-10] implement RBAC middleware\""
run_case "rejects invalid type" 1 "hotfix(backend): [KAN-10] patch quickly"
run_case "rejects uppercase scope" 1 "feat(Back-End): [KAN-10] implement RBAC middleware"
run_case "rejects missing jira id" 1 "feat(backend): implement RBAC middleware"

echo ""
echo "Summary: $PASS_COUNT passed, $FAIL_COUNT failed"

if [ "$FAIL_COUNT" -ne 0 ]; then
  exit 1
fi

echo "All commit-msg hook tests passed."
