"""Tests para JsonQueryStore."""

from __future__ import annotations

from datetime import date
from pathlib import Path

from azure_repos_scan.domain.models import (
    CodeSearchHit,
    DailyQueryRecord,
    DotNetVersion,
)
from azure_repos_scan.infrastructure.persistence.query_store import JsonQueryStore


def _make_hit(version: DotNetVersion = DotNetVersion.NET_8) -> CodeSearchHit:
    return CodeSearchHit(
        repository_name="my-repo",
        project_name="MyProject",
        dotnet_version=version,
        branch="master",
    )


def _make_record(
    query_date: date | None = None,
    version: DotNetVersion = DotNetVersion.NET_8,
) -> DailyQueryRecord:
    return DailyQueryRecord(
        query_date=query_date or date(2025, 1, 15),
        organization="test-org",
        project="MyProject",
        versions_searched=[version],
        results_by_version={version.moniker: [_make_hit(version)]},
    )


class TestJsonQueryStore:
    """Tests para el almacén JSON de consultas."""

    def test_save_and_load(self, tmp_path: Path) -> None:
        store = JsonQueryStore(tmp_path / "queries.json")
        record = _make_record()
        store.save_query(record)

        loaded = store.load_queries()
        assert len(loaded) == 1
        assert loaded[0].organization == "test-org"
        assert loaded[0].total_results == 1

    def test_load_returns_empty_when_no_file(self, tmp_path: Path) -> None:
        store = JsonQueryStore(tmp_path / "nonexistent.json")
        assert store.load_queries() == []

    def test_get_by_date(self, tmp_path: Path) -> None:
        store = JsonQueryStore(tmp_path / "queries.json")
        record = _make_record(date(2025, 3, 10))
        store.save_query(record)

        found = store.get_query_by_date(date(2025, 3, 10))
        assert found is not None
        assert found.query_date == date(2025, 3, 10)

    def test_get_by_date_returns_none(self, tmp_path: Path) -> None:
        store = JsonQueryStore(tmp_path / "queries.json")
        assert store.get_query_by_date(date(2025, 1, 1)) is None

    def test_merge_same_day(self, tmp_path: Path) -> None:
        store = JsonQueryStore(tmp_path / "queries.json")
        record1 = _make_record(date(2025, 1, 15), DotNetVersion.NET_8)
        record2 = _make_record(date(2025, 1, 15), DotNetVersion.NET_6)

        store.save_query(record1)
        store.save_query(record2)

        loaded = store.load_queries()
        assert len(loaded) == 1  # merged into single record
        assert loaded[0].total_results == 2
        assert "net8.0" in loaded[0].results_by_version
        assert "net6.0" in loaded[0].results_by_version

    def test_different_days_not_merged(self, tmp_path: Path) -> None:
        store = JsonQueryStore(tmp_path / "queries.json")
        record1 = _make_record(date(2025, 1, 15))
        record2 = _make_record(date(2025, 1, 16))

        store.save_query(record1)
        store.save_query(record2)

        loaded = store.load_queries()
        assert len(loaded) == 2

    def test_roundtrip_preserves_hit_data(self, tmp_path: Path) -> None:
        store = JsonQueryStore(tmp_path / "queries.json")
        record = _make_record()
        store.save_query(record)

        loaded = store.load_queries()
        hit = loaded[0].results_by_version["net8.0"][0]
        assert hit.repository_name == "my-repo"
        assert hit.project_name == "MyProject"
        assert hit.dotnet_version == DotNetVersion.NET_8
        assert hit.branch == "master"

    def test_roundtrip_preserves_versions_searched(self, tmp_path: Path) -> None:
        store = JsonQueryStore(tmp_path / "queries.json")
        record = _make_record()
        store.save_query(record)

        loaded = store.load_queries()
        assert DotNetVersion.NET_8 in loaded[0].versions_searched
