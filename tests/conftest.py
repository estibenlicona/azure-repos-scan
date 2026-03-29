"""Fixtures compartidas para tests."""

from __future__ import annotations

from typing import Sequence, final

import pytest

from azure_repos_scan.domain.models import (
    CodeSearchFacets,
    CodeSearchHit,
    CodeSearchPage,
    FacetItem,
    Project,
    ProjectId,
    Repository,
    RepositoryId,
)


@final
class FakeAzureDevOpsClient:
    """Fake del port AzureDevOpsClient para tests unitarios."""

    def __init__(
        self,
        projects: Sequence[Project] | None = None,
        repos_by_project: dict[str, list[Repository]] | None = None,
        search_results: list[CodeSearchHit] | None = None,
        *,
        facets: CodeSearchFacets | None = None,
        project_facets: dict[str, CodeSearchFacets] | None = None,
        project_search_results: dict[str, list[CodeSearchHit]] | None = None,
    ) -> None:
        self._projects: Sequence[Project] = projects or []
        self._repos_by_project: dict[str, list[Repository]] = repos_by_project or {}
        self._search_results: list[CodeSearchHit] = search_results or []
        self._facets: CodeSearchFacets | None = facets
        self._project_facets: dict[str, CodeSearchFacets] = project_facets or {}
        self._project_search_results: dict[str, list[CodeSearchHit]] = (
            project_search_results or {}
        )
        self.search_calls: list[
            tuple[str, str | None, int, int, dict[str, list[str]] | None]
        ] = []

    def list_projects(self) -> Sequence[Project]:
        return self._projects

    def list_repositories(self, project_name: str) -> Sequence[Repository]:
        return self._repos_by_project.get(project_name, [])

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
        self.search_calls.append((search_text, project, skip, top, filters))

        # Determine effective project from URL param or filters
        effective_project = project
        if not effective_project and filters:
            proj_filter = filters.get("Project", [])
            if len(proj_filter) == 1:
                effective_project = proj_filter[0]

        # Choose result set based on project
        if effective_project and effective_project in self._project_search_results:
            results = self._project_search_results[effective_project]
        else:
            results = self._search_results

        page_hits = results[skip : skip + top]

        # Facets: project-level facets override org-level
        facets: CodeSearchFacets | None = None
        if include_facets:
            if effective_project and effective_project in self._project_facets:
                facets = self._project_facets[effective_project]
            else:
                facets = self._facets

        return CodeSearchPage(
            hits=page_hits,
            total_count=len(results),
            skip=skip,
            top=top,
            facets=facets,
        )


@final
class FakeQueryStore:
    """Fake del port QueryStoragePort para tests unitarios."""

    def __init__(self) -> None:
        from azure_repos_scan.domain.models import DailyQueryRecord

        self.records: list[DailyQueryRecord] = []

    def save_query(self, record: "DailyQueryRecord") -> None:  # noqa: UP037
        from azure_repos_scan.domain.models import DailyQueryRecord

        existing = next(
            (r for r in self.records if r.query_date == record.query_date), None
        )
        if existing is not None:
            existing.merge(record)
        else:
            self.records.append(record)

    def load_queries(self) -> "list[DailyQueryRecord]":  # noqa: UP037
        return list(self.records)

    def get_query_by_date(self, query_date: "date") -> "DailyQueryRecord | None":  # noqa: UP037, F821
        return next((r for r in self.records if r.query_date == query_date), None)


@pytest.fixture
def sample_project() -> Project:
    """Proyecto de ejemplo para tests."""
    return Project(
        id=ProjectId("proj-001"),
        name="MyProject",
        description="Proyecto de prueba",
        url="https://dev.azure.com/org/MyProject",
    )


@pytest.fixture
def sample_repository(sample_project: Project) -> Repository:
    """Repositorio de ejemplo para tests."""
    return Repository(
        id=RepositoryId("repo-001"),
        name="my-repo",
        project=sample_project,
        default_branch="master",
        url="https://dev.azure.com/org/MyProject/_git/my-repo",
        size_bytes=1024000,
    )


@pytest.fixture
def fake_client(
    sample_project: Project,
    sample_repository: Repository,
) -> FakeAzureDevOpsClient:
    """Cliente fake con datos de ejemplo."""
    return FakeAzureDevOpsClient(
        projects=[sample_project],
        repos_by_project={sample_project.name: [sample_repository]},
    )
