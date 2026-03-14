from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.embedding import Embedding
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
    item_ids = [m.id for m in items]
    emb_result = await db.execute(
        select(Embedding.memorized_item_id).where(
            Embedding.memorized_item_id.in_(item_ids)
        )
    )
    embedded_ids = {row[0] for row in emb_result}
    response_items = [
        MemorizedItemRead.model_validate(m).model_copy(
            update={"has_embedding": m.id in embedded_ids}
        )
        for m in items
    ]
    return MemorizedItemList(items=response_items, total=total)


@router.get("/{memory_id}", response_model=MemorizedItemRead)
async def get_memory(
    memory_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await MemoryService(db).get_memory(current_user.id, memory_id)


@router.post("/{memory_id}/vectorize", status_code=status.HTTP_200_OK)
async def vectorize_memory(
    memory_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from app.services.embedding_service import EmbeddingService
    item = await MemoryService(db).get_memory(current_user.id, memory_id)
    # Skip if already vectorized
    existing = await db.execute(
        select(Embedding.id).where(Embedding.memorized_item_id == memory_id)
    )
    if existing.scalar_one_or_none() is not None:
        return {"status": "already_vectorized"}
    await EmbeddingService(db).generate_and_store(item)
    await db.commit()
    return {"status": "vectorized"}


@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory(
    memory_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    await MemoryService(db).delete_memory(current_user.id, memory_id)
