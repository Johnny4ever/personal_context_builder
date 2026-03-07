"""
Idempotent seed script: creates the single vault user from env vars.
Run with: python -m app.scripts.seed_user
"""
import asyncio
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core.config import settings
from app.core.database import Base
from app.core.security import hash_password
from app.models.user import User
import app.models  # noqa — register all models


async def seed() -> None:
    if not settings.first_user_email or not settings.first_user_password:
        print("FIRST_USER_EMAIL and FIRST_USER_PASSWORD must be set in .env")
        sys.exit(1)

    engine = create_async_engine(settings.database_url)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    async with SessionLocal() as session:
        result = await session.execute(
            select(User).where(User.email == settings.first_user_email)
        )
        existing = result.scalar_one_or_none()
        if existing:
            print(f"User already exists: id={existing.id}, email={existing.email}")
        else:
            user = User(
                email=settings.first_user_email,
                password_hash=hash_password(settings.first_user_password),
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            print(f"Created user: id={user.id}, email={user.email}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
