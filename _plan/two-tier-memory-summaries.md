# Implementation Plan: Two-Tier Memory Summaries

Spec: `_specs/two-tier-memory-summaries.md`
Branch: `claude/feature/two-tier-memory-summaries`

---

## Overview of Changes

Seven discrete areas of change, in dependency order:

1. DB migration — add `detail_summary` column to `memorized_items`
2. ORM model — add field to `MemorizedItem`
3. Backend schemas — add field to draft and memory schemas; update `MemoryResult`
4. Backend services — update `DraftService.approve_draft`, `EmbeddingService._text_to_embed`, `ContextService.query`
5. Backend API — no new endpoints; schema changes propagate automatically
6. Chrome extension — update summarisation prompt to produce both headline + detail
7. Frontend — update draft review card, memory list, memory detail view

---

## Step 1 — Database Migration

**File:** `backend/alembic/versions/0006_add_detail_summary_to_memorized_items.py`

```python
# upgrade
op.add_column(
    "memorized_items",
    sa.Column("detail_summary", sa.Text(), nullable=True),
)

# downgrade
op.drop_column("memorized_items", "detail_summary")
```

No index needed. NULL default is correct — existing rows are left as-is.

---

## Step 2 — ORM Model

**File:** `backend/app/models/memorized_item.py`

Add one field after `summary_text`:

```python
detail_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
```

No other model changes.

---

## Step 3 — Backend Schemas

### 3a. `backend/app/schemas/draft.py`

**`DraftCreate`** — add optional field:
```python
detail_summary: str | None = None
```

**`DraftApprove`** — add optional field:
```python
detail_summary: str | None = None
```

**`DraftRead`** — add optional field so the review card can pre-populate it:
```python
detail_summary: str | None = None
```

### 3b. `backend/app/schemas/memory.py`

**`MemorizedItemRead`** — add optional field:
```python
detail_summary: str | None = None
```

### 3c. `backend/app/schemas/context.py`

**`MemoryResult`** — rename `summary` → `headline`, add `detail`:
```python
headline: str          # was: summary
detail: str | None     # new: detail_summary, falls back to None
tags: list[str]
source_platform: str
save_mode: str
similarity: int
```

> **Breaking change note:** The `summary` field in `MemoryResult` is renamed to `headline`. The frontend `ContextResponse` consumer (semantic search in `memories/page.tsx`) must be updated in Step 7.

---

## Step 4 — Backend Services

### 4a. `backend/app/services/draft_service.py` — `approve_draft()`

When creating the `MemorizedItem`, pass through `detail_summary` from `DraftApprove`:

```python
item = MemorizedItem(
    user_id=user_id,
    source_platform=draft.source_platform,
    summary_text=data.summary_text or draft.summary_text,
    detail_summary=data.detail_summary,          # NEW
    approved_facts_json=data.approved_facts_json,
    tags_json=data.tags_json,
    save_mode=data.save_mode,
)
```

Also, when `create_draft` is called, store `detail_summary` on the `MemoryDraft` row so the review card can display it. Add `detail_summary` column to `memory_drafts` table (see migration note below).

> **Additional migration needed:** `memory_drafts` also needs a `detail_summary` column so the draft can carry the field before approval. Add it to the same migration (Step 1) or a separate `0006b` migration.

**Revised Step 1** — migration should add column to **both** tables:
- `memorized_items.detail_summary` (Text, nullable)
- `memory_drafts.detail_summary` (Text, nullable)

**`create_draft()`** — pass `detail_summary` from `DraftCreate` into the `MemoryDraft` row:
```python
draft = MemoryDraft(
    ...
    detail_summary=data.detail_summary,   # NEW
)
```

### 4b. `backend/app/services/embedding_service.py` — `_text_to_embed()`

Update the `summary_only` and `summary_and_facts` branches to embed `summary_text` (headline) only — this is already the current behaviour, so **no change needed** for those branches.

For `full_conversation`, the current fallback is `raw_text or summary_text`. This is unchanged.

No code changes required in `EmbeddingService`.

### 4c. `backend/app/services/context_service.py` — `query()`

Update the list comprehension that builds `MemoryResult`:

```python
memory_results = [
    MemoryResult(
        headline=m.summary_text,                              # renamed from summary
        detail=m.detail_summary or None,                      # NEW
        tags=m.tags_json or [],
        source_platform=m.source_platform,
        save_mode=m.save_mode.value,
        similarity=max(0, round((1 - distance) * 100)),
    )
    for m, distance in memories
]
```

---

## Step 5 — Backend API

No new endpoints or route changes. The schema changes in Step 3 propagate automatically through the existing route handlers:

- `POST /api/v1/drafts/` — `DraftCreate` now accepts `detail_summary`
- `POST /api/v1/drafts/{id}/approve` — `DraftApprove` now accepts `detail_summary`
- `GET /api/v1/drafts/` and `GET /api/v1/drafts/{id}` — `DraftRead` now returns `detail_summary`
- `GET /api/v1/memories/` and `GET /api/v1/memories/{id}` — `MemorizedItemRead` now returns `detail_summary`
- `POST /api/v1/context/query` — `MemoryResult` now returns `headline` + `detail`

---

## Step 6 — Chrome Extension

**File:** `extension/src/background/index.ts`

The summarisation prompt is sent to the model API (OpenAI / Anthropic / Gemini). Currently it returns:
```json
{ "summary": "...", "facts": {...}, "tags": [...] }
```

Update the prompt to return:
```json
{
  "headline": "One sentence, ≤ 15 words, describing the core topic.",
  "detail": "2-5 sentences covering what was discussed, key decisions, and any notable facts or entities.",
  "facts": { "key": "value" },
  "tags": ["tag1", "tag2"]
}
```

