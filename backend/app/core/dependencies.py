from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token, hash_api_token

bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    from app.models.user import User

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    user = await db.get(User, int(payload["sub"]))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


async def get_current_user_or_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    For /context/query: accepts either a Bearer JWT or an X-API-Token header.
    Tries JWT first, falls back to API token.
    """
    from app.models.api_token import ApiToken
    from app.models.user import User

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.removeprefix("Bearer ")
        payload = decode_access_token(token)
        if payload is not None:
            user = await db.get(User, int(payload["sub"]))
            if user is not None:
                return user

    api_token_value = request.headers.get("X-API-Token")
    if api_token_value:
        token_hash = hash_api_token(api_token_value)
        result = await db.execute(
            select(ApiToken).where(
                ApiToken.token_hash == token_hash,
                ApiToken.revoked_at.is_(None),
            )
        )
        api_token = result.scalar_one_or_none()
        if api_token is not None:
            if api_token.expires_at and api_token.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="API token has expired",
                )
            api_token.last_used_at = datetime.now(timezone.utc).replace(tzinfo=None)
            await db.commit()
            user = await db.get(User, api_token.user_id)
            if user is not None:
                return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
    )
