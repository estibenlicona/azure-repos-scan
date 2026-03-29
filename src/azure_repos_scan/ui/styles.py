"""Estilos QSS centralizados — tema navy oscuro estilo CRM/Grafana."""

from __future__ import annotations

ACCENT_COLOR = "#00d4aa"  # Teal/cyan
ACCENT_PURPLE = "#9f7aea"  # Purple para gradientes
BG_PRIMARY = "#0d1117"  # Navy muy oscuro
BG_SECONDARY = "#161b22"  # Cards / panels
BG_TERTIARY = "#1c2333"  # Hover / alternate
BG_CARD = "#1a2332"  # Fondo de cards
SIDEBAR_BG = "#0b0f15"  # Sidebar más oscuro
TEXT_PRIMARY = "#e6edf3"
TEXT_SECONDARY = "#7d8590"
BORDER_COLOR = "#21262d"
SUCCESS_COLOR = "#00d4aa"
ERROR_COLOR = "#f85149"
WARNING_COLOR = "#d29922"

# Colores por versión .NET para badges y charts
VERSION_COLORS: dict[str, str] = {
    "netcoreapp3.1": "#f85149",
    "net5.0": "#f0883e",
    "net6.0": "#d29922",
    "net7.0": "#9f7aea",
    "net8.0": "#00d4aa",
    "net9.0": "#58a6ff",
    "net10.0": "#3fb950",
}

# Gradientes para KPI cards
KPI_GRADIENT_CYAN = "qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #0d9488, stop:1 #06b6d4)"
KPI_GRADIENT_PURPLE = "qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #7c3aed, stop:1 #ec4899)"
KPI_GRADIENT_BLUE = "qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #2563eb, stop:1 #06b6d4)"
KPI_GRADIENT_GREEN = "qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #059669, stop:1 #34d399)"

