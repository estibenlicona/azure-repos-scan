"""Tarjeta KPI para métricas clave del dashboard — estilo CRM con acento."""

from __future__ import annotations

from typing import final

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QFrame, QLabel, QVBoxLayout, QWidget


@final
class KpiCard(QFrame):
    """Tarjeta de métrica clave: valor grande + label descriptivo con acento de color."""

    def __init__(
        self,
        label: str,
        value: str = "0",
        accent: str = "cyan",
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        obj_name = f"kpi_card_{accent}" if accent in ("cyan", "purple") else "kpi_card"
        self.setObjectName(obj_name)
        self.setFrameShape(QFrame.Shape.StyledPanel)
        self.setMinimumWidth(160)
        self.setMaximumHeight(100)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 12, 16, 12)
        layout.setSpacing(4)
        layout.setAlignment(Qt.AlignmentFlag.AlignCenter)

        self._value_label = QLabel(value)
        self._value_label.setObjectName("kpi_value")
        self._value_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(self._value_label)

        self._desc_label = QLabel(label)
        self._desc_label.setObjectName("kpi_desc")
        self._desc_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(self._desc_label)

    def set_value(self, value: str) -> None:
        """Actualizar el valor de la tarjeta."""
        self._value_label.setText(value)

    def set_label(self, label: str) -> None:
        """Actualizar la descripción de la tarjeta."""
        self._desc_label.setText(label)
