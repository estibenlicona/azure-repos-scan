"""Tests para modelos y caso de uso de Code Search .NET."""

from __future__ import annotations

from datetime import date

from azure_repos_scan.application.use_cases import SearchDotNetProjectsUseCase
from azure_repos_scan.domain.models import (
    DEFAULT_BRANCHES,
    CodeSearchFacets,
    CodeSearchHit,
    DailyQueryRecord,
    DotNetVersion,
    FacetItem,
)
from tests.conftest import FakeAzureDevOpsClient, FakeQueryStore


class TestDotNetVersion:
    """Tests para el enum DotNetVersion."""

    def test_all_versions_have_label(self) -> None:
        for v in DotNetVersion:
            assert v.label.startswith(".NET")

    def test_net8_moniker(self) -> None:
        assert DotNetVersion.NET_8.moniker == "net8.0"

    def test_net3_1_moniker(self) -> None:
        assert DotNetVersion.NET_3_1.moniker == "netcoreapp3.1"

    def test_build_search_queries_returns_two(self) -> None:
        queries = DotNetVersion.NET_6.build_search_queries()
        assert len(queries) == 2
        assert "TargetFramework" in queries[0]
        assert "TargetFrameworks" in queries[1]

    def test_build_search_queries_contains_moniker(self) -> None:
        queries = DotNetVersion.NET_9.build_search_queries()
        for q in queries:
            assert "net9.0" in q

    def test_all_versions_count(self) -> None:
        assert len(DotNetVersion) == 7


class TestCodeSearchHit:
    """Tests para CodeSearchHit."""

    def test_creates_hit(self) -> None:
        hit = CodeSearchHit(
            repository_name="my-repo",
            project_name="MyProject",
            dotnet_version=DotNetVersion.NET_8,
            branch="master",
        )
        assert hit.repository_name == "my-repo"
        assert hit.dotnet_version.label == ".NET 8"

    def test_hit_is_frozen(self) -> None:
        hit = CodeSearchHit(
            repository_name="r",
            project_name="p",
            dotnet_version=DotNetVersion.NET_6,
            branch="master",
        )
        try:
            hit.repository_name = "other"  # pyright: ignore[reportAttributeAccessIssue]
            assert False, "Should be frozen"  # noqa: B011
        except AttributeError:
            pass


class TestDailyQueryRecord:
    """Tests para DailyQueryRecord."""

    def _make_hit(self, version: DotNetVersion, repo: str = "repo") -> CodeSearchHit:
        return CodeSearchHit(
            repository_name=repo,
            project_name="proj",
            dotnet_version=version,
            branch="master",
        )

    def test_total_results(self) -> None:
        record = DailyQueryRecord(
            query_date=date(2025, 1, 15),
            organization="org",
            project=None,
            versions_searched=[DotNetVersion.NET_8],
            results_by_version={"net8.0": [self._make_hit(DotNetVersion.NET_8)]},
        )
        assert record.total_results == 1

    def test_merge_adds_new_version(self) -> None:
        record1 = DailyQueryRecord(
            query_date=date(2025, 1, 15),
            organization="org",
            project=None,
            versions_searched=[DotNetVersion.NET_8],
            results_by_version={"net8.0": [self._make_hit(DotNetVersion.NET_8)]},
        )
        record2 = DailyQueryRecord(
            query_date=date(2025, 1, 15),
            organization="org",
            project=None,
            versions_searched=[DotNetVersion.NET_6],
            results_by_version={"net6.0": [self._make_hit(DotNetVersion.NET_6)]},
        )
        record1.merge(record2)
        assert record1.total_results == 2
        assert "net6.0" in record1.results_by_version
        assert "net8.0" in record1.results_by_version

    def test_merge_replaces_same_version(self) -> None:
        hit1 = self._make_hit(DotNetVersion.NET_8, "repo-a")
        hit2 = self._make_hit(DotNetVersion.NET_8, "repo-b")
        record1 = DailyQueryRecord(
            query_date=date(2025, 1, 15),
            organization="org",
            project=None,
            versions_searched=[DotNetVersion.NET_8],
            results_by_version={"net8.0": [hit1]},
        )
        record2 = DailyQueryRecord(
            query_date=date(2025, 1, 15),
            organization="org",
            project=None,
            versions_searched=[DotNetVersion.NET_8],
            results_by_version={"net8.0": [hit2]},
        )
        record1.merge(record2)
        # merge replaces the version key
        assert len(record1.results_by_version["net8.0"]) == 1
        assert record1.results_by_version["net8.0"][0].repository_name == "repo-b"

    def test_get_all_hits(self) -> None:
        record = DailyQueryRecord(
            query_date=date(2025, 1, 15),
            organization="org",
            project=None,
            versions_searched=[DotNetVersion.NET_8, DotNetVersion.NET_6],
            results_by_version={
                "net8.0": [self._make_hit(DotNetVersion.NET_8)],
                "net6.0": [self._make_hit(DotNetVersion.NET_6, "repo2")],
            },
        )
        all_hits = record.get_all_hits()
        assert len(all_hits) == 2


