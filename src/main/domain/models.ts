/** Domain entities and value objects. */

// ---------------------------------------------------------------------------
// Value Objects — validated, immutable wrappers
// ---------------------------------------------------------------------------

export class OrganizationName {
  readonly value: string;

  constructor(value: string) {
    if (!value.trim()) {
      throw new Error("El nombre de organización no puede estar vacío");
    }
    this.value = value;
  }
}

export class ProjectId {
  readonly value: string;

  constructor(value: string) {
    if (!value.trim()) {
      throw new Error("ProjectId no puede estar vacío");
    }
    this.value = value;
  }
}

export class RepositoryId {
  readonly value: string;

  constructor(value: string) {
    if (!value.trim()) {
      throw new Error("RepositoryId no puede estar vacío");
    }
    this.value = value;
  }
}

// ---------------------------------------------------------------------------
// DotNetVersion Enum
// ---------------------------------------------------------------------------

export interface DotNetVersionInfo {
  readonly display: string;
  readonly moniker: string;
  readonly label: string;
  readonly sortKey: number;
}

/**
 * .NET versions with their Code Search query strings.
 *
 * Each member maps to a display name, target-framework moniker,
 * human-readable label, and a sort key for ordering.
 */
export const DotNetVersion = {
  Net31: "NET_3_1",
  Net50: "NET_5",
  Net60: "NET_6",
  Net70: "NET_7",
  Net80: "NET_8",
  Net90: "NET_9",
  Net100: "NET_10",
} as const;

export type DotNetVersion = (typeof DotNetVersion)[keyof typeof DotNetVersion];

const VERSION_INFO: Record<DotNetVersion, DotNetVersionInfo> = {
  [DotNetVersion.Net31]: {
    display: "3.1",
    moniker: "netcoreapp3.1",
    label: ".NET 3.1",
    sortKey: 0,
  },
  [DotNetVersion.Net50]: {
    display: "5",
    moniker: "net5.0",
    label: ".NET 5",
    sortKey: 1,
  },
  [DotNetVersion.Net60]: {
    display: "6",
    moniker: "net6.0",
    label: ".NET 6",
    sortKey: 2,
  },
  [DotNetVersion.Net70]: {
    display: "7",
    moniker: "net7.0",
    label: ".NET 7",
    sortKey: 3,
  },
  [DotNetVersion.Net80]: {
    display: "8",
    moniker: "net8.0",
    label: ".NET 8",
    sortKey: 4,
  },
  [DotNetVersion.Net90]: {
    display: "9",
    moniker: "net9.0",
    label: ".NET 9",
    sortKey: 5,
  },
  [DotNetVersion.Net100]: {
    display: "10",
    moniker: "net10.0",
    label: ".NET 10",
    sortKey: 6,
  },
};

/** All DotNetVersion members in declaration order. */
export const ALL_DOTNET_VERSIONS: readonly DotNetVersion[] = [
  DotNetVersion.Net31,
  DotNetVersion.Net50,
  DotNetVersion.Net60,
  DotNetVersion.Net70,
  DotNetVersion.Net80,
  DotNetVersion.Net90,
  DotNetVersion.Net100,
];

/** Get metadata for a DotNetVersion. */
export function getDotNetVersionInfo(version: DotNetVersion): DotNetVersionInfo {
  return VERSION_INFO[version];
}

/** Human-readable label, e.g. ".NET 8". */
export function getDotNetLabel(version: DotNetVersion): string {
  return VERSION_INFO[version].label;
}

/** Target-framework moniker, e.g. "net8.0". */
export function getDotNetMoniker(version: DotNetVersion): string {
  return VERSION_INFO[version].moniker;
}

/** Ordinal for sorting (lower = older). */
export function getDotNetSortKey(version: DotNetVersion): number {
  return VERSION_INFO[version].sortKey;
}

/**
 * Build Code Search queries for both singular and plural TargetFramework.
 *
 * Returns two queries per version:
 * - `ext:csproj AND <TargetFramework>{moniker}</TargetFramework>`
 * - `ext:csproj AND <TargetFrameworks>{moniker}</TargetFrameworks>`
 */
export function buildSearchQueries(version: DotNetVersion): [string, string] {
  const tf = VERSION_INFO[version].moniker;
  return [
    `ext:csproj AND <TargetFramework>${tf}</TargetFramework>`,
    `ext:csproj AND <TargetFrameworks>${tf}</TargetFrameworks>`,
  ];
}

