# Personal AI Context Vault
## MVP Product Requirement Document (PRD)

**Version:** 0.2  
**Author:** Johnny  
**Status:** Draft / MVP Scope

---

# 1. Product Overview

## 1.1 Background

Modern AI conversational tools such as ChatGPT, Claude, Gemini, and coding assistants maintain isolated conversation histories. Users often need to repeat their background, preferences, projects, and goals across different AI systems.

This product aims to create a **Personal AI Context Vault** — a secure, user-controlled memory layer that:

- observes conversations from supported AI platforms
- creates a draft summary for user review
- stores only user-approved memories
- builds a structured personal profile and vector memory store
- provides relevant context to any connected language model

The vault acts as a **portable AI memory and identity layer** across providers.

---

# 2. Product Goals

The MVP should prove these core capabilities:

1. **Conversation Observation**  
   Detect conversations from supported AI platforms.

2. **User-Approved Memory Creation**  
   Summarize the observed conversation and allow the user to review it before anything is permanently stored.

3. **Personal Context Storage**  
   Store approved summaries, facts, and optionally raw conversations in structured and vectorized form.

4. **Context Retrieval**  
   Allow AI systems to retrieve relevant personal context for future interactions.

---

# 3. MVP Product Principle

The MVP must follow this rule:

> **Observed conversation does not equal permanent memory.**  
> A conversation must first be summarized and reviewed by the user before it can be memorized.

This is a core trust and privacy requirement.

---

# 4. In Scope (MVP)

The MVP will include:

- browser-based conversation observation
- support for ChatGPT and Claude web interfaces
- conversation summarization
- user review workflow
- explicit “Save to Memory” / “Memorize” action
- approved memory storage
- vector search
- personal profile extraction
- API/token-based retrieval
- basic authentication and security controls

---

# 5. Out of Scope (MVP)

The following are out of scope for the first version:

- enterprise / team shared memory
- wearable device integration
- mobile native app
- advanced knowledge graph reasoning
- automatic cross-model prompt optimization
- billing / monetization
- real-time proactive AI assistant behavior
- local desktop proxy for all apps
- full biometric auth implementation across all devices

These may be considered in later phases.

---

# 6. Target User

## Primary User
Individual AI power users who use multiple conversational AI systems.

Examples:

- developers
- analysts
- product managers
- researchers
- knowledge workers

## Typical User Problem

- repeats the same background to multiple AI tools
- wants an AI to remember prior context
- wants control over what becomes permanent memory
- cares strongly about privacy and security

---

# 7. User Stories

### 7.1 Observation
As a user, I want the system to detect my conversations on supported AI platforms so I do not have to manually copy them.

### 7.2 Review Before Save
As a user, I want the system to summarize a conversation first and show it to me for review before it is permanently stored.

### 7.3 Controlled Memory
As a user, I want to choose whether a conversation should be memorized, and at what level.

### 7.4 Personal Context Retrieval
As a user, I want connected AI models to retrieve my approved background and relevant prior discussions.

### 7.5 Security
As a user, I want strong control over access to my personal memory, including token management and secure authentication.

---

# 8. End-to-End MVP Workflow

The core workflow for the MVP is:

```text
Conversation detected
→ temporary session capture
→ draft summary generated
→ extracted facts suggested
→ review card shown to user
→ user clicks Save to Memory
→ approved data stored
→ embeddings generated
→ profile updated
→ memory becomes retrievable
```

Nothing should enter long-term memory before the user approves it.

---

# 9. Functional Requirements

## 9.1 Conversation Observation

### Description
The system should detect supported AI conversations through a browser extension.

### Supported Platforms
- ChatGPT web
- Claude web

### Requirements
- The extension shall detect conversation content from supported sites
- The extension shall temporarily capture the latest conversation exchange in session state
- The extension shall not store observed conversation to permanent memory automatically
- The extension shall allow observation to be paused or disabled
- The extension shall support manual trigger if automatic detection fails
- The extension shall provide a **Capture** button the user can click at any time to trigger capture
- The extension shall detect when the user attempts to navigate away from a supported AI page and display a prompt asking if they want to capture the conversation before leaving

### Model API Key Management
- The extension shall allow the user to configure their preferred AI model provider and API key
- The API key shall be stored locally in the extension using `chrome.storage.local`
- The API key shall never be transmitted to the vault backend
- The extension shall use the stored API key to call the user's configured model API directly for summarization
- Supported providers at MVP: OpenAI, Anthropic (Claude)