class TestSearchDotNetProjectsUseCase:
    """Tests para el caso de uso SearchDotNetProjects."""

    def _make_hits(self, version: DotNetVersion, count: int) -> list[CodeSearchHit]:
        return [
            CodeSearchHit(
                repository_name=f"repo-{i}",
                project_name="proj",
                dotnet_version=version,
                branch="master",
            )
            for i in range(count)
        ]

    def test_searches_selected_versions(self) -> None:
        org_facets = CodeSearchFacets(
            projects=[FacetItem(name="proj", result_count=3)],
        )
        proj_facets = CodeSearchFacets(
            repositories=[FacetItem(name="repo-0", result_count=3)],
        )
        hits = self._make_hits(DotNetVersion.NET_8, 3)
        client = FakeAzureDevOpsClient(
            search_results=hits,
            facets=org_facets,
            project_facets={"proj": proj_facets},
        )
        store = FakeQueryStore()
        uc = SearchDotNetProjectsUseCase(client, store, "org")

        record = uc.execute(
            [DotNetVersion.NET_8], project=None, branches=["develop", "master"],
        )

        assert record.total_results > 0
        assert DotNetVersion.NET_8 in record.versions_searched
        assert len(store.records) == 1

    def test_facets_based_no_pagination(self) -> None:
        """Con la estrategia de facetas, no se necesita paginación."""
        org_facets = CodeSearchFacets(
            projects=[FacetItem(name="proj", result_count=60)],
        )
        proj_facets = CodeSearchFacets(
            repositories=[
                FacetItem(name=f"repo-{i}", result_count=1)
                for i in range(10)
            ],
        )
        hits = self._make_hits(DotNetVersion.NET_6, 60)
        client = FakeAzureDevOpsClient(
            search_results=hits,
            facets=org_facets,
            project_facets={"proj": proj_facets},
        )
        store = FakeQueryStore()
        uc = SearchDotNetProjectsUseCase(client, store, "org")

        record = uc.execute(
            [DotNetVersion.NET_6], project=None, branches=["develop"],
        )

        assert record.total_results > 0
        # Todas las llamadas usan skip=0 y top=1 (probes), sin paginación
        for call in client.search_calls:
            assert call[2] == 0  # skip siempre es 0
            assert call[3] == 1  # top siempre es 1

    def test_saves_to_store(self) -> None:
        client = FakeAzureDevOpsClient(search_results=[])
        store = FakeQueryStore()
        uc = SearchDotNetProjectsUseCase(client, store, "org")

        uc.execute([DotNetVersion.NET_8], project="MyProject")

        assert len(store.records) == 1
        assert store.records[0].organization == "org"
        assert store.records[0].project == "MyProject"

    def test_progress_callback_called(self) -> None:
        client = FakeAzureDevOpsClient(search_results=[])
        store = FakeQueryStore()
        uc = SearchDotNetProjectsUseCase(client, store, "org")

        progress_calls: list[tuple[int, int, str]] = []

        def on_progress(cur: int, total: int, msg: str) -> None:
            progress_calls.append((cur, total, msg))

        uc.execute([DotNetVersion.NET_8], project=None, on_progress=on_progress)

        # At least the final "completado" call
        assert len(progress_calls) > 0
        last = progress_calls[-1]
        assert last[0] == last[1]  # current == total

    def test_multiple_versions(self) -> None:
        hits_8 = self._make_hits(DotNetVersion.NET_8, 2)
        # Fake returns same results regardless of query, so dedup matters
        client = FakeAzureDevOpsClient(search_results=hits_8)
        store = FakeQueryStore()
        uc = SearchDotNetProjectsUseCase(client, store, "org")

        record = uc.execute([DotNetVersion.NET_8, DotNetVersion.NET_6], project=None)

        assert DotNetVersion.NET_8 in record.versions_searched
        assert DotNetVersion.NET_6 in record.versions_searched


