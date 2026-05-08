---
name: test-driven-development
description: Drives implementation with tests first. Use when adding logic to services or repositories, fixing any bug, or modifying behavior in changed code. Use when CLAUDE.md's 70% coverage target is at risk on touched files.
---

# Test-Driven Development (SmartFinance)

Adapted from [addyosmani/agent-skills — test-driven-development](https://github.com/addyosmani/agent-skills/blob/main/skills/test-driven-development/SKILL.md). Project specifics below.

## Project Context

- Test runner: **Vitest** (frontend + backend). Tests co-located: `*.test.ts` / `*.test.tsx`.
- Coverage target: **≥70% on core business logic** (services, repositories). UI components lower priority.
- Commands: `bun run test`, `bun run --cwd backend test`, `bun run --cwd frontend test`, `bun run test:coverage`.
- DB tests use Prisma + a real test database (see `feedback_no_cors.md` & existing repository tests in `backend/src/repositories/*.test.ts` for the pattern).

## When to Use

- Adding or modifying any service / repository function.
- Fixing any bug → write the failing repro first (Prove-It pattern).
- Touching atomic transaction code, RBAC checks, or error mapping.
- Modifying any function whose behavior contributes to a Jira AC.

**Skip:** docstring/copy fixes, pure CSS, type-only changes with no runtime branch.

## The Cycle

```
RED → write failing test → GREEN → minimal implementation → REFACTOR → keep tests green
```

A test that passes on first run proves nothing — make it fail first.

## The Prove-It Pattern (Bug Fixes)

```
Bug report / regression
        │
   write reproducing test
        │  (must FAIL — confirms bug)
        ▼
   apply fix
        │  (test PASSES)
        ▼
   run full suite (no regressions)
        │
        ▼
   commit reproducer + fix together
```

Without the failing reproducer, "fix" is unverified.

## Test Pyramid (project shape)

| Layer                        | Share | Examples                                                            |
| ---------------------------- | ----- | ------------------------------------------------------------------- |
| Unit (Vitest, mocked Prisma) | ~80%  | Service logic, repository function shapes, frontend hooks/utils     |
| Integration (real test DB)   | ~15%  | Repository ↔ Postgres, controller ↔ service via Fastify `inject()`  |
| E2E                          | ~5%   | Reserved — none currently. Critical user flows only when warranted. |

## SmartFinance-specific patterns

- **Service tests:** mock the repository module (`vi.mock("../repositories/<name>.repository.js")`). Cover RBAC matrix, error mapping, audit-event emission.
- **Repository tests:** test transaction and error-mapping logic with `vi.mock("../prisma.js")` for unit, OR a real test DB for integration. **For atomic functions with retry / serialization-failure handling, mock `prisma.$transaction` to sequence reject/resolve outcomes** — this is the gap PR #93 left open on `createUserAtomic`.
- **Frontend tests:** wrap in `QueryClientProvider` + `MemoryRouter`. Mock `api` from `../lib/api`. For TanStack Query mutations, prefer integration-style tests that observe the user-visible outcome (re-render after invalidation) over spy-only tests. Add a direct spy on `invalidateQueries({ queryKey: [...] })` to lock each key — observable behavior alone misses a missing key.
- **Audit events:** wrap assertion in `await vi.waitFor(...)` because `void auditService.logEvent(...)` is fire-and-forget.

## Behavior, not implementation

```ts
// GOOD — asserts on outcome
expect(result.role).toBe("ADMIN");

// BAD — asserts on internal call sequence
expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
  isolationLevel: "Serializable",
});
```

The first survives refactors. The second breaks when you switch to `executeRaw`.

## DAMP > DRY in tests

Each test reads as a complete spec. A reader should not have to chase shared helpers to know what is being asserted. Some duplication across `it(...)` blocks is fine — saves the reader a jump.

## Coverage gates the project actually cares about

- Repository functions with side effects (writes, transactions, error mapping): **mandatory direct tests**.
- Service-layer policy (RBAC checks, ownership guards): **mandatory direct tests**.
- Pure utilities: required if behavior is non-trivial.
- Components: required if they contain branching logic, state, or accessibility-critical interactions; not required for pure JSX assemblies.

## Anti-rationalization

| Excuse                                       | Counter                                                                                                                                                  |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "The service test covers it."                | Service tests mock the repo. The mocked behavior could diverge from real Prisma error codes. PR-93 demonstrated this exact gap on P2034 / P2002 mapping. |
| "It's only used in bootstrap, hard to test." | Bootstrap is a security-critical invariant (first user becomes ADMIN). Hard-to-test ≠ skip. Mock the count and assert role.                              |
| "I'll add tests in a follow-up ticket."      | Coverage rotted from "later" never returns to 70%. Tests land with the change or the change does not land.                                               |
| "The retry path is rare."                    | Rare paths fail at 3am. The whole reason `createUserAtomic` exists is to handle a rare race in CI — and it has zero tests.                               |
| "It's a refactor, behavior is unchanged."    | Refactors are exactly when regression tests pay off. If no test exists, write one before the refactor.                                                   |

## Verification before merge

- [ ] All new branches in changed code have at least one assertion that would fail if the branch were inverted.
- [ ] `bun run test` passes (no `.only`, no skipped tests committed).
- [ ] `bun run --cwd backend test` and `bun run --cwd frontend test` both pass.
- [ ] Coverage on changed services/repositories ≥ 70% (`bun run test:coverage` if measuring).
- [ ] No mocked-everything tests that "pass" without exercising real branches.

## Red flags

- A repository function with `prisma.$transaction` and no test that simulates a transaction error.
- A service test that mocks the repository AND no separate repository test exists for the mocked behavior.
- `mockReturnValueOnce` chains that depend on call ordering — convert to `mockImplementation` keyed on argument.
- "It works locally" without a test reproducing the bug.
