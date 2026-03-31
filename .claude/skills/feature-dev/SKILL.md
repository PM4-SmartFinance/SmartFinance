---
description: Guided feature development with codebase exploration, architecture design, and quality review
argument-hint: Feature description
---

# Feature Development

Systematic approach: explore codebase → ask questions → design architecture → implement → review.

Initial request: $ARGUMENTS

## How to launch agents

Agent definitions live in `.claude/agents/*.md`. To launch one: read the agent file, then use the Agent tool with the file's content as the prompt. Always use `subagent_type: "general-purpose"`. Launch multiple agents in a single message for parallelism.

## Phase 1: Discovery

1. Create todo list with all phases
2. If unclear, ask what problem they're solving, what it should do, constraints
3. Confirm understanding with user

## Phase 2: Codebase Exploration

1. Read `.claude/agents/code-explorer.md`. Launch 2–3 general-purpose agents in parallel with that prompt, each targeting a different aspect (similar features, architecture, UI patterns). Each should return 5–10 key files.
2. Read all files identified by agents
3. Present summary of findings

## Phase 3: Clarifying Questions

**DO NOT SKIP.** Before designing:

1. Identify underspecified aspects: edge cases, error handling, integration points, scope, performance
2. Present all questions in organized list
3. **Wait for answers before proceeding**

## Phase 4: Architecture Design

1. Read `.claude/agents/code-architect.md`. Launch 2–3 general-purpose agents with that prompt, each with a different focus (minimal changes, clean architecture, pragmatic balance)
2. Present approaches with trade-offs and **your recommendation**
3. **Ask user which approach they prefer**

## Phase 5: Implementation

**Wait for explicit user approval.**

1. Implement following chosen architecture and codebase conventions
2. Update todos as you progress

## Phase 6: Quality Review

1. Read `.claude/agents/code-reviewer.md`. Launch general-purpose agents in parallel with that prompt (bugs/correctness, conventions/abstractions)
2. Present findings, ask user what to fix
3. Address based on user decision

## Phase 7: Summary

Mark todos complete. Summarize: what was built, key decisions, files modified, next steps.
