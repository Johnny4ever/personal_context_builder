"""Set user_profile.source_memory_id FK to SET NULL on delete

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-14 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(
        "user_profile_source_memory_id_fkey", "user_profile", type_="foreignkey"
    )
    op.create_foreign_key(
        "user_profile_source_memory_id_fkey",
        "user_profile",
        "memorized_items",
        ["source_memory_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "user_profile_source_memory_id_fkey", "user_profile", type_="foreignkey"
    )
    op.create_foreign_key(
        "user_profile_source_memory_id_fkey",
        "user_profile",
        "memorized_items",
        ["source_memory_id"],
        ["id"],
    )
