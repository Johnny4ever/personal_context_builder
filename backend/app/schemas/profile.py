from datetime import datetime

from pydantic import BaseModel


class ProfileFactRead(BaseModel):
    id: int
    profile_key: str
    profile_value: str
    confidence_score: float | None
    source_memory_id: int | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProfileFactUpdate(BaseModel):
    profile_value: str
    confidence_score: float | None = None
