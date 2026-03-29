/** Domain layer — re-exports all models, ports, and exceptions. */

export {
  // Value Objects
  OrganizationName,
  ProjectId,
  RepositoryId,

  // DotNetVersion enum + helpers
  DotNetVersion,
  ALL_DOTNET_VERSIONS,
  getDotNetVersionInfo,
  getDotNetLabel,
  getDotNetMoniker,
  getDotNetSortKey,
  buildSearchQueries,
  dotNetVersionFromMoniker,

  // Constants
  DEFAULT_BRANCHES,
  VERSION_COLORS,

  // Entities / Data interfaces
  type Project,
  type Repository,
  type ScanResult,
  type FacetItem,
  type CodeSearchFacets,
  type CodeSearchHit,
  type CodeSearchPage,
  type DotNetVersionInfo,

  // Mutable aggregates
  DailyQueryRecord,

  // Report interfaces
  type RepoSummary,
  type MonthlySnapshot,
} from "./models";

export {
  type AzureDevOpsClient,
  type QueryStoragePort,
} from "./ports";

export {
  DomainError,
  AuthenticationError,
  OrganizationNotFoundError,
  ApiError,
  RateLimitError,
  SearchIndexNotReadyError,
} from "./exceptions";
