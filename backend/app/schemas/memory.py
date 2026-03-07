from datetime import datetime

from pydantic import BaseModel

from app.models.memorized_item import SaveMode


class MemorizedItemRead(BaseModel):
    id: int
    user_id: int
    source_platform: str
    summary_text: str
    approved_facts_json: dict | None
    tags_json: list[str] | None
    save_mode: SaveMode
    created_at: datetime

    model_config = {"from_attributes": True}


class MemorizedItemList(BaseModel):
    items: list[MemorizedItemRead]
    total: int
