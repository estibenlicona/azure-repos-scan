/** Domain ports — contracts for the infrastructure layer. */

import type {
  CodeSearchPage,
  DailyQueryRecord,
  Project,
  Repository,
} from "./models";

/** Port for communication with the Azure DevOps API. */
export interface AzureDevOpsClient {
  /** Retrieve all projects in the organization. */
  listProjects(): Promise<readonly Project[]>;

  /** Retrieve all repositories for a given project. */
  listRepositories(projectName: string): Promise<readonly Repository[]>;

  /** Search code in the organization or a specific project. */
  searchCode(
    searchText: string,
    project: string | null,
    skip: number,
    top: number,
    options?: {
      filters?: Record<string, string[]>;
      includeFacets?: boolean;
    },
  ): Promise<CodeSearchPage>;
}

/** Port for persisting historical query records. */
export interface QueryStoragePort {
  /** Save or update a daily query record. */
  saveQuery(record: DailyQueryRecord): Promise<void>;

  /** Load all historical query records. */
  loadQueries(): Promise<DailyQueryRecord[]>;

  /** Get the query record for a specific date, or null if none exists. */
  getQueryByDate(queryDate: Date): Promise<DailyQueryRecord | null>;
}