class TestFacetModels:
    """Tests para FacetItem y CodeSearchFacets."""

    def test_facet_item_creation(self) -> None:
        item = FacetItem(name="ProjectA", result_count=42)
        assert item.name == "ProjectA"
        assert item.result_count == 42

    def test_facet_item_frozen(self) -> None:
        item = FacetItem(name="X", result_count=1)
        try:
            item.name = "Y"  # pyright: ignore[reportAttributeAccessIssue]
            assert False, "Should be frozen"  # noqa: B011
        except AttributeError:
            pass

    def test_code_search_facets_defaults(self) -> None:
        facets = CodeSearchFacets()
        assert facets.projects == []
        assert facets.repositories == []

    def test_code_search_facets_with_data(self) -> None:
        facets = CodeSearchFacets(
            projects=[FacetItem(name="P1", result_count=10)],
            repositories=[FacetItem(name="R1", result_count=5)],
        )
        assert len(facets.projects) == 1
        assert len(facets.repositories) == 1

    def test_default_branches_values(self) -> None:
        assert "develop" in DEFAULT_BRANCHES
        assert "test" in DEFAULT_BRANCHES
        assert "master" in DEFAULT_BRANCHES
        assert "master" in DEFAULT_BRANCHES
        assert len(DEFAULT_BRANCHES) == 4


