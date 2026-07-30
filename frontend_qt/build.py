"""PyInstaller build script for 研墨 — cross-platform packaging.

Usage:
    python frontend_qt/build.py        # Build for current platform
    python frontend_qt/build.py --onefile  # Single executable

Output:
    Windows: dist/研墨.exe
    macOS:   dist/研墨.app
    Linux:   dist/研墨
"""

import platform
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
SYSTEM = platform.system()

BASE_ARGS = [
    sys.executable, "-m", "PyInstaller",
    "--name", "研墨",
    "--noconfirm",
    "--clean",
    "--add-data", f"{ROOT / 'backend'}{';' if SYSTEM == 'Windows' else ':'}backend",
    "--hidden-import", "backend.core.event_bus",
    "--hidden-import", "backend.core.config",
    "--hidden-import", "backend.core.security",
    "--hidden-import", "backend.core.storage",
    "--hidden-import", "backend.core.llm_router",
    "--hidden-import", "backend.core.engine",
    "--hidden-import", "backend.core.scheduler",
    "--hidden-import", "backend.plugins",
    "--hidden-import", "chromadb",
    "--hidden-import", "sympy",
    "--hidden-import", "feedparser",
    "--hidden-import", "aiohttp",
    "--hidden-import", "sentence_transformers",
    "--hidden-import", "PySide6",
    "--collect-all", "chromadb",
    "--collect-all", "sentence_transformers",
]

PLATFORM_ARGS = {
    "Windows": [
        "--windowed",
        "--icon", str(ROOT / "frontend/src-tauri/icons/icon.ico"),
    ],
    "Darwin": [
        "--windowed",
        "--icon", str(ROOT / "frontend/src-tauri/icons/icon.icns"),
        "--osx-bundle-identifier", "com.researchink.app",
    ],
    "Linux": [
        "--windowed",
    ],
}

EXTRA = PLATFORM_ARGS.get(SYSTEM, [])

if "--onefile" in sys.argv:
    EXTRA.append("--onefile")

ENTRY = str(ROOT / "frontend_qt" / "main.py")


def build():
    args = BASE_ARGS + EXTRA + [ENTRY]
    print(f"Building for {SYSTEM}...")
    print(f"PyInstaller args: {' '.join(args)}")
    subprocess.run(args, cwd=str(ROOT), check=True)

    if SYSTEM == "Windows":
        print("\nOutput: dist/研墨.exe")
    elif SYSTEM == "Darwin":
        print("\nOutput: dist/研墨.app")
        print("  To create DMG: hdiutil create -volname 研墨 -srcfolder dist/研墨.app dist/研墨.dmg")
    else:
        print("\nOutput: dist/研墨")
        print("  To create AppImage: use appimagetool")


if __name__ == "__main__":
    build()
