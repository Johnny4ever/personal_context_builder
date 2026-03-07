from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_or_token
from app.schemas.context import ContextQuery, ContextResponse
from app.services.context_service import ContextService

router = APIRouter(prefix="/context", tags=["context"])


@router.post("/query", response_model=ContextResponse)
async def query_context(
    payload: ContextQuery,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user_or_token),
):
    return await ContextService(db).query(current_user.id, payload)
