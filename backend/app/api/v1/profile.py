from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.profile import ProfileFactRead, ProfileFactUpdate
from app.services.profile_service import ProfileService

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/", response_model=list[ProfileFactRead])
async def get_profile(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await ProfileService(db).get_profile(current_user.id)


@router.patch("/{profile_key}", response_model=ProfileFactRead)
async def update_profile_fact(
    profile_key: str,
    payload: ProfileFactUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await ProfileService(db).update_fact(current_user.id, profile_key, payload)
