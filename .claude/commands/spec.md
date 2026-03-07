---
description: Create a feature spec file and git branch from a short idea
argument-hint: Short feature description
allowed-tools: Read, Write, Glob, Bash(git switch:*), Bash(git status:*), Bash(git branch:*)
---

You are helping spin up a new feature spec for the Personal AI Context Vault project.

User input: $ARGUMENTS

## Step 1 — Check working directory is clean

Run `git status`. If there are any uncommitted, unstaged, or untracked files, **abort and tell the user to commit or stash changes first**. Do not proceed.

## Step 2 — Parse arguments

From `$ARGUMENTS` derive:

1. `feature_title` — short human-readable title in Title Case.
2. `feature_slug` — lowercase kebab-case, only `a-z 0-9 -`, max 40 chars.
3. `branch_name` — format: `claude/feature/<feature_slug>`. If branch exists, append `-01`, `-02`, etc.

If you cannot infer a sensible slug, ask the user to clarify.

## Step 3 — Switch to a new git branch

Create and switch to `branch_name` before writing any files.

## Step 4 — Write the spec file

Save a markdown spec to `_specs/<feature_slug>.md` using this structure:

```markdown
# <feature_title>

## Overview
[One paragraph describing what this feature does and why it matters]

## User Story
As a user, I want to [action] so that [outcome].

## Scope
### In Scope
- [bullet list]

### Out of Scope
- [bullet list]

## Functional Requirements
[Numbered list of requirements]

## UI / UX Notes
[Key screens or interactions, no implementation detail]

## Data / API Changes
[Tables, fields, or endpoints affected]

## Privacy & Security Considerations
[How this feature upholds the core privacy rule: raw conversation never reaches backend]

## Open Questions
- [Any unresolved decisions]
```

Do not include code examples. Keep it product-level, not implementation-level.

## Step 5 — Report to user

```
Branch: <branch_name>
Spec file: _specs/<feature_slug>.md
Title: <feature_title>
```

Do not print the full spec in chat unless the user asks.