/** Resolve a DotNetVersion from its moniker string (e.g. "net8.0"). */
export function dotNetVersionFromMoniker(
  moniker: string,
): DotNetVersion | undefined {
  for (const v of ALL_DOTNET_VERSIONS) {
    if (VERSION_INFO[v].moniker === moniker) {
      return v;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default branches available for Code Search queries. */
export const DEFAULT_BRANCHES: readonly string[] = [
  "develop",
  "test",
  "master",
];

/** Mapping from moniker to hex colour string for dashboard charts. */
export const VERSION_COLORS: Readonly<Record<string, string>> = {
  "netcoreapp3.1": "#e74c3c",
  "net5.0": "#e67e22",
  "net6.0": "#f1c40f",
  "net7.0": "#2ecc71",
  "net8.0": "#3498db",
  "net9.0": "#9b59b6",
  "net10.0": "#1abc9c",
};

// ---------------------------------------------------------------------------
// Entities / Data Interfaces
// ---------------------------------------------------------------------------

export interface Project {
  readonly id: ProjectId;
  readonly name: string;
  readonly description: string;
  readonly url: string;
}

export interface Repository {
  readonly id: RepositoryId;
  readonly name: string;
  readonly project: Project;
  readonly defaultBranch: string;
  readonly url: string;
  readonly sizeBytes: number;
}

export interface ScanResult {
  readonly organization: OrganizationName;
  readonly projects: readonly Project[];
  readonly repositories: readonly Repository[];
  readonly scannedAt: Date;
  readonly totalRepos: number;
  readonly totalProjects: number;
}

// ---------------------------------------------------------------------------
// Code Search types
// ---------------------------------------------------------------------------

export interface FacetItem {
  readonly name: string;
  readonly resultCount: number;
}

export interface CodeSearchFacets {
  readonly projects: readonly FacetItem[];
  readonly repositories: readonly FacetItem[];
}

export interface CodeSearchHit {
  readonly repositoryName: string;
  readonly projectName: string;
  readonly dotnetVersion: DotNetVersion;
  readonly branch: string;
  readonly csprojCount: number;
}

export interface CodeSearchPage {
  readonly hits: readonly CodeSearchHit[];
  readonly totalCount: number;
  readonly skip: number;
  readonly top: number;
  readonly facets?: CodeSearchFacets;
}

// ---------------------------------------------------------------------------
// DailyQueryRecord — mutable aggregate for merging daily query results
// ---------------------------------------------------------------------------

export class DailyQueryRecord {
  queryDate: Date;
  organization: string;
  project: string | null;
  versionsSearched: DotNetVersion[];
  resultsByVersion: Record<string, CodeSearchHit[]>;

  constructor(params: {
    queryDate: Date;
    organization: string;
    project: string | null;
    versionsSearched: DotNetVersion[];
    resultsByVersion?: Record<string, CodeSearchHit[]>;
  }) {
    this.queryDate = params.queryDate;
    this.organization = params.organization;
    this.project = params.project;
    this.versionsSearched = [...params.versionsSearched];
    this.resultsByVersion = params.resultsByVersion
      ? { ...params.resultsByVersion }
      : {};
  }

  /** Total results across all versions. */
  get totalResults(): number {
    return Object.values(this.resultsByVersion).reduce(
      (sum, hits) => sum + hits.length,
      0,
    );
  }

  /**
   * Merge results from another record (same day).
   *
   * Overwrites version keys present in `other` and appends any
   * newly-searched versions that are not yet tracked.
   */
  merge(other: DailyQueryRecord): void {
    for (const [versionKey, hits] of Object.entries(other.resultsByVersion)) {
      this.resultsByVersion[versionKey] = hits;
    }

    const seen = new Set(
      this.versionsSearched.map((v) => {
        const info = VERSION_INFO[v];
        return `${info.display},${info.moniker}`;
      }),
    );

    for (const v of other.versionsSearched) {
      const key = (() => {
        const info = VERSION_INFO[v];
        return `${info.display},${info.moniker}`;
      })();
      if (!seen.has(key)) {
        this.versionsSearched.push(v);
        seen.add(key);
      }
    }
  }

  /** Flatten all hits from every version into a single array. */
  getAllHits(): CodeSearchHit[] {
    const allHits: CodeSearchHit[] = [];
    for (const hits of Object.values(this.resultsByVersion)) {
      allHits.push(...hits);
    }
    return allHits;
  }
}

// ---------------------------------------------------------------------------
// Reports / Dashboard
// ---------------------------------------------------------------------------

export interface RepoSummary {
  readonly repositoryName: string;
  readonly projectName: string;
  readonly oldestVersion: DotNetVersion;
  readonly allVersions: ReadonlySet<DotNetVersion>;
  readonly branches: ReadonlySet<string>;
  readonly csprojCount: number;
  readonly hits: readonly CodeSearchHit[];
}

export interface MonthlySnapshot {
  /** Format: "YYYY-MM" */
  readonly month: string;
  readonly reposByVersion: ReadonlyMap<DotNetVersion, number>;
}
