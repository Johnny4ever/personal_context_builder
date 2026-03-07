from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.draft import DraftApprove, DraftCreate, DraftRead
from app.schemas.memory import MemorizedItemRead
from app.services.draft_service import DraftService
from app.services.expiry_service import expire_old_drafts

router = APIRouter(prefix="/drafts", tags=["drafts"])


@router.post("/", response_model=DraftRead, status_code=status.HTTP_201_CREATED)
async def create_draft(
    payload: DraftCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await DraftService(db).create_draft(current_user.id, payload)


@router.get("/", response_model=list[DraftRead])
async def list_drafts(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    await expire_old_drafts(db)
    return await DraftService(db).list_drafts(current_user.id)


@router.get("/{draft_id}", response_model=DraftRead)
async def get_draft(
    draft_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await DraftService(db).get_draft(current_user.id, draft_id)


@router.post("/{draft_id}/approve", response_model=MemorizedItemRead)
async def approve_draft(
    draft_id: int,
    payload: DraftApprove,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await DraftService(db).approve_draft(current_user.id, draft_id, payload)


@router.delete("/{draft_id}", status_code=status.HTTP_204_NO_CONTENT)
async def dismiss_draft(
    draft_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    await DraftService(db).dismiss_draft(current_user.id, draft_id)


@router.post("/{draft_id}/private", response_model=DraftRead)
async def mark_private(
    draft_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await DraftService(db).mark_private(current_user.id, draft_id)
