"""Tests para BuildDashboardDataUseCase y modelos de reporte."""

from __future__ import annotations

from datetime import date

from azure_repos_scan.application.use_cases import BuildDashboardDataUseCase, _group_hits_into_repos
from azure_repos_scan.domain.models import (
    CodeSearchHit,
    DailyQueryRecord,
    DotNetVersion,
    MonthlySnapshot,
    RepoSummary,
)
from tests.conftest import FakeQueryStore


def _hit(
    repo: str = "MyRepo",
    project: str = "Backend",
    version: DotNetVersion = DotNetVersion.NET_8,
    branch: str = "master",
) -> CodeSearchHit:
    return CodeSearchHit(
        repository_name=repo,
        project_name=project,
        dotnet_version=version,
        branch=branch,
    )


def _record(
    query_date: date,
    hits_by_version: dict[str, list[CodeSearchHit]],
    org: str = "myorg",
) -> DailyQueryRecord:
    versions = []
    for moniker in hits_by_version:
        for v in DotNetVersion:
            if v.moniker == moniker:
                versions.append(v)
                break
    return DailyQueryRecord(
        query_date=query_date,
        organization=org,
        project=None,
        versions_searched=versions,
        results_by_version=hits_by_version,
    )


# -----------------------------------------------------------------------
# DotNetVersion.sort_key
# -----------------------------------------------------------------------


class TestSortKey:
    def test_sort_key_ordering(self) -> None:
        assert DotNetVersion.NET_3_1.sort_key < DotNetVersion.NET_5.sort_key
        assert DotNetVersion.NET_5.sort_key < DotNetVersion.NET_8.sort_key
        assert DotNetVersion.NET_8.sort_key < DotNetVersion.NET_10.sort_key

    def test_sort_key_all_unique(self) -> None:
        keys = [v.sort_key for v in DotNetVersion]
        assert len(keys) == len(set(keys))


# -----------------------------------------------------------------------
# RepoSummary y agrupación
# -----------------------------------------------------------------------


class TestGroupHitsIntoRepos:
    def test_multiple_csprojs_same_repo(self) -> None:
        hits = [
            _hit(repo="RepoA"),
            _hit(repo="RepoA"),
            _hit(repo="RepoA"),
        ]
        summaries = _group_hits_into_repos(hits)
        assert len(summaries) == 1
        assert summaries[0].csproj_count == 3
        assert summaries[0].repository_name == "RepoA"

    def test_oldest_version_selected(self) -> None:
        hits = [
            _hit(repo="RepoA", version=DotNetVersion.NET_8),
            _hit(repo="RepoA", version=DotNetVersion.NET_6),
        ]
        summaries = _group_hits_into_repos(hits)
        assert summaries[0].oldest_version == DotNetVersion.NET_6

    def test_all_versions_collected(self) -> None:
        hits = [
            _hit(repo="RepoA", version=DotNetVersion.NET_6),
            _hit(repo="RepoA", version=DotNetVersion.NET_8),
        ]
        summaries = _group_hits_into_repos(hits)
        assert summaries[0].all_versions == frozenset({DotNetVersion.NET_6, DotNetVersion.NET_8})

    def test_branches_collected(self) -> None:
        hits = [
            _hit(repo="RepoA", branch="master"),
            _hit(repo="RepoA", branch="develop"),
        ]
        summaries = _group_hits_into_repos(hits)
        assert summaries[0].branches == frozenset({"master", "develop"})

    def test_branch_filter(self) -> None:
        hits = [
            _hit(repo="RepoA", branch="master"),
            _hit(repo="RepoA", branch="develop"),
            _hit(repo="RepoB", branch="develop"),
        ]
        summaries = _group_hits_into_repos(hits, branch_filter="master")
        assert len(summaries) == 1
        assert summaries[0].repository_name == "RepoA"
        assert summaries[0].csproj_count == 1

    def test_empty_hits(self) -> None:
        summaries = _group_hits_into_repos([])
        assert summaries == []

    def test_different_repos_separate(self) -> None:
        hits = [
            _hit(repo="RepoA"),
            _hit(repo="RepoB"),
        ]
        summaries = _group_hits_into_repos(hits)
        assert len(summaries) == 2


# -----------------------------------------------------------------------
# BuildDashboardDataUseCase
# -----------------------------------------------------------------------