Update the response parsing in all three provider branches to read `headline` and `detail` instead of `summary`, then set `summary_text = headline` and `detail_summary = detail` in the `DraftCreate` payload posted to the backend.

**Affected code block** (in the `CAPTURE_REQUESTED` handler):
```typescript
const draftPayload = {
  summary_text: parsed.headline,        // was: parsed.summary
  detail_summary: parsed.detail ?? null, // NEW
  candidate_facts_json: parsed.facts ?? {},
  suggested_tags_json: parsed.tags ?? [],
  source_platform: message.platform,
  platform_conversation_id: message.conversationId ?? null,
};
```

The prompt change must be consistent across all three model provider branches (OpenAI, Anthropic, Gemini). Each branch has a slightly different prompt format — update the JSON schema description in each.

---

## Step 7 — Frontend

### 7a. `frontend/src/lib/types.ts`

```typescript
// Draft
interface Draft {
  ...
  detail_summary: string | null;   // NEW
}

// Memory
interface Memory {
  ...
  detail_summary: string | null;   // NEW
}

// MemoryResult (context search)
interface MemoryResult {
  headline: string;                // was: summary
  detail: string | null;           // NEW
  tags: string[];
  source_platform: string;
  save_mode: string;
  similarity: number;
}
```

### 7b. `frontend/src/app/drafts/page.tsx`

In the `DraftCard` component:

1. Add a state variable for `detailSummary` initialised from `draft.detail_summary`.
2. Replace the single "Summary" textarea with two stacked fields:
   - **Headline** (single-line `<input type="text">`), label: "Headline — used for search"
   - **Detail** (multi-line `<textarea>`), label: "Details — returned to AI"
3. On approve, include `detail_summary: detailSummary` in the `approveDraft` call payload.

The `approveDraft` API call in `frontend/src/lib/api.ts` passes through to `DraftApprove` — add `detail_summary` to the request body:
```typescript
export const approveDraft = (id: number, payload: {..., detail_summary?: string | null}) =>
  json<Memory>(`/drafts/${id}/approve`, { method: "POST", body: JSON.stringify(payload) });
```

### 7c. `frontend/src/app/memories/page.tsx`

Two changes:

1. **Memory list cards** — show `memory.detail_summary` as a secondary line below the headline (truncated to ~120 chars, greyed out). If null, show nothing.

2. **Semantic search results** — currently uses `result.summary` for the card body. Update to use `result.detail ?? result.headline` and update the TypeScript reference from `result.summary` → `result.headline` for the card title.

### 7d. Memory detail page (if it exists)

Check `frontend/src/app/memories/[id]/page.tsx`. If it exists, add a "Details" section below the headline. If it does not exist yet, this is out of scope.

---

## Step 8 — Run Migrations and Rebuild

After all code changes:

```bash
# Apply DB migration
docker compose exec backend alembic upgrade head

# Rebuild backend (model/schema changes auto-reload via uvicorn --reload)
# No rebuild needed for backend

# Rebuild extension
make build-ext

# Rebuild frontend (required for any frontend code change)
docker compose up -d --build frontend
```

---

## File Change Summary

| File | Change |
|------|--------|
| `backend/alembic/versions/0006_add_detail_summary.py` | New migration: add `detail_summary` to `memorized_items` and `memory_drafts` |
| `backend/app/models/memorized_item.py` | Add `detail_summary: Mapped[str \| None]` |
| `backend/app/models/memory_draft.py` | Add `detail_summary: Mapped[str \| None]` |
| `backend/app/schemas/draft.py` | Add `detail_summary: str \| None` to `DraftCreate`, `DraftApprove`, `DraftRead` |
| `backend/app/schemas/memory.py` | Add `detail_summary: str \| None` to `MemorizedItemRead` |
| `backend/app/schemas/context.py` | Rename `summary` → `headline`, add `detail: str \| None` in `MemoryResult` |
| `backend/app/services/draft_service.py` | Pass `detail_summary` in `create_draft` and `approve_draft` |
| `backend/app/services/context_service.py` | Use `headline`/`detail` fields in `MemoryResult` construction |
| `extension/src/background/index.ts` | Update prompt and payload to use `headline` + `detail` |
| `frontend/src/lib/types.ts` | Add `detail_summary` to `Draft`, `Memory`; rename/add fields in `MemoryResult` |
| `frontend/src/lib/api.ts` | Add `detail_summary` to `approveDraft` payload type |
| `frontend/src/app/drafts/page.tsx` | Two-field review card (Headline + Detail) |
| `frontend/src/app/memories/page.tsx` | Show `detail_summary` in list cards and search results |

---

## Decisions Made (Resolving Open Questions)

| Question | Decision |
|----------|----------|
| Length cap on detail summary? | No backend cap for now — left to the model's judgement. |
| Headline length guidance in prompt? | Yes — prompt instructs "≤ 15 words" for the headline. |
| One-click "Generate detail" for existing memories? | Out of scope for this iteration. |
| Search using headline embedding only? | Yes — headline embedding only. Detail is retrieval-only. |

---

## Testing Checklist

- [ ] Approve a draft; verify `memorized_items.detail_summary` is populated in DB
- [ ] Approve a draft with no detail (empty textarea); verify `detail_summary` is NULL
- [ ] Capture from extension; verify the draft in the review card shows both Headline and Detail fields
- [ ] Run semantic search; verify results show `headline` as title and `detail` as snippet
- [ ] Delete a memory; verify cascade still works
- [ ] Existing memories (detail_summary = NULL) display without errors in list and search
