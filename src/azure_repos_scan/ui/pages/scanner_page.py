"""Página del escáner — busca versiones .NET en Azure DevOps."""

from __future__ import annotations

import math
from pathlib import Path
from typing import final

from PySide6.QtCore import QThread, Qt, Signal
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QFileDialog,
    QGroupBox,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QMessageBox,
    QProgressBar,
    QPushButton,
    QSplitter,
    QTableWidget,
    QTableWidgetItem,
    QTreeWidget,
    QTreeWidgetItem,
    QVBoxLayout,
    QWidget,
)
from pydantic import SecretStr

from azure_repos_scan.application.use_cases import (
    ExportResultsUseCase,
    ProgressCallback,
    SearchDotNetProjectsUseCase,
)
from azure_repos_scan.domain.models import (
    DEFAULT_BRANCHES,
    CodeSearchHit,
    DailyQueryRecord,
    DotNetVersion,
)
from azure_repos_scan.domain.ports import QueryStoragePort
from azure_repos_scan.infrastructure.adapters.azure_devops_client import HttpxAzureDevOpsClient
from azure_repos_scan.infrastructure.persistence.settings_store import SettingsStore
from azure_repos_scan.ui.styles import VERSION_COLORS

_COLUMNS = ["Repositorio", "Proyecto", "Versión .NET", "Branch"]
_DEFAULT_PAGE_SIZES = [25, 50, 100]


# ---------------------------------------------------------------------------
# Worker thread
# ---------------------------------------------------------------------------


