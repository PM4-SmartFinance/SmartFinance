---
description: "PR review using specialized agents"
argument-hint: "[review-aspects]"
---

# PR Review

Run a pull request review using specialized agents. Each focuses on a different quality aspect.

**Arguments (optional):** "$ARGUMENTS"

## How to launch agents

Agent definitions live in `.claude/agents/*.md`. To launch one: read the agent file, then use the Agent tool with the file's content as the prompt. Always use `subagent_type: "general-purpose"`. Launch multiple agents in a single message for parallelism.

## Workflow

1. **Scope**: Run `git diff --name-only` to identify changed files. Parse arguments for specific aspects.

2. **Available aspects:**
   - **code** — General code review (CLAUDE.md compliance, bugs)
   - **tests** — Test coverage quality and gaps
   - **errors** — Silent failures and error handling
   - **all** — Run all applicable (default)

3. **Which agents to launch** (read from `.claude/agents/`):
   - **Always**: `code-reviewer.md`
   - **If test files changed**: `pr-test-analyzer.md`
   - **If error handling changed**: `silent-failure-hunter.md`

4. **Launch agents** in parallel (default). Each analyzes `git diff`.

5. **Aggregate** into:

   ```
   ## Critical Issues (must fix)
   - [agent]: issue [file:line]

   ## Important Issues (should fix)
   - [agent]: issue [file:line]

   ## Strengths
   - What's well-done
   ```
