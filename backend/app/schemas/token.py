from datetime import datetime

from pydantic import BaseModel


class ApiTokenCreate(BaseModel):
    token_name: str
    expires_at: datetime | None = None


class ApiTokenCreated(BaseModel):
    """Returned once on token creation. plain_token is never stored and never returned again."""
    id: int
    token_name: str
    plain_token: str
    created_at: datetime
    expires_at: datetime | None


class ApiTokenRead(BaseModel):
    """Safe token metadata — no plain_token field."""
    id: int
    token_name: str
    created_at: datetime
    expires_at: datetime | None
    revoked_at: datetime | None
    last_used_at: datetime | None

    model_config = {"from_attributes": True}