class TestSearchWithBranchFilter:
    """Tests para verificar la estrategia basada en facetas."""

    def test_search_passes_filters_to_client(self) -> None:
        """Verificar que search_code recibe filtro de branches."""
        # Org facets → 1 proyecto, project facets → 1 repo
        org_facets = CodeSearchFacets(
            projects=[FacetItem(name="Proj", result_count=5)],
        )
        proj_facets = CodeSearchFacets(
            repositories=[FacetItem(name="my-repo", result_count=5)],
        )
        client = FakeAzureDevOpsClient(
            search_results=[
                CodeSearchHit(
                    repository_name="my-repo",
                    project_name="Proj",
                    dotnet_version=DotNetVersion.NET_8,
                    branch="",
                ),
            ],
            facets=org_facets,
            project_facets={"Proj": proj_facets},
        )
        store = FakeQueryStore()
        uc = SearchDotNetProjectsUseCase(client, store, "org")

        uc.execute(
            [DotNetVersion.NET_8], project=None, branches=["develop", "master"],
        )

        assert len(client.search_calls) > 0

    def test_facets_extract_repos_without_pagination(self) -> None:
        """Los repos se obtienen de facetas, sin paginar resultados individuales."""
        org_facets = CodeSearchFacets(
            projects=[FacetItem(name="ProjA", result_count=50)],
        )
        proj_facets = CodeSearchFacets(
            repositories=[
                FacetItem(name="repo-1", result_count=30),
                FacetItem(name="repo-2", result_count=20),
            ],
        )
        # search_results tiene solo 1 hit (el probe), no necesitamos más
        client = FakeAzureDevOpsClient(
            search_results=[
                CodeSearchHit(
                    repository_name="dummy",
                    project_name="ProjA",
                    dotnet_version=DotNetVersion.NET_8,
                    branch="",
                ),
            ],
            facets=org_facets,
            project_facets={"ProjA": proj_facets},
        )
        store = FakeQueryStore()
        uc = SearchDotNetProjectsUseCase(client, store, "org")

        record = uc.execute(
            [DotNetVersion.NET_8], project=None, branches=["develop"],
        )

        # Debe tener 2 repos (de las facetas), no los hits paginados
        all_hits = record.get_all_hits()
        repo_names = {h.repository_name for h in all_hits}
        assert "repo-1" in repo_names
        assert "repo-2" in repo_names

    def test_subdivision_by_project_via_facets(self) -> None:
        """Múltiples proyectos: obtiene facets de Repository por cada uno."""
        org_facets = CodeSearchFacets(
            projects=[
                FacetItem(name="ProjA", result_count=600),
                FacetItem(name="ProjB", result_count=500),
            ],
        )
        proj_a_facets = CodeSearchFacets(
            repositories=[
                FacetItem(name="repo-a-1", result_count=400),
                FacetItem(name="repo-a-2", result_count=200),
            ],
        )
        proj_b_facets = CodeSearchFacets(
            repositories=[FacetItem(name="repo-b-1", result_count=500)],
        )
        client = FakeAzureDevOpsClient(
            search_results=[
                CodeSearchHit(
                    repository_name="dummy",
                    project_name="org",
                    dotnet_version=DotNetVersion.NET_8,
                    branch="",
                ),
            ],
            facets=org_facets,
            project_facets={
                "ProjA": proj_a_facets,
                "ProjB": proj_b_facets,
            },
        )
        store = FakeQueryStore()
        uc = SearchDotNetProjectsUseCase(client, store, "org")

        record = uc.execute(
            [DotNetVersion.NET_8], project=None, branches=["master"],
        )

        all_hits = record.get_all_hits()
        repo_names = {h.repository_name for h in all_hits}
        assert "repo-a-1" in repo_names
        assert "repo-a-2" in repo_names
        assert "repo-b-1" in repo_names
        # Debe consultar cada proyecto individualmente via filters
        project_names = set()
        for c in client.search_calls:
            flt = c[4] or {}
            for p in flt.get("Project", []):
                project_names.add(p)
        assert "ProjA" in project_names
        assert "ProjB" in project_names

    def test_per_branch_queries_assign_branch(self) -> None:
        """Cada branch genera hits con la branch correcta, no vacía."""
        org_facets = CodeSearchFacets(
            projects=[FacetItem(name="Proj", result_count=10)],
        )
        proj_facets = CodeSearchFacets(
            repositories=[FacetItem(name="repo-1", result_count=10)],
        )
        client = FakeAzureDevOpsClient(
            search_results=[
                CodeSearchHit(
                    repository_name="dummy",
                    project_name="Proj",
                    dotnet_version=DotNetVersion.NET_8,
                    branch="",
                ),
            ],
            facets=org_facets,
            project_facets={"Proj": proj_facets},
        )
        store = FakeQueryStore()
        uc = SearchDotNetProjectsUseCase(client, store, "org")

        record = uc.execute(
            [DotNetVersion.NET_8], project=None,
            branches=["develop", "test", "master"],
        )

        all_hits = record.get_all_hits()
        branches = {h.branch for h in all_hits}
        # Fake devuelve mismas facetas para todas las branches,
        # por lo que repo-1 aparece en cada branch solicitada
        assert "develop" in branches
        assert "test" in branches
        assert "master" in branches
        # Ningún hit debe tener branch vacía
        assert "" not in branches
        # repo-1 aparece 3 veces (una por branch) por cada query (singular+plural)
        # pero dedup por (repo, branch) reduce a 3
        repo1_hits = [h for h in all_hits if h.repository_name == "repo-1"]
        assert len(repo1_hits) == 3

    def test_no_branch_filter_returns_all(self) -> None:
        """Sin branches seleccionadas, busca sin filtro de branch."""
        org_facets = CodeSearchFacets(
            projects=[FacetItem(name="Proj", result_count=10)],
        )
        proj_facets = CodeSearchFacets(
            repositories=[FacetItem(name="repo-1", result_count=10)],
        )
        client = FakeAzureDevOpsClient(
            search_results=[
                CodeSearchHit(
                    repository_name="dummy",
                    project_name="Proj",
                    dotnet_version=DotNetVersion.NET_8,
                    branch="",
                ),
            ],
            facets=org_facets,
            project_facets={"Proj": proj_facets},
        )
        store = FakeQueryStore()
        uc = SearchDotNetProjectsUseCase(client, store, "org")

        record = uc.execute([DotNetVersion.NET_8], project=None, branches=[])

        all_hits = record.get_all_hits()
        assert len(all_hits) > 0
        # Branch queda vacía cuando no se filtra
        assert all(h.branch == "" for h in all_hits)
        # No debe enviar filtro Branch en ninguna llamada
        for c in client.search_calls:
            flt = c[4] or {}
            assert "Branch" not in flt
