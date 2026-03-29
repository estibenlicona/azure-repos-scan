"""Bootstrap: inyección de dependencias y arranque de la aplicación."""

from __future__ import annotations

import sys


def main() -> None:
    """Punto de entrada principal de la aplicación."""
    from PySide6.QtWidgets import QApplication

    from azure_repos_scan.infrastructure.config import get_settings
    from azure_repos_scan.infrastructure.persistence.query_store import JsonQueryStore
    from azure_repos_scan.infrastructure.persistence.settings_store import SettingsStore
    from azure_repos_scan.ui.app import MainWindow

    settings = get_settings()
    settings_store = SettingsStore()
    store = JsonQueryStore()

    app = QApplication(sys.argv)
    window = MainWindow(
        pat=settings.azure_devops_pat,
        store=store,
        settings_store=settings_store,
    )
    window.show()
    sys.exit(app.exec())
