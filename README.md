# Personal AI Context Vault

A self-hosted, single-user memory layer for AI conversations. The vault captures conversation summaries from Claude and ChatGPT via a Chrome extension, lets you review and approve them, then stores approved memories in a searchable vector database — ready to be retrieved as context by any connected AI tool (e.g. Claude Code via the MCP server pattern).

## Privacy Guarantee

> **Raw conversation text never reaches the vault backend.**

The Chrome extension calls your configured model API (OpenAI or Anthropic) directly using your own API key. Only the AI-generated summary and extracted facts are sent to the backend. Your API key is stored in `chrome.storage.local` and never transmitted elsewhere.

## Architecture

```
┌─────────────────┐     summarise      ┌──────────────────┐
│ Chrome Extension│ ─────────────────▶ │  Your Model API  │
│  (content script│ ◀─ summary/facts ─ │ (OpenAI/Anthropic│
│   + popup)      │                    └──────────────────┘
└────────┬────────┘
         │ POST /drafts/  (summary + facts only, NO raw text)
         ▼
┌─────────────────┐     approve        ┌──────────────────┐
│  FastAPI Backend│ ◀──────────────── │ Next.js Dashboard│
│  + PostgreSQL   │                    │  /drafts  review │
│  + pgvector     │ ─── embeddings ──▶ │  /memories       │
└─────────────────┘                    │  /profile        │
         ▲                             │  /tokens         │
         │ X-API-Token                 └──────────────────┘
         │
┌────────┴────────┐
│   Claude Code   │  GET /context/query → relevant memories + profile
│   (MCP / curl)  │
└─────────────────┘
```

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11, FastAPI, SQLAlchemy 2.0 (async) |
| Database | PostgreSQL 15 + pgvector (HNSW cosine similarity) |
| Frontend | Next.js 14 (App Router), TypeScript |
| Extension | Chrome Manifest V3, TypeScript, Webpack |
| Embeddings | OpenAI `text-embedding-3-small` (backend-side, approved text only) |
| Auth | bcrypt, JWT access (15 min) + refresh (30 days) tokens |
| API Tokens | SHA-256 hashed, plain token returned once on creation |
| Deployment | Docker Compose, self-hosted |

## Quick Start

### 1. Clone and configure

```bash
git clone <this-repo>
cd Context_share_app
cp .env.example .env
# Edit .env — set FIRST_USER_EMAIL, FIRST_USER_PASSWORD, EMBEDDING_API_KEY
```

### 2. Start the stack

```bash
docker compose up --build -d
```

Services:
- Backend API: http://localhost:8001
- Frontend dashboard: http://localhost:3000
- PostgreSQL: localhost:5432

### 3. Seed the user

```bash
docker compose exec backend python -m app.scripts.seed_user
```

### 4. Load the Chrome extension

```bash
cd extension
npm install && npm run build
# In Chrome: chrome://extensions → Load unpacked → select extension/dist/
```

Configure the extension popup:
- Set your OpenAI or Anthropic API key
- Set Vault URL to `http://localhost:8001`
- Log in with your seeded credentials

### 5. Capture memories

1. Open a conversation on claude.ai or ChatGPT
2. Click **Capture** in the extension popup
3. Visit http://localhost:3000/drafts to review the draft
4. Click **Save to Memory** — the summary is embedded and stored

### 6. Query context (Claude Code / MCP)

```bash
# Create an API token at http://localhost:3000/tokens, then:
curl -X POST http://localhost:8001/api/v1/context/query \
  -H "X-API-Token: <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"query": "what are my career goals?", "limit": 5}'
```

Returns:
```json
{
  "profile_summary": "current_role: analyst\ntarget_role: AI engineer",
  "relevant_memories": [
    {
      "summary": "Discussed transitioning into AI engineering...",
      "tags": ["career", "ai"],
      "source_platform": "claude",
      "save_mode": "summary_only"
    }
  ]
}
```

## Project Structure

```
Context_share_app/
├── backend/                  # FastAPI application
│   ├── app/
│   │   ├── api/v1/           # Route handlers (auth, drafts, memories, profile, tokens, context)
│   │   ├── models/           # SQLAlchemy ORM models (7 tables)
│   │   ├── schemas/          # Pydantic v2 request/response schemas
│   │   ├── services/         # Business logic
│   │   └── core/             # Config, database, security, dependencies
│   ├── alembic/              # Database migrations
│   └── tests/                # pytest suite (15 tests)
├── frontend/                 # Next.js dashboard
│   └── src/app/
│       ├── drafts/           # Review queue
│       ├── memories/         # Memory browser
│       ├── profile/          # Profile facts
│       └── tokens/           # API token management
├── extension/                # Chrome Extension (Manifest V3)
│   └── src/
│       ├── background/       # Service worker — calls model API, posts to vault
│       ├── content/          # DOM scrapers for ChatGPT and Claude
│       └── popup/            # Extension UI
├── docker-compose.yml
├── .env.example
└── Makefile
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/login` | — | Get JWT tokens |
| POST | `/api/v1/auth/refresh` | — | Rotate refresh token |
| GET | `/api/v1/auth/me` | JWT | Current user |
| POST | `/api/v1/drafts/` | JWT | Create draft (extension) |
| GET | `/api/v1/drafts/` | JWT | List pending drafts |
| POST | `/api/v1/drafts/{id}/approve` | JWT | Approve → store memory |
| DELETE | `/api/v1/drafts/{id}` | JWT | Dismiss draft |
| POST | `/api/v1/drafts/{id}/private` | JWT | Mark private |
| GET | `/api/v1/memories/` | JWT | Paginated memory list |
| DELETE | `/api/v1/memories/{id}` | JWT | Delete memory |
| GET | `/api/v1/profile/` | JWT | Profile facts |
| PATCH | `/api/v1/profile/{key}` | JWT | Update a fact |
| POST | `/api/v1/context/query` | JWT or X-API-Token | Semantic search |
| POST | `/api/v1/tokens/` | JWT | Create API token |
| GET | `/api/v1/tokens/` | JWT | List tokens |
| DELETE | `/api/v1/tokens/{id}` | JWT | Revoke token |

## Running Tests

```bash
docker compose exec backend python -m pytest tests/ -v
# 15 passed
```

## Environment Variables

See [.env.example](.env.example) for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | ≥32 random bytes, base64-encoded |
| `FIRST_USER_EMAIL` | Seeded admin email |
| `FIRST_USER_PASSWORD` | Seeded admin password |
| `EMBEDDING_API_KEY` | OpenAI API key for embedding approved summaries |

## Save Modes

When approving a draft, choose how much to store:

| Mode | What's stored |
|------|--------------|
| `summary_only` | AI-generated summary text (default) |
| `summary_and_facts` | Summary + extracted key/value facts |
| `full_conversation` | Summary + facts + raw conversation text |

> Note: `full_conversation` is the only mode where raw text enters the vault — and only because the user explicitly chose it.

## Notes

- **Single-user MVP** — no multi-tenancy. Auth protects one user's data.
- **Draft expiry** — drafts auto-expire after 7 days if not reviewed.
- **Port** — backend binds to host port `8001` by default (to avoid conflicts). Change in `docker-compose.yml` if needed.
- **HTTPS** — for production, put Caddy or nginx in front of the backend.
