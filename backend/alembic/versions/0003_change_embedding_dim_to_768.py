"""Change embedding vector dimension from 1536 to 768 (Gemini text-embedding-004)

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-14 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the HNSW index first (cannot alter column with index in place)
    op.execute("DROP INDEX IF EXISTS ix_embeddings_hnsw")

    # Delete existing embeddings — dimensions are incompatible, must re-embed
    op.execute("DELETE FROM embeddings")

    # Change vector column dimension 1536 → 768
    op.execute("ALTER TABLE embeddings ALTER COLUMN embedding_vector TYPE vector(768)")

    # Recreate HNSW index
    op.execute(
        "CREATE INDEX ix_embeddings_hnsw ON embeddings USING hnsw (embedding_vector vector_cosine_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_embeddings_hnsw")
    op.execute("DELETE FROM embeddings")
    op.execute("ALTER TABLE embeddings ALTER COLUMN embedding_vector TYPE vector(1536)")
    op.execute(
        "CREATE INDEX ix_embeddings_hnsw ON embeddings USING hnsw (embedding_vector vector_cosine_ops)"
    )
