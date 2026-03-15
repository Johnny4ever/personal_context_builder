from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation_temp import ConversationObservedTemp, ConversationStatus
from app.models.memory_draft import DraftStatus, MemoryDraft
from app.models.memorized_item import MemorizedItem, SaveMode
from app.schemas.draft import DraftApprove, DraftCreate

DRAFT_EXPIRY_DAYS = 7


class DraftService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_draft(self, user_id: int, data: DraftCreate) -> MemoryDraft:
        # Deduplicate: return existing awaiting_review draft for the same conversation
        if data.platform_conversation_id:
            result = await self.db.execute(
                select(MemoryDraft)
                .join(ConversationObservedTemp, MemoryDraft.temp_conversation_id == ConversationObservedTemp.id)
                .where(
                    MemoryDraft.user_id == user_id,
                    MemoryDraft.draft_status == DraftStatus.awaiting_review,
                    ConversationObservedTemp.conversation_id == data.platform_conversation_id,
                )
            )
            existing = result.scalars().first()
            if existing:
                return existing

        # Create a minimal temp record as metadata (raw_text is empty — stays in extension)
        temp = ConversationObservedTemp(
            user_id=user_id,
            platform=data.source_platform,
            conversation_id=data.platform_conversation_id,
            raw_text="",  # raw text never sent to backend
            status=ConversationStatus.draft_summarized,
        )
        self.db.add(temp)
        await self.db.flush()

        draft = MemoryDraft(
            user_id=user_id,
            temp_conversation_id=temp.id,
            source_platform=data.source_platform,
            summary_text=data.summary_text,
            detail_summary=data.detail_summary,
            candidate_facts_json=data.candidate_facts_json,
            suggested_tags_json=data.suggested_tags_json,
            expires_at=(datetime.now(timezone.utc) + timedelta(days=DRAFT_EXPIRY_DAYS)).replace(tzinfo=None),
        )
        self.db.add(draft)
        await self.db.commit()
        await self.db.refresh(draft)
        return draft

    async def list_drafts(self, user_id: int) -> list[MemoryDraft]:
        result = await self.db.execute(
            select(MemoryDraft)
            .where(
                MemoryDraft.user_id == user_id,
                MemoryDraft.draft_status == DraftStatus.awaiting_review,
                MemoryDraft.expires_at > datetime.now(timezone.utc).replace(tzinfo=None),
            )
            .order_by(MemoryDraft.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_draft(self, user_id: int, draft_id: int) -> MemoryDraft:
        draft = await self.db.get(MemoryDraft, draft_id)
        if draft is None or draft.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")
        return draft

    async def approve_draft(
        self, user_id: int, draft_id: int, data: DraftApprove
    ) -> MemorizedItem:
        from app.services.embedding_service import EmbeddingService
        from app.services.profile_service import ProfileService

        draft = await self.get_draft(user_id, draft_id)
        if draft.draft_status != DraftStatus.awaiting_review:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Draft has already been reviewed",
            )

        summary = data.summary_text or draft.summary_text
        facts = data.approved_facts_json or draft.candidate_facts_json
        tags = data.tags_json or draft.suggested_tags_json

        # raw_text only populated when save_mode=full_conversation — but since the
        # backend never received raw text, this field stays None for all modes in MVP.
        item = MemorizedItem(
            user_id=user_id,
            source_platform=draft.temp_conversation_id
            and (
                await self.db.get(ConversationObservedTemp, draft.temp_conversation_id)
            ).platform
            or "unknown",
            summary_text=summary,
            detail_summary=data.detail_summary,
            approved_facts_json=facts,
            tags_json=tags,
            save_mode=data.save_mode,
        )
        self.db.add(item)
        await self.db.flush()

        try:
            await EmbeddingService(self.db).generate_and_store(item)
        except Exception as exc:
            # Embedding is best-effort; don't fail the whole approve if the
            # embedding API is unavailable or misconfigured.
            import logging
            logging.getLogger(__name__).warning("Embedding generation failed (memory saved without vector): %s", exc)

        if facts:
            await ProfileService(self.db).upsert_facts(user_id, facts, item.id)

        draft.draft_status = DraftStatus.private
        draft.reviewed_at = datetime.now(timezone.utc).replace(tzinfo=None)

        # Delete temp record (null FK first to avoid constraint violation)
        if draft.temp_conversation_id:
            temp_id = draft.temp_conversation_id
            draft.temp_conversation_id = None
            temp = await self.db.get(ConversationObservedTemp, temp_id)
            if temp:
                await self.db.delete(temp)

        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def dismiss_draft(self, user_id: int, draft_id: int) -> None:
        draft = await self.get_draft(user_id, draft_id)
        temp_id = draft.temp_conversation_id
        await self.db.delete(draft)
        if temp_id:
            temp = await self.db.get(ConversationObservedTemp, temp_id)
            if temp:
                await self.db.delete(temp)
        await self.db.commit()

    async def mark_private(self, user_id: int, draft_id: int) -> MemoryDraft:
        draft = await self.get_draft(user_id, draft_id)
        draft.draft_status = DraftStatus.private
        draft.reviewed_at = datetime.now(timezone.utc).replace(tzinfo=None)
        await self.db.commit()
        await self.db.refresh(draft)
        return draft
