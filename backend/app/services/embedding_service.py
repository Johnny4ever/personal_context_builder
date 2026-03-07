import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.embedding import Embedding, EmbeddingSourceType
from app.models.memorized_item import MemorizedItem, SaveMode


class EmbeddingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_embedding(self, text: str) -> list[float]:
        """Call OpenAI embeddings API with the backend's own API key."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {settings.embedding_api_key}"},
                json={"input": text, "model": settings.embedding_model},
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()["data"][0]["embedding"]

    def _text_to_embed(self, item: MemorizedItem) -> tuple[str, EmbeddingSourceType]:
        """Determine what text to embed based on save_mode."""
        if item.save_mode == SaveMode.summary_only:
            return item.summary_text, EmbeddingSourceType.summary
        elif item.save_mode == SaveMode.summary_and_facts:
            facts_text = ""
            if item.approved_facts_json:
                facts_text = " ".join(
                    f"{k}: {v}" for k, v in item.approved_facts_json.items()
                )
            return f"{item.summary_text} {facts_text}".strip(), EmbeddingSourceType.facts
        else:  # full_conversation
            # raw_text is None in MVP (backend never receives raw text)
            # Fall back to summary for embedding
            text = item.raw_text or item.summary_text
            return text, EmbeddingSourceType.full

    async def generate_and_store(self, item: MemorizedItem) -> Embedding:
        text, source_type = self._text_to_embed(item)
        vector = await self._get_embedding(text)
        embedding = Embedding(
            memorized_item_id=item.id,
            embedding_vector=vector,
            embedding_source_type=source_type,
        )
        self.db.add(embedding)
        await self.db.flush()
        return embedding

    async def search(
        self, user_id: int, query_vector: list[float], limit: int = 5
    ) -> list[MemorizedItem]:
        from sqlalchemy import select

        result = await self.db.execute(
            select(MemorizedItem)
            .join(Embedding, Embedding.memorized_item_id == MemorizedItem.id)
            .where(MemorizedItem.user_id == user_id)
            .order_by(Embedding.embedding_vector.cosine_distance(query_vector))
            .limit(limit)
        )
        return list(result.scalars().all())
