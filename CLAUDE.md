# Personal AI Context Vault — Claude Code Project Guide

## Product Overview

A self-hosted, single-user personal memory layer that observes AI conversations,
generates draft summaries for user review, and stores only user-approved memories
in a searchable vector store. Approved context can be retrieved by any connected AI tool.

## Core Principle — Never Forget

> Raw conversation text NEVER touches the vault backend.
> The browser extension calls the user's configured model API directly.
> Only the approved summary/facts are sent to the backend.

This is the central privacy guarantee. Any code that violates this must be rejected.

## Tech Stack

| Layer            | Technology                                      |
|------------------|-------------------------------------------------|
| Backend          | Python 3.11+, FastAPI                           |
| Database         | PostgreSQL 15+ with pgvector extension          |
| Frontend         | Next.js (App Router)                            |
| Browser Extension| Chrome Extension (Manifest V3)                  |
| Embeddings       | User-configured (default: OpenAI text-embedding-3-small) |
| Auth             | Email + password, bcrypt, JWT (access + refresh tokens) |
| Deployment       | Docker Compose, self-hosted                     |

## Project Structure (to be filled as built)

```
Context_share_app/
├── CLAUDE.md
├── _specs/               # Feature spec files
├── backend/              # FastAPI app
│   ├── app/
│   │   ├── api/          # Route handlers
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── services/     # Business logic
│   │   └── core/         # Config, auth, security
│   ├── alembic/          # DB migrations
│   └── tests/
├── frontend/             # Next.js dashboard
│   └── src/
├── extension/            # Chrome extension
│   ├── src/
│   │   ├── content/      # Content scripts (DOM capture)
│   │   ├── background/   # Service worker
│   │   └── popup/        # Extension popup UI
│   └── manifest.json
└── docker-compose.yml
```

## Key Architectural Decisions

- **Single-user MVP**: No multi-tenancy. Auth exists to protect the single user's data.
- **Self-hosted**: Docker Compose, single environment.
- **Capture triggers**: Explicit "Capture" button click, or page-leave prompt.
- **Conversation unit**: Most recent exchange by default; user may select a range.
- **Save mode default**: Summary only. Other modes (summary + facts, full) are opt-in.
- **Draft expiry**: 7-day hard expiry with pre-expiry notification.
- **Profile conflicts**: Last write wins, with diff notification to user. User may revert.
- **Dismiss behaviour**: Immediate deletion of draft and associated temp record.

## Backend Conventions

- Use `async` FastAPI route handlers throughout.
- Pydantic v2 for all request/response schemas.
- SQLAlchemy 2.0 with async sessions (`AsyncSession`).
- Alembic for all schema changes — never edit tables manually.
- All authenticated endpoints use the `get_current_user` dependency.
- Return 401 for unauthenticated, 403 for unauthorised, never expose internal errors.

## Extension Conventions

- Manifest V3.
- Store user API key in `chrome.storage.local` only — never sync, never send to backend.
- Content scripts must not inject state into the page's JS context.
- All model API calls (summarization, embeddings) are made from the extension, not the backend.

## Security Rules

- Never log raw conversation content.
- Never store raw conversation text on the backend.
- Hash API tokens before storing (store only the hash, return the plain token once on creation).
- JWT access tokens expire in 15 minutes. Refresh tokens expire in 30 days.
- All endpoints require authentication except `/auth/login` and `/auth/refresh`.
