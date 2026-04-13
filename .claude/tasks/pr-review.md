# PR Review

Review the current branch's pull request against Jira requirements, project standards, and dependency health. Output a structured markdown report.

## How to launch agents

Agent definitions live in `.claude/agents/*.md`. To launch one: read the agent file, then use the Agent tool with the file's content as the prompt. Always use `subagent_type: "general-purpose"`. Launch multiple agents in a single message for parallelism.

## Steps

1. **Identify context** — determine branch name, extract Jira ticket ID (e.g. `KAN-30` from `feature/KAN-30-csv-importer`).

2. **Gather PR metadata** — run `gh pr view` to get title, description, changed files, PR URL.

3. **Gather Jira requirements** — fetch the Jira ticket (Atlassian MCP, cloud: `smartfinancepm4.atlassian.net`) for summary, description, acceptance criteria, and DoD.

4. **Read all changed files** — `git diff develop...HEAD --stat` to list, then read every changed source file in full.

5. **Requirements check** — compare implementation against each Jira acceptance criterion and DoD item. Mark each as PASS, PARTIAL, or FAIL with notes.

6. **Architecture & best practices review** — check against CLAUDE.md rules:
   - Layered architecture (controller → service → repository)
   - Thin controllers, framework-agnostic services
   - Repository pattern, DB transactions for writes
   - Named exports, input validation at boundary
   - Centralized error handling via ServiceError
   - TypeScript strict mode (no `any`)
   - Security (no secrets, injection prevention)
   - Rate each finding as HIGH / MEDIUM / LOW

7. **Run review agents in parallel** — read these agent files from `.claude/agents/`, then launch each as a general-purpose agent in a single message:
   - `code-reviewer.md` — bugs, logic errors, CLAUDE.md violations
   - `silent-failure-hunter.md` — swallowed errors, empty catch blocks
   - `pr-test-analyzer.md` — test coverage gaps and quality

   Merge findings with step 6, deduplicate (keep the more detailed finding).

8. **API documentation check** — if PR adds/modifies endpoints, verify `backend/API.md` is updated. Flag missing docs.

9. **Security review** — auth, authorization, input validation, file handling, SQL injection, secrets. Incorporate findings from code-reviewer agent.

10. **Live endpoint verification** — if PR adds/modifies endpoints, start server and test:
    - Setup: `docker compose -f docker-compose.dev.yml up -d`, `bun install`, `bunx prisma migrate deploy`, `bunx prisma generate`, `bunx prisma db seed`
    - Start: `bun run --filter @smartfinance/backend dev`
    - Test each endpoint: status codes, response shapes, error cases, auth enforcement
    - Document setup issues as findings
    - Stop and clean up after testing

11. **Dependency audit** — run the `dependency-audit` task or manually: `bun outdated`, check new deps are justified.

12. **Write report** — save to `.claude/review/PR-<number>-<ticket-id>-<short-name>.md`:
    - PR metadata (branch, PR link, Jira link, date)
    - Requirements check table
    - Architecture & best practices (compliant + issues with severity)
    - Test quality (strengths + gaps)
    - Security review table
    - Dependency audit
    - Summary verdict: APPROVE / APPROVE WITH SUGGESTIONS / REQUEST CHANGES
    - Categorized improvements: must-fix, strongly recommended, nice-to-have
    - Comment in tone of a senior developer reviewing a junior's PR

## Notes

- Use base branch from PR (could be `main` or `develop`) for diffs.
- Jira cloud ID: `smartfinancepm4.atlassian.net`.
- Run sub-tasks in parallel where possible.
- Be specific — always reference file path and line numbers.
- Keep tone constructive and factual.
