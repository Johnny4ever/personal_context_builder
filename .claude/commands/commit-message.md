---
description: Generate a commit message by analysing staged git changes
allowed-tools: Bash(git status:*), Bash(git diff --staged), Bash(git commit:*)
---

## Run these commands first:

```bash
git status
git diff --staged
```

## Your task:

Analyse the staged changes and write a commit message. Use present tense. Focus on **why** the change was made, not just what changed.

## Commit types:

- `feat:` — new feature or behaviour
- `fix:` — bug fix
- `refactor:` — restructuring without behaviour change
- `docs:` — documentation only
- `chore:` — config, tooling, migrations, dependencies
- `test:` — adding or updating tests
- `security:` — security fix or hardening

## Format:

```
<type>(<scope>): <short description>

<optional body: explain the why, not the what>
```

Scope examples: `extension`, `backend`, `frontend`, `db`, `auth`, `embeddings`

## Output:

1. Show a one-line summary of what is staged
2. Propose the commit message
3. Ask for confirmation before committing

DO NOT auto-commit. Wait for explicit user approval.
