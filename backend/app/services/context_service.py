import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.schemas.context import ContextQuery, ContextResponse, MemoryResult
from app.services.embedding_service import EmbeddingService
from app.services.profile_service import ProfileService


class ContextService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _embed_query(self, text: str) -> list[float]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {settings.embedding_api_key}"},
                json={"input": text, "model": settings.embedding_model},
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()["data"][0]["embedding"]

    async def query(self, user_id: int, data: ContextQuery) -> ContextResponse:
        query_vector = await self._embed_query(data.query)

        embedding_svc = EmbeddingService(self.db)
        memories = await embedding_svc.search(user_id, query_vector, limit=data.limit)

        profile_svc = ProfileService(self.db)
        profile_facts = await profile_svc.get_profile(user_id)
        profile_summary = profile_svc.build_profile_summary(profile_facts)

        memory_results = [
            MemoryResult(
                summary=m.summary_text,
                tags=m.tags_json or [],
                source_platform=m.source_platform,
                save_mode=m.save_mode.value,
            )
            for m in memories
        ]

        return ContextResponse(
            profile_summary=profile_summary,
            relevant_memories=memory_results,
        )
