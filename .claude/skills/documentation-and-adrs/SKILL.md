---
name: documentation-and-adrs
description: Records architectural decisions and writes durable docs. Use when making a non-trivial architectural choice, when CLAUDE.md gains a new rule, or when the same context is being explained to multiple agents/teammates.
---

# Documentation and ADRs (SmartFinance)

Adapted from [addyosmani/agent-skills — documentation-and-adrs](https://github.com/addyosmani/agent-skills/blob/main/skills/documentation-and-adrs/SKILL.md). Project specifics below.

## Project Context

- Wiki lives in `wiki/` (separate git repo, not part of main codebase).
- ADRs live in `wiki/decisions/` — sequential numbering: `0001-<slug>.md`, `0002-<slug>.md`, …
- API reference: `backend/API.md`.
- Codebase rules: `CLAUDE.md` (project) + `CLAUDE.local.md` (personal, gitignored).
- Memory: `~/.claude/projects/-Users-maximilian-programming-SmartFinance/memory/MEMORY.md`.

## What to document where

| Content                                                            | Location                                     |
| ------------------------------------------------------------------ | -------------------------------------------- |
| Architectural decision (why we chose X over Y)                     | `wiki/decisions/NNNN-*.md` (ADR)             |
| Endpoint signatures, request/response shapes                       | `backend/API.md`                             |
| Project conventions / coding rules                                 | `CLAUDE.md`                                  |
| User guide, ops, deployment                                        | `wiki/` (other folders)                      |
| Per-feature spec / Jira context                                    | Jira (KAN-NNN)                               |
| Stable cross-conversation knowledge about the user / project state | auto-memory                                  |
| Why a single line of code looks weird                              | inline comment with the _why_ (not the what) |

If you're tempted to add a comment that explains _what_ the code does, the code is unclear. Rename / refactor instead.

## ADR Triggers

Write an ADR when you decide:

- A framework / library / major dep (Fastify 5, Prisma, Zustand, TanStack Query).
- A data-modeling pattern (repository layer, atomic transaction strategy).
- An auth strategy (cookie sessions + Argon2, RBAC roles).
- A boundary rule (extension-module isolation, no-CORS-via-Vite-proxy).
- A branching / release model (develop + main two-branch).
- Anything that would be expensive to reverse later, or that future agents must not silently undo.

## ADR Template

```markdown
# ADR NNNN — <Title>

- **Status:** Proposed | Accepted | Superseded by ADR-MMMM | Deprecated
- **Date:** YYYY-MM-DD
- **Decider(s):** <name(s) / role(s)>
- **Related:** <Jira / PR / prior ADRs>

## Context

What is the situation that calls for a decision? What forces are at play
(technical constraints, deadlines, team capability, prior decisions)?

## Decision

What did we choose? State it plainly. One paragraph maximum.

## Consequences

What becomes easier? What becomes harder? What constraints does this
impose on future work? What is now off-limits?

## Alternatives Considered

For each alternative: what was it, why was it rejected? At least two —
"no alternatives" usually means insufficient analysis.

## References

Links to docs, RFCs, blog posts, prior PRs, Jira tickets.
```

Status lifecycle: `Proposed` → `Accepted` (after merge) → `Superseded by …` (when replaced) or `Deprecated` (when no replacement).

## Suggested back-fill ADRs

These decisions exist in the codebase / CLAUDE.md but have no ADR. Worth back-filling in priority order:

1. **Layered architecture (controller / service / repository).** Why this over a flat structure or DDD aggregates.
2. **Repository pattern + all-writes-in-transactions.** Why every write goes through a repo function.
3. **Cookie sessions + Argon2** (over JWT, over bcrypt). Security + revocation reasoning.
4. **Same-origin via Vite proxy + reverse proxy in prod (no `@fastify/cors`).** Why deliberately no CORS.
5. **Extension architecture: namespace-isolated JSON storage, no repo access.** What modules can and cannot do.
6. **Two-branch git model: `develop` integration + `main` release-only.** Why not trunk-based.
7. **Bun as package manager + script runner; asdf via `.tool-versions`.** Why Bun over npm/yarn/pnpm.
8. **TanStack Query for server state + Zustand for client state, no mixing.** Why this split.
9. **Bootstrap-first-admin invariant inside `createUserAtomic`.** Why the policy lives in a serializable transaction with retry.
10. **CSV import all-or-nothing transaction.** Why partial imports are not allowed.

## Inline Comments — when

A comment is justified only when:

- It records _why_ the code looks the way it does, where the why isn't in the code.
- It records a workaround for a specific bug / library quirk (link the issue).
- It records an invariant a future change might unknowingly break.

Never:

- Restate the code in English.
- Reference the current task / fix / caller. That belongs in the PR description and rots fast.
- Document obvious framework behavior.

## Updating CLAUDE.md

CLAUDE.md grows when:

- A new convention is enforced project-wide (e.g., "no React.FC").
- A new tool joins the stack (Vitest, Prisma).
- A pattern from one part of the codebase is now mandatory everywhere.

CLAUDE.md does NOT grow with:

- Per-feature notes.
- Personal preference (those go in `CLAUDE.local.md`).
- Anything that belongs in an ADR.

## Updating `backend/API.md`

Mandatory whenever:

- A new endpoint is added.
- A request / response shape changes.
- A status code mapping changes.
- An auth requirement changes.

Reviewer should reject any backend PR that adds an endpoint without API.md update.

## Anti-rationalization

| Excuse                                    | Counter                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| "It's documented in the PR description."  | PRs are write-once. Once merged the description is hard to find. ADRs live in `wiki/decisions/`.        |
| "Everyone on the team knows why."         | Future agents don't. Team rotation doesn't. Document the why.                                           |
| "An ADR is overkill for this."            | If the decision is small, the ADR is small. The point is durability.                                    |
| "I'll write it after the implementation." | After-the-fact ADRs lose the rejected alternatives. The value is in capturing options at decision time. |
| "The code is self-explanatory."           | The _what_ might be. The _why_ never is.                                                                |

## Verification before merge

- [ ] Any new convention added to CLAUDE.md is reflected in linter / template / agent prompt where applicable.
- [ ] Any architectural choice that future agents must not undo has an ADR (proposed or accepted).
- [ ] Any new endpoint is in `backend/API.md`.
- [ ] No comment in changed code restates the code.