@final
class _SearchWorker(QThread):
    """Hilo para ejecutar la búsqueda sin bloquear la UI."""

    progress = Signal(int, int, str)
    finished = Signal(object)
    error = Signal(str)

    def __init__(
        self,
        use_case: SearchDotNetProjectsUseCase,
        versions: list[DotNetVersion],
        project: str | None,
        branches: list[str],
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self._use_case = use_case
        self._versions = versions
        self._project = project
        self._branches = branches

    def run(self) -> None:
        try:
            cb: ProgressCallback = lambda cur, total, msg: self.progress.emit(cur, total, msg)
            record = self._use_case.execute(
                self._versions, self._project, on_progress=cb, branches=self._branches,
            )
            self.finished.emit(record)
        except Exception as exc:  # noqa: BLE001
            self.error.emit(str(exc))


# ---------------------------------------------------------------------------
# ScannerPage
# ---------------------------------------------------------------------------


@final
class ScannerPage(QWidget):
    """Página del escáner de versiones .NET."""

    status_message = Signal(str)
    """Señal para enviar mensajes al status bar de la ventana principal."""

    def __init__(
        self,
        pat: SecretStr,
        store: QueryStoragePort,
        settings_store: SettingsStore,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self._pat = pat
        self._store = store
        self._settings = settings_store
        self._worker: _SearchWorker | None = None

        # State
        self._all_hits: list[CodeSearchHit] = []
        self._filtered_hits: list[CodeSearchHit] = []
        self._current_page = 0
        self._page_size = 50

        self._setup_ui()
        self._restore_settings()
        self._refresh_history()

    # ------------------------------------------------------------------
    # UI setup
    # ------------------------------------------------------------------

    def _setup_ui(self) -> None:
        root = QVBoxLayout(self)
        root.setContentsMargins(16, 12, 16, 8)
        root.setSpacing(10)

        # -- Header
        title = QLabel("Escáner — .NET Version Scanner")
        title.setObjectName("title")
        root.addWidget(title)

        # -- Top section (config + versions)
        top_row = QHBoxLayout()
        top_row.setSpacing(12)
        top_row.addLayout(self._build_config_panel(), 1)
        top_row.addWidget(self._build_version_panel())
        top_row.addWidget(self._build_branch_panel())
        root.addLayout(top_row)

        # -- Action bar
        root.addLayout(self._build_action_bar())

        # -- Splitter (results | history)
        splitter = QSplitter(Qt.Orientation.Horizontal)
        splitter.addWidget(self._build_results_panel())
        splitter.addWidget(self._build_history_panel())
        splitter.setStretchFactor(0, 3)
        splitter.setStretchFactor(1, 1)
        root.addWidget(splitter, 1)

    def _build_config_panel(self) -> QVBoxLayout:
        group = QGroupBox("Configuración")
        layout = QVBoxLayout(group)
        layout.setSpacing(6)

        row_org = QHBoxLayout()
        row_org.addWidget(QLabel("Organización:"))
        self._input_org = QLineEdit()
        self._input_org.setPlaceholderText("mi-organizacion")
        row_org.addWidget(self._input_org)
        layout.addLayout(row_org)

        row_proj = QHBoxLayout()
        row_proj.addWidget(QLabel("Proyecto:"))
        self._input_project = QLineEdit()
        self._input_project.setPlaceholderText("(vacío = toda la organización)")
        row_proj.addWidget(self._input_project)
        layout.addLayout(row_proj)

        outer = QVBoxLayout()
        outer.addWidget(group)
        return outer

    def _build_version_panel(self) -> QGroupBox:
        group = QGroupBox("Versiones .NET")
        layout = QVBoxLayout(group)
        layout.setSpacing(4)

        ctrl_row = QHBoxLayout()
        btn_all = QPushButton("Todas")
        btn_all.setFixedWidth(70)
        btn_all.clicked.connect(self._select_all_versions)
        btn_none = QPushButton("Ninguna")
        btn_none.setObjectName("btn_secondary")
        btn_none.setFixedWidth(90)
        btn_none.clicked.connect(self._deselect_all_versions)
        ctrl_row.addWidget(btn_all)
        ctrl_row.addWidget(btn_none)
        ctrl_row.addStretch()
        layout.addLayout(ctrl_row)

        self._version_checks: dict[DotNetVersion, QCheckBox] = {}
        grid = QHBoxLayout()
        grid.setSpacing(10)
        for version in DotNetVersion:
            cb = QCheckBox(version.label)
            cb.setChecked(True)
            self._version_checks[version] = cb
            grid.addWidget(cb)
        layout.addLayout(grid)

        return group

    def _build_branch_panel(self) -> QGroupBox:
        group = QGroupBox("Branches")
        layout = QVBoxLayout(group)
        layout.setSpacing(4)

        ctrl_row = QHBoxLayout()
        btn_all = QPushButton("Todas")
        btn_all.setFixedWidth(70)
        btn_all.clicked.connect(self._select_all_branches)
        btn_none = QPushButton("Ninguna")
        btn_none.setObjectName("btn_secondary")
        btn_none.setFixedWidth(90)
        btn_none.clicked.connect(self._deselect_all_branches)
        ctrl_row.addWidget(btn_all)
        ctrl_row.addWidget(btn_none)
        ctrl_row.addStretch()
        layout.addLayout(ctrl_row)

        self._branch_checks: dict[str, QCheckBox] = {}
        grid = QHBoxLayout()
        grid.setSpacing(10)
        for branch in DEFAULT_BRANCHES:
            cb = QCheckBox(branch)
            cb.setChecked(True)
            self._branch_checks[branch] = cb
            grid.addWidget(cb)
        layout.addLayout(grid)

        return group

    def _build_action_bar(self) -> QHBoxLayout:
        row = QHBoxLayout()
        row.setSpacing(10)

        self._btn_scan = QPushButton("▶  Escanear")
        self._btn_scan.setFixedWidth(160)
        self._btn_scan.clicked.connect(self._on_scan)
        row.addWidget(self._btn_scan)

        self._progress = QProgressBar()
        self._progress.setRange(0, 100)
        self._progress.setValue(0)
        self._progress.setTextVisible(True)
        self._progress.setFormat("")
        row.addWidget(self._progress, 1)

        self._lbl_counter = QLabel("")
        self._lbl_counter.setObjectName("counter")
        row.addWidget(self._lbl_counter)

        return row

    def _build_results_panel(self) -> QWidget:
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(6)

        filter_row = QHBoxLayout()
        filter_row.addWidget(QLabel("Filtrar versión:"))
        self._combo_filter = QComboBox()
        self._combo_filter.addItem("Todas", None)
        for v in DotNetVersion:
            self._combo_filter.addItem(v.label, v)
        self._combo_filter.currentIndexChanged.connect(self._on_filter_changed)
        filter_row.addWidget(self._combo_filter)
        filter_row.addStretch()

        self._btn_export = QPushButton("📥  Exportar Excel")
        self._btn_export.setObjectName("btn_secondary")
        self._btn_export.setFixedWidth(150)
        self._btn_export.setEnabled(False)
        self._btn_export.clicked.connect(self._on_export)
        filter_row.addWidget(self._btn_export)
        layout.addLayout(filter_row)

        self._table = QTableWidget()
        self._table.setColumnCount(len(_COLUMNS))
        self._table.setHorizontalHeaderLabels(_COLUMNS)
        self._table.setAlternatingRowColors(True)
        self._table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self._table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self._table.verticalHeader().setVisible(False)

        header = self._table.horizontalHeader()
        header.setStretchLastSection(False)
        header.setSectionResizeMode(QHeaderView.ResizeMode.Interactive)
        header.setSectionResizeMode(3, QHeaderView.ResizeMode.Stretch)
        layout.addWidget(self._table, 1)

        pag_row = QHBoxLayout()
        self._btn_prev = QPushButton("◀ Anterior")
        self._btn_prev.setObjectName("btn_secondary")
        self._btn_prev.setFixedWidth(100)
        self._btn_prev.clicked.connect(self._on_prev_page)
        pag_row.addWidget(self._btn_prev)

        self._lbl_page = QLabel("Página 0 de 0")
        self._lbl_page.setAlignment(Qt.AlignmentFlag.AlignCenter)
        pag_row.addWidget(self._lbl_page, 1)

        self._btn_next = QPushButton("Siguiente ▶")
        self._btn_next.setObjectName("btn_secondary")
        self._btn_next.setFixedWidth(100)
        self._btn_next.clicked.connect(self._on_next_page)
        pag_row.addWidget(self._btn_next)

        pag_row.addWidget(QLabel("  Filas:"))
        self._combo_page_size = QComboBox()
        for size in _DEFAULT_PAGE_SIZES:
            self._combo_page_size.addItem(str(size), size)
        self._combo_page_size.setCurrentIndex(1)
        self._combo_page_size.currentIndexChanged.connect(self._on_page_size_changed)
        pag_row.addWidget(self._combo_page_size)
        layout.addLayout(pag_row)

        return panel

    def _build_history_panel(self) -> QGroupBox:
        group = QGroupBox("Historial de consultas")
        layout = QVBoxLayout(group)
        layout.setContentsMargins(8, 16, 8, 8)

        self._history_tree = QTreeWidget()
        self._history_tree.setHeaderLabels(["Fecha", "Resultados"])
        self._history_tree.header().setStretchLastSection(True)
        self._history_tree.header().setSectionResizeMode(
            0, QHeaderView.ResizeMode.ResizeToContents,
        )
        self._history_tree.itemDoubleClicked.connect(self._on_history_load)
        layout.addWidget(self._history_tree)

        btn_refresh = QPushButton("Actualizar historial")
        btn_refresh.setObjectName("btn_secondary")
        btn_refresh.clicked.connect(self._refresh_history)
        layout.addWidget(btn_refresh)

        return group

    # ------------------------------------------------------------------
    # Settings persistence
    # ------------------------------------------------------------------

    def _restore_settings(self) -> None:
        self._input_org.setText(self._settings.get("organization"))
        self._input_project.setText(self._settings.get("project"))

    def _save_settings(self) -> None:
        self._settings.set("organization", self._input_org.text().strip())
        self._settings.set("project", self._input_project.text().strip())

    # ------------------------------------------------------------------
    # Version selection helpers
    # ------------------------------------------------------------------

    def _select_all_versions(self) -> None:
        for cb in self._version_checks.values():
            cb.setChecked(True)

    def _deselect_all_versions(self) -> None:
        for cb in self._version_checks.values():
            cb.setChecked(False)

    def _get_selected_versions(self) -> list[DotNetVersion]:
        return [v for v, cb in self._version_checks.items() if cb.isChecked()]

    # ------------------------------------------------------------------
    # Branch selection helpers
    # ------------------------------------------------------------------

    def _select_all_branches(self) -> None:
        for cb in self._branch_checks.values():
            cb.setChecked(True)

    def _deselect_all_branches(self) -> None:
        for cb in self._branch_checks.values():
            cb.setChecked(False)

    def _get_selected_branches(self) -> list[str]:
        return [b for b, cb in self._branch_checks.items() if cb.isChecked()]

    # ------------------------------------------------------------------
    # Scan
    # ------------------------------------------------------------------

    def _on_scan(self) -> None:
        org = self._input_org.text().strip()
        if not org:
            QMessageBox.warning(self, "Validación", "La organización es requerida.")
            return

        versions = self._get_selected_versions()
        if not versions:
            QMessageBox.warning(self, "Validación", "Selecciona al menos una versión.")
            return

        project = self._input_project.text().strip() or None
        self._save_settings()

        self._btn_scan.setEnabled(False)
        self._progress.setRange(0, 0)
        self._progress.setFormat("Iniciando búsqueda...")
        self.status_message.emit("Búsqueda en curso...")

        client = HttpxAzureDevOpsClient(
            organization=org,
            pat=self._pat,
        )
        branches = self._get_selected_branches()
        use_case = SearchDotNetProjectsUseCase(client, self._store, org)
        self._worker = _SearchWorker(use_case, versions, project, branches, parent=self)
        self._worker.progress.connect(self._on_progress)
        self._worker.finished.connect(self._on_search_complete)
        self._worker.error.connect(self._on_search_error)
        self._worker.start()

    def _on_progress(self, current: int, total: int, message: str) -> None:
        if total > 0:
            self._progress.setRange(0, total)
            self._progress.setValue(current)
            pct = int(current / total * 100)
            self._progress.setFormat(f"{pct}% — {message}")
        else:
            self._progress.setFormat(message)

    def _on_search_complete(self, record: object) -> None:
        if not isinstance(record, DailyQueryRecord):
            return
        self._btn_scan.setEnabled(True)
        self._progress.setRange(0, 100)
        self._progress.setValue(100)
        self._progress.setFormat("Completado")

        self._all_hits = record.get_all_hits()
        self._apply_filter()
        self._refresh_history()
        self._btn_export.setEnabled(bool(self._all_hits))

        total = len(self._all_hits)
        self._lbl_counter.setText(f"{total} resultado{'s' if total != 1 else ''}")
        self.status_message.emit(f"Búsqueda completada — {total} resultados")

    def _on_search_error(self, message: str) -> None:
        self._btn_scan.setEnabled(True)
        self._progress.setRange(0, 100)
        self._progress.setValue(0)
        self._progress.setFormat("")
        self.status_message.emit(f"Error: {message}")
        QMessageBox.critical(self, "Error de búsqueda", message)

    # ------------------------------------------------------------------
    # Filtering
    # ------------------------------------------------------------------

    def _on_filter_changed(self) -> None:
        self._apply_filter()

    def _apply_filter(self) -> None:
        selected = self._combo_filter.currentData()
        if selected is None:
            self._filtered_hits = list(self._all_hits)
        else:
            self._filtered_hits = [h for h in self._all_hits if h.dotnet_version == selected]
        self._current_page = 0
        self._render_table()

    # ------------------------------------------------------------------
    # Pagination
    # ------------------------------------------------------------------

    def _total_pages(self) -> int:
        return max(1, math.ceil(len(self._filtered_hits) / self._page_size))

    def _on_prev_page(self) -> None:
        if self._current_page > 0:
            self._current_page -= 1
            self._render_table()

    def _on_next_page(self) -> None:
        if self._current_page < self._total_pages() - 1:
            self._current_page += 1
            self._render_table()

    def _on_page_size_changed(self) -> None:
        self._page_size = self._combo_page_size.currentData() or 50
        self._current_page = 0
        self._render_table()

    # ------------------------------------------------------------------
    # Table rendering
    # ------------------------------------------------------------------

    def _render_table(self) -> None:
        start = self._current_page * self._page_size
        end = start + self._page_size
        page_hits = self._filtered_hits[start:end]

        self._table.setRowCount(len(page_hits))
        for row, hit in enumerate(page_hits):
            self._table.setItem(row, 0, QTableWidgetItem(hit.repository_name))
            self._table.setItem(row, 1, QTableWidgetItem(hit.project_name))

            version_item = QTableWidgetItem(hit.dotnet_version.label)
            color = VERSION_COLORS.get(hit.dotnet_version.moniker, "#0078D4")
            version_item.setForeground(self._make_color(color))
            self._table.setItem(row, 2, version_item)

            self._table.setItem(row, 3, QTableWidgetItem(hit.branch))

        self._table.resizeColumnsToContents()
        self._table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)

        total_pages = self._total_pages()
        self._lbl_page.setText(
            f"Página {self._current_page + 1} de {total_pages}"
            f"  ({len(self._filtered_hits)} registros)"
        )
        self._btn_prev.setEnabled(self._current_page > 0)
        self._btn_next.setEnabled(self._current_page < total_pages - 1)

    @staticmethod
    def _make_color(hex_color: str) -> QColor:
        return QColor(hex_color)

    # ------------------------------------------------------------------
    # History
    # ------------------------------------------------------------------

    def _refresh_history(self) -> None:
        self._history_tree.clear()
        records = self._store.load_queries()
        records.sort(key=lambda r: r.query_date, reverse=True)
        for record in records:
            date_str = record.query_date.isoformat()
            total = record.total_results
            top_item = QTreeWidgetItem([date_str, str(total)])
            for moniker, hits in record.results_by_version.items():
                child = QTreeWidgetItem([moniker, str(len(hits))])
                top_item.addChild(child)
            self._history_tree.addTopLevelItem(top_item)

    def _on_history_load(self, item: QTreeWidgetItem, _column: int) -> None:
        if item.parent() is not None:  # type: ignore[truthy-function]
            return
        date_str = item.text(0)
        from datetime import date

        query_date = date.fromisoformat(date_str)
        record = self._store.get_query_by_date(query_date)
        if record is None:
            return
        self._all_hits = record.get_all_hits()
        self._combo_filter.setCurrentIndex(0)
        self._apply_filter()
        self._btn_export.setEnabled(bool(self._all_hits))
        total = len(self._all_hits)
        self._lbl_counter.setText(f"{total} resultado{'s' if total != 1 else ''}")
        self.status_message.emit(f"Cargado historial del {date_str} — {total} resultados")

    # ------------------------------------------------------------------
    # Export
    # ------------------------------------------------------------------

    def _on_export(self) -> None:
        if not self._filtered_hits:
            return
        path, _ = QFileDialog.getSaveFileName(
            self, "Exportar Excel", "resultados_dotnet.xlsx", "Excel (*.xlsx)"
        )
        if not path:
            return
        use_case = ExportResultsUseCase()
        output = use_case.execute(self._filtered_hits, Path(path))
        self.status_message.emit(f"Exportado: {output}")
        QMessageBox.information(self, "Exportación", f"Archivo guardado en:\n{output}")
