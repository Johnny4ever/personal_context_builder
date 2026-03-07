import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class DraftStatus(str, enum.Enum):
    awaiting_review = "awaiting_review"
    dismissed = "dismissed"
    private = "private"


class MemoryDraft(Base):
    __tablename__ = "memory_drafts"
    __table_args__ = (Index("ix_memory_drafts_expires_at", "expires_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    temp_conversation_id: Mapped[int | None] = mapped_column(
        ForeignKey("conversations_observed_temp.id"), nullable=True
    )
    source_platform: Mapped[str | None] = mapped_column(String(50), nullable=True)
    summary_text: Mapped[str] = mapped_column(Text)
    candidate_facts_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    suggested_tags_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    draft_status: Mapped[DraftStatus] = mapped_column(
        SAEnum(DraftStatus), default=DraftStatus.awaiting_review
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
