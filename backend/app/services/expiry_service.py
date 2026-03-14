from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation_temp import ConversationObservedTemp
from app.models.memory_draft import DraftStatus, MemoryDraft


async def expire_old_drafts(db: AsyncSession) -> int:
    """
    Hard-delete drafts that have passed their expires_at timestamp.
    Also deletes associated temp conversation records.
    Called lazily on GET /drafts/.
    Returns the number of drafts deleted.
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    result = await db.execute(
        select(MemoryDraft).where(
            MemoryDraft.draft_status == DraftStatus.awaiting_review,
            MemoryDraft.expires_at < now,
        )
    )
    expired = list(result.scalars().all())

    for draft in expired:
        temp_id = draft.temp_conversation_id
        await db.delete(draft)
        if temp_id:
            temp = await db.get(ConversationObservedTemp, temp_id)
            if temp:
                await db.delete(temp)

    if expired:
        await db.commit()

    return len(expired)