### Conversation Unit
- Default capture: most recent exchange (last user message + last assistant response)
- User may also manually select a portion of the conversation to capture instead
- Entire thread capture is not the default but may be user-triggered

### Captured Temporary Fields
- source platform
- conversation identifier
- timestamp
- user message(s)
- assistant message(s)
- raw combined text

---

## 9.2 Draft Summarization Before Memory

### Description
Before permanent storage, the browser extension shall generate a draft summary and candidate facts for review by calling the user's configured model API directly. The vault backend receives only the resulting draft — never the raw conversation.

### Requirements
- The extension shall call the user's configured model API (using their stored API key) to summarize the observed conversation
- Raw conversation text shall not be sent to the vault backend at any point
- The system shall generate:
  - a short summary
  - candidate facts
  - suggested tags
- The summary shall be created in temporary state first
- The user shall be able to review the draft before memorization

### Example Draft Output
- Summary: User discussed transitioning into data engineering
- Candidate facts:
  - interested in data engineering
  - uses Snowflake
  - uses dbt
- Suggested tags:
  - career
  - skills
  - AI

---

## 9.3 Memory Review and Approval

### Description
The system shall present a review component before anything is memorized.

### Requirements
- The system shall display a review card after summarization
- The review card shall include:
  - summary
  - extracted facts
  - suggested tags
  - save mode options
- The review card shall include a clear primary action button:
  - **Save to Memory** or **Memorize**
- The user shall be able to:
  - approve
  - edit
  - dismiss
  - mark as private / do not save

### Save Modes
The user shall be able to select one of the following:
- summary only
- summary + facts
- full conversation
- do not save

### Core Rule
- No embedding generation shall occur before approval
- No profile update shall occur before approval
- No vector storage shall occur before approval
- No permanent database write shall occur before approval, except optional temporary local session state

---

## 9.4 Memory State Model

The system should track a conversation through states.

### Required States
- detected
- draft summarized
- awaiting review
- memorized
- dismissed
- private
- deleted

### Notes
- Only items in **memorized** state enter long-term storage
- Dismissed and private items must not be used for retrieval

---

## 9.5 Memory Storage

### Description
The system stores only approved memory artifacts.

### Storage Types
Depending on user-selected save mode, the system may store:
- approved summary
- approved facts
- approved tags
- raw conversation text

### Requirements
- The system shall store approved items in persistent storage
- The storage model shall support separation between:
  - summary
  - extracted facts
  - full conversation content
- The system shall record save mode used
- The system shall record source platform and timestamp

---

## 9.6 Personal Profile Extraction

### Description
Approved memories should contribute to a growing user profile.

### Profile Content Examples
- role
- skills
- interests
- goals
- projects
- preferences

### Conflict Resolution
When a new approved memory contains a fact that contradicts an existing profile entry:
- The new value shall be applied automatically (last write wins)
- The user shall be notified of the change with a diff view (old value → new value)
- The user may revert the change or define a custom value if they disagree with the automatic update

### Requirements
- The system shall extract profile facts only from approved memory
- The system shall update the user profile incrementally
- The system shall not update the user profile from dismissed or private conversations
- The user shall be able to review stored profile entries in the dashboard
- The system shall log profile fact changes with source memory reference

---

## 9.7 Embedding Generation

### Description
After a memory is approved, the system generates embeddings for semantic retrieval.

### Requirements
- Embeddings shall only be generated after the user has approved the memory
- The embedding source shall depend on save mode:
  - summary only → embed summary
  - summary + facts → embed summary and/or combined approved content
  - full conversation → embed full approved content
- Embeddings shall be stored in vector-capable storage

### Suggested Model
- Default: OpenAI text-embedding-3-small (user provides their own API key)
- The embedding model should be user-configurable to match the user's chosen provider
- Local embedding model support deferred to Phase 2

---

## 9.8 Vector Storage and Search

### Description
Store memory vectors to support semantic search.

### Suggested MVP Technology
- PostgreSQL + pgvector

### Requirements
- The system shall store embeddings linked to approved memory records
- The system shall allow semantic similarity search
- The system shall return relevant memories based on query similarity
- The system shall exclude dismissed, deleted, or private records from retrieval

---

## 9.9 Context Retrieval API

### Description
Connected AI tools should be able to retrieve user context.

