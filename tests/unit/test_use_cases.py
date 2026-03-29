"""Tests para casos de uso."""

from __future__ import annotations

from azure_repos_scan.application.use_cases import (
    ListProjectsUseCase,
    ListRepositoriesUseCase,
    ScanOrganizationUseCase,
)
from azure_repos_scan.domain.models import Project, Repository
from tests.conftest import FakeAzureDevOpsClient


class TestListProjectsUseCase:
    """Tests para el caso de uso ListProjects."""

    def test_returns_projects(self, fake_client: FakeAzureDevOpsClient) -> None:
        use_case = ListProjectsUseCase(fake_client)
        result = use_case.execute()
        assert len(result) == 1
        assert result[0].name == "MyProject"

    def test_returns_empty_when_no_projects(self) -> None:
        client = FakeAzureDevOpsClient(projects=[])
        use_case = ListProjectsUseCase(client)
        result = use_case.execute()
        assert len(result) == 0


class TestListRepositoriesUseCase:
    """Tests para el caso de uso ListRepositories."""

    def test_returns_repos_for_project(self, fake_client: FakeAzureDevOpsClient) -> None:
        use_case = ListRepositoriesUseCase(fake_client)
        result = use_case.execute("MyProject")
        assert len(result) == 1
        assert result[0].name == "my-repo"

    def test_returns_empty_for_unknown_project(
        self, fake_client: FakeAzureDevOpsClient
    ) -> None:
        use_case = ListRepositoriesUseCase(fake_client)
        result = use_case.execute("NonExistent")
        assert len(result) == 0


class TestScanOrganizationUseCase:
    """Tests para el caso de uso ScanOrganization."""

    def test_scans_all_projects_and_repos(
        self,
        fake_client: FakeAzureDevOpsClient,
        sample_project: Project,
        sample_repository: Repository,
    ) -> None:
        use_case = ScanOrganizationUseCase(fake_client, organization="test-org")
        result = use_case.execute()

        assert result.organization.value == "test-org"
        assert result.total_projects == 1
        assert result.total_repos == 1
        assert result.projects[0].name == sample_project.name
        assert result.repositories[0].name == sample_repository.name
        assert result.scanned_at is not None

    def test_scans_empty_organization(self) -> None:
        client = FakeAzureDevOpsClient(projects=[], repos_by_project={})
        use_case = ScanOrganizationUseCase(client, organization="empty-org")
        result = use_case.execute()

        assert result.total_projects == 0
        assert result.total_repos == 0
