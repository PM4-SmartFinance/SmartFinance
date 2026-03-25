# Issue Workflow

Work on a Jira issue from analysis through implementation. Track progress in a local issue file.

## Inputs

- Jira ticket ID (e.g. `KAN-30`) — passed as argument or extracted from branch name

## Steps

1. **Create tracking file** — create `.claude/issues/<branch-name>.md` with ticket ID, title, and status sections (Analysis, Plan, Progress, Open Questions).

2. **Fetch Jira ticket** — use Atlassian MCP tools (cloud ID: `smartfinancepm4.atlassian.net`) to get the issue summary, description, acceptance criteria, and definition of done. Write findings into the tracking file.

3. **Analyse the codebase** — identify which files, layers, and modules are affected. Map out the required changes. Update the tracking file with the plan.

4. **Create feature branch** (if not already on one) — follow the naming convention: `<type>/<JIRA-ID>-<description>`.

5. **Write tests first** — for each acceptance criterion, write failing tests that prove the requirement is met once the code is implemented. Use Vitest. Place tests next to the source file (`*.test.ts`).

6. **Implement** — work through the plan step by step. Follow the layered architecture (controller → service → repository). Keep controllers thin, services framework-agnostic, use repository pattern for DB access.

7. **Verify** — run `bun run lint`, `bun run test`, and build both workspaces. Fix any issues.

8. **Update tracking file** — mark completed items, note any deviations from the plan.

9. **Commit** — use Conventional Commits with Jira ID: `<type>(<scope>): [<JIRA-ID>] <subject>`. Stage only relevant files.

10. **Update Jira** — transition the ticket status if appropriate (e.g. To Do → In Progress). Add a comment summarizing what was done.

## Notes

- The Jira cloud ID is `smartfinancepm4.atlassian.net`.
- Never commit to `main` directly — always use feature branches.
- All write operations must use DB transactions.
- Run the full lint + test suite before considering the task done.
- The `.claude/issues/` directory is gitignored — tracking files are local only.