### Endpoint Example
`POST /context/query`

### Example Input
```json
{
  "query": "help me plan my career transition"
}
```

### Example Output
```json
{
  "profile_summary": "Johnny is a product analyst with SQL, Snowflake, and dbt experience who wants to transition into data engineering.",
  "relevant_memories": [
    {
      "summary": "Discussed career transition into data engineering.",
      "tags": ["career", "skills"]
    }
  ]
}
```

### Requirements
- The system shall accept a user query
- The system shall retrieve approved relevant memories only
- The system shall return:
  - profile summary
  - top relevant memories
  - optional facts/tags
- The system shall support token-based access

---

## 9.10 Endpoint and Token Access

### Description
Users may connect multiple endpoints to retrieve context.

### Example Endpoints
- laptop browser
- phone app
- AI plugin
- local development tool

### Requirements
- The system shall support API token generation
- The system shall allow token revocation
- The system shall track connected endpoints
- The system shall associate token usage with endpoint or integration name

### Recommended Token Fields
- token_id
- token_name
- created_at
- expires_at
- last_used_at
- revoked_flag

---

## 9.11 Security Requirements

Security is a core differentiator of the product.

### Authentication Approach
- Email + password authentication
- Passwords stored using bcrypt hashing
- JWT access tokens (short-lived, e.g. 15 minutes) with refresh tokens
- No third-party OAuth required for MVP single-user setup

### MVP Security Requirements
- user authentication required
- secure session management required
- API token management required
- stored data must be encrypted at rest
- transport must use HTTPS
- sensitive actions must require authenticated access
- access logs should be recorded

### Future Security Direction
- biometric authentication
- TOTP / authenticator app support
- device trust model
- scoped tokens
- zero-knowledge or client-side encryption

---

## 9.12 Privacy Controls

### Requirements
- The user shall be able to choose what gets memorized
- The user shall be able to dismiss a memory draft; dismissed drafts and their associated temporary conversation record shall be deleted immediately
- The user shall be able to mark a conversation as private
- The user shall be able to delete memorized records
- The user shall be able to disable observation on supported platforms
- The user shall be able to pause memory collection

### Recommended Future Enhancements
- source-level rules
- sensitive content detection
- memory expiration
- category-based sharing controls

---

# 10. UI / UX Requirements

## 10.1 Browser Extension Experience

The extension should:

- observe supported AI pages
- detect new conversation completion
- generate a draft summary
- display a review component near the bottom of the conversation or in extension UI

### Review Card Content
- summary
- extracted facts
- suggested tags
- save mode selector
- action buttons

### Buttons
- Save to Memory
- Edit
- Dismiss
- Private / Don’t Save

---

## 10.2 Dashboard

The MVP dashboard should allow the user to:

### View Memory Drafts
- pending review items
- draft summaries

### View Memorized Items
- approved memories
- summaries
- facts
- tags
- source platform

### View Personal Profile
- extracted profile facts
- profile summary

### Query Context
- semantic search test area
- returned context preview

### Manage Tokens
- create token
- revoke token
- view usage metadata

---

# 11. Data Model (MVP Suggested)

## 11.1 conversations_observed_temp
Temporary session-level records only.

Suggested fields:
- id
- user_id
- platform
- conversation_id
- observed_at
- raw_text
- status

## 11.2 memory_drafts
Draft summaries awaiting review.

Suggested fields:
- id
- user_id
- temp_conversation_id
- summary_text
- candidate_facts_json
- suggested_tags_json
- draft_status
- created_at
- reviewed_at

## 11.3 memorized_items
Approved memory records.

Suggested fields:
- id
- user_id
- source_platform
- summary_text
- approved_facts_json
- tags_json
- raw_text_nullable
- save_mode
- created_at

## 11.4 embeddings
Vector representations for retrieval.

Suggested fields:
- id
- memorized_item_id
- embedding_vector
- embedding_source_type
- created_at

## 11.5 user_profile
Structured user profile facts.

Suggested fields:
- id
- user_id
- profile_key
- profile_value
- confidence_score_nullable
- source_memory_id
- created_at
- updated_at

## 11.6 api_tokens
Suggested fields:
- id
- user_id
- token_name
- token_hash
- created_at
- expires_at
- revoked_at
- last_used_at

---

# 12. Suggested Tech Stack

## Backend
- Python
- FastAPI

## Database
- PostgreSQL
- pgvector

