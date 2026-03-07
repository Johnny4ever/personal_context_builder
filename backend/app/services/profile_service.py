from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_profile import UserProfile
from app.schemas.profile import ProfileFactUpdate


class ProfileService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_profile(self, user_id: int) -> list[UserProfile]:
        result = await self.db.execute(
            select(UserProfile)
            .where(UserProfile.user_id == user_id)
            .order_by(UserProfile.profile_key)
        )
        return list(result.scalars().all())

    async def upsert_facts(
        self, user_id: int, facts: dict, source_memory_id: int
    ) -> None:
        """
        Insert or update profile facts. Last write wins on conflict.
        Uses PostgreSQL ON CONFLICT DO UPDATE for atomicity.
        """
        for key, value in facts.items():
            stmt = pg_insert(UserProfile).values(
                user_id=user_id,
                profile_key=str(key),
                profile_value=str(value),
                source_memory_id=source_memory_id,
            )
            stmt = stmt.on_conflict_do_update(
                constraint="uq_user_profile_key",
                set_={
                    "profile_value": stmt.excluded.profile_value,
                    "source_memory_id": stmt.excluded.source_memory_id,
                },
            )
            await self.db.execute(stmt)
        await self.db.flush()

    async def update_fact(
        self, user_id: int, profile_key: str, data: ProfileFactUpdate
    ) -> UserProfile:
        from fastapi import HTTPException, status

        result = await self.db.execute(
            select(UserProfile).where(
                UserProfile.user_id == user_id,
                UserProfile.profile_key == profile_key,
            )
        )
        fact = result.scalar_one_or_none()
        if fact is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Profile key not found"
            )
        fact.profile_value = data.profile_value
        if data.confidence_score is not None:
            fact.confidence_score = data.confidence_score
        await self.db.commit()
        await self.db.refresh(fact)
        return fact

    def build_profile_summary(self, facts: list[UserProfile]) -> str:
        if not facts:
            return "No profile information stored yet."
        lines = [f"{f.profile_key}: {f.profile_value}" for f in facts]
        return "User profile — " + "; ".join(lines)
