from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import generate_api_token, hash_api_token
from app.models.api_token import ApiToken
from app.schemas.token import ApiTokenCreate, ApiTokenCreated, ApiTokenRead


class TokenService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_token(
        self, user_id: int, data: ApiTokenCreate
    ) -> ApiTokenCreated:
        plain = generate_api_token()
        token = ApiToken(
            user_id=user_id,
            token_name=data.token_name,
            token_hash=hash_api_token(plain),
            expires_at=data.expires_at,
        )
        self.db.add(token)
        await self.db.commit()
        await self.db.refresh(token)
        return ApiTokenCreated(
            id=token.id,
            token_name=token.token_name,
            plain_token=plain,
            created_at=token.created_at,
            expires_at=token.expires_at,
        )

    async def list_tokens(self, user_id: int) -> list[ApiTokenRead]:
        result = await self.db.execute(
            select(ApiToken)
            .where(ApiToken.user_id == user_id)
            .order_by(ApiToken.created_at.desc())
        )
        return [ApiTokenRead.model_validate(t) for t in result.scalars().all()]

    async def revoke_token(self, user_id: int, token_id: int) -> None:
        token = await self.db.get(ApiToken, token_id)
        if token is None or token.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Token not found"
            )
        token.revoked_at = datetime.now(timezone.utc).replace(tzinfo=None)
        await self.db.commit()
