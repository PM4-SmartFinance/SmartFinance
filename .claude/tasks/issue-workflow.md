# Issue Workflow

Work on a Jira issue from analysis through implementation.

## Inputs

- Jira ticket ID (e.g. `KAN-30`) — passed as argument or extracted from branch name

## How to launch agents

Agent definitions live in `.claude/agents/*.md`. To launch one: read the agent file, then use the Agent tool with the file's content as the prompt. Always use `subagent_type: "general-purpose"`. Launch multiple agents in a single message for parallelism.

## Steps

1. **Create tracking file** — `.claude/issues/<branch-name>.md` with ticket ID, title, sections: Analysis, Plan, Progress, Open Questions.

2. **Fetch Jira ticket** — Atlassian MCP (cloud: `smartfinancepm4.atlassian.net`) for summary, description, acceptance criteria, DoD. Write into tracking file.

3. **Analyse codebase** — read `.claude/agents/code-explorer.md`, then launch general-purpose agents with that prompt to identify affected files, layers, and modules. Map required changes. Update tracking file with plan.

4. **Create feature branch** (if not on one) — naming: `<type>/<JIRA-ID>-<description>`.

5. **Write tests first** — for each acceptance criterion, write failing Vitest tests. Place co-located (`*.test.ts`).

6. **Implement** — work through plan. Follow layered architecture (controller → service → repository). Keep controllers thin, services framework-agnostic.

7. **Verify** — `bun run lint`, `bun run test`, build both workspaces. Fix issues.

8. **Update tracking file** — mark completed items, note deviations.

9. **Commit** — Conventional Commits with Jira ID: `<type>(<scope>): [<JIRA-ID>] <subject>`. Stage only relevant files.

10. **Update Jira** — transition ticket status if appropriate. Add comment summarizing work.

## Notes

- Jira cloud ID: `smartfinancepm4.atlassian.net`.
- Never commit to `main` or `develop` directly.
- All writes use DB transactions.
- Run lint + test before considering done.
- `.claude/issues/` is gitignored.
