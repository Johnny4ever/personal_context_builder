from datetime import datetime

from pydantic import BaseModel

from app.models.memory_draft import DraftStatus
from app.models.memorized_item import SaveMode


class DraftCreate(BaseModel):
    """
    Sent by the browser extension after summarising the conversation.
    IMPORTANT: raw_text is intentionally absent — the backend never receives raw conversation text.
    """
    summary_text: str
    detail_summary: str | None = None
    candidate_facts_json: dict | None = None
    suggested_tags_json: list[str] | None = None
    source_platform: str
    platform_conversation_id: str | None = None


class DraftRead(BaseModel):
    id: int
    user_id: int
    summary_text: str
    detail_summary: str | None
    candidate_facts_json: dict | None
    suggested_tags_json: list[str] | None
    draft_status: DraftStatus
    source_platform: str | None
    created_at: datetime
    reviewed_at: datetime | None
    expires_at: datetime

    model_config = {"from_attributes": True}


class DraftApprove(BaseModel):
    """User reviews and optionally edits the draft before approving."""
    save_mode: SaveMode = SaveMode.summary_only
    summary_text: str | None = None
    detail_summary: str | None = None
    approved_facts_json: dict | None = None
    tags_json: list[str] | None = None
