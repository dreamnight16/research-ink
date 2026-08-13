#!/usr/bin/env bash
# 研墨 (Yanmo) — one-shot install script
# curl -fsSL https://raw.githubusercontent.com/dreamnight16/Yanmo/master/scripts/install.sh | bash
set -euo pipefail

echo "=== 研墨 Yanmo Installer ==="
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "ERROR: Python 3.11+ is required. Install it from https://python.org"
    exit 1
fi
echo "[OK] Python: $(python3 --version)"

# Check Node.js
if ! command -v node &>/dev/null; then
    echo "WARNING: Node.js not found. Frontend dev server won't work."
    echo "  Install from https://nodejs.org"
else
    echo "[OK] Node.js: $(node --version)"
fi

# Check Ollama
if ! command -v ollama &>/dev/null; then
    echo "WARNING: Ollama not found. LLM features require Ollama."
    echo "  Install from https://ollama.com"
else
    echo "[OK] Ollama: $(ollama --version 2>&1 | head -1)"
fi

echo ""
echo "Installing Python dependencies..."
pip install -e ".[dev]"

echo ""
echo "Installing frontend dependencies..."
if [ -d frontend ]; then
    cd frontend && npm install && cd ..
fi

echo ""
echo "=== Done ==="
echo "Start the backend:   python -m backend.main"
echo "Start the frontend:  cd frontend && npm run dev"
echo "Open:                http://localhost:5173"
