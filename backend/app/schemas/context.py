from pydantic import BaseModel


class ContextQuery(BaseModel):
    query: str
    limit: int = 5


class MemoryResult(BaseModel):
    headline: str
    detail: str | None
    tags: list[str]
    source_platform: str
    save_mode: str
    similarity: int  # 0-100, higher = more relevant


class ContextResponse(BaseModel):
    profile_summary: str
    relevant_memories: list[MemoryResult]
