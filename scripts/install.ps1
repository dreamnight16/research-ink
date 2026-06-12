# Yanmo (研墨) — One-shot install script for Windows
Write-Host "=== Yanmo Installer ==="
Write-Host ""

# Check Python
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "ERROR: Python 3.11+ is required. Install it from https://python.org"
    exit 1
}
Write-Host "[OK] Python: $(python --version)"

# Check Node.js
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "WARNING: Node.js not found. Frontend dev server won't work."
    Write-Host "  Install from https://nodejs.org"
} else {
    Write-Host "[OK] Node.js: $(node --version)"
}

# Check Ollama
$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollama) {
    Write-Host "WARNING: Ollama not found. LLM features require Ollama."
    Write-Host "  Install from https://ollama.com"
} else {
    Write-Host "[OK] Ollama found"
}

Write-Host ""
Write-Host "Installing Python dependencies..."
pip install -e ".[dev]"

Write-Host ""
Write-Host "Installing frontend dependencies..."
if (Test-Path frontend) {
    Push-Location frontend
    npm install
    Pop-Location
}

Write-Host ""
Write-Host "=== Done ==="
Write-Host "Start the backend:   python -m backend.main"
Write-Host "Start the frontend:  cd frontend; npm run dev"
Write-Host "Open:                http://localhost:5173"
