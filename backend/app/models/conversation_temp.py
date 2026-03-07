import enum
from datetime import datetime

from sqlalchemy import Enum as SAEnum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class ConversationStatus(str, enum.Enum):
    detected = "detected"
    draft_summarized = "draft_summarized"
    awaiting_review = "awaiting_review"


class ConversationObservedTemp(Base):
    """
    Short-lived session capture. Raw conversation text lives ONLY here.
    Deleted on dismiss or after draft approval.
    """

    __tablename__ = "conversations_observed_temp"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    platform: Mapped[str] = mapped_column(String(50))
    conversation_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    observed_at: Mapped[datetime] = mapped_column(server_default=func.now())
    raw_text: Mapped[str] = mapped_column(Text)
    status: Mapped[ConversationStatus] = mapped_column(
        SAEnum(ConversationStatus), default=ConversationStatus.detected
    )
