"""Entidades y value objects del dominio."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from typing import final


@final
@dataclass(frozen=True, slots=True)
class OrganizationName:
    """Value object para el nombre de una organización de Azure DevOps."""

    value: str

    def __post_init__(self) -> None:
        if not self.value.strip():
            msg = "El nombre de organización no puede estar vacío"
            raise ValueError(msg)


@final
@dataclass(frozen=True, slots=True)
class ProjectId:
    """Value object para el ID de un proyecto."""

    value: str

    def __post_init__(self) -> None:
        if not self.value.strip():
            msg = "ProjectId no puede estar vacío"
            raise ValueError(msg)


@final
@dataclass(frozen=True, slots=True)
class RepositoryId:
    """Value object para el ID de un repositorio."""

    value: str

    def __post_init__(self) -> None:
        if not self.value.strip():
            msg = "RepositoryId no puede estar vacío"
            raise ValueError(msg)


@final
@dataclass(frozen=True, slots=True)
class Project:
    """Entidad que representa un proyecto de Azure DevOps."""

    id: ProjectId
    name: str
    description: str
    url: str


@final
@dataclass(frozen=True, slots=True)
class Repository:
    """Entidad que representa un repositorio Git de Azure DevOps."""

    id: RepositoryId
    name: str
    project: Project
    default_branch: str
    url: str
    size_bytes: int


@final
@dataclass(frozen=True, slots=True)
class ScanResult:
    """Resultado de un escaneo de repositorios."""

    organization: OrganizationName
    projects: list[Project]
    repositories: list[Repository]
    scanned_at: datetime
    total_repos: int
    total_projects: int


# ---------------------------------------------------------------------------
# Code Search — Detección de versiones .NET
# ---------------------------------------------------------------------------


class DotNetVersion(Enum):
    """Versiones de .NET con sus queries de búsqueda para Code Search."""

    NET_3_1 = ("3.1", "netcoreapp3.1")
    NET_5 = ("5", "net5.0")
    NET_6 = ("6", "net6.0")
    NET_7 = ("7", "net7.0")
    NET_8 = ("8", "net8.0")
    NET_9 = ("9", "net9.0")
    NET_10 = ("10", "net10.0")

    def __init__(self, display: str, moniker: str) -> None:
        self.display = display
        self.moniker = moniker

    @property
    def label(self) -> str:
        """Etiqueta legible, ej: '.NET 8'."""
        return f".NET {self.display}"

    @property
    def sort_key(self) -> int:
        """Ordinal para ordenar versiones (menor = más antigua)."""
        _ORDER: dict[str, int] = {
            "netcoreapp3.1": 0,
            "net5.0": 1,
            "net6.0": 2,
            "net7.0": 3,
            "net8.0": 4,
            "net9.0": 5,
            "net10.0": 6,
        }
        return _ORDER.get(self.moniker, 99)

    def build_search_queries(self) -> list[str]:
        """Generar queries de Code Search (singular y plural TargetFramework)."""
        tf = self.moniker
        return [
            f"ext:csproj AND <TargetFramework>{tf}</TargetFramework>",
            f"ext:csproj AND <TargetFrameworks>{tf}</TargetFrameworks>",
        ]


DEFAULT_BRANCHES: tuple[str, ...] = (
    "develop",
    "test",
    "master"
)
"""Ramas predeterminadas disponibles para consultas de Code Search."""


@final
@dataclass(frozen=True, slots=True)
class FacetItem:
    """Elemento de faceta devuelto por Code Search."""

    name: str
    result_count: int


@final
@dataclass(frozen=True, slots=True)
class CodeSearchFacets:
    """Facetas agregadas devueltas por Code Search."""

    projects: list[FacetItem] = field(default_factory=list)
    repositories: list[FacetItem] = field(default_factory=list)


@final
@dataclass(frozen=True, slots=True)
class CodeSearchHit:
    """Un resultado individual de Code Search."""

    repository_name: str
    project_name: str
    dotnet_version: DotNetVersion
    branch: str


@final
@dataclass(frozen=True, slots=True)
class CodeSearchPage:
    """Página de resultados de Code Search."""

    hits: list[CodeSearchHit]
    total_count: int
    skip: int
    top: int
    facets: CodeSearchFacets | None = None


@final
@dataclass(slots=True)
class DailyQueryRecord:
    """Registro de consulta diaria agrupado por día y versión."""

    query_date: date
    organization: str
    project: str | None
    versions_searched: list[DotNetVersion]
    results_by_version: dict[str, list[CodeSearchHit]] = field(default_factory=dict)

    @property
    def total_results(self) -> int:
        """Total de resultados sumando todas las versiones."""
        return sum(len(hits) for hits in self.results_by_version.values())

    def merge(self, other: DailyQueryRecord) -> None:
        """Fusionar resultados de otra consulta del mismo día."""
        for version_key, hits in other.results_by_version.items():
            self.results_by_version[version_key] = hits
        seen = {v.value for v in self.versions_searched}
        for v in other.versions_searched:
            if v.value not in seen:
                self.versions_searched.append(v)
                seen.add(v.value)

    def get_all_hits(self) -> list[CodeSearchHit]:
        """Obtener todos los hits de todas las versiones como lista plana."""
        all_hits: list[CodeSearchHit] = []
        for hits in self.results_by_version.values():
            all_hits.extend(hits)
        return all_hits


# ---------------------------------------------------------------------------
# Reportes / Dashboard
# ---------------------------------------------------------------------------


@final
@dataclass(frozen=True, slots=True)
class RepoSummary:
    """Resumen de un repositorio agrupando sus csprojs."""

    repository_name: str
    project_name: str
    oldest_version: DotNetVersion
    all_versions: frozenset[DotNetVersion]
    branches: frozenset[str]
    csproj_count: int
    hits: tuple[CodeSearchHit, ...]


@final
@dataclass(frozen=True, slots=True)
class MonthlySnapshot:
    """Snapshot mensual de repos por versión para evolución temporal."""

    month: str  # "YYYY-MM"
    repos_by_version: dict[DotNetVersion, int]
