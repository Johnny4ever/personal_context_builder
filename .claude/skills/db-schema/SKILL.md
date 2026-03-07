---
name: db-schema
description: |
  PostgreSQL + pgvector schema conventions for the Personal AI Context Vault.
  Use when: (1) Creating or modifying SQLAlchemy models, (2) Writing Alembic migrations,
  (3) Defining Pydantic schemas that map to DB tables, (4) Writing vector search queries,
  or (5) Working with the memory state machine.
---

# Core Tables

| Table | Purpose |
|---|---|
| `conversations_observed_temp` | Short-lived session capture; deleted on dismiss or approval |
| `memory_drafts` | Draft summaries awaiting user review; expire after 7 days |
| `memorized_items` | Approved memory records (permanent) |
| `embeddings` | pgvector embeddings linked to memorized_items |
| `user_profile` | Extracted profile facts from approved memories |
| `api_tokens` | Hashed API tokens for retrieval API access |

# Memory State Machine

```
detected → draft_summarized → awaiting_review → memorized
                                              → dismissed  (deleted immediately)
                                              → private    (stored, excluded from retrieval)
memorized → deleted          (user-initiated)
```

Only `memorized` items are embedded and retrievable.

# SQLAlchemy Model Conventions

```python
# backend/app/models/memorized_item.py
from sqlalchemy import String, Text, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.core.database import Base
import enum

class SaveMode(str, enum.Enum):
    summary_only = "summary_only"
    summary_and_facts = "summary_and_facts"
    full_conversation = "full_conversation"

class MemorizedItem(Base):
    __tablename__ = "memorized_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(index=True)
    source_platform: Mapped[str] = mapped_column(String(50))
    summary_text: Mapped[str] = mapped_column(Text)
    approved_facts_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    tags_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    save_mode: Mapped[SaveMode] = mapped_column(SAEnum(SaveMode))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
```

# pgvector Usage

```python
# backend/app/models/embedding.py
from pgvector.sqlalchemy import Vector
from sqlalchemy.orm import Mapped, mapped_column

class Embedding(Base):
    __tablename__ = "embeddings"

    id: Mapped[int] = mapped_column(primary_key=True)
    memorized_item_id: Mapped[int] = mapped_column(ForeignKey("memorized_items.id"), index=True)
    embedding_vector: Mapped[list] = mapped_column(Vector(1536))  # adjust dim for model
    embedding_source_type: Mapped[str] = mapped_column(String(30))  # "summary", "facts", "full"
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
```

# Vector Similarity Search

```python
# Cosine distance search (lower = more similar)
from pgvector.sqlalchemy import Vector
from sqlalchemy import select, func

async def search_memories(query_vector: list[float], limit: int = 5, session: AsyncSession):
    stmt = (
        select(MemorizedItem, Embedding)
        .join(Embedding, Embedding.memorized_item_id == MemorizedItem.id)
        .where(MemorizedItem.user_id == current_user.id)
        .order_by(Embedding.embedding_vector.cosine_distance(query_vector))
        .limit(limit)
    )
    result = await session.execute(stmt)
    return result.all()
```

# Pydantic Schema Conventions

```python
# backend/app/schemas/memorized_item.py
from pydantic import BaseModel
from datetime import datetime
from app.models.memorized_item import SaveMode

class MemorizedItemCreate(BaseModel):
    summary_text: str
    approved_facts_json: dict | None = None
    tags_json: list[str] | None = None
    save_mode: SaveMode = SaveMode.summary_only
    source_platform: str

class MemorizedItemRead(MemorizedItemCreate):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}
```

# Privacy Rule (Enforced at Model Level)

- `conversations_observed_temp.raw_text` — allowed (temporary, extension-side only context)
- `memorized_items.raw_text` — allowed ONLY when `save_mode == full_conversation` and user explicitly chose it
- No other table may store raw conversation text
