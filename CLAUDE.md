# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Privacy Rule — Non-Negotiable

> Raw conversation text NEVER touches the vault backend.
> The Chrome extension calls the user's model API (OpenAI/Anthropic/Gemini) directly.
> Only the approved summary, facts, and tags are sent to the backend.

Any code path that sends raw conversation text to the backend must be rejected.

## Common Commands

```bash
# Start all services
make up                          # docker compose up --build -d

# Stop all services (preserves data)
docker compose down

# Run database migrations
make migrate                     # alembic upgrade head inside container

# Seed the first user (idempotent)
make seed                        # python -m app.scripts.seed_user

# Run backend tests
make test-backend                # pytest tests/ -v inside container

# Run a single test file
docker compose exec backend pytest tests/test_drafts.py -v

# Run a single test by name
docker compose exec backend pytest tests/test_auth.py::test_login -v

# View logs
make logs                        # docker compose logs -f

# Build Chrome extension
make build-ext                   # cd extension && npm install && npm run build

# Rebuild frontend (required after any frontend code change)
docker compose up -d --build frontend

# Force-recreate backend to reload .env changes
docker compose up -d --force-recreate backend
```

**Ports:** backend → `localhost:8001`, frontend → `localhost:3000`, db → `localhost:5432`

## Git Workflow

- **Always create a new branch from master** for any changes — never commit directly to master.
- Push the branch and wait for the user to give the explicit merge command.
- Branch naming: `feature/<short-description>` or `fix/<short-description>`.

## Architecture Overview

### Data Flow

```
Chrome Extension (content script)
  └─ scrapes DOM (ChatGPT / Claude.ai)
  └─ sends CAPTURE_REQUESTED to background service worker
       └─ calls user's model API (OpenAI/Anthropic/Gemini) → summary + facts JSON
       └─ POSTs to vault backend: { summary_text, candidate_facts_json, suggested_tags_json, source_platform }
            └─ backend creates MemoryDraft (awaiting_review)

Frontend Dashboard
  └─ user reviews draft, selects save_mode, approves
       └─ backend creates MemorizedItem + Embedding (via Voyage AI) + upserts UserProfile facts
```

### Backend (`backend/app/`)

- **`core/`** — `config.py` (pydantic-settings, `@lru_cache`), `database.py` (async SQLAlchemy engine), `security.py` (bcrypt, JWT, SHA-256 token hashing), `dependencies.py` (`get_current_user`, `get_current_user_or_token`)
- **`models/`** — SQLAlchemy ORM models. Key models: `MemoryDraft` (awaiting_review → private/dismissed), `MemorizedItem` (approved memories), `Embedding` (pgvector 1024-dim, Voyage AI voyage-3), `UserProfile` (key/value facts, last-write-wins)
- **`schemas/`** — Pydantic v2 request/response models. `DraftCreate` intentionally has **no `raw_text` field** — this is the API-layer privacy enforcement.
- **`services/`** — All business logic lives here. Route handlers are thin wrappers. Key services: `DraftService` (approve/dismiss/expire), `EmbeddingService` (Voyage AI, cosine similarity search with distance scores), `ContextService` (semantic query endpoint), `ProfileService` (upsert facts)
- **`api/v1/`** — FastAPI routers mounted under `/api/v1`. Context endpoint (`/context/query`) accepts both JWT and `X-API-Token` header.

### Database Schema (PostgreSQL + pgvector)

7 tables: `users`, `conversations_observed_temp`, `memory_drafts`, `memorized_items`, `embeddings`, `user_profile`, `api_tokens`

- `memory_drafts.temp_conversation_id` FK → `conversations_observed_temp`: must be nulled before deleting temp record (done in `DraftService.approve_draft`)
- `user_profile.source_memory_id` FK → `memorized_items` with `ON DELETE SET NULL`
- `embeddings.memorized_item_id` FK → `memorized_items` with `ON DELETE CASCADE`
- Vector column is `vector(1024)` — Voyage AI `voyage-3` model

Migrations in `backend/alembic/versions/` — always create a new migration file, never edit tables manually.

### Frontend (`frontend/src/`)

- Next.js App Router. All pages are `"use client"` — no server components.
- `lib/api.ts` — all fetch calls. Uses `NEXT_PUBLIC_API_URL` (baked at Docker build time) to call the backend directly at `http://localhost:8001`. **Do not use relative `/api/` paths** — the Next.js rewrite runs server-side only and breaks in the browser.
- `lib/auth.ts` — JWT stored in `localStorage`. Auto-refreshes on 401.
- `lib/types.ts` — TypeScript interfaces mirroring backend Pydantic schemas.

### Chrome Extension (`extension/src/`)

- Manifest V3, webpack bundled.
- `background/index.ts` — service worker. Handles `CAPTURE_REQUESTED` message: runs sensitive content detection, deduplication (djb2 hash + 30-min TTL in `chrome.storage.local`), calls model API, posts draft to vault.
- `content/chatgpt.ts`, `content/claude.ts` — DOM scrapers. Inject a floating "Capture to Vault" button. Listen for `beforeunload` to prompt capture on page leave.
- `shared/storage.ts` — typed wrappers for `chrome.storage.local`. Keys: `model_api_key`, `model_provider`, `vault_token`, `vault_refresh_token`, `vault_url`.
- Model provider selection: `openai` | `anthropic` | `gemini` — set via popup, stored in `chrome.storage.local`, never sent to backend.

## Key Implementation Details

### Embedding (Voyage AI)
- Model: `voyage-3`, 1024 dimensions, configured via `EMBEDDING_API_KEY` and `EMBEDDING_MODEL` in `.env`
- Both `EmbeddingService._get_embedding()` and `ContextService._embed_query()` call `https://api.voyageai.com/v1/embeddings`
- Embedding failures in `approve_draft` are non-fatal (logged as warning, memory still saves)
- Search returns `list[tuple[MemorizedItem, float]]` (item + cosine distance). Similarity % = `(1 - distance) * 100`

### Draft Deletion Order
When deleting/dismissing a draft, the FK constraint requires:
1. Null out `draft.temp_conversation_id` first
2. Delete the draft
3. Then delete the `ConversationObservedTemp` record

### Frontend Rebuild Required
The frontend is a compiled Next.js production build in Docker. Code changes to `frontend/` require `docker compose up -d --build frontend` to take effect. Backend changes hot-reload automatically via `uvicorn --reload`.

### `.env` Changes Require Force-Recreate
`docker compose restart` does **not** re-read `.env` for environment variables. Use `docker compose up -d --force-recreate backend` to pick up `.env` changes.

## Environment Variables

Key vars in `.env` (see `.env.example` for full list):
- `DATABASE_URL` — asyncpg connection string
- `JWT_SECRET` — minimum 32 bytes
- `EMBEDDING_API_KEY` — Voyage AI key (`pa-...`)
- `EMBEDDING_MODEL` — `voyage-3`
- `EMBEDDING_DIMENSIONS` — `1024`
- `BACKEND_CORS_ORIGINS` — JSON array, must include `http://localhost:3000` and the Chrome extension origin
- `FIRST_USER_EMAIL` / `FIRST_USER_PASSWORD` — used by seed script
