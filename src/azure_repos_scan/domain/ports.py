"""Ports (interfaces) del dominio — contratos para la capa de infraestructura."""

from __future__ import annotations

from datetime import date
from typing import Protocol, Sequence

from azure_repos_scan.domain.models import (
    CodeSearchPage,
    DailyQueryRecord,
    Project,
    Repository,
)


class AzureDevOpsClient(Protocol):
    """Port para comunicación con la API de Azure DevOps."""

    def list_projects(self) -> Sequence[Project]:
        """Obtener todos los proyectos de la organización."""
        ...

    def list_repositories(self, project_name: str) -> Sequence[Repository]:
        """Obtener todos los repositorios de un proyecto."""
        ...

    def search_code(
        self,
        search_text: str,
        project: str | None,
        skip: int,
        top: int,
        *,
        filters: dict[str, list[str]] | None = None,
        include_facets: bool = False,
    ) -> CodeSearchPage:
        """Buscar código en la organización o proyecto."""
        ...


class QueryStoragePort(Protocol):
    """Port para persistencia de consultas históricas."""

    def save_query(self, record: DailyQueryRecord) -> None:
        """Guardar o actualizar consulta del día."""
        ...

    def load_queries(self) -> list[DailyQueryRecord]:
        """Cargar todas las consultas históricas."""
        ...

    def get_query_by_date(self, query_date: date) -> DailyQueryRecord | None:
        """Obtener consulta de un día específico."""
        ...
