---
name: code-review-and-quality
description: Conducts five-axis code review with severity labels and change sizing. Use before merging any PR. Use when reviewing code written by yourself, another agent, or a teammate.
---

# Code Review and Quality (SmartFinance)

Adapted from [addyosmani/agent-skills — code-review-and-quality](https://github.com/addyosmani/agent-skills/blob/main/skills/code-review-and-quality/SKILL.md). Project specifics below.

## Approval Standard

> Approve a change when it definitely improves the codebase, even if it isn't perfect. Do not block on personal preference. Do block on real defects, real security risks, real architectural drift.

Project additionally requires:

- Explicit Project-Owner approval on every PR (per CLAUDE.md).
- CI green (lint, tests, Docker build).
- No new PR creation after **Thursday 20:00** in sprint-review week (only — see `feedback_late_pr_cutoff.md`).

## The Five Axes

Score every changed file across these. Findings on any axis can block merge.

### 1. Correctness

- Matches the Jira AC and the PR description.
- All branches handled (null / empty / boundary / negative).
- No off-by-one, race condition, or unhandled rejection.
- Tests cover the new branches and would catch a regression.

### 2. Readability & Simplicity

- Names are descriptive (no `data`, `result`, `temp` without context).
- Control flow is shallow (early returns over nested ternaries).
- No dead code, no `// removed` comments, no orphaned `_unused` vars.
- Abstractions earn their complexity (≥2 consumers; otherwise inline).
- Three similar lines beat a premature helper.

### 3. Architecture (CLAUDE.md compliance)

- Layered: controller → service → repository. No layer skipped.
- Service is framework-agnostic (no Fastify types in services).
- All writes inside `prisma.$transaction`.
- Named exports only. No `React.FC`.
- TanStack Query for server state, Zustand for client state, no mixing.
- React 19 patterns (`use()`, `<Context>` provider, no class components).
- No barrel files, no Axios, no `useEffect` for fetching.
- Frontend never reaches the DB — only via `api`.

### 4. Security

- Input validation at the boundary (Fastify JSON Schema).
- RBAC + ownership checks at the service layer.
- All writes in transactions; error mapping in repository.
- No secrets in code. No PII in logs. No `console.log` in backend prod code.
- No new `dangerouslySetInnerHTML` with user data.
- No CORS introduced (project uses Vite proxy / reverse proxy — see memory).
- File uploads: size + type check on backend in addition to frontend.

### 5. Performance

- Backend filters, paginates, aggregates — frontend never loads full datasets.
- No N+1: prefer `findMany` with `where` over loop+find.
- Pagination with server-clamped `limit`.
- Frontend: no inline object/array props on hot-rendering trees that depend on referential equality. `useMemo` only when measurably needed.
- TanStack Query: `staleTime` set when frequent re-renders are wasteful.

## Severity Labels

Tag every comment so the author knows what's mandatory and what's optional.

| Label                       | Meaning                                                                                    | Author action             |
| --------------------------- | ------------------------------------------------------------------------------------------ | ------------------------- |
| **Critical**                | Blocks merge. Bug, security, data loss, broken contract.                                   | Must fix.                 |
| _(no label)_                | Required change. Architectural drift, CLAUDE.md violation, missing test on touched branch. | Must fix or justify.      |
| **Optional** / **Consider** | Suggestion that would improve the code.                                                    | Author may take or leave. |
| **Nit**                     | Style or naming preference, no behavior impact.                                            | Author may ignore.        |
| **FYI**                     | Informational. Future context.                                                             | No action.                |

If everything is "Nit", the diff is approvable. If anything is unlabeled, the author must address.

## Change Sizing

| Diff size                         | Status                                            |
| --------------------------------- | ------------------------------------------------- |
| ≤ ~100 lines                      | Ideal. One sitting.                               |
| ≤ ~300 lines                      | OK if it's a single logical change.               |
| > ~400 lines and crosses layers   | Flag for split.                                   |
| Pure rename / mechanical refactor | Size doesn't matter; reviewer checks intent only. |

**Always separate refactor from feature.** A diff that refactors and adds behavior is two diffs. PR #93 is the cautionary example: a frontend bugfix bundled with a backend concurrency rewrite — split next time.

## Splitting Strategies

| Strategy                                                    | When                              |
| ----------------------------------------------------------- | --------------------------------- |
| **Stack** — small PR, then PR atop it                       | Sequential dependencies           |
| **By layer** — repo PR, then service PR, then controller PR | Cross-layer change                |
| **Vertical slice** — full-stack but for one resource        | Feature work touching N resources |
| **Cleanup-first** — separate the rename / move              | Refactor mixed with new code      |

## Review Process

1. **Context.** Read Jira AC + PR description. State what you expect to see before opening the diff.
2. **Tests first.** Open the test files. Are the assertions on outcome, not implementation? Do they exercise the new branches? Would they fail if the code regressed?
3. **Implementation.** File by file, run the five axes.
4. **Severity-tag every finding.**
5. **Verify the verification.** Did the author run lint / tests / build / manual UI check? Are there screenshots for UI changes? Did `bun audit` change?

## Multi-agent review (project pattern)

`/run task pr-review` launches:

- `code-reviewer.md` — bugs + CLAUDE.md compliance.
- `silent-failure-hunter.md` — error handling.
- `pr-test-analyzer.md` — coverage gaps.

These run as parallel general-purpose agents and the orchestrator merges + dedupes findings. Keep the more detailed finding when the same issue surfaces in two agents.

## Dependency review

For any PR that touches `package.json`:

- Existing stack already covers it? (Often yes.)
- Bundle / runtime weight? (Especially frontend.)
- Active maintenance? (Last commit, open issues, recent release.)
- Vulnerabilities? `bun audit`.
- License compatible?
- Single workspace or hoist to root? (Shared tooling → root.)

Defer to the `dependency-audit` task for full sweep.

## Honesty Norms

- Do not rubber-stamp. "LGTM" without evidence is noise.
- Quantify when you can. "This adds ~50ms per row" beats "this might be slow".
- Push back on real problems, even if the author is senior. Comment on code, not people.
- Accept being overruled when the author has full context and the trade-off is judgment.

## Anti-rationalization

| Excuse                                   | Counter                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| "It's a junior author, I'll be lenient." | Lenient review = production bugs. Be kind, be honest, be specific.                          |
| "The CI will catch it."                  | CI catches what tests catch. Reviews catch design and intent.                               |
| "I'll fix it in a follow-up."            | Follow-ups don't happen. Fix or file a Jira ticket with a self-assignment before approving. |
| "All comments are nits."                 | Then label them so. If they aren't, label honestly.                                         |
| "Splitting would slow us down."          | Two reviewable PRs ship faster than one un-mergable PR.                                     |

## Red Flags

- Diff > 400 lines crossing layers, no split rationale.
- New endpoint without API.md update.
- New service-layer code without a corresponding test.
- Repository changes whose tests still mock `prisma.$transaction` trivially.
- Frontend uses `useEffect` for fetching.
- Server data duplicated into Zustand.
- New `console.log` in backend code.
- New `any` or `as unknown as`.
- `--no-verify` in commits.
- PR title or description without Jira ID `[KAN-NNN]`.

## Verification before approving

- [ ] Five axes scored.
- [ ] Every finding has a severity label.
- [ ] Diff size and scope match a single Jira ticket.
- [ ] Tests cover every new branch in changed code.
- [ ] No CLAUDE.md violation flagged as Nit by mistake.
- [ ] Author verification story is plausible (lint / test / build / UI screenshot if applicable).
