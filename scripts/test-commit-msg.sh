#!/bin/bash

# Test script for commit message regex validation
# Usage: ./scripts/test-commit-msg.sh
# Exit code: 0 if all tests pass, 1 if any test fails

PASS_COUNT=0
FAIL_COUNT=0

# Color codes (disable when not a TTY, e.g. CI)
if [ -t 1 ]; then
  GREEN='\033[0;32m'
  RED='\033[0;31m'
  NC='\033[0m'
else
  GREEN=''
  RED=''
  NC=''
fi

# Source the pattern from the commit-msg hook (single source of truth)
REPO_ROOT="$(git rev-parse --show-toplevel)"
PATTERN=$(grep "^pattern=" "$REPO_ROOT/.husky/commit-msg" | sed "s/^pattern='//" | sed "s/'$//")

if [ -z "$PATTERN" ]; then
  echo "ERROR: Could not extract pattern from .husky/commit-msg"
  exit 1
fi

test_commit_msg() {
  local message="$1"
  local should_pass="$2"
  local description="$3"

  # Simulate the hook logic: allow merge and revert
  case "$message" in
    Merge*|Revert*)
      if [ "$should_pass" = "true" ]; then
        printf "${GREEN}✓ PASS${NC}: %s\n" "$description"
        PASS_COUNT=$((PASS_COUNT + 1))
        return 0
      else
        printf "${RED}✗ FAIL${NC}: %s (expected to fail, but merge/revert allowed)\n" "$description"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        return 1
      fi
      ;;
  esac

  # Test against pattern
  if echo "$message" | grep -qE "$PATTERN"; then
    if [ "$should_pass" = "true" ]; then
      printf "${GREEN}✓ PASS${NC}: %s\n" "$description"
      PASS_COUNT=$((PASS_COUNT + 1))
      return 0
    else
      printf "${RED}✗ FAIL${NC}: %s (expected to reject, but matched)\n" "$description"
      FAIL_COUNT=$((FAIL_COUNT + 1))
      return 1
    fi
  else
    if [ "$should_pass" = "false" ]; then
      printf "${GREEN}✓ PASS${NC}: %s\n" "$description"
      PASS_COUNT=$((PASS_COUNT + 1))
      return 0
    else
      printf "${RED}✗ FAIL${NC}: %s (expected to pass, but rejected)\n" "$description"
      FAIL_COUNT=$((FAIL_COUNT + 1))
      return 1
    fi
  fi
}

echo "Testing commit message regex validation..."
echo ""

# Happy-path cases
test_commit_msg "feat(backend): [KAN-10] implement RBAC middleware" true "Simple feature with single-word scope"
test_commit_msg "fix(frontend): [KAN-15] resolve layout shift on mobile dashboard" true "Bug fix with description"
test_commit_msg "docs(root): [KAN-23] add CONTRIBUTING.md with team branching strategy" true "Documentation with root scope"
test_commit_msg "chore(back-end): [KAN-99] update dependencies" true "Chore with hyphenated scope"
test_commit_msg "ci(ci-cd): [KAN-42] add GitHub Actions workflow" true "CI with multi-word hyphenated scope"
test_commit_msg "refactor(db): [KAN-5] simplify query logic" true "Refactor with short scope"
test_commit_msg "test: [KAN-100] add edge case coverage" true "Type without scope"
test_commit_msg "style: [KAN-88] format code with Prettier" true "Style change without scope"
test_commit_msg "build(root): [KAN-10] upgrade dependencies" true "Build type with scope"
test_commit_msg "perf(backend): [KAN-55] optimize query indexing" true "Perf type with scope"
test_commit_msg "Merge pull request #69 from PM4-SmartFinance/feature/KAN-111-test" true "Merge commit (always allowed)"
test_commit_msg "Revert 'feat: [KAN-50] old feature'" true "Revert commit (always allowed)"

echo ""
echo "Rejection cases"
echo ""

# Rejection cases
test_commit_msg "feat[KAN-10] missing scope parens and colon" false "Missing scope parens and colon"
test_commit_msg "feat(backend) [KAN-10] missing colon" false "Missing colon after scope"
test_commit_msg "feat(backend): KAN-10 missing square brackets" false "Missing square brackets around Jira ID"
test_commit_msg "feat(backend): [KAN10] missing hyphen in Jira ID" false "Jira ID missing hyphen"
test_commit_msg "FEAT(backend): [KAN-10] uppercase type" false "Uppercase type (should be lowercase)"
test_commit_msg "feat(Back-end): [KAN-10] uppercase scope" false "Uppercase letter in scope"
test_commit_msg "feat(backend_tools): [KAN-10] underscore in scope" false "Underscore instead of hyphen in scope"
test_commit_msg "feat(backend-): [KAN-10] trailing hyphen in scope" false "Trailing hyphen inside scope"
test_commit_msg "feat(-backend): [KAN-10] leading hyphen in scope" false "Leading hyphen in scope"
test_commit_msg "feat(back--end): [KAN-10] double hyphen in scope" false "Consecutive hyphens in scope"
test_commit_msg "feat(backend2): [KAN-10] digit in scope" false "Digit in scope"
test_commit_msg "unknown(backend): [KAN-10] invalid type" false "Invalid type"
test_commit_msg "feat(backend): [KAN-10]" false "Missing subject after Jira ID"
test_commit_msg "feat(backend): [KAN-0] zero Jira ID" false "Jira ID cannot be zero"

echo ""
echo "========================================"
printf "Results: ${GREEN}%d passed${NC}, ${RED}%d failed${NC}\n" "$PASS_COUNT" "$FAIL_COUNT"
echo "========================================"

if [ $FAIL_COUNT -eq 0 ]; then
  exit 0
else
  exit 1
fi
