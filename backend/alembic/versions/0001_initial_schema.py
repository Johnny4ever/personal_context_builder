"""Initial schema — all tables

Revision ID: 0001
Revises:
Create Date: 2024-01-01 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # conversations_observed_temp
    op.create_table(
        "conversations_observed_temp",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("platform", sa.String(50), nullable=False),
        sa.Column("conversation_id", sa.String(255), nullable=True),
        sa.Column("observed_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("raw_text", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("detected", "draft_summarized", "awaiting_review", name="conversationstatus"),
            nullable=False,
            server_default="detected",
        ),
    )
    op.create_index("ix_conversations_observed_temp_user_id", "conversations_observed_temp", ["user_id"])

    # memory_drafts
    op.create_table(
        "memory_drafts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "temp_conversation_id",
            sa.Integer(),
            sa.ForeignKey("conversations_observed_temp.id"),
            nullable=True,
        ),
        sa.Column("summary_text", sa.Text(), nullable=False),
        sa.Column("candidate_facts_json", sa.JSON(), nullable=True),
        sa.Column("suggested_tags_json", sa.JSON(), nullable=True),
        sa.Column(
            "draft_status",
            sa.Enum("awaiting_review", "dismissed", "private", name="draftstatus"),
            nullable=False,
            server_default="awaiting_review",
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_memory_drafts_user_id", "memory_drafts", ["user_id"])
    op.create_index("ix_memory_drafts_expires_at", "memory_drafts", ["expires_at"])

    # memorized_items
    op.create_table(
        "memorized_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("source_platform", sa.String(50), nullable=False),
        sa.Column("summary_text", sa.Text(), nullable=False),
        sa.Column("approved_facts_json", sa.JSON(), nullable=True),
        sa.Column("tags_json", sa.JSON(), nullable=True),
        sa.Column("raw_text", sa.Text(), nullable=True),
        sa.Column(
            "save_mode",
            sa.Enum("summary_only", "summary_and_facts", "full_conversation", name="savemode"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_memorized_items_user_id", "memorized_items", ["user_id"])

    # embeddings
    op.create_table(
        "embeddings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "memorized_item_id",
            sa.Integer(),
            sa.ForeignKey("memorized_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("embedding_vector", Vector(1536), nullable=False),
        sa.Column(
            "embedding_source_type",
            sa.Enum("summary", "facts", "full", name="embeddingsourcetype"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_embeddings_memorized_item_id", "embeddings", ["memorized_item_id"])
    op.execute(
        "CREATE INDEX ix_embeddings_hnsw ON embeddings USING hnsw (embedding_vector vector_cosine_ops)"
    )

    # user_profile
    op.create_table(
        "user_profile",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("profile_key", sa.String(100), nullable=False),
        sa.Column("profile_value", sa.Text(), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column(
            "source_memory_id",
            sa.Integer(),
            sa.ForeignKey("memorized_items.id"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "profile_key", name="uq_user_profile_key"),
    )
    op.create_index("ix_user_profile_user_id", "user_profile", ["user_id"])
    op.create_index("ix_user_profile_profile_key", "user_profile", ["profile_key"])

    # api_tokens
    op.create_table(
        "api_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token_name", sa.String(100), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_api_tokens_user_id", "api_tokens", ["user_id"])


def downgrade() -> None:
    op.drop_table("api_tokens")
    op.drop_table("user_profile")
    op.drop_table("embeddings")
    op.drop_table("memorized_items")
    op.drop_table("memory_drafts")
    op.drop_table("conversations_observed_temp")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS embeddingsourcetype")
    op.execute("DROP TYPE IF EXISTS savemode")
    op.execute("DROP TYPE IF EXISTS draftstatus")
    op.execute("DROP TYPE IF EXISTS conversationstatus")
    op.execute("DROP EXTENSION IF EXISTS vector")
