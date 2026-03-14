import enum
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import Enum as SAEnum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class EmbeddingSourceType(str, enum.Enum):
    summary = "summary"
    facts = "facts"
    full = "full"


class Embedding(Base):
    __tablename__ = "embeddings"

    id: Mapped[int] = mapped_column(primary_key=True)
    memorized_item_id: Mapped[int] = mapped_column(
        ForeignKey("memorized_items.id", ondelete="CASCADE"), index=True
    )
    embedding_vector: Mapped[list] = mapped_column(Vector(1024))
    embedding_source_type: Mapped[EmbeddingSourceType] = mapped_column(
        SAEnum(EmbeddingSourceType)
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
