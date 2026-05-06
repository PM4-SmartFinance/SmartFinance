---
name: incremental-implementation
description: Lands large changes as a sequence of thin, working slices. Use when implementing any feature touching more than one file or layer, when scope is growing during work, or when a commit is about to exceed ~100 lines.
---

# Incremental Implementation (SmartFinance)

Adapted from [addyosmani/agent-skills — incremental-implementation](https://github.com/addyosmani/agent-skills/blob/main/skills/incremental-implementation/SKILL.md). Project specifics below.

## Project Context

- Branching: feature off `develop`, PR back to `develop`. `main` is release-only.
- Pre-commit hooks (Husky + lint-staged) — never bypass with `--no-verify`.
- No PR creation after **Thursday 20:00** in sprint-review week (only).
- Commits follow Conventional Commits: `<type>(<scope>): [<JIRA-ID>] <subject>`.
- CI must be green before merge (lint, tests, Docker build).

## The Slice Loop

```
┌─ implement ─→ test ─→ verify ─→ commit ─┐
│                                          │
└──────────────── next slice ──────────────┘
```

Each iteration:

1. **Implement** the smallest piece of behavior that produces an observable change.
2. **Test** — write or run tests covering the new branch.
3. **Verify** — `bun run lint`, run the relevant test suites, build, manual UI check if frontend.
4. **Commit** with a Conventional message + Jira ID.

Each commit leaves the system in a working state. If you can't say "the build is green and the app still runs after this commit", the slice is too big.

## Sizing a Slice

| Diff size                             | Status                                   |
| ------------------------------------- | ---------------------------------------- |
| < ~100 lines, single layer            | Ideal.                                   |
| ~100–300 lines, single logical change | OK.                                      |
| > ~400 lines or crosses layers        | Split.                                   |
| Mechanical rename / move              | Size irrelevant; reviewer checks intent. |

**Refactor and feature are two slices.** Land the rename, then land the new behavior. PR #93 (KAN-123) bundled a frontend bugfix with a backend concurrency rewrite — that's exactly the pattern this skill exists to prevent.

## Slicing Strategies

### By layer (vertical, narrow)

For a new endpoint:

1. Repository function + repo unit tests.
2. Service function + service unit tests.
3. Controller route + JSON Schema + API.md entry.
4. Frontend `useQuery` hook + types in `lib/queries/`.
5. UI component + tests.

Each step ships green. Each step is reviewable in isolation.

### By feature flag (vertical, wide)

When a feature must merge dark:

1. Add the gate (env var or DB-driven). Default off.
2. Land the new code path behind the gate. Tests cover both branches.
3. Flip in staging, verify, then in prod.
4. Remove the gate once stable.

Project doesn't yet have a flag system — add an env-var flag inline rather than blocking a release.

### By data migration (sequential)

For a schema change:

1. Add the new column / table; backfill in a Prisma migration.
2. Land code that **writes both old and new**. Reads still use old.
3. Cut readers over to new.
4. Drop old in a follow-up migration.

Each step is independently rollback-safe.

## Stop-the-Line

When anything in the loop fails:

```
1. STOP — do not start the next slice.
2. PRESERVE — keep the failure output, do not edit it away.
3. DIAGNOSE — root cause, not symptom.
4. FIX or REVERT — do not paper over with try/catch.
5. RE-VERIFY — full loop green again.
6. RESUME.
```

The `silent-failure-hunter` agent enforces this on review. Don't let the inverse happen during implementation.

## Working with Jira AC

Each slice maps to one acceptance criterion or one explicit prerequisite step.

```
Jira AC:
- [ ] AC1: Backend endpoint returns BudgetProgress data
- [ ] AC2: Dashboard widget renders 3 donut charts
- [ ] AC3: After CSV import, the widget refreshes without reload

Slices:
1. (prereq) Add BudgetType enum migration
2. (AC1) repository + service + endpoint + API.md + tests
3. (AC2) BudgetProgressWidget component + tests + dashboard wiring
4. (AC3) CsvImportCard onSuccess invalidation + integration test
```

Each commit message references the same Jira ID. When a slice would balloon, file a follow-up Jira ticket and link from the original.

## Commit Discipline

- One Conventional Commit per slice.
- `[<JIRA-ID>]` in the subject.
- Body: _why_, not _what_. The diff shows what.
- No `Co-Authored-By` lines (per memory).
- Never amend a published commit. Never `git push --force` to `main` / `develop`.
- Stack PRs when slices have sequential dependencies.

## Scope Discipline

- The Jira ticket is the scope. Anything outside is scope creep.
- See an unrelated bug while working? **File a new Jira ticket.** Don't fix it in this branch.
- Tempted to refactor a neighboring file while you're here? Stop. Refactor in a separate PR.
- The PR description must match the diff. If the diff outgrew the description, update the description AND consider splitting.

## Verification per slice

- [ ] `bun run lint` clean.
- [ ] Relevant test suite green (`bun run --cwd backend test` and/or frontend).
- [ ] `bun run --cwd backend build` and `bun run --cwd frontend build` succeed.
- [ ] If frontend: dev server boots, feature exercised in browser, golden-path + at least one edge case.
- [ ] Commit message follows Conventional Commits + Jira ID.
- [ ] No `--no-verify`, no `console.log` left in backend code.

## Anti-rationalization

| Excuse                                                      | Counter                                                                                              |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| "It's all related, easier to land together."                | Reviewer can hold ~100 lines in their head. 700 lines = overlooked bugs. PR #93 proved it.           |
| "Splitting makes ugly intermediate states."                 | Each slice should be deployable. If it isn't, design a different split (feature flag, dual-write).   |
| "I already wrote it all, splitting is busywork."            | Stack PRs onto the branch one commit at a time. The work is keeping each commit green, not retyping. |
| "The CI is slow, fewer pushes is better."                   | CI catches what tests catch. Smaller PRs land faster end-to-end even with more pushes.               |
| "It's a refactor, no behavior change, size doesn't matter." | Pure mechanical refactor — true. Anything that touches behavior — false.                             |

## Red Flags

- A single PR description that says "and also fixes…", "and refactors…", "and updates…".
- A commit titled "WIP" or "various fixes" landing on `develop`.
- A diff that rewrites a file the ticket doesn't mention.
- A backend rewrite hidden inside a frontend-titled PR.
- Tests added in a "follow-up commit" never delivered.
