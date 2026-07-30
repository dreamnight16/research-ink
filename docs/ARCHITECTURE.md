# Architecture

## Overview

ResearchInk is a local-first research assistant with a plugin-based architecture.
The backend runs as a FastAPI server on `127.0.0.1:8000`. The frontend is a
React SPA served by Vite.

```
┌─────────────────────────────────────────────┐
│                  Frontend                    │
│  React 18 + TypeScript + Vite                │
│  ┌─────────┐ ┌──────────┐ ┌─────────────┐  │
│  │Tab Bar  │ │Chat Panel│ │Settings     │  │
│  └─────────┘ └──────────┘ └─────────────┘  │
│  ┌──────────────────────────────────────┐   │
│  │          Plugin Panels (5)            │   │
│  └──────────────────────────────────────┘   │
└──────────────────┬──────────────────────────┘
                   │ HTTP + WebSocket
                   │ Auth: Bearer token
┌──────────────────▼──────────────────────────┐
│               Backend (FastAPI)              │
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │Middleware │ │Gateway   │ │Routes       │  │
│  │(auth,     │ │(app      │ │(plugins,    │  │
│  │ rate-limit│ │ factory) │ │ security)   │  │
│  └──────────┘ └──────────┘ └─────────────┘  │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │           Plugin Engine              │    │
│  │  ┌────────┐ ┌────────┐ ┌─────────┐  │    │
│  │  │Discover│ │Load/   │ │Dependency│  │    │
│  │  │        │ │Unload  │ │Validation│  │    │
│  │  └────────┘ └────────┘ └─────────┘  │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌───────────┐  │
│  │Config│ │LLM   │ │Event │ │Scheduler   │  │
│  │      │ │Router│ │Bus   │ │            │  │
│  └──────┘ └──────┘ └──────┘ └───────────┘  │
│                                              │
│  ┌──────┐ ┌──────┐ ┌──────────────────────┐ │
│  │Secur-│ │Stor- │ │       Plugins        │ │
│  │ity   │ │age   │ │ (5 built-in)         │ │
│  └──────┘ └──────┘ └──────────────────────┘ │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│               Data Layer                     │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │ SQLite   │ │ ChromaDB │ │ File System  │  │
│  │(research │ │(vectors) │ │(~/.research-ink/)   │  │
│  │ .db)     │ │          │ │              │  │
│  └──────────┘ └──────────┘ └─────────────┘  │
└─────────────────────────────────────────────┘
```

## Key Components

### Plugin Engine (`backend/core/engine.py`)

Discovers plugins from `plugin.toml` manifests, loads/unloads them at runtime,
and validates plugin dependencies. Built-in plugins run in-process; user plugins
are rejected by default (sandboxing planned for v1.1).

### Event Bus (`backend/core/event_bus.py`)

In-process pub/sub for plugin communication. Plugins emit events like
`paper.saved`; other plugins or the WebSocket forwarder subscribe.

### LLM Router (`backend/core/llm_router.py`)

Routes chat requests to local Ollama or cloud providers (Claude, OpenAI, DeepSeek)
based on data classification. SSRF protection ensures Ollama URLs are localhost only.

### Security Manager (`backend/core/security.py`)

Three-tier data classification (secret / cautious / public). Secret data is
forced to local models. Cloud operations on cautious data require user approval.
All cloud outbound traffic is logged to the audit trail. Classifications,
approvals, and audit entries are persisted to SQLite.

### Storage (`backend/core/storage.py`)

Thread-safe SQLite with WAL mode + ChromaDB for vector embeddings. Schema is
managed centrally by `backend/core/schema.py`.

### Task Scheduler (`backend/core/scheduler.py`)

Lightweight async scheduler for recurring tasks (e.g., auto-fetch papers hourly).
Supports crash recovery and per-task timeouts.

## Data Flow

### Paper Search
```
User keyword → /api/literature/feed
  → CrawlerManager.search_all()
    → ArxivCrawler + SemanticScholarCrawler + DBLPCrawler (parallel)
    → Deduplication (ID + DOI + title similarity)
    → Response (sorted by date, max 30)
```

### Chat
```
User message → /api/chat
  → SecurityManager.mark(doc_id, classification)
  → SecurityManager.allow_cloud(doc_id)
  → LLMRouter.select(classification, cloud_approved)
  → LLMRouter.chat(provider, messages)
  → If cloud: SecurityManager.log_cloud_send(...)
  → Response
```

### Formula Verification
```
User LaTeX → /api/formula/verify
  → verify_formula() — basic checks (brackets, div-by-zero, domain)
  → latex_to_sympy() — LaTeX → SymPy expression string
  → sympy_verify() — parse with SymPy (evaluate=False for safety)
  → Response (combined result)
```

## Security Model

- **Authentication**: Local bearer token (256-bit, stored in `~/.research-ink/.api_token`)
- **Authorization**: Token required for all endpoints except `/health`, `/docs`, `/api/auth/token`
- **Data classification**: Secret → local only; Cautious → local unless approved; Public → cloud-allowed
- **SSRF protection**: Ollama URL restricted to localhost
- **Input validation**: Pydantic models with field constraints on all endpoints
- **Audit**: All cloud outbound requests logged with content hash

## Directory Layout

```
backend/
├── api/           # FastAPI app, middleware, routes
├── core/          # Engine, event bus, security, storage, config, etc.
└── plugins/       # Built-in plugins (literature, formula, evaluator, etc.)
    ├── evaluator/
    ├── formula/
    ├── literature/
    │   └── crawlers/  # ArXiv, Semantic Scholar, DBLP
    ├── paper_writer/
    └── term_advisor/

frontend/
└── src/
    ├── core/       # App shell, API client, types
    ├── plugins/    # Plugin panels
    └── shared/     # Shared UI components

plugin_schema/      # Plugin API documentation and examples
tests/              # Backend tests
scripts/            # Installation and utility scripts
```
