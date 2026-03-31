# Action Item Patterns Reference

Common patterns found in meeting notes and how to parse them.

## Pattern Categories

### Category 1: @Mentions (Highest Confidence)

**Format:** `@Name [action verb] [task]`

- Assignee: Text immediately after @
- Task: Everything after action verb (to/will/should/needs to)

### Category 2: Name + Action Verb (High Confidence)

**Format:** `Name [action verb] [task]`

- Action verbs: to, will, should, needs to, must, has to, is to, going to

### Category 3: Structured Action Format (High Confidence)

**Format:** `Action: Name - [task]` or `AI: Name - [task]`

### Category 4: TODO Format (Medium Confidence)

**Format:** `TODO: [task] (Name)` or `TODO: [task] - Name`

### Category 5: Colon or Dash Format (Medium Confidence)

**Format:** `Name: [task]` or `Name - [task]`

## Anti-Patterns (Not Action Items)

- Discussion Notes: "John mentioned the documentation needs updating"
- General Statements: "Documentation needs to be updated"
- Past Actions: "John updated the documentation"

## Confidence Scoring

**High Confidence (90%+):** @Mentions with clear action, "Name to do X" format
**Medium Confidence (60-90%):** Name: task format, TODO with name
**Low Confidence (<60%):** Ambiguous wording, no clear assignee
