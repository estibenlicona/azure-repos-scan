"""Tabla tipo árbol agrupada por repositorio para drill-down."""

from __future__ import annotations

from typing import Sequence, final

from PySide6.QtGui import QColor
from PySide6.QtWidgets import QHeaderView, QTreeWidget, QTreeWidgetItem, QWidget

from azure_repos_scan.domain.models import RepoSummary
from azure_repos_scan.ui.styles import VERSION_COLORS


@final
class RepoTreeTable(QTreeWidget):
    """Árbol de repos con sus csprojs como hijos (drill-down)."""

    _HEADERS = ["Repositorio", "Proyecto", "Versión .NET", "Branch"]

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setHeaderLabels(self._HEADERS)
        self.setAlternatingRowColors(True)
        self.setRootIsDecorated(False)
        self.setUniformRowHeights(True)

        header = self.header()
        header.setStretchLastSection(False)
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        for col in range(1, len(self._HEADERS)):
            header.setSectionResizeMode(col, QHeaderView.ResizeMode.ResizeToContents)

    def load_summaries(self, summaries: Sequence[RepoSummary]) -> None:
        """Poblar el árbol con los resúmenes de repositorios."""
        self.clear()

        sorted_repos = sorted(summaries, key=lambda s: s.repository_name.lower())
        for repo in sorted_repos:
            item = QTreeWidgetItem([
                repo.repository_name,
                repo.project_name,
                repo.oldest_version.label,
                ", ".join(sorted(repo.branches)),
            ])

            color = VERSION_COLORS.get(repo.oldest_version.moniker, "#0078D4")
            item.setForeground(2, self._make_color(color))

            self.addTopLevelItem(item)

    @staticmethod
    def _make_color(hex_color: str) -> QColor:
        return QColor(hex_color)
