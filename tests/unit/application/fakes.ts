/** Fake (in-memory) implementations of domain ports for unit testing. */

import type {
  CodeSearchHit,
  CodeSearchPage,
  DailyQueryRecord,
  Project,
  Repository,
} from "../../../src/main/domain/models";
import type {
  AzureDevOpsClient,
  QueryStoragePort,
} from "../../../src/main/domain/ports";

// ---------------------------------------------------------------------------
// FakeAzureDevOpsClient
// ---------------------------------------------------------------------------

interface FakeSearchResult {
  moniker: string;
  repoName: string;
  projectName: string;
  branch: string;
}

export class FakeAzureDevOpsClient implements AzureDevOpsClient {
  private readonly projects: Project[] = [];
  private readonly repositories: Map<string, Repository[]> = new Map();
  private readonly searchResults: FakeSearchResult[] = [];

  addProject(project: Project): void {
    this.projects.push(project);
  }

  addRepository(repo: Repository): void {
    const projectName = repo.project.name;
    const list = this.repositories.get(projectName) ?? [];
    list.push(repo);
    this.repositories.set(projectName, list);
  }

  addSearchResult(
    moniker: string,
    repoName: string,
    projectName: string,
    branch = "",
  ): void {
    this.searchResults.push({ moniker, repoName, projectName, branch });
  }

  async listProjects(): Promise<readonly Project[]> {
    return this.projects;
  }

  async listRepositories(projectName: string): Promise<readonly Repository[]> {
    return this.repositories.get(projectName) ?? [];
  }

  async searchCode(
    searchText: string,
    _project: string | null,
    _skip: number,
    _top: number,
    options?: {
      filters?: Record<string, string[]>;
      includeFacets?: boolean;
    },
  ): Promise<CodeSearchPage> {
    // Determine which moniker is being searched
    const monikerMatch = searchText.match(
      /<TargetFrameworks?>([\w.]+)<\/TargetFrameworks?>/,
    );
    const moniker = monikerMatch?.[1] ?? "";

    // Filter results by moniker
    let matching = this.searchResults.filter((r) => r.moniker === moniker);

    // Apply project filter
    const projectFilter = options?.filters?.["Project"];
    if (projectFilter) {
      matching = matching.filter((r) =>
        projectFilter.includes(r.projectName),
      );
    }

    // Apply branch filter
    const branchFilter = options?.filters?.["Branch"];
    if (branchFilter) {
      matching = matching.filter(
        (r) => r.branch === "" || branchFilter.includes(r.branch),
      );
    }

    if (matching.length === 0) {
      return { hits: [], totalCount: 0, skip: 0, top: 1 };
    }

    // Build facets if requested
    const facets = options?.includeFacets
      ? {
          projects: [
            ...new Map(
              matching.map((r) => [
                r.projectName,
                {
                  name: r.projectName,
                  resultCount: matching.filter(
                    (x) => x.projectName === r.projectName,
                  ).length,
                },
              ]),
            ).values(),
          ],
          repositories: [
            ...new Map(
              matching.map((r) => [
                r.repoName,
                {
                  name: r.repoName,
                  resultCount: matching.filter(
                    (x) => x.repoName === r.repoName,
                  ).length,
                },
              ]),
            ).values(),
          ],
        }
      : undefined;

    return {
      hits: [],
      totalCount: matching.length,
      skip: 0,
      top: 1,
      facets,
    };
  }
}

// ---------------------------------------------------------------------------
// FakeQueryStore
// ---------------------------------------------------------------------------

export class FakeQueryStore implements QueryStoragePort {
  readonly records: DailyQueryRecord[] = [];

  async saveQuery(record: DailyQueryRecord): Promise<void> {
    const dateKey = record.queryDate.toISOString().slice(0, 10);
    const existing = this.records.find(
      (r) => r.queryDate.toISOString().slice(0, 10) === dateKey,
    );
    if (existing) {
      existing.merge(record);
    } else {
      this.records.push(record);
    }
  }

  async loadQueries(): Promise<DailyQueryRecord[]> {
    return [...this.records];
  }

  async getQueryByDate(queryDate: Date): Promise<DailyQueryRecord | null> {
    const dateKey = queryDate.toISOString().slice(0, 10);
    return (
      this.records.find(
        (r) => r.queryDate.toISOString().slice(0, 10) === dateKey,
      ) ?? null
    );
  }
}
