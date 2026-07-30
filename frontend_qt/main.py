"""研墨 — Native Qt Desktop Application. Cross-platform: Windows, macOS, Linux."""

import sys
import platform
from pathlib import Path

# Ensure project root is on path
sys.path.insert(0, str(Path(__file__).parent.parent))

from PySide6.QtWidgets import QApplication
from PySide6.QtCore import Qt

from frontend_qt.main_window import MainWindow


def main():
    # macOS: use Fusion style for consistent cross-platform look
    if platform.system() == "Darwin":
        sys.argv += ["-style", "Fusion"]

    # High DPI support
    QApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )
    app = QApplication(sys.argv)
    app.setApplicationName("研墨")
    app.setOrganizationName("YanMo")
    app.setOrganizationDomain("research-ink.app")

    window = MainWindow()
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