## Frontend
- React or Next.js

## Browser Extension
- Chrome extension first
- possible Chromium-based support
- Secure local key storage via `chrome.storage.local` for user API keys
- Extension makes model API calls directly; no raw conversation text sent to vault backend

## Embeddings
- OpenAI embedding API initially
- local embedding model later

## Deployment
- Docker
- self-hosted for MVP (single environment)
- SaaS / cloud-hosted deferred to a future iteration

## Authentication
- Email + password (bcrypt hashing)
- JWT access tokens (short-lived) + refresh tokens
- No third-party OAuth dependency for MVP
- Google OAuth or similar can be added when product moves to multi-user SaaS

## Product Scope
- MVP is a single-user prototype for the author's personal use
- Multi-user and team features deferred to a future product iteration

---

# 13. Non-Functional Requirements

## Performance
- review draft generation should feel near real-time
- context retrieval target under 2 seconds for typical query sizes

## Reliability
- failed summarization should not lose the observed conversation in temporary state
- user should be able to retry summary generation

## Scalability
- initial system should support at least tens of thousands of memorized items per user
- design should allow later scaling to larger memory volumes

## Security
- all sensitive endpoints authenticated
- token values stored hashed where possible
- logs should avoid exposing full secrets

---

# 14. Success Criteria

The MVP is successful if:

1. A user can use ChatGPT or Claude in browser and have the conversation detected
2. The system generates a draft summary for review
3. The user can click **Save to Memory**
4. Only approved items are stored
5. Approved items are vectorized and retrievable
6. A profile summary can be built from approved memories
7. Another AI tool can query and receive useful context

---

# 15. Risks and Open Questions

## Risks
- browser DOM changes may break capture
- summarization quality may be inconsistent
- profile extraction may create incorrect facts
- users may be confused by too much review friction
- security expectations may be higher than MVP implementation

## Decided Questions

The following questions have been resolved:

| Question | Decision |
|----------|----------|
| Should raw conversation stay only locally until approved? | **Yes — raw text goes only to the user's configured model API (via their own key). The vault backend never receives raw conversation text.** |
| Should summary generation happen locally or via remote API? | **User-configured remote model with their own API key. The extension calls the model API directly.** |
| Should full conversation save mode be enabled by default? | **No — default is summary only. Other modes (summary + facts, full conversation) are opt-in.** |
| Should memory drafts expire if user does not review them? | **Yes — 7-day hard expiry. User receives a notification before expiry.** |
| Should sensitive content detection be included in MVP or phase 2? | **MVP — keyword/pattern-based detection only. LLM-based sensitivity classification deferred to phase 2.** |
| Is the backend hosted SaaS or self-hosted? | **Self-hosted for MVP. SaaS option deferred to a future iteration.** |
| Is multi-device support required for MVP? | **No — single device only for MVP. Multi-device sync is a future feature.** |
| How do users authenticate? | **Email + password with bcrypt + JWT (access + refresh tokens). No OAuth dependency for MVP.** |
| What triggers conversation capture? | **Explicit Capture button click, or a prompt shown when the user navigates away from a supported AI page.** |
| What counts as a conversation unit? | **Default is most recent exchange (last user message + last AI response). User may manually select a different portion.** |
| How are conflicting profile facts handled? | **Last write wins automatically, with a diff notification to the user. User may revert or override.** |
| What happens to temp records on dismiss? | **Immediately deleted — both the draft and its associated temporary conversation record.** |
| Who are the initial API consumers? | **Single-user prototype for the author's personal use. External integrations considered in a future product phase.** |

---

# 16. Future Enhancements

After MVP, potential next steps include:

- source-level save rules
- sensitive-content detection
- memory ranking and confidence scoring
- richer personal knowledge graph
- mobile app
- biometric authentication
- authenticator app MFA
- multi-provider integrations beyond ChatGPT and Claude
- local proxy for desktop AI tools
- cloud + local hybrid storage model
- endpoint trust levels
- temporal memory and profile evolution

---

# 17. Recommended MVP Build Order

## Phase 1
- backend setup
- database schema
- memorized item model
- embedding pipeline
- retrieval API

## Phase 2
- browser extension
- temporary observation
- draft summary generation
- review card UI
- Save to Memory workflow

## Phase 3
- dashboard
- profile view
- memory view
- token management

## Phase 4
- hardening
- deletion flow
- logging
- basic security review

