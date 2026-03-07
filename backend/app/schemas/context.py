from pydantic import BaseModel


class ContextQuery(BaseModel):
    query: str
    limit: int = 5


class MemoryResult(BaseModel):
    summary: str
    tags: list[str]
    source_platform: str
    save_mode: str


class ContextResponse(BaseModel):
    profile_summary: str
    relevant_memories: list[MemoryResult]
