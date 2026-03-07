---
description: Generate an Alembic database migration from a description of schema changes
argument-hint: Describe the schema change (e.g. "add expires_at column to memory_drafts")
allowed-tools: Read, Write, Bash(alembic:*), Glob
---

You are generating an Alembic migration for the Personal AI Context Vault backend.

User input: $ARGUMENTS

## Step 1 — Understand the current schema

Read the existing models in `backend/app/models/` and the latest migration in `backend/alembic/versions/` to understand the current state.

## Step 2 — Plan the migration

Based on `$ARGUMENTS`, determine:
- Which table(s) are affected
- What columns/indexes/constraints are added, removed, or modified
- Whether a data migration is needed alongside the schema change

## Step 3 — Generate the migration file

Create a new Alembic migration file in `backend/alembic/versions/` following this pattern:

```python
"""<short description of change>

Revision ID: <use a random 12-char hex string>
Revises: <previous revision id>
Create Date: <current date>
"""
from alembic import op
import sqlalchemy as sa
# import pgvector types if needed

revision = '<revision_id>'
down_revision = '<previous_revision_id>'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # schema changes here
    pass


def downgrade() -> None:
    # reverse the changes here
    pass
```

## Rules

- Always implement both `upgrade()` and `downgrade()`.
- Never drop a column without checking if it has data — note this as a warning if relevant.
- Use `op.execute()` for data migrations, not raw Python loops.
- For vector columns, use `pgvector.sqlalchemy.Vector`.
- Migration filenames: `<revision_id>_<slug>.py` where slug matches the description.

## Step 4 — Report

Tell the user:
- The migration file path
- A summary of what `upgrade()` and `downgrade()` do
- Any warnings (destructive changes, data loss risk, index build time on large tables)

Ask for confirmation before running `alembic upgrade head`.
