"""Página de reportes / dashboard con gráficos Plotly y drill-down."""

from __future__ import annotations

from pathlib import Path
from typing import final

import plotly.graph_objects as go  # pyright: ignore[reportMissingTypeStubs]
from PySide6.QtCore import Qt
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWidgets import (
    QComboBox,
    QFileDialog,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QMenu,
    QMessageBox,
    QPushButton,
    QScrollArea,
    QSizePolicy,
    QVBoxLayout,
    QWidget,
)

from azure_repos_scan.application.use_cases import (
    BuildDashboardDataUseCase,
    DashboardData,
    ExportDashboardUseCase,
    ExportResultsUseCase,
)
from azure_repos_scan.domain.models import CodeSearchHit, DotNetVersion, RepoSummary
from azure_repos_scan.domain.ports import QueryStoragePort
from azure_repos_scan.ui.styles import (
    ACCENT_COLOR,
    BG_PRIMARY,
    BG_SECONDARY,
    TEXT_PRIMARY,
    TEXT_SECONDARY,
    VERSION_COLORS,
)
from azure_repos_scan.ui.widgets.kpi_card import KpiCard
from azure_repos_scan.ui.widgets.repo_tree_table import RepoTreeTable

# ---------------------------------------------------------------------------
# Plotly HTML helper
# ---------------------------------------------------------------------------

_PLOTLY_CDN = "https://cdn.plot.ly/plotly-2.35.2.min.js"


def _render_plotly_html(fig: go.Figure) -> str:  # pyright: ignore[reportMissingTypeStubs]
    """Generar HTML completo con un gráfico Plotly embebido."""
    fig.update_layout(  # pyright: ignore[reportUnknownMemberType]
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(family="Segoe UI", color=TEXT_PRIMARY, size=12),
        margin=dict(l=40, r=20, t=40, b=40),
        legend=dict(
            font=dict(color=TEXT_PRIMARY, size=11),
            bgcolor="rgba(0,0,0,0)",
        ),
    )
    inner_html: str = fig.to_html(  # pyright: ignore[reportUnknownMemberType]
        include_plotlyjs="cdn",
        full_html=False,
        config={"displayModeBar": False, "responsive": True},
    )
    return f"""<!DOCTYPE html>
<html><head>
<script src="{_PLOTLY_CDN}"></script>
<style>body{{margin:0;background:transparent;overflow:hidden}}</style>
</head><body>{inner_html}</body></html>"""