class TestBuildDashboardData:
    def test_build_for_date(self) -> None:
        store = FakeQueryStore()
        record = _record(
            date(2026, 3, 28),
            {
                "net8.0": [
                    _hit(repo="RepoA", version=DotNetVersion.NET_8),
                    _hit(repo="RepoB", version=DotNetVersion.NET_8),
                ],
                "net6.0": [
                    _hit(repo="RepoA", version=DotNetVersion.NET_6),
                ],
            },
        )
        store.records.append(record)

        uc = BuildDashboardDataUseCase(store)
        data = uc.build_for_date(date(2026, 3, 28))

        assert data is not None
        assert data.total_repos == 2  # RepoA (oldest=net6) + RepoB (oldest=net8)
        assert data.total_csprojs == 3

    def test_build_for_date_not_found(self) -> None:
        store = FakeQueryStore()
        uc = BuildDashboardDataUseCase(store)
        data = uc.build_for_date(date(2026, 1, 1))
        assert data is None

    def test_branches_dynamic(self) -> None:
        store = FakeQueryStore()
        record = _record(
            date(2026, 3, 28),
            {
                "net8.0": [
                    _hit(repo="RepoA", branch="master"),
                    _hit(repo="RepoB", branch="develop"),
                    _hit(repo="RepoC", branch="release/v1"),
                ],
            },
        )
        store.records.append(record)

        uc = BuildDashboardDataUseCase(store)
        data = uc.build_for_date(date(2026, 3, 28))
        assert data is not None
        assert set(data.branches_available) == {"master", "develop", "release/v1"}

    def test_branch_filter_applied(self) -> None:
        store = FakeQueryStore()
        record = _record(
            date(2026, 3, 28),
            {
                "net8.0": [
                    _hit(repo="RepoA", branch="master"),
                    _hit(repo="RepoB", branch="develop"),
                ],
            },
        )
        store.records.append(record)

        uc = BuildDashboardDataUseCase(store)
        data = uc.build_for_date(date(2026, 3, 28), branch_filter="master")
        assert data is not None
        assert data.total_repos == 1

    def test_repos_grouped_by_oldest_version(self) -> None:
        store = FakeQueryStore()
        record = _record(
            date(2026, 3, 28),
            {
                "net8.0": [
                    _hit(repo="RepoA", version=DotNetVersion.NET_8),
                ],
                "net6.0": [
                    _hit(repo="RepoA", version=DotNetVersion.NET_6),
                ],
            },
        )
        store.records.append(record)

        uc = BuildDashboardDataUseCase(store)
        data = uc.build_for_date(date(2026, 3, 28))
        assert data is not None
        # RepoA should be grouped under NET_6 (its oldest version)
        assert DotNetVersion.NET_6 in data.repos_by_version
        assert len(data.repos_by_version[DotNetVersion.NET_6]) == 1
        assert DotNetVersion.NET_8 not in data.repos_by_version


# -----------------------------------------------------------------------
# Monthly evolution
# -----------------------------------------------------------------------


class TestMonthlyEvolution:
    def test_basic_evolution(self) -> None:
        store = FakeQueryStore()
        store.records.append(
            _record(date(2026, 1, 15), {"net8.0": [_hit(repo="R1")]})
        )
        store.records.append(
            _record(date(2026, 2, 10), {"net8.0": [_hit(repo="R1"), _hit(repo="R2")]})
        )
        store.records.append(
            _record(date(2026, 3, 28), {
                "net8.0": [_hit(repo="R1", version=DotNetVersion.NET_8)],
                "net9.0": [_hit(repo="R2", version=DotNetVersion.NET_9)],
            })
        )

        uc = BuildDashboardDataUseCase(store)
        snapshots = uc.build_monthly_evolution(months=6)

        assert len(snapshots) == 3
        assert snapshots[0].month == "2026-01"
        assert snapshots[1].month == "2026-02"
        assert snapshots[2].month == "2026-03"

    def test_most_recent_per_month(self) -> None:
        store = FakeQueryStore()
        store.records.append(
            _record(date(2026, 3, 1), {"net8.0": [_hit(repo="R1")]})
        )
        store.records.append(
            _record(date(2026, 3, 28), {
                "net8.0": [_hit(repo="R1"), _hit(repo="R2")],
            })
        )

        uc = BuildDashboardDataUseCase(store)
        snapshots = uc.build_monthly_evolution(months=6)

        # Should use March 28 (most recent)
        assert len(snapshots) == 1
        assert snapshots[0].month == "2026-03"
        assert snapshots[0].repos_by_version.get(DotNetVersion.NET_8) == 2

    def test_empty_store(self) -> None:
        store = FakeQueryStore()
        uc = BuildDashboardDataUseCase(store)
        snapshots = uc.build_monthly_evolution()
        assert snapshots == []

    def test_available_dates(self) -> None:
        store = FakeQueryStore()
        store.records.append(_record(date(2026, 1, 10), {"net8.0": [_hit()]}))
        store.records.append(_record(date(2026, 3, 28), {"net8.0": [_hit()]}))

        uc = BuildDashboardDataUseCase(store)
        dates = uc.get_available_dates()
        assert dates == [date(2026, 3, 28), date(2026, 1, 10)]
