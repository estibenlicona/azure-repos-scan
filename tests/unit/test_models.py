"""Tests para modelos del dominio."""

from __future__ import annotations

import pytest

from azure_repos_scan.domain.models import (
    OrganizationName,
    Project,
    ProjectId,
    Repository,
    RepositoryId,
)


class TestOrganizationName:
    """Tests para el value object OrganizationName."""

    def test_creates_valid_organization(self) -> None:
        org = OrganizationName("my-org")
        assert org.value == "my-org"

    def test_raises_on_empty_name(self) -> None:
        with pytest.raises(ValueError, match="no puede estar vacío"):
            OrganizationName("")

    def test_raises_on_whitespace_only(self) -> None:
        with pytest.raises(ValueError, match="no puede estar vacío"):
            OrganizationName("   ")

    def test_is_frozen(self) -> None:
        org = OrganizationName("test")
        with pytest.raises(AttributeError):
            org.value = "other"  # pyright: ignore[reportAttributeAccessIssue]


class TestProjectId:
    """Tests para el value object ProjectId."""

    def test_creates_valid_id(self) -> None:
        pid = ProjectId("proj-123")
        assert pid.value == "proj-123"

    def test_raises_on_empty(self) -> None:
        with pytest.raises(ValueError, match="no puede estar vacío"):
            ProjectId("")


class TestRepositoryId:
    """Tests para el value object RepositoryId."""

    def test_creates_valid_id(self) -> None:
        rid = RepositoryId("repo-abc")
        assert rid.value == "repo-abc"

    def test_raises_on_empty(self) -> None:
        with pytest.raises(ValueError, match="no puede estar vacío"):
            RepositoryId("")


class TestProject:
    """Tests para la entidad Project."""

    def test_creates_project(self) -> None:
        project = Project(
            id=ProjectId("p1"),
            name="Test",
            description="Desc",
            url="https://example.com",
        )
        assert project.name == "Test"
        assert project.id.value == "p1"

    def test_project_is_frozen(self) -> None:
        project = Project(
            id=ProjectId("p1"),
            name="Test",
            description="",
            url="",
        )
        with pytest.raises(AttributeError):
            project.name = "Other"  # pyright: ignore[reportAttributeAccessIssue]


class TestRepository:
    """Tests para la entidad Repository."""

    def test_creates_repository(self, sample_project: Project) -> None:
        repo = Repository(
            id=RepositoryId("r1"),
            name="my-repo",
            project=sample_project,
            default_branch="master",
            url="https://example.com",
            size_bytes=500,
        )
        assert repo.name == "my-repo"
        assert repo.project.name == sample_project.name
        assert repo.size_bytes == 500
