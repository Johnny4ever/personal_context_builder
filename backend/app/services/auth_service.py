from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import TokenResponse


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def authenticate_user(self, email: str, password: str) -> User | None:
        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user is None or not verify_password(password, user.password_hash):
            return None
        return user

    def _make_tokens(self, user_id: int) -> TokenResponse:
        data = {"sub": str(user_id)}
        return TokenResponse(
            access_token=create_access_token(data),
            refresh_token=create_refresh_token(data),
        )

    async def create_tokens(self, user_id: int) -> TokenResponse:
        return self._make_tokens(user_id)

    async def refresh_tokens(self, refresh_token: str) -> TokenResponse | None:
        payload = decode_refresh_token(refresh_token)
        if payload is None:
            return None
        user = await self.db.get(User, int(payload["sub"]))
        if user is None:
            return None
        return self._make_tokens(user.id)
