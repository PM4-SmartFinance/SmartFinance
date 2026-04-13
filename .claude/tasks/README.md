# Claude Code Tasks

Reusable task definitions for common workflows. Reference a task by name when prompting Claude Code.

| Task               | Description                                                          |
| ------------------ | -------------------------------------------------------------------- |
| `issue-workflow`   | Work on a Jira issue end-to-end: analysis, tests, implementation, PR |
| `pr-review`        | Full code review against Jira requirements and project standards     |
| `spec-coverage`    | Check test coverage for changed files, identify gaps                 |
| `dependency-audit` | Audit dependencies for updates, duplicates, and vulnerabilities      |

Tasks use agents from `.claude/agents/` where applicable (code-explorer, code-reviewer, silent-failure-hunter, pr-test-analyzer).
