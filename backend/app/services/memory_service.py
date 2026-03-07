from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.memorized_item import MemorizedItem


class MemoryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_memories(
        self, user_id: int, skip: int = 0, limit: int = 20
    ) -> tuple[list[MemorizedItem], int]:
        count_result = await self.db.execute(
            select(func.count()).where(MemorizedItem.user_id == user_id)
        )
        total = count_result.scalar_one()

        result = await self.db.execute(
            select(MemorizedItem)
            .where(MemorizedItem.user_id == user_id)
            .order_by(MemorizedItem.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all()), total

    async def get_memory(self, user_id: int, memory_id: int) -> MemorizedItem:
        item = await self.db.get(MemorizedItem, memory_id)
        if item is None or item.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found"
            )
        return item

    async def delete_memory(self, user_id: int, memory_id: int) -> None:
        item = await self.get_memory(user_id, memory_id)
        await self.db.delete(item)
        await self.db.commit()
