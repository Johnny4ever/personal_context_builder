from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.token import ApiTokenCreate, ApiTokenCreated, ApiTokenRead
from app.services.token_service import TokenService

router = APIRouter(prefix="/tokens", tags=["tokens"])


@router.post("/", response_model=ApiTokenCreated, status_code=status.HTTP_201_CREATED)
async def create_token(
    payload: ApiTokenCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await TokenService(db).create_token(current_user.id, payload)


@router.get("/", response_model=list[ApiTokenRead])
async def list_tokens(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await TokenService(db).list_tokens(current_user.id)


@router.delete("/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_token(
    token_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    await TokenService(db).revoke_token(current_user.id, token_id)
