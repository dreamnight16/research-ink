# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

Please report security vulnerabilities to **[support@dreamnight.net.cn]**.

**Do NOT** create public GitHub issues for security vulnerabilities.

You should receive a response within 48 hours. If the issue is confirmed,
we will release a patch as soon as possible, depending on complexity.

## Preferred Languages

- English
- 中文 (Chinese)

## Disclosure Policy

Once a fix is ready, we will:

1. Release a patch version
2. Publish a security advisory on GitHub
3. Credit the reporter (unless anonymity is requested)

## Security Model

### Data Classification

Yanmo uses a three-tier classification system for all data:

| Level | Description | Cloud Allowed |
|-------|-------------|---------------|
| **Secret** | Confidential data (advisor notes, unpublished results) | Never |
| **Cautious** | Default level — sensitive unless approved | After explicit user approval |
| **Public** | Non-sensitive data | Always (if cloud configured) |

Classifications and cloud approvals are persisted to the local SQLite database
and survive application restarts.

### API Authentication

- A 256-bit bearer token is generated on first launch and stored at `~/.yanmo/.api_token`
- Token is retrievable only from localhost (`127.0.0.1`, `::1`)
- Token can be rotated via `POST /api/auth/rotate-token` (requires current token)
- Token comparison uses constant-time `secrets.compare_digest()` to prevent timing attacks

### SSRF Protection

- Ollama URL is restricted to localhost addresses only
- External Ollama URLs raise a `ValueError` at initialization
- Cloud API endpoints are hardcoded to known provider domains

### Audit Trail

- All cloud outbound requests are logged with document ID, target model, and content hash
- No message content is stored in audit logs — only SHA-256 content hashes
- Audit log entries are persisted to SQLite and capped at 10,000 entries
- Query via `GET /api/security/audit-log` with pagination (`?limit=100&offset=0`)

### Input Validation

- All API endpoints use Pydantic models with field-level constraints
- Request body size limited to 5 MB
- ChromaDB collection names restricted to alphanumeric characters, hyphens, and underscores
- Rate limiting: 60 requests per minute per IP address

### Plugin Security

- Built-in plugins run in-process (trusted code)
- User-installed plugins are **rejected by default** (`allow_untrusted_plugins: false`)
- Plugin dependencies are validated at load time
- Plugin sandboxing via subprocess isolation is planned for v1.1

### Data Storage

- All data stored locally at `~/.yanmo/`
- SQLite database uses WAL journal mode
- ChromaDB vector embeddings are unencrypted (single-user local application)
- API keys are stored in the system keyring when available (falls back to environment variables)
- `.api_token` is protected with restrictive file permissions (Unix: 0600, Windows: hidden attribute)
