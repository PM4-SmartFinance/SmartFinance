---
name: capture-tasks-from-meeting-notes
description: Extract action items from meeting notes and create Jira tasks with assignees.
---

# Capture Tasks from Meeting Notes

Parse pasted meeting notes → extract action items → create Jira tasks.

## Workflow

1. **Get notes** — User pastes meeting notes directly
2. **Parse action items** — Match patterns: `@Name to X`, `Name will X`, `Action: Name - X`, `TODO: X (Name)`
3. **Ask for project key** — Which Jira project (default: KAN)
4. **Lookup account IDs** — `lookupJiraAccountId` per assignee
5. **Present to user** — Show parsed items. **Wait for confirmation before creating.**
6. **Create tasks** — `createJiraIssue` with assignee, summary, description
7. **Summary** — List created tasks with links

See `references/action-item-patterns.md` for pattern details.
