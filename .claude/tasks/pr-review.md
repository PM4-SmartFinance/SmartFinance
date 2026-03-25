# PR Review

Review the current branch's pull request against its Jira requirements, project best practices, and dependency health. Output a structured markdown report.

## Steps

1. **Identify context** — determine the current branch name, extract the Jira ticket ID (e.g. `KAN-30` from `feature/KAN-30-csv-importer`).

2. **Gather PR metadata** — run `gh pr view` to get the GitHub PR title, description, changed files, additions/deletions, and PR URL.

3. **Gather Jira requirements** — fetch the Jira ticket (using the Atlassian MCP tools with `smartfinancepm4.atlassian.net`) to get the summary, description, acceptance criteria, and definition of done.

4. **Read all changed files** — use `git diff main...HEAD --stat` to list changed files, then read every changed source file (not lockfiles) in full.

5. **Requirements check** — compare the implementation against each Jira acceptance criterion and DoD item. Mark each as PASS, PARTIAL, or FAIL with notes.

6. **Architecture & best practices review** — check the code against the rules in `CLAUDE.md`:
   - Layered architecture (controller → service → repository)
   - Thin controllers, framework-agnostic services
   - Repository pattern (no direct ORM/SQL outside repository layer)
   - DB transactions for write operations
   - Named exports only
   - Input validation at the boundary
   - Centralized error handling via ServiceError
   - Auth and authorization enforcement
   - TypeScript strict mode (no `any`, no unnecessary type assertions)
   - Security (no secrets, file size limits, injection prevention)
   - Rate each finding as HIGH / MEDIUM / LOW

7. **API documentation check** — if the PR adds or modifies backend endpoints, verify that `backend/API.md` has been updated accordingly. Flag missing or outdated endpoint documentation as a finding.

8. **Test quality assessment** — count tests, evaluate coverage of happy paths, error cases, and edge cases. Note gaps (missing integration tests, untested scenarios).

9. **Security review** — check authentication, authorization, input validation, file handling, SQL injection prevention, and secrets.

10. **Live endpoint verification** — if the PR adds or modifies backend endpoints, start the server locally and test them:
    - Follow the README Development Setup (`docker compose -f docker-compose.dev.yml up -d`, `bun install`, `prisma migrate deploy`, `prisma generate`, `prisma db seed`)
    - Start the backend (`bun run --filter @smartfinance/backend dev`)
    - Test each new/modified endpoint with `fetch` or `curl` — verify status codes, response shapes, error cases, and auth enforcement
    - If the PR touches the database schema, verify that migrations exist and apply cleanly
    - Document any setup issues (missing steps, crashes, env loading problems) as findings
    - Stop and clean up the server and database after testing

11. **Run dependency audit** — execute the `dependency-audit` task or manually check:
    - All dependencies up to date (use `bun outdated`)
    - Any known vulnerabilities (attempt `osv-scanner` or note if unavailable)
    - New dependencies added by the PR are justified and current

12. **Write review report** — create the report at `.claude/review/PR-<number>-<ticket-id>-<short-name>.md` with these sections:
    - PR metadata (branch, PR link, Jira link, date)
    - Requirements check table
    - Architecture & best practices (compliant items + issues with severity)
    - Test quality (metrics + strengths + gaps)
    - Security review table
    - Dependency audit (versions table + findings)
    - Summary with overall verdict: APPROVE / APPROVE WITH SUGGESTIONS / REQUEST CHANGES
    - Categorized improvement list: must-fix, strongly recommended, nice-to-have
    - Comment like from a Senior Developer reviewing a junior developers pull request.

## Notes

- Use the base branch from the PR (could be `main` or `develop`) for diff comparisons.
- The Jira cloud ID is `smartfinancepm4.atlassian.net`.
- Run sub-tasks in parallel where possible (e.g. fetch PR + Jira + diff simultaneously).
- Be specific in findings — always reference file path and line numbers.
- Keep the tone constructive and factual — this report may be shared with the team.
