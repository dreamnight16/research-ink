# Changelog

## [1.0.0] — 2026-06-12

### Cross-Platform
- Desktop: Tauri v2 shell with custom Rust commands (backend status, API token, restart)
- Desktop: System tray integration and IPC health monitoring
- Desktop: NSIS (.msi) + DMG + AppImage packaging targets
- Mobile: Capacitor shell for Android/iOS with 100% React code reuse
- Mobile: LAN auto-discovery for desktop backend (mDNS + IP probing)
- Mobile: QR code pairing flow (`POST /api/auth/pair`)
- Mobile: Responsive CSS breakpoints (768/375/320)
- Mobile: Offline degradation with connection status banner
- Backend binds `0.0.0.0` (configurable via `YANMO_HOST`) for LAN access
- CORS extended for `capacitor://localhost` and LAN origins
- CSP extended for LAN IP ranges

### Security
- Fix `sympy.parse_expr()` code injection risk via `evaluate=False` and restricted symbol table
- Enforce Ollama URL SSRF protection (was log-only, now raises `ValueError`)
- Add constant-time token comparison via `secrets.compare_digest()`
- Add `POST /api/auth/rotate-token` endpoint for token rotation
- Add request body size limit (5 MB middleware)
- Fix WebSocket ticket race condition with atomic `dict.pop()`
- Add ChromaDB collection name path-traversal protection (regex validation)
- Add `asyncio.Lock` on shared mutable state (rate limiter, WS tickets, EventBus)
- Remove auth token prefix leak from startup log
- Case-insensitive "Bearer" prefix handling
- Add `*.api_token` to `.gitignore`
- Restrict plugin manifest endpoint from exposing filesystem paths

### Reliability
- Fix: Health endpoint auth bypass (`/health` → `/api/health` in skip paths)
- Fix: Remove fake `knowledge-base` dependency from evaluator/term_advisor plugin.toml
- Fix: Settings component inaccessible from UI (added header button)
- SecurityManager: SQLite-backed persistence for classifications, approvals, and audit log
- Config: graceful degradation on corrupted `config.json` (auto-backup + default fallback)
- LLMRouter: retry logic for transient HTTP errors (429, connection errors)
- Scheduler: auto-restart on loop crash + per-task timeout protection
- EventBus: handler exceptions propagated instead of silently swallowed
- 10 silent `except: pass` sites converted to logged warnings

### Stability
- Dedup: O(n²) fallback to ID-only mode for >500 papers
- WebSocket: max 50 concurrent connections
- Rate limiter: max 10,000 tracked IPs
- Scheduler: 600s per-task execution timeout

### Code Quality
- Introduce `PluginProtocol` and `BasePlugin` — all plugins now inherit a shared contract
- Split `gateway.py` (362 lines) into `gateway.py` + `middleware.py` + `routes_plugins.py` + `routes_security.py`
- Extract `constants.py` — 30+ hardcoded values centralized
- Extract `schemas.py` — unified `ApiResponse[T]` envelope
- Extract `schema.py` — centralized DDL management
- Remove dead code: `audit_log_persist()`, `get_commands()` boilerplate
- Remove fake `knowledge-base` dependency from plugin manifests
- Enforce plugin dependency validation at load time
- Standardize route prefixes to kebab-case
- Add `ruff`, `mypy`, `pre-commit` configuration

### Observability
- Structured logging with timestamps and levels
- `/api/health` now checks Ollama + SQLite + ChromaDB liveness
- Request logging middleware (method, path, status, duration)
- Global exception handler returns JSON, never stack traces

### Testing
- 49 → 95+ backend tests (80%+ coverage target)
- 0 → 13 frontend tests (vitest + testing-library)
- Shared test fixtures via `tests/conftest.py`
- CI: 4 jobs (lint, typecheck, test matrix, frontend)

### Documentation
- New: `CHANGELOG.md`, `ROADMAP.md`, `docs/ARCHITECTURE.md`
- New: `Dockerfile`, `docker-compose.yml`, `.env.example`
- New: `scripts/install.sh`, `scripts/install.ps1`
- New: `plugin_schema/example_plugin/` (reference implementation)
- Updated: `README.md` (Why Yanmo, Who is for, Quick Start, quantified value)
- Updated: `plugin_schema/API.md` (corrected paths, updated interface)
- Updated: `SECURITY.md` (persistence model, token rotation)

### UX
- New: `Loading`, `ErrorBanner`, `EmptyState` shared components
- All panels wired with loading/error/empty states
- Chat history persisted to localStorage
- Settings save confirmation toast

[0.1.1]: https://github.com/sixtdreanight/Yanmo/releases/tag/v0.1.1