GLOBAL_STYLE = f"""
QMainWindow {{
    background-color: {BG_PRIMARY};
}}

QWidget {{
    background-color: {BG_PRIMARY};
    color: {TEXT_PRIMARY};
    font-family: "Segoe UI", sans-serif;
    font-size: 13px;
}}

/* --- Botones --- */
QPushButton {{
    background-color: {ACCENT_COLOR};
    color: #0d1117;
    border: none;
    border-radius: 8px;
    padding: 8px 16px;
    font-weight: bold;
    min-height: 32px;
}}

QPushButton:hover {{
    background-color: #33dfba;
}}

QPushButton:pressed {{
    background-color: #00b894;
}}

QPushButton:disabled {{
    background-color: {BG_TERTIARY};
    color: {TEXT_SECONDARY};
}}

QPushButton#btn_secondary {{
    background-color: {BG_SECONDARY};
    color: {TEXT_PRIMARY};
    border: 1px solid {BORDER_COLOR};
}}

QPushButton#btn_secondary:hover {{
    background-color: {BG_TERTIARY};
    border-color: {ACCENT_COLOR};
}}

/* --- Inputs --- */
QLineEdit {{
    background-color: {BG_SECONDARY};
    color: {TEXT_PRIMARY};
    border: 1px solid {BORDER_COLOR};
    border-radius: 8px;
    padding: 6px 12px;
    min-height: 28px;
}}

QLineEdit:focus {{
    border-color: {ACCENT_COLOR};
}}

/* --- ComboBox --- */
QComboBox {{
    background-color: {BG_SECONDARY};
    color: {TEXT_PRIMARY};
    border: 1px solid {BORDER_COLOR};
    border-radius: 8px;
    padding: 6px 12px;
    min-height: 28px;
    min-width: 80px;
}}

QComboBox:hover {{
    border-color: {ACCENT_COLOR};
}}

QComboBox::drop-down {{
    border: none;
    width: 20px;
}}

QComboBox QAbstractItemView {{
    background-color: {BG_SECONDARY};
    color: {TEXT_PRIMARY};
    border: 1px solid {BORDER_COLOR};
    selection-background-color: {ACCENT_COLOR};
    selection-color: #0d1117;
    outline: none;
}}

/* --- Tabla --- */
QTableWidget {{
    background-color: {BG_SECONDARY};
    color: {TEXT_PRIMARY};
    border: 1px solid {BORDER_COLOR};
    border-radius: 8px;
    alternate-background-color: {BG_TERTIARY};
    gridline-color: {BORDER_COLOR};
    outline: none;
    selection-background-color: {ACCENT_COLOR};
    selection-color: #0d1117;
}}

QTableWidget::item {{
    padding: 4px 8px;
    min-height: 28px;
}}

QHeaderView::section {{
    background-color: {BG_TERTIARY};
    color: {TEXT_PRIMARY};
    border: none;
    border-right: 1px solid {BORDER_COLOR};
    border-bottom: 1px solid {BORDER_COLOR};
    padding: 8px 10px;
    font-weight: bold;
}}

/* --- Tree (drill-down) --- */
QTreeWidget {{
    background-color: {BG_SECONDARY};
    color: {TEXT_PRIMARY};
    border: 1px solid {BORDER_COLOR};
    border-radius: 8px;
    outline: none;
}}

QTreeWidget::item {{
    padding: 4px 8px;
    min-height: 24px;
}}

QTreeWidget::item:selected {{
    background-color: {ACCENT_COLOR};
    color: #0d1117;
}}

QTreeWidget::item:hover {{
    background-color: {BG_TERTIARY};
}}

/* --- Checkboxes --- */
QCheckBox {{
    spacing: 6px;
    background-color: transparent;
}}

QCheckBox::indicator {{
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 1px solid {BORDER_COLOR};
    background-color: {BG_SECONDARY};
}}

QCheckBox::indicator:checked {{
    background-color: {ACCENT_COLOR};
    border-color: {ACCENT_COLOR};
}}

QCheckBox::indicator:hover {{
    border-color: {ACCENT_COLOR};
}}

/* --- Progress bar --- */
QProgressBar {{
    background-color: {BG_SECONDARY};
    border: 1px solid {BORDER_COLOR};
    border-radius: 8px;
    text-align: center;
    color: {TEXT_PRIMARY};
    min-height: 22px;
    font-size: 11px;
}}

QProgressBar::chunk {{
    background-color: {ACCENT_COLOR};
    border-radius: 7px;
}}

/* --- Group Box --- */
QGroupBox {{
    border: 1px solid {BORDER_COLOR};
    border-radius: 12px;
    margin-top: 12px;
    padding: 16px 12px 12px 12px;
    font-weight: bold;
    background-color: {BG_SECONDARY};
}}

QGroupBox::title {{
    subcontrol-origin: margin;
    left: 14px;
    padding: 0 8px;
    color: {ACCENT_COLOR};
}}

/* --- Labels --- */
QLabel {{
    color: {TEXT_PRIMARY};
    background-color: transparent;
}}

QLabel#title {{
    font-size: 20px;
    font-weight: bold;
    padding: 4px 0;
}}

QLabel#subtitle {{
    font-size: 12px;
    color: {TEXT_SECONDARY};
}}

QLabel#counter {{
    font-size: 14px;
    font-weight: bold;
    color: {ACCENT_COLOR};
}}

/* --- Status bar --- */
QStatusBar {{
    background-color: {BG_SECONDARY};
    color: {TEXT_SECONDARY};
    font-size: 12px;
    border-top: 1px solid {BORDER_COLOR};
}}

/* --- Splitter --- */
QSplitter::handle {{
    background-color: {BORDER_COLOR};
    width: 2px;
}}

/* --- ScrollBar --- */
QScrollBar:vertical {{
    background: {BG_PRIMARY};
    width: 8px;
    border: none;
}}

QScrollBar::handle:vertical {{
    background: {BORDER_COLOR};
    min-height: 30px;
    border-radius: 4px;
}}

QScrollBar::handle:vertical:hover {{
    background: {TEXT_SECONDARY};
}}

QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
    height: 0;
}}

QScrollBar:horizontal {{
    background: {BG_PRIMARY};
    height: 8px;
    border: none;
}}

QScrollBar::handle:horizontal {{
    background: {BORDER_COLOR};
    min-width: 30px;
    border-radius: 4px;
}}

QScrollBar::handle:horizontal:hover {{
    background: {TEXT_SECONDARY};
}}

QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {{
    width: 0;
}}

/* --- Sidebar --- */
QWidget#sidebar {{
    background-color: {SIDEBAR_BG};
    border-right: 1px solid {BORDER_COLOR};
}}

QLabel#sidebar_title {{
    font-size: 14px;
    font-weight: bold;
    color: {TEXT_PRIMARY};
    padding: 0;
    background-color: transparent;
}}

QLabel#sidebar_section {{
    font-size: 10px;
    font-weight: bold;
    color: {TEXT_SECONDARY};
    letter-spacing: 1px;
    padding: 0;
    background-color: transparent;
}}

QPushButton#sidebar_btn {{
    background-color: transparent;
    color: {TEXT_SECONDARY};
    border: none;
    border-left: 3px solid transparent;
    border-radius: 0;
    padding: 10px 14px;
    font-size: 13px;
    font-weight: normal;
    min-height: 36px;
    text-align: left;
}}

QPushButton#sidebar_btn:checked {{
    color: {ACCENT_COLOR};
    border-left: 3px solid {ACCENT_COLOR};
    background-color: rgba(0, 212, 170, 25);
}}

QPushButton#sidebar_btn:hover {{
    background-color: {BG_TERTIARY};
    color: {TEXT_PRIMARY};
}}

/* --- KPI Cards --- */
QFrame#kpi_card {{
    background-color: {BG_CARD};
    border: 1px solid {BORDER_COLOR};
    border-radius: 12px;
}}

QFrame#kpi_card_cyan {{
    background-color: {BG_CARD};
    border: 1px solid {BORDER_COLOR};
    border-radius: 12px;
    border-top: 3px solid {ACCENT_COLOR};
}}

QFrame#kpi_card_purple {{
    background-color: {BG_CARD};
    border: 1px solid {BORDER_COLOR};
    border-radius: 12px;
    border-top: 3px solid {ACCENT_PURPLE};
}}

QLabel#kpi_value {{
    font-size: 32px;
    font-weight: bold;
    color: {TEXT_PRIMARY};
    background-color: transparent;
}}

QLabel#kpi_desc {{
    font-size: 11px;
    color: {TEXT_SECONDARY};
    background-color: transparent;
}}

/* --- QMenu --- */
QMenu {{
    background-color: {BG_SECONDARY};
    color: {TEXT_PRIMARY};
    border: 1px solid {BORDER_COLOR};
    border-radius: 8px;
    padding: 4px;
}}

QMenu::item {{
    padding: 6px 24px 6px 12px;
    border-radius: 4px;
}}

QMenu::item:selected {{
    background-color: {ACCENT_COLOR};
    color: #0d1117;
}}

/* --- ScrollArea --- */
QScrollArea {{
    border: none;
    background-color: transparent;
}}
"""
