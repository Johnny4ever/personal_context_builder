import httpx
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.schemas.context import ContextQuery, ContextResponse, MemoryResult
from app.services.embedding_service import EmbeddingService
from app.services.profile_service import ProfileService


class ContextService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _embed_query(self, text: str) -> list[float]:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.voyageai.com/v1/embeddings",
                    headers={
                        "Authorization": f"Bearer {settings.embedding_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={"model": settings.embedding_model, "input": [text]},
                    timeout=30.0,
                )
                if response.status_code == 429:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Embedding API rate limit hit — wait a moment and try again.",
                    )
                response.raise_for_status()
                return response.json()["data"][0]["embedding"]
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Embedding API error: {exc}",
            )

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
                similarity=max(0, round((1 - distance) * 100)),
            )
            for m, distance in memories
        ]

        return ContextResponse(
            profile_summary=profile_summary,
            relevant_memories=memory_results,
        )
