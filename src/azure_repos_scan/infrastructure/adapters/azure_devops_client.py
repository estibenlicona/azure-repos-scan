"""Implementación del cliente de Azure DevOps usando httpx."""

from __future__ import annotations

import base64
import time
from typing import Any, Sequence, final

import httpx
from pydantic import SecretStr

from azure_repos_scan.domain.exceptions import (
    ApiError,
    AuthenticationError,
    RateLimitError,
    SearchIndexNotReadyError,
)
from azure_repos_scan.domain.models import (
    CodeSearchFacets,
    CodeSearchHit,
    CodeSearchPage,
    DotNetVersion,
    FacetItem,
    Project,
    ProjectId,
    Repository,
    RepositoryId,
)

_MAX_RETRIES = 3
_API_BASE = "https://dev.azure.com"
_CODE_SEARCH_BASE = "https://almsearch.dev.azure.com"


@final
class HttpxAzureDevOpsClient:
    """Implementación concreta del port AzureDevOpsClient usando httpx."""

    def __init__(
        self,
        organization: str,
        pat: SecretStr,
    ) -> None:
        token_bytes = f":{pat.get_secret_value()}".encode("ascii")
        encoded = base64.b64encode(token_bytes).decode("ascii")
        auth_headers: dict[str, str] = {
            "Authorization": f"Basic {encoded}",
            "Content-Type": "application/json",
        }
        self._organization = organization
        self._client = httpx.Client(
            base_url=f"{_API_BASE}/{organization}",
            headers=auth_headers,
            timeout=30.0,
        )
        self._search_client = httpx.Client(
            base_url=f"{_CODE_SEARCH_BASE}/{organization}",
            headers=auth_headers,
            timeout=60.0,
        )

    # ------------------------------------------------------------------
    # Projects & Repositories (existente)
    # ------------------------------------------------------------------

    def list_projects(self) -> Sequence[Project]:
        """Obtener todos los proyectos de la organización."""
        response = self._request("GET", "/_apis/projects", params={"api-version": "7.1"})
        raw_projects: list[dict[str, Any]] = response.get("value", [])
        return [
            Project(
                id=ProjectId(p["id"]),
                name=p["name"],
                description=p.get("description", ""),
                url=p.get("url", ""),
            )
            for p in raw_projects
        ]

    def list_repositories(self, project_name: str) -> Sequence[Repository]:
        """Obtener todos los repositorios de un proyecto."""
        projects = self.list_projects()
        project = next((p for p in projects if p.name == project_name), None)
        if project is None:
            return []

        response = self._request(
            "GET",
            f"/{project_name}/_apis/git/repositories",
            params={"api-version": "7.1"},
        )
        raw_repos: list[dict[str, Any]] = response.get("value", [])
        return [
            Repository(
                id=RepositoryId(r["id"]),
                name=r["name"],
                project=project,
                default_branch=r.get("defaultBranch", ""),
                url=r.get("webUrl", ""),
                size_bytes=r.get("size", 0),
            )
            for r in raw_repos
        ]

    # ------------------------------------------------------------------
    # Code Search
    # ------------------------------------------------------------------

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
        """Buscar código vía Azure DevOps Code Search API."""
        path = (
            f"/{project}/_apis/search/codesearchresults"
            if project
            else "/_apis/search/codesearchresults"
        )
        body: dict[str, Any] = {
            "searchText": search_text,
            "$skip": skip,
            "$top": top,
        }
        if filters:
            body["filters"] = filters
        if include_facets:
            body["includeFacets"] = True

        data = self._search_request(path, body)

        info_code: int = data.get("infoCode", 0)
        if info_code in (1, 2):
            raise SearchIndexNotReadyError

        version = self._detect_version_from_query(search_text)
        raw_results: list[dict[str, Any]] = data.get("results", [])
        hits: list[CodeSearchHit] = []
        for r in raw_results:
            repo_info: dict[str, Any] = r.get("repository", {})
            proj_info: dict[str, Any] = r.get("project", {})
            versions_list: list[dict[str, Any]] = r.get("versions", [])
            branch = versions_list[0].get("branchName", "") if versions_list else ""
            hits.append(
                CodeSearchHit(
                    repository_name=repo_info.get("name", ""),
                    project_name=proj_info.get("name", ""),
                    dotnet_version=version,
                    branch=branch,
                )
            )

        total_count: int = data.get("count", 0)

        facets: CodeSearchFacets | None = None
        if include_facets:
            raw_facets: dict[str, list[dict[str, Any]]] = data.get("facets") or {}
            facets = CodeSearchFacets(
                projects=[
                    FacetItem(name=f["name"], result_count=f["resultCount"])
                    for f in raw_facets.get("Project", [])
                ],
                repositories=[
                    FacetItem(name=f["name"], result_count=f["resultCount"])
                    for f in raw_facets.get("Repository", [])
                ],
            )

        return CodeSearchPage(
            hits=hits, total_count=total_count, skip=skip, top=top, facets=facets,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _detect_version_from_query(search_text: str) -> DotNetVersion:
        """Detectar la versión .NET a partir del texto de búsqueda."""
        for version in DotNetVersion:
            if version.moniker in search_text:
                return version
        return DotNetVersion.NET_8  # fallback

    def _search_request(
        self,
        path: str,
        body: dict[str, Any],
    ) -> dict[str, Any]:
        """POST al endpoint de Code Search con retry en rate limit."""
        for attempt in range(_MAX_RETRIES):
            response = self._search_client.post(
                path,
                json=body,
                params={"api-version": "7.1"},
            )
            if response.status_code == 401:  # noqa: PLR2004
                raise AuthenticationError
            if response.status_code == 429:  # noqa: PLR2004
                retry_after = int(response.headers.get("Retry-After", "30"))
                if attempt < _MAX_RETRIES - 1:
                    time.sleep(retry_after)
                    continue
                raise RateLimitError(retry_after)
            if response.status_code >= 400:  # noqa: PLR2004
                raise ApiError(response.status_code, response.text)
            result: dict[str, Any] = response.json()
            return result
        msg = "Máximo de reintentos alcanzado"
        raise ApiError(0, msg)

    def _request(
        self,
        method: str,
        path: str,
        params: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Ejecutar una petición HTTP y manejar errores."""
        response = self._client.request(method, path, params=params)
        if response.status_code == 401:  # noqa: PLR2004
            raise AuthenticationError
        if response.status_code >= 400:  # noqa: PLR2004
            raise ApiError(response.status_code, response.text)
        result: dict[str, Any] = response.json()
        return result
