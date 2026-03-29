"""Persistencia de consultas históricas en JSON local."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any, final

from azure_repos_scan.domain.models import (
    CodeSearchHit,
    DailyQueryRecord,
    DotNetVersion,
)

_VERSION_MAP: dict[str, DotNetVersion] = {v.value[1]: v for v in DotNetVersion}

# Monikers legacy (antes del fix .0) → moniker actual
_LEGACY_MAP: dict[str, str] = {
    "net5": "net5.0",
    "net6": "net6.0",
    "net7": "net7.0",
    "net8": "net8.0",
    "net9": "net9.0",
    "net10": "net10.0",
}


def _get_default_path() -> Path:
    """Ruta por defecto: %APPDATA%/azure-repos-scan/queries.json."""
    import os

    appdata = os.environ.get("APPDATA", str(Path.home()))
    folder = Path(appdata) / "azure-repos-scan"
    folder.mkdir(parents=True, exist_ok=True)
    return folder / "queries.json"


def _hit_to_dict(hit: CodeSearchHit) -> dict[str, str]:
    return {
        "repository_name": hit.repository_name,
        "project_name": hit.project_name,
        "dotnet_version": hit.dotnet_version.moniker,
        "branch": hit.branch,
    }


def _hit_from_dict(d: dict[str, Any]) -> CodeSearchHit:
    moniker: str = d.get("dotnet_version", "net8.0")
    moniker = _LEGACY_MAP.get(moniker, moniker)
    version = _VERSION_MAP.get(moniker, DotNetVersion.NET_8)
    return CodeSearchHit(
        repository_name=d.get("repository_name", ""),
        project_name=d.get("project_name", ""),
        dotnet_version=version,
        branch=d.get("branch", ""),
    )


def _record_to_dict(record: DailyQueryRecord) -> dict[str, Any]:
    return {
        "query_date": record.query_date.isoformat(),
        "organization": record.organization,
        "project": record.project,
        "versions_searched": [v.moniker for v in record.versions_searched],
        "results_by_version": {
            key: [_hit_to_dict(h) for h in hits]
            for key, hits in record.results_by_version.items()
        },
    }


def _record_from_dict(d: dict[str, Any]) -> DailyQueryRecord:
    versions_raw: list[str] = d.get("versions_searched", [])
    versions = [
        _VERSION_MAP[_LEGACY_MAP.get(m, m)]
        for m in versions_raw
        if _LEGACY_MAP.get(m, m) in _VERSION_MAP
    ]
    results_raw: dict[str, list[dict[str, Any]]] = d.get("results_by_version", {})
    results: dict[str, list[CodeSearchHit]] = {}
    for key, hits in results_raw.items():
        migrated_key = _LEGACY_MAP.get(key, key)
        parsed = [_hit_from_dict(h) for h in hits]
        if migrated_key in results:
            results[migrated_key].extend(parsed)
        else:
            results[migrated_key] = parsed
    return DailyQueryRecord(
        query_date=date.fromisoformat(d["query_date"]),
        organization=d.get("organization", ""),
        project=d.get("project"),
        versions_searched=versions,
        results_by_version=results,
    )


@final
class JsonQueryStore:
    """Almacena consultas históricas en un archivo JSON local."""

    def __init__(self, path: Path | None = None) -> None:
        self._path = path or _get_default_path()

    def save_query(self, record: DailyQueryRecord) -> None:
        """Guardar o merge consulta del día."""
        records = self.load_queries()
        existing = next(
            (r for r in records if r.query_date == record.query_date),
            None,
        )
        if existing is not None:
            existing.merge(record)
        else:
            records.append(record)
        self._write(records)

    def load_queries(self) -> list[DailyQueryRecord]:
        """Cargar todas las consultas históricas."""
        if not self._path.exists():
            return []
        raw_text = self._path.read_text(encoding="utf-8")
        if not raw_text.strip():
            return []
        data: list[dict[str, Any]] = json.loads(raw_text)
        return [_record_from_dict(d) for d in data]

    def get_query_by_date(self, query_date: date) -> DailyQueryRecord | None:
        """Obtener consulta de un día específico."""
        records = self.load_queries()
        return next((r for r in records if r.query_date == query_date), None)

    def _write(self, records: list[DailyQueryRecord]) -> None:
        """Escribir todas las consultas al archivo JSON."""
        self._path.parent.mkdir(parents=True, exist_ok=True)
        data = [_record_to_dict(r) for r in records]
        self._path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
