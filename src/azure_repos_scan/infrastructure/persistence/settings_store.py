"""Persistencia de configuración del usuario (org, proyecto) entre sesiones."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, final


def _get_default_path() -> Path:
    """Ruta por defecto: %APPDATA%/azure-repos-scan/settings.json."""
    import os

    appdata = os.environ.get("APPDATA", str(Path.home()))
    folder = Path(appdata) / "azure-repos-scan"
    folder.mkdir(parents=True, exist_ok=True)
    return folder / "settings.json"


@final
class SettingsStore:
    """Almacena configuración del usuario en un archivo JSON."""

    def __init__(self, path: Path | None = None) -> None:
        self._path = path or _get_default_path()
        self._data: dict[str, Any] = self._load()

    def get(self, key: str, default: str = "") -> str:
        """Obtener un valor de configuración."""
        value: str = str(self._data.get(key, default))
        return value

    def set(self, key: str, value: str) -> None:
        """Guardar un valor de configuración."""
        self._data[key] = value
        self._save()

    def _load(self) -> dict[str, Any]:
        if not self._path.exists():
            return {}
        raw = self._path.read_text(encoding="utf-8")
        if not raw.strip():
            return {}
        result: dict[str, Any] = json.loads(raw)
        return result

    def _save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps(self._data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
