/** Use case: search .NET projects by version using Code Search facets. */

import type {
  CodeSearchHit,
  CodeSearchPage,
  DailyQueryRecord,
  DotNetVersion,
} from "../../domain/models";
import {
  DailyQueryRecord as DailyQueryRecordClass,
  buildSearchQueries,
  getDotNetLabel,
  getDotNetMoniker,
} from "../../domain/models";
import type { AzureDevOpsClient, QueryStoragePort } from "../../domain/ports";

type ProgressCallback = (
  current: number,
  total: number,
  message: string,
) => void;

export class SearchDotNetProjectsUseCase {
  constructor(
    private readonly client: AzureDevOpsClient,
    private readonly store: QueryStoragePort,
    private readonly organization: string,
  ) {}

  async execute(params: {
    versions: DotNetVersion[];
    project?: string;
    branches?: string[];
    onProgress?: ProgressCallback;
  }): Promise<DailyQueryRecord> {
    const { versions, project, onProgress, branches = [] } = params;
    const resultsByVersion: Record<string, CodeSearchHit[]> = {};
    const queries = SearchDotNetProjectsUseCase.buildQueries(versions);
    const totalSteps = queries.length;

    for (let step = 0; step < queries.length; step++) {
      const [version, query] = queries[step];

      if (onProgress) {
        onProgress(step, totalSteps, `Buscando ${getDotNetLabel(version)}...`);
      }

      const hits = await this.fetchAllPages(
        query,
        project ?? null,
        version,
        branches,
      );
      const key = getDotNetMoniker(version);

      if (key in resultsByVersion) {
        // Deduplicate by (repositoryName, branch)
        const existing = new Set(
          resultsByVersion[key].map(
            (h) => `${h.repositoryName}\0${h.branch}`,
          ),
        );
        for (const h of hits) {
          const pair = `${h.repositoryName}\0${h.branch}`;
          if (!existing.has(pair)) {
            resultsByVersion[key].push(h);
            existing.add(pair);
          }
        }
      } else {
        resultsByVersion[key] = hits;
      }
    }

    if (onProgress) {
      onProgress(totalSteps, totalSteps, "Búsqueda completada");
    }

    const record = new DailyQueryRecordClass({
      queryDate: new Date(),
      organization: this.organization,
      project: project ?? null,
      versionsSearched: [...versions],
      resultsByVersion,
    });

    await this.store.saveQuery(record);
    return record;
  }

  /** Build search queries (singular + plural TargetFramework) per version. */
  private static buildQueries(
    versions: DotNetVersion[],
  ): Array<[DotNetVersion, string]> {
    const queries: Array<[DotNetVersion, string]> = [];
    for (const v of versions) {
      for (const q of buildSearchQueries(v)) {
        queries.push([v, q]);
      }
    }
    return queries;
  }

  /**
   * Fetch repositories matching a query using facets (no pagination).
   *
   * Strategy:
   * 1. Org-level call with includeFacets → Project facets
   * 2. Per project, call with Project filter → Repository facets
   * 3. Each repo in facets produces a CodeSearchHit
   *
   * When branches is empty, search without branch filter.
   * When branches are provided, query each branch separately.
   */
  private async fetchAllPages(
    query: string,
    project: string | null,
    version: DotNetVersion,
    branches: string[],
  ): Promise<CodeSearchHit[]> {
    if (project) {
      return this.fetchForProject(query, project, version, branches);
    }

    // Org-level probe WITHOUT branch filter to discover projects via facets.
    // Branch filtering is applied later at the per-project level.
    const probe = await this.client.searchCode(query, null, 0, 1, {
      includeFacets: true,
    });

    if (probe.totalCount === 0) {
      return [];
    }

    // Extract project names from facets
    const projectNames: string[] = [];
    if (probe.facets?.projects) {
      for (const f of probe.facets.projects) {
        if (f.resultCount > 0) {
          projectNames.push(f.name);
        }
      }
    }

    if (projectNames.length === 0) {
      return [];
    }

    // Fetch repos for each project
    const allHits: CodeSearchHit[] = [];
    for (const projName of projectNames) {
      const hits = await this.fetchForProject(
        query,
        projName,
        version,
        branches,
      );
      allHits.push(...hits);
    }
    return allHits;
  }

  /** Fetch hits for a project, segmenting by branch if applicable. */
  private async fetchForProject(
    query: string,
    project: string,
    version: DotNetVersion,
    branches: string[],
  ): Promise<CodeSearchHit[]> {
    if (branches.length === 0) {
      // No branch filter: single call with project in URL path
      const filters = { Project: [project] };
      const probe = await this.client.searchCode(query, project, 0, 1, {
        filters,
        includeFacets: true,
      });
      return SearchDotNetProjectsUseCase.hitsFromRepoFacets(
        probe,
        project,
        version,
        "",
      );
    }

    // With branches: one call per branch, project in URL path
    const allHits: CodeSearchHit[] = [];
    for (const branch of branches) {
      const filters = { Branch: [branch], Project: [project] };
      const probe = await this.client.searchCode(query, project, 0, 1, {
        filters,
        includeFacets: true,
      });
      allHits.push(
        ...SearchDotNetProjectsUseCase.hitsFromRepoFacets(
          probe,
          project,
          version,
          branch,
        ),
      );
    }
    return allHits;
  }

  /** Build CodeSearchHit entries from the Repository facets. */
  private static hitsFromRepoFacets(
    page: CodeSearchPage,
    projectName: string,
    version: DotNetVersion,
    branch: string,
  ): CodeSearchHit[] {
    if (!page.facets?.repositories) {
      return [];
    }
    return page.facets.repositories
      .filter((repo) => repo.resultCount > 0)
      .map((repo) => ({
        repositoryName: repo.name,
        projectName,
        dotnetVersion: version,
        branch,
      }));
  }
}
