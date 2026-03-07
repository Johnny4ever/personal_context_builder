import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_token(data: dict, expires_delta: timedelta, token_type: str) -> str:
    payload = data.copy()
    payload.update(
        {
            "type": token_type,
            "exp": datetime.now(timezone.utc) + expires_delta,
        }
    )
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(data: dict) -> str:
    return _create_token(
        data,
        timedelta(minutes=settings.access_token_expire_minutes),
        "access",
    )


def create_refresh_token(data: dict) -> str:
    return _create_token(
        data,
        timedelta(days=settings.refresh_token_expire_days),
        "refresh",
    )


def _decode_token(token: str, expected_type: str) -> dict | None:
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        if payload.get("type") != expected_type:
            return None
        return payload
    except JWTError:
        return None


def decode_access_token(token: str) -> dict | None:
    return _decode_token(token, "access")


def decode_refresh_token(token: str) -> dict | None:
    return _decode_token(token, "refresh")


def hash_api_token(plain: str) -> str:
    return hashlib.sha256(plain.encode()).hexdigest()


def generate_api_token() -> str:
    return secrets.token_urlsafe(32)
