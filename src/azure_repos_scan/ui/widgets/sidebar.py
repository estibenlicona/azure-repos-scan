"""Sidebar de navegación con secciones categorizadas e iconos profesionales."""

from __future__ import annotations

from typing import final

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QVBoxLayout,
    QWidget,
)


@final
class SidebarWidget(QWidget):
    """Barra lateral de navegación estilo CRM/Grafana — 200px, secciones."""

    page_changed = Signal(int)

    # (icon_char, label, section)
    _SECTIONS: list[tuple[str, list[tuple[str, str, int]]]] = [
        ("REPORTES", [
            ("\uE9D9", "Dashboard", 0),
        ]),
        ("HERRAMIENTAS", [
            ("\uE721", "Escáner", 1),
        ]),
    ]

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setFixedWidth(200)
        self.setObjectName("sidebar")

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Header
        header = QWidget()
        header.setStyleSheet("background-color: transparent;")
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(16, 16, 16, 16)
        header_layout.setSpacing(8)

        app_icon = QLabel("\uE774")
        app_icon.setStyleSheet(
            "font-family: 'Segoe MDL2 Assets'; font-size: 20px; color: #00d4aa;"
            " background: transparent;"
        )
        header_layout.addWidget(app_icon)

        app_title = QLabel("Azure Repos\nScan")
        app_title.setObjectName("sidebar_title")
        header_layout.addWidget(app_title)
        header_layout.addStretch()
        layout.addWidget(header)

        # Separator
        layout.addWidget(self._separator())

        self._buttons: list[QPushButton] = []

        for section_name, items in self._SECTIONS:
            # Section label
            section_lbl = QLabel(f"  {section_name}")
            section_lbl.setObjectName("sidebar_section")
            section_lbl.setContentsMargins(16, 12, 0, 4)
            layout.addWidget(section_lbl)

            for icon_char, label, page_idx in items:
                btn = QPushButton(f"  {icon_char}   {label}")
                btn.setObjectName("sidebar_btn")
                btn.setCheckable(True)
                btn.setProperty("nav_index", page_idx)
                btn.setStyleSheet(
                    "font-family: 'Segoe MDL2 Assets', 'Segoe UI'; text-align: left;"
                )
                btn.clicked.connect(self._on_clicked)
                self._buttons.append(btn)
                layout.addWidget(btn)

            layout.addWidget(self._separator())

        layout.addStretch()

        # Activate first button by default
        if self._buttons:
            self._buttons[0].setChecked(True)

    @staticmethod
    def _separator() -> QFrame:
        sep = QFrame()
        sep.setFrameShape(QFrame.Shape.HLine)
        sep.setStyleSheet("background-color: #21262d; max-height: 1px;")
        return sep

    def _on_clicked(self) -> None:
        btn = self.sender()
        if not isinstance(btn, QPushButton):
            return
        idx = btn.property("nav_index")
        if not isinstance(idx, int):
            return
        for b in self._buttons:
            b.setChecked(b is btn)
        self.page_changed.emit(idx)

    def set_active(self, index: int) -> None:
        """Activar un botón por índice programáticamente."""
        for i, btn in enumerate(self._buttons):
            btn.setChecked(i == index)
