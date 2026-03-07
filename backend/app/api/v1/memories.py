from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.memory import MemorizedItemList, MemorizedItemRead
from app.services.memory_service import MemoryService

router = APIRouter(prefix="/memories", tags=["memories"])


@router.get("/", response_model=MemorizedItemList)
async def list_memories(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    items, total = await MemoryService(db).list_memories(current_user.id, skip, limit)
    return MemorizedItemList(items=items, total=total)


@router.get("/{memory_id}", response_model=MemorizedItemRead)
async def get_memory(
    memory_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await MemoryService(db).get_memory(current_user.id, memory_id)


@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory(
    memory_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    await MemoryService(db).delete_memory(current_user.id, memory_id)