@final
class DashboardPage(QWidget):
    """Página del dashboard de reportes con Plotly interactivo."""

    def __init__(
        self,
        store: QueryStoragePort,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self._store = store
        self._use_case = BuildDashboardDataUseCase(store)
        self._current_data: DashboardData | None = None
        self._all_summaries: list[RepoSummary] = []
        self._setup_ui()
        self._load_dates()

    # ------------------------------------------------------------------
    # UI setup
    # ------------------------------------------------------------------

    def _setup_ui(self) -> None:
        root = QVBoxLayout(self)
        root.setContentsMargins(20, 16, 20, 8)
        root.setSpacing(12)

        # Toolbar
        root.addLayout(self._build_toolbar())

        # Scroll area for dashboard content
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QScrollArea.Shape.NoFrame)

        self._scroll_content = QWidget()
        self._content_layout = QVBoxLayout(self._scroll_content)
        self._content_layout.setContentsMargins(0, 0, 0, 0)
        self._content_layout.setSpacing(16)

        # KPI Cards
        self._build_kpi_section()

        # Charts row (donuts)
        self._build_charts_section()

        # Evolution area chart
        self._build_evolution_section()

        # Drill-down
        self._build_drilldown_section()

        self._content_layout.addStretch()
        scroll.setWidget(self._scroll_content)
        root.addWidget(scroll, 1)

    def _build_toolbar(self) -> QHBoxLayout:
        row = QHBoxLayout()
        row.setSpacing(12)

        title = QLabel("Dashboard — Reportes .NET")
        title.setObjectName("title")
        row.addWidget(title)
        row.addStretch()

        row.addWidget(QLabel("Fecha:"))
        self._combo_date = QComboBox()
        self._combo_date.setMinimumWidth(140)
        self._combo_date.currentIndexChanged.connect(self._on_date_changed)
        row.addWidget(self._combo_date)

        row.addWidget(QLabel("Branch:"))
        self._combo_branch = QComboBox()
        self._combo_branch.setMinimumWidth(120)
        self._combo_branch.currentIndexChanged.connect(self._on_branch_changed)
        row.addWidget(self._combo_branch)

        self._btn_export = QPushButton("Exportar")
        self._btn_export.setObjectName("btn_secondary")
        self._btn_export.setFixedWidth(120)
        self._btn_export.clicked.connect(self._show_export_menu)
        row.addWidget(self._btn_export)

        return row

    def _build_kpi_section(self) -> None:
        row = QHBoxLayout()
        row.setSpacing(14)

        self._kpi_repos = KpiCard("Repositorios", "—", accent="cyan")
        self._kpi_csprojs = KpiCard("Proyectos .csproj", "—", accent="purple")
        self._kpi_top_version = KpiCard("Versión dominante", "—", accent="cyan")
        self._kpi_branches = KpiCard("Branches", "—", accent="purple")

        row.addWidget(self._kpi_repos)
        row.addWidget(self._kpi_csprojs)
        row.addWidget(self._kpi_top_version)
        row.addWidget(self._kpi_branches)

        self._content_layout.addLayout(row)

    def _build_charts_section(self) -> None:
        row = QHBoxLayout()
        row.setSpacing(16)

        # Donut: repos by version
        version_group = QGroupBox("Repositorios por versión .NET")
        version_layout = QVBoxLayout(version_group)
        version_layout.setContentsMargins(4, 4, 4, 4)
        self._version_web = QWebEngineView()
        self._version_web.setMinimumHeight(320)
        self._version_web.setSizePolicy(
            QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed,
        )
        self._version_web.page().setBackgroundColor(Qt.GlobalColor.transparent)
        version_layout.addWidget(self._version_web)
        row.addWidget(version_group, 1)

        # Donut: repos by branch
        branch_group = QGroupBox("Repositorios por branch")
        branch_layout = QVBoxLayout(branch_group)
        branch_layout.setContentsMargins(4, 4, 4, 4)
        self._branch_web = QWebEngineView()
        self._branch_web.setMinimumHeight(320)
        self._branch_web.setSizePolicy(
            QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed,
        )
        self._branch_web.page().setBackgroundColor(Qt.GlobalColor.transparent)
        branch_layout.addWidget(self._branch_web)
        row.addWidget(branch_group, 1)

        self._content_layout.addLayout(row)

    def _build_evolution_section(self) -> None:
        group = QGroupBox("Evolución mensual")
        layout = QVBoxLayout(group)
        layout.setContentsMargins(4, 4, 4, 4)

        self._evo_web = QWebEngineView()
        self._evo_web.setMinimumHeight(280)
        self._evo_web.setSizePolicy(
            QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed,
        )
        self._evo_web.page().setBackgroundColor(Qt.GlobalColor.transparent)
        layout.addWidget(self._evo_web)

        self._content_layout.addWidget(group)

    def _build_drilldown_section(self) -> None:
        self._drilldown_group = QGroupBox("Detalle por repositorio")
        layout = QVBoxLayout(self._drilldown_group)

        header_row = QHBoxLayout()
        self._drilldown_label = QLabel("")
        self._drilldown_label.setObjectName("counter")
        header_row.addWidget(self._drilldown_label)
        header_row.addStretch()

        self._btn_export_drill = QPushButton("Exportar Excel")
        self._btn_export_drill.setObjectName("btn_secondary")
        self._btn_export_drill.setFixedWidth(150)
        self._btn_export_drill.clicked.connect(self._export_drilldown)
        header_row.addWidget(self._btn_export_drill)
        layout.addLayout(header_row)

        self._repo_tree = RepoTreeTable()
        self._repo_tree.setMinimumHeight(200)
        layout.addWidget(self._repo_tree)

        self._drilldown_group.setVisible(False)
        self._content_layout.addWidget(self._drilldown_group)

    # ------------------------------------------------------------------
    # Data loading
    # ------------------------------------------------------------------

    def refresh(self) -> None:
        """Recargar datos y fechas (llamar al cambiar a esta página)."""
        self._load_dates()

    def _load_dates(self) -> None:
        self._combo_date.blockSignals(True)
        self._combo_date.clear()

        dates = self._use_case.get_available_dates()
        if not dates:
            self._combo_date.addItem("Sin datos", None)
            self._combo_date.blockSignals(False)
            self._clear_dashboard()
            return

        for d in dates:
            self._combo_date.addItem(d.isoformat(), d)

        self._combo_date.blockSignals(False)
        self._combo_date.setCurrentIndex(0)
        self._on_date_changed()

    def _on_date_changed(self) -> None:
        query_date = self._combo_date.currentData()
        if query_date is None:
            self._clear_dashboard()
            return

        branch_filter = self._combo_branch.currentData()
        data = self._use_case.build_for_date(query_date, branch_filter)
        if data is None:
            self._clear_dashboard()
            return

        self._current_data = data
        self._update_branch_combo(data)
        self._update_dashboard(data)

    def _on_branch_changed(self) -> None:
        query_date = self._combo_date.currentData()
        if query_date is None:
            return

        branch_filter = self._combo_branch.currentData()
        data = self._use_case.build_for_date(query_date, branch_filter)
        if data is None:
            return

        self._current_data = data
        self._update_dashboard(data)

    def _update_branch_combo(self, data: DashboardData) -> None:
        self._combo_branch.blockSignals(True)
        current = self._combo_branch.currentData()
        self._combo_branch.clear()
        self._combo_branch.addItem("Todas", None)
        for branch in data.branches_available:
            self._combo_branch.addItem(branch, branch)

        if current:
            idx = self._combo_branch.findData(current)
            if idx >= 0:
                self._combo_branch.setCurrentIndex(idx)

        self._combo_branch.blockSignals(False)

    # ------------------------------------------------------------------
    # Dashboard update
    # ------------------------------------------------------------------

    def _clear_dashboard(self) -> None:
        self._kpi_repos.set_value("—")
        self._kpi_csprojs.set_value("—")
        self._kpi_top_version.set_value("—")
        self._kpi_branches.set_value("—")
        blank = "<html><body style='background:transparent'></body></html>"
        self._version_web.setHtml(blank)
        self._branch_web.setHtml(blank)
        self._evo_web.setHtml(blank)
        self._drilldown_group.setVisible(False)
        self._all_summaries = []

    def _update_dashboard(self, data: DashboardData) -> None:
        self._all_summaries = []
        for summaries in data.repos_by_version.values():
            self._all_summaries.extend(summaries)

        # KPIs
        self._kpi_repos.set_value(str(data.total_repos))
        self._kpi_csprojs.set_value(str(data.total_csprojs))

        if data.repos_by_version:
            top_version = max(data.repos_by_version, key=lambda v: len(data.repos_by_version[v]))
            self._kpi_top_version.set_value(top_version.label)
        else:
            self._kpi_top_version.set_value("—")

        self._kpi_branches.set_value(str(len(data.branches_available)))

        # Charts
        self._render_version_donut(data)
        self._render_branch_donut(data)
        self._render_evolution()

        self._show_drilldown(self._all_summaries, "Todos los repositorios")

    # ------------------------------------------------------------------
    # Donut chart: versions
    # ------------------------------------------------------------------

    def _render_version_donut(self, data: DashboardData) -> None:
        sorted_versions = sorted(data.repos_by_version.keys(), key=lambda v: v.sort_key)
        labels = [v.label for v in sorted_versions]
        values = [len(data.repos_by_version[v]) for v in sorted_versions]
        colors = [VERSION_COLORS.get(v.moniker, ACCENT_COLOR) for v in sorted_versions]

        fig = go.Figure(data=[go.Pie(  # pyright: ignore[reportUnknownMemberType]
            labels=labels,
            values=values,
            hole=0.55,
            marker=dict(colors=colors, line=dict(color=BG_PRIMARY, width=2)),
            textinfo="label+value",
            textfont=dict(size=11, color=TEXT_PRIMARY),
            hovertemplate="%{label}: %{value} repos<extra></extra>",
        )])
        fig.update_layout(  # pyright: ignore[reportUnknownMemberType]
            showlegend=True,
            legend=dict(orientation="v", x=1.02, y=0.5),
            height=300,
        )
        self._version_web.setHtml(_render_plotly_html(fig))

    # ------------------------------------------------------------------
    # Donut chart: branches
    # ------------------------------------------------------------------

    def _render_branch_donut(self, data: DashboardData) -> None:
        branch_counts: dict[str, int] = {}
        for summaries in data.repos_by_version.values():
            for s in summaries:
                for branch in s.branches:
                    branch_counts[branch] = branch_counts.get(branch, 0) + 1

        _BRANCH_COLORS = [ACCENT_COLOR, "#9f7aea", "#ec4899", "#58a6ff", "#f0883e", "#3fb950"]
        labels = sorted(branch_counts.keys())
        values = [branch_counts[b] for b in labels]
        colors = [_BRANCH_COLORS[i % len(_BRANCH_COLORS)] for i in range(len(labels))]

        fig = go.Figure(data=[go.Pie(  # pyright: ignore[reportUnknownMemberType]
            labels=labels,
            values=values,
            hole=0.55,
            marker=dict(colors=colors, line=dict(color=BG_PRIMARY, width=2)),
            textinfo="label+value",
            textfont=dict(size=11, color=TEXT_PRIMARY),
            hovertemplate="%{label}: %{value} repos<extra></extra>",
        )])
        fig.update_layout(  # pyright: ignore[reportUnknownMemberType]
            showlegend=True,
            legend=dict(orientation="v", x=1.02, y=0.5),
            height=300,
        )
        self._branch_web.setHtml(_render_plotly_html(fig))

    # ------------------------------------------------------------------
    # Area chart: monthly evolution
    # ------------------------------------------------------------------

    def _render_evolution(self) -> None:
        snapshots = self._use_case.build_monthly_evolution(months=6)
        if not snapshots:
            self._evo_web.setHtml(
                "<html><body style='background:transparent'></body></html>",
            )
            return

        all_versions: set[DotNetVersion] = set()
        for snap in snapshots:
            all_versions.update(snap.repos_by_version.keys())
        sorted_versions = sorted(all_versions, key=lambda v: v.sort_key)

        months = [s.month for s in snapshots]

        fig = go.Figure()  # pyright: ignore[reportUnknownMemberType]
        for version in sorted_versions:
            y_vals = [snap.repos_by_version.get(version, 0) for snap in snapshots]
            color = VERSION_COLORS.get(version.moniker, ACCENT_COLOR)
            fig.add_trace(go.Scatter(  # pyright: ignore[reportUnknownMemberType]
                x=months,
                y=y_vals,
                name=version.label,
                mode="lines",
                line=dict(color=color, width=2),
                fill="tonexty",
                fillcolor=color.replace(")", ",0.15)").replace("rgb", "rgba")
                if color.startswith("rgb")
                else f"rgba({int(color[1:3],16)},{int(color[3:5],16)},{int(color[5:7],16)},0.15)",
                hovertemplate=f"{version.label}: %{{y}} repos<extra></extra>",
            ))

        fig.update_layout(  # pyright: ignore[reportUnknownMemberType]
            xaxis=dict(
                showgrid=True,
                gridcolor="rgba(255,255,255,0.05)",
                linecolor=TEXT_SECONDARY,
            ),
            yaxis=dict(
                showgrid=True,
                gridcolor="rgba(255,255,255,0.05)",
                linecolor=TEXT_SECONDARY,
            ),
            height=260,
            hovermode="x unified",
        )
        self._evo_web.setHtml(_render_plotly_html(fig))

    # ------------------------------------------------------------------
    # Drill-down
    # ------------------------------------------------------------------

    def _show_drilldown(self, summaries: list[RepoSummary], title: str) -> None:
        self._drilldown_label.setText(title)
        self._repo_tree.load_summaries(summaries)
        self._drilldown_group.setVisible(True)
        self._drill_summaries = summaries

    # ------------------------------------------------------------------
    # Export
    # ------------------------------------------------------------------

    def _show_export_menu(self) -> None:
        menu = QMenu(self)
        menu.addAction("Exportar como PNG", self._export_png)
        menu.addAction("Exportar como PDF", self._export_pdf)
        menu.addAction("Exportar datos (Excel)", self._export_excel)
        menu.exec(self._btn_export.mapToGlobal(self._btn_export.rect().bottomLeft()))

    def _export_png(self) -> None:
        path, _ = QFileDialog.getSaveFileName(
            self, "Exportar Dashboard PNG", "dashboard.png", "Imagen PNG (*.png)",
        )
        if not path:
            return
        ExportDashboardUseCase.to_image(self._scroll_content, Path(path))
        QMessageBox.information(self, "Exportación", f"Dashboard guardado en:\n{path}")

    def _export_pdf(self) -> None:
        path, _ = QFileDialog.getSaveFileName(
            self, "Exportar Dashboard PDF", "dashboard.pdf", "Documento PDF (*.pdf)",
        )
        if not path:
            return
        ExportDashboardUseCase.to_pdf(self._scroll_content, Path(path))
        QMessageBox.information(self, "Exportación", f"Dashboard guardado en:\n{path}")

    def _export_excel(self) -> None:
        if not self._all_summaries:
            return
        path, _ = QFileDialog.getSaveFileName(
            self, "Exportar Excel", "reporte_dotnet.xlsx", "Excel (*.xlsx)",
        )
        if not path:
            return
        all_hits: list[CodeSearchHit] = []
        for s in self._all_summaries:
            all_hits.extend(s.hits)
        use_case = ExportResultsUseCase()
        output = use_case.execute(all_hits, Path(path))
        QMessageBox.information(self, "Exportación", f"Datos guardados en:\n{output}")

    def _export_drilldown(self) -> None:
        summaries = getattr(self, "_drill_summaries", [])
        if not summaries:
            return
        path, _ = QFileDialog.getSaveFileName(
            self, "Exportar Excel", "detalle_dotnet.xlsx", "Excel (*.xlsx)",
        )
        if not path:
            return
        all_hits: list[CodeSearchHit] = []
        for s in summaries:
            all_hits.extend(s.hits)
        use_case = ExportResultsUseCase()
        output = use_case.execute(all_hits, Path(path))
        QMessageBox.information(self, "Exportación", f"Datos guardados en:\n{output}")
