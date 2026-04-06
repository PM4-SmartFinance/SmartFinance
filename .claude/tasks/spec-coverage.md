# Spec Coverage Check

Analyse test coverage for changed files. Identify missing tests and untested edge cases.

## How to launch agents

Agent definitions live in `.claude/agents/*.md`. To launch one: read the agent file, then use the Agent tool with the file's content as the prompt. Always use `subagent_type: "general-purpose"`.

## Steps

1. **Identify changed files** — `git diff develop...HEAD --name-only`, filter to `.ts`/`.tsx` in `src/` directories.

2. **Map source → test files** — check for `<name>.test.ts` / `<name>.spec.ts` co-located. Flag files without tests.

3. **Run test analysis agent** — read `.claude/agents/pr-test-analyzer.md`, then launch a general-purpose agent with that prompt on the changed files to identify:
   - Critical coverage gaps (untested error handling, business logic branches)
   - Test quality issues (implementation-coupled tests, missing negative cases)
   - Priority-ranked recommendations

4. **Run coverage report** — execute `bun run test:coverage` and parse output. Highlight files below 70% line coverage.

5. **Write report** — structured markdown:
   - Summary table: file → test file → test count → coverage → status
   - Detailed gaps per file with suggested test cases (from agent + manual analysis)
   - Priority ranking: critical gaps first (untested business logic > untested utilities)

## Notes

- Test runner: **Vitest**. Tests co-located with source (`*.test.ts`).
- Focus on services and repositories. UI component tests are lower priority.
- Quality target: ≥70% coverage on core business logic.
