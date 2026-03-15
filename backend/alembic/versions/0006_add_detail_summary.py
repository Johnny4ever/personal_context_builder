"""Add detail_summary to memorized_items and memory_drafts

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-16 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "memorized_items",
        sa.Column("detail_summary", sa.Text(), nullable=True),
    )
    op.add_column(
        "memory_drafts",
        sa.Column("detail_summary", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("memory_drafts", "detail_summary")
    op.drop_column("memorized_items", "detail_summary")
