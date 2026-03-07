---
name: fastapi-patterns
description: |
  FastAPI conventions and patterns for the Personal AI Context Vault backend.
  Use when: (1) Creating new route handlers, (2) Writing auth dependencies,
  (3) Structuring services and repositories, (4) Handling errors consistently,
  or (5) Writing async database queries.
---

# Directory Layout

```
backend/app/
├── api/
│   └── v1/
│       ├── router.py          # Mounts all sub-routers
│       ├── auth.py            # /auth/login, /auth/refresh
│       ├── memories.py        # /memories/*
│       ├── profile.py         # /profile/*
│       ├── context.py         # /context/query
│       └── tokens.py          # /tokens/*
├── core/
│   ├── config.py              # Settings (pydantic-settings)
│   ├── database.py            # AsyncSession factory
│   ├── security.py            # JWT, bcrypt helpers
│   └── dependencies.py        # get_current_user, get_db
├── models/                    # SQLAlchemy ORM models
├── schemas/                   # Pydantic request/response schemas
└── services/                  # Business logic (no DB access here)
```

# Route Handler Pattern

```python
# backend/app/api/v1/memories.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.memorized_item import MemorizedItemCreate, MemorizedItemRead
from app.services.memory_service import MemoryService

router = APIRouter(prefix="/memories", tags=["memories"])

@router.post("/", response_model=MemorizedItemRead, status_code=status.HTTP_201_CREATED)
async def create_memory(
    payload: MemorizedItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await MemoryService(db).create(user_id=current_user.id, data=payload)
```

# Auth Dependency

```python
# backend/app/core/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.security import decode_access_token

bearer = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = await db.get(User, payload["sub"])
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
```

# Service Layer Pattern

```python
# backend/app/services/memory_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.memorized_item import MemorizedItem
from app.schemas.memorized_item import MemorizedItemCreate

class MemoryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: int, data: MemorizedItemCreate) -> MemorizedItem:
        item = MemorizedItem(user_id=user_id, **data.model_dump())
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item
```

# Error Handling

```python
# Always raise HTTPException — never let internal errors surface
raise HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail="Memory not found",
)

# 401 for unauthenticated, 403 for unauthorised (wrong user)
raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
```

# Settings Pattern

```python
# backend/app/core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    model_config = {"env_file": ".env"}

settings = Settings()
```

# Async DB Session

```python
# backend/app/core/database.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

# API Token Auth (for retrieval API)

```python
# Tokens are hashed on storage. On each request, hash the incoming token and compare.
import hashlib

def hash_token(plain: str) -> str:
    return hashlib.sha256(plain.encode()).hexdigest()

async def get_current_token_user(
    token: str = Header(..., alias="X-API-Token"),
    db: AsyncSession = Depends(get_db),
) -> User:
    hashed = hash_token(token)
    api_token = await db.scalar(
        select(ApiToken).where(ApiToken.token_hash == hashed, ApiToken.revoked_at.is_(None))
    )
    if api_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API token")
    # Update last_used_at
    api_token.last_used_at = datetime.utcnow()
    await db.commit()
    return await db.get(User, api_token.user_id)
```
