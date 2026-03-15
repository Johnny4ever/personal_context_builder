import enum
from datetime import datetime

from sqlalchemy import Enum as SAEnum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class SaveMode(str, enum.Enum):
    summary_only = "summary_only"
    summary_and_facts = "summary_and_facts"
    full_conversation = "full_conversation"


class MemorizedItem(Base):
    __tablename__ = "memorized_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    source_platform: Mapped[str] = mapped_column(String(50))
    summary_text: Mapped[str] = mapped_column(Text)
    detail_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_facts_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    tags_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # raw_text is ONLY populated when save_mode=full_conversation and user explicitly chose it
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    save_mode: Mapped[SaveMode] = mapped_column(SAEnum(SaveMode))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
