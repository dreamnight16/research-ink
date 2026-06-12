**Language:** [English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-Hant.md) | [日本語](README.ja.md)

# Yanmo (研墨)

[![Tests](https://img.shields.io/badge/tests-75%20passed-green)](https://github.com/sixtdreanight/Yanmo/actions)
[![Python](https://img.shields.io/badge/python-3.11+-blue)](https://www.python.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Android%20%7C%20iOS-lightgrey)]()

**A research assistant that runs on your own machine. Your data stays put.**

Unlike general-purpose AI chat, Yanmo is purpose-built for researchers: deconstruct vague advisor directions, track papers across multiple sources, cross-validate formula derivations, evaluate project proposals objectively, and assist with thesis writing. Five purpose-built tools, each with its own interface — not crammed into a single chat box.

Three core principles: **data stays local, formulas must not be wrong, plugin system for extensibility.** Plus AI-powered dedup, research gap finder, and AI-text humanizer.

Desktop application, not a web app. Runs on Windows, Linux, and macOS.

---

## Why Yanmo?

| | Yanmo | General AI Chat | Research Rabbit | Zotero |
|---|---|---|---|---|
| **Data stays local** | Yes (Ollama) | No | No | Partial |
| **Formula verification** | Dual-channel (SymPy + basic) | No | No | No |
| **Multi-source paper search** | ArXiv + Semantic Scholar + DBLP | No | Yes | No |
| **Triple dedup** | Title + arxiv_id + DOI | N/A | Partial | Partial |
| **AI-text humanizer** | Built-in (Chinese + English) | No | No | No |
| **Plugin extensibility** | Yes | No | No | Yes |
| **Advisor direction decoder** | Yes | Prompt engineering | No | No |

---

## Who is This For?

- **Graduate students** drowning in advisor feedback, paper tracking, and thesis writing
- **Research engineers** who need formula safety guarantees and can't send proprietary work to cloud APIs
- **Independent researchers** who want a unified toolchain without switching between 5 different apps

---

## Quick Start

Requires Python 3.11+, Node.js 18+, and Ollama.

**One-shot install:**
```bash
# Linux / macOS
curl -fsSL https://raw.githubusercontent.com/sixtdreanight/Yanmo/master/scripts/install.sh | bash

# Windows (PowerShell)
Invoke-WebRequest https://raw.githubusercontent.com/sixtdreanight/Yanmo/master/scripts/install.ps1 | Invoke-Expression
```

**Manual install:**
```bash
pip install -e ".[dev]"
python -m backend.main
```

Backend runs at `127.0.0.1:8000`. Then start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

**Docker:**
```bash
docker compose up
```

### Desktop App

Download the installer for your platform from [Releases](https://github.com/sixtdreanight/Yanmo/releases):

| Platform | Format | Size |
|----------|--------|------|
| Windows 10/11 | `.msi` | ~50MB |
| macOS 12+ | `.dmg` | ~50MB |
| Linux (x86_64) | `.AppImage` / `.deb` | ~50MB |

> **Note:** The desktop app bundles the React frontend with a Tauri shell. Python 3.11+ and Ollama are required as runtime dependencies (not bundled).

### Mobile App (Companion)

The mobile app connects to your desktop backend over the same WiFi network:

| Platform | Format |
|----------|--------|
| Android 8+ | `.apk` |
| iOS 16+ | Developer-signed `.ipa` |

1. On desktop: go to **Settings → 移动端配对**, generate a pairing code
2. On mobile: enter the desktop IP and pairing code to connect
3. Your phone becomes a remote control for all desktop features

### Desktop App (Legacy / Qt)

> **Note:** The Qt frontend (`frontend_qt/`) is deprecated. Use the Tauri desktop app or the React Web app instead.

---

## Features

Five tabs across the top (+ chat panel on the right): Advisor Decoder, Paper Tracker, Project Reviewer, Formula Validator, Thesis Writer.

### Advisor Decoder

Paste your advisor's words. Auto-decomposes into executable tasks with ordering and time estimates. Each task expands to show sub-steps and suggested resources. Advisor data is classified as confidential, forced to local model only.

### Paper Tracker

Set research keywords. Parallel fetches from ArXiv, Semantic Scholar, and DBLP. Papers displayed in a feed with one-click Chinese summaries. Auto-updates every hour in the background.

Triple dedup (title similarity + arxiv_id + DOI) ensures no preprint appears twice. Click "Find Ideas" to analyze the current paper list across 10+ dimensions (theory, efficiency, robustness, fairness, etc.), flagging research gaps sorted by confidence.

### Project Reviewer

Submit a project name and description. Scores on three dimensions — novelty, soundness, methodology — with specific weaknesses and improvement suggestions.

### Formula Validator

Split-pane LaTeX source and rendered preview. Submit for dual-channel validation: basic checks (bracket matching, division by zero, domain) + SymPy symbolic computation. Both channels must pass for a green light. No LLM involved — pure local symbolic computation.

### Thesis Writer

Generates structured outlines with estimated word counts. Supports BibTeX paste-and-parse. Bottom panel has an "AI-text humanizer" tool that detects AI writing traces and auto-cleans.

---

## Plugin System

Plugins live in `~/.yanmo/plugins/`. Load them via Settings → Plugin Manager. Minimum requirement: `plugin.toml` + `plugin.py`. See `plugin_schema/API.md` for the development guide. Supports lifecycle management, hot-load/unload, and event bus.

---

## Architecture

| Component | Description |
|---|---|
| Plugin Engine | Lifecycle management, hot-load/unload, event bus |
| Task Scheduler | Auto-fetch papers hourly |
| WebSocket | Real-time push of paper updates to frontend |
| Security Layer | 3-tier data classification + cloud operation interception + audit logs |
| Storage | SQLite (structured) + ChromaDB (vectors) + local files |

## Data Security

Default: all operations use local Ollama. Cloud API keys are optional — if you don't fill them in, nothing leaves your machine.

- Confidential data is forced local; cloud operations are auto-blocked
- Cloud outbound traffic has audit logs
- Data stored in `~/.yanmo/`, backup anytime

## Tech Stack

| Layer | Stack |
|---|---|
| Backend | Python, FastAPI, SQLite, ChromaDB, SymPy, SciPy |
| Frontend | React 18, TypeScript, Vite, KaTeX |
| Desktop Shell | Tauri (Rust) |
| Fonts | Noto Sans SC, Noto Serif SC |

## Related

- [myBlog](https://github.com/sixtdreanight/myBlog) — Author's blog, more research-related articles

## License

MIT

---

<div align="center">

**Language / 语言 / 言語**

[**English**](README.md) | [**简体中文**](README.zh-CN.md) | [**繁體中文**](README.zh-Hant.md) | [**日本語**](README.ja.md)

</div>
