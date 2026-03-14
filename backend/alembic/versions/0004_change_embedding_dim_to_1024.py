"""Change embedding vector dimension to 1024 (Voyage AI voyage-3)

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-14 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_embeddings_hnsw")
    op.execute("DELETE FROM embeddings")
    op.execute("ALTER TABLE embeddings ALTER COLUMN embedding_vector TYPE vector(1024)")
    op.execute(
        "CREATE INDEX ix_embeddings_hnsw ON embeddings USING hnsw (embedding_vector vector_cosine_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_embeddings_hnsw")
    op.execute("DELETE FROM embeddings")
    op.execute("ALTER TABLE embeddings ALTER COLUMN embedding_vector TYPE vector(768)")
    op.execute(
        "CREATE INDEX ix_embeddings_hnsw ON embeddings USING hnsw (embedding_vector vector_cosine_ops)"
    )
