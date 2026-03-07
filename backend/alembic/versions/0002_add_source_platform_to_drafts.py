"""Add source_platform to memory_drafts

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-07

"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "memory_drafts",
        sa.Column("source_platform", sa.String(50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("memory_drafts", "source_platform")
