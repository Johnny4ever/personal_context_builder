from datetime import datetime

from sqlalchemy import Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class UserProfile(Base):
    __tablename__ = "user_profile"
    __table_args__ = (UniqueConstraint("user_id", "profile_key", name="uq_user_profile_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    profile_key: Mapped[str] = mapped_column(String(100), index=True)
    profile_value: Mapped[str] = mapped_column(Text)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_memory_id: Mapped[int | None] = mapped_column(
        ForeignKey("memorized_items.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
