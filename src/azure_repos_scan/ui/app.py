"""Ventana principal — shell con sidebar y páginas."""

from __future__ import annotations

from typing import final

from PySide6.QtWidgets import (
    QHBoxLayout,
    QMainWindow,
    QStackedWidget,
    QStatusBar,
    QWidget,
)
from pydantic import SecretStr

from azure_repos_scan.domain.ports import QueryStoragePort
from azure_repos_scan.infrastructure.persistence.settings_store import SettingsStore
from azure_repos_scan.ui.pages.dashboard_page import DashboardPage
from azure_repos_scan.ui.pages.scanner_page import ScannerPage
from azure_repos_scan.ui.styles import GLOBAL_STYLE
from azure_repos_scan.ui.widgets.sidebar import SidebarWidget


@final
class MainWindow(QMainWindow):
    """Ventana principal: sidebar de navegación + páginas apiladas."""

    def __init__(
        self,
        pat: SecretStr,
        store: QueryStoragePort,
        settings_store: SettingsStore,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self._store = store

        self.setWindowTitle("Azure Repos Scan — .NET Version Scanner")
        self.setMinimumSize(1200, 750)
        self.setStyleSheet(GLOBAL_STYLE)

        # Central layout
        central = QWidget()
        self.setCentralWidget(central)
        layout = QHBoxLayout(central)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Sidebar
        self._sidebar = SidebarWidget()
        self._sidebar.page_changed.connect(self._on_page_changed)
        layout.addWidget(self._sidebar)

        # Stacked pages
        self._stack = QStackedWidget()
        layout.addWidget(self._stack, 1)

        # Page 0: Dashboard (default)
        self._dashboard_page = DashboardPage(store=store)
        self._stack.addWidget(self._dashboard_page)

        # Page 1: Scanner
        self._scanner_page = ScannerPage(
            pat=pat,
            store=store,
            settings_store=settings_store,
        )
        self._scanner_page.status_message.connect(self._on_status_message)
        self._stack.addWidget(self._scanner_page)

        # Status bar
        self._status_bar = QStatusBar()
        self.setStatusBar(self._status_bar)
        self._status_bar.showMessage("Listo")

        # Start on dashboard
        self._stack.setCurrentIndex(0)

    def _on_page_changed(self, index: int) -> None:
        """Cambio de página desde el sidebar."""
        self._stack.setCurrentIndex(index)
        # Refresh dashboard when switching to it
        if index == 0:
            self._dashboard_page.refresh()

    def _on_status_message(self, message: str) -> None:
        """Recibir mensaje de status de las páginas hijas."""
        self._status_bar.showMessage(message)
