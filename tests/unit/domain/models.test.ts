import { describe, it, expect } from "vitest";

import {
  OrganizationName,
  ProjectId,
  RepositoryId,
  DotNetVersion,
  ALL_DOTNET_VERSIONS,
  getDotNetLabel,
  getDotNetMoniker,
  getDotNetSortKey,
  buildSearchQueries,
  dotNetVersionFromMoniker,
  getDotNetVersionInfo,
  DailyQueryRecord,
  DEFAULT_BRANCHES,
  VERSION_COLORS,
  type CodeSearchHit,
} from "../../../src/main/domain/models";

// ---------------------------------------------------------------------------
// Value Objects
// ---------------------------------------------------------------------------

describe("OrganizationName", () => {
  it("stores the value on valid creation", () => {
    const org = new OrganizationName("my-org");
    expect(org.value).toBe("my-org");
  });

  it("throws on empty string", () => {
    expect(() => new OrganizationName("")).toThrow(
      "El nombre de organización no puede estar vacío",
    );
  });

  it("throws on whitespace-only string", () => {
    expect(() => new OrganizationName("   ")).toThrow(
      "El nombre de organización no puede estar vacío",
    );
  });
});

describe("ProjectId", () => {
  it("stores the value on valid creation", () => {
    const pid = new ProjectId("proj-123");
    expect(pid.value).toBe("proj-123");
  });

  it("throws on empty string", () => {
    expect(() => new ProjectId("")).toThrow("ProjectId no puede estar vacío");
  });

  it("throws on whitespace-only string", () => {
    expect(() => new ProjectId("  \t ")).toThrow(
      "ProjectId no puede estar vacío",
    );
  });
});

describe("RepositoryId", () => {
  it("stores the value on valid creation", () => {
    const rid = new RepositoryId("repo-abc");
    expect(rid.value).toBe("repo-abc");
  });

  it("throws on empty string", () => {
    expect(() => new RepositoryId("")).toThrow(
      "RepositoryId no puede estar vacío",
    );
  });

  it("throws on whitespace-only string", () => {
    expect(() => new RepositoryId("   ")).toThrow(
      "RepositoryId no puede estar vacío",
    );
  });
});

// ---------------------------------------------------------------------------
// DotNetVersion enum
// ---------------------------------------------------------------------------

describe("DotNetVersion enum", () => {
  it("has exactly 7 members", () => {
    expect(ALL_DOTNET_VERSIONS).toHaveLength(7);
  });

  it("contains all expected enum values", () => {
    expect(ALL_DOTNET_VERSIONS).toEqual([
      DotNetVersion.Net31,
      DotNetVersion.Net50,
      DotNetVersion.Net60,
      DotNetVersion.Net70,
      DotNetVersion.Net80,
      DotNetVersion.Net90,
      DotNetVersion.Net100,
    ]);
  });
});

describe("getDotNetLabel()", () => {
  it.each([
    [DotNetVersion.Net31, ".NET 3.1"],
    [DotNetVersion.Net50, ".NET 5"],
    [DotNetVersion.Net60, ".NET 6"],
    [DotNetVersion.Net70, ".NET 7"],
    [DotNetVersion.Net80, ".NET 8"],
    [DotNetVersion.Net90, ".NET 9"],
    [DotNetVersion.Net100, ".NET 10"],
  ] as const)("returns %s for %s", (version, expected) => {
    expect(getDotNetLabel(version)).toBe(expected);
  });
});

describe("getDotNetMoniker()", () => {
  it.each([
    [DotNetVersion.Net31, "netcoreapp3.1"],
    [DotNetVersion.Net50, "net5.0"],
    [DotNetVersion.Net60, "net6.0"],
    [DotNetVersion.Net70, "net7.0"],
    [DotNetVersion.Net80, "net8.0"],
    [DotNetVersion.Net90, "net9.0"],
    [DotNetVersion.Net100, "net10.0"],
  ] as const)("returns %s for %s", (version, expected) => {
    expect(getDotNetMoniker(version)).toBe(expected);
  });
});

describe("getDotNetSortKey()", () => {
  it("returns increasing sort keys for each version in order", () => {
    const keys = ALL_DOTNET_VERSIONS.map(getDotNetSortKey);
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i]).toBeGreaterThan(keys[i - 1]);
    }
  });

  it.each([
    [DotNetVersion.Net31, 0],
    [DotNetVersion.Net50, 1],
    [DotNetVersion.Net60, 2],
    [DotNetVersion.Net70, 3],
    [DotNetVersion.Net80, 4],
    [DotNetVersion.Net90, 5],
    [DotNetVersion.Net100, 6],
  ] as const)("returns %i for %s", (version, expected) => {
    expect(getDotNetSortKey(version)).toBe(expected);
  });
});

describe("buildSearchQueries()", () => {
  it("returns a tuple of two query strings", () => {
    const queries = buildSearchQueries(DotNetVersion.Net80);
    expect(queries).toHaveLength(2);
  });

  it("first query uses singular <TargetFramework>", () => {
    const [singular] = buildSearchQueries(DotNetVersion.Net80);
    expect(singular).toBe(
      "ext:csproj AND <TargetFramework>net8.0</TargetFramework>",
    );
  });

  it("second query uses plural <TargetFrameworks>", () => {
    const [, plural] = buildSearchQueries(DotNetVersion.Net80);
    expect(plural).toBe(
      "ext:csproj AND <TargetFrameworks>net8.0</TargetFrameworks>",
    );
  });

  it("embeds the correct moniker for Net31", () => {
    const [singular, plural] = buildSearchQueries(DotNetVersion.Net31);
    expect(singular).toContain("netcoreapp3.1");
    expect(plural).toContain("netcoreapp3.1");
  });
});

describe("dotNetVersionFromMoniker()", () => {
  it("roundtrips every version through its moniker", () => {
    for (const version of ALL_DOTNET_VERSIONS) {
      const moniker = getDotNetMoniker(version);
      expect(dotNetVersionFromMoniker(moniker)).toBe(version);
    }
  });

  it("returns undefined for an unknown moniker", () => {
    expect(dotNetVersionFromMoniker("net99.0")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(dotNetVersionFromMoniker("")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// DailyQueryRecord
// ---------------------------------------------------------------------------

function makeHit(overrides: Partial<CodeSearchHit> = {}): CodeSearchHit {
  return {
    repositoryName: overrides.repositoryName ?? "repo-a",
    projectName: overrides.projectName ?? "proj-1",
    dotnetVersion: overrides.dotnetVersion ?? DotNetVersion.Net80,
    branch: overrides.branch ?? "develop",
    csprojCount: overrides.csprojCount ?? 1,
  };
}

describe("DailyQueryRecord", () => {
  it("constructs with valid data", () => {
    const record = new DailyQueryRecord({
      queryDate: new Date("2024-06-01"),
      organization: "contoso",
      project: "my-project",
      versionsSearched: [DotNetVersion.Net80],
    });

    expect(record.queryDate).toEqual(new Date("2024-06-01"));
    expect(record.organization).toBe("contoso");
    expect(record.project).toBe("my-project");
    expect(record.versionsSearched).toEqual([DotNetVersion.Net80]);
  });

  it("defaults resultsByVersion to empty object when omitted", () => {
    const record = new DailyQueryRecord({
      queryDate: new Date("2024-06-01"),
      organization: "contoso",
      project: null,
      versionsSearched: [],
    });
    expect(record.resultsByVersion).toEqual({});
  });

  it("copies versionsSearched to avoid external mutation", () => {
    const versions = [DotNetVersion.Net80];
    const record = new DailyQueryRecord({
      queryDate: new Date("2024-06-01"),
      organization: "contoso",
      project: null,
      versionsSearched: versions,
    });
    versions.push(DotNetVersion.Net90);
    expect(record.versionsSearched).toEqual([DotNetVersion.Net80]);
  });

  describe("totalResults", () => {
    it("returns 0 for empty results", () => {
      const record = new DailyQueryRecord({
        queryDate: new Date("2024-06-01"),
        organization: "contoso",
        project: null,
        versionsSearched: [],
      });
      expect(record.totalResults).toBe(0);
    });

    it("sums hits across all versions", () => {
      const record = new DailyQueryRecord({
        queryDate: new Date("2024-06-01"),
        organization: "contoso",
        project: null,
        versionsSearched: [DotNetVersion.Net80, DotNetVersion.Net60],
        resultsByVersion: {
          [DotNetVersion.Net80]: [makeHit(), makeHit()],
          [DotNetVersion.Net60]: [makeHit({ dotnetVersion: DotNetVersion.Net60 })],
        },
      });
      expect(record.totalResults).toBe(3);
    });
  });

  describe("getAllHits()", () => {
    it("returns empty array when no results", () => {
      const record = new DailyQueryRecord({
        queryDate: new Date("2024-06-01"),
        organization: "contoso",
        project: null,
        versionsSearched: [],
      });
      expect(record.getAllHits()).toEqual([]);
    });

    it("flattens hits from multiple versions", () => {
      const hit1 = makeHit({ repositoryName: "repo-1" });
      const hit2 = makeHit({ repositoryName: "repo-2" });
      const hit3 = makeHit({ repositoryName: "repo-3", dotnetVersion: DotNetVersion.Net60 });

      const record = new DailyQueryRecord({
        queryDate: new Date("2024-06-01"),
        organization: "contoso",
        project: null,
        versionsSearched: [DotNetVersion.Net80, DotNetVersion.Net60],
        resultsByVersion: {
          [DotNetVersion.Net80]: [hit1, hit2],
          [DotNetVersion.Net60]: [hit3],
        },
      });

      const allHits = record.getAllHits();
      expect(allHits).toHaveLength(3);
      expect(allHits).toContainEqual(hit1);
      expect(allHits).toContainEqual(hit2);
      expect(allHits).toContainEqual(hit3);
    });
  });

  describe("merge()", () => {
    it("combines resultsByVersion from another record", () => {
      const recordA = new DailyQueryRecord({
        queryDate: new Date("2024-06-01"),
        organization: "contoso",
        project: null,
        versionsSearched: [DotNetVersion.Net80],
        resultsByVersion: {
          [DotNetVersion.Net80]: [makeHit()],
        },
      });

      const recordB = new DailyQueryRecord({
        queryDate: new Date("2024-06-01"),
        organization: "contoso",
        project: null,
        versionsSearched: [DotNetVersion.Net60],
        resultsByVersion: {
          [DotNetVersion.Net60]: [makeHit({ dotnetVersion: DotNetVersion.Net60 })],
        },
      });

      recordA.merge(recordB);

      expect(recordA.resultsByVersion[DotNetVersion.Net80]).toHaveLength(1);
      expect(recordA.resultsByVersion[DotNetVersion.Net60]).toHaveLength(1);
      expect(recordA.totalResults).toBe(2);
    });

    it("overwrites existing version keys with data from other", () => {
      const recordA = new DailyQueryRecord({
        queryDate: new Date("2024-06-01"),
        organization: "contoso",
        project: null,
        versionsSearched: [DotNetVersion.Net80],
        resultsByVersion: {
          [DotNetVersion.Net80]: [makeHit()],
        },
      });

      const newHits = [makeHit({ repositoryName: "new-repo" }), makeHit({ repositoryName: "new-repo-2" })];
      const recordB = new DailyQueryRecord({
        queryDate: new Date("2024-06-01"),
        organization: "contoso",
        project: null,
        versionsSearched: [DotNetVersion.Net80],
        resultsByVersion: {
          [DotNetVersion.Net80]: newHits,
        },
      });

      recordA.merge(recordB);

      expect(recordA.resultsByVersion[DotNetVersion.Net80]).toHaveLength(2);
      expect(recordA.resultsByVersion[DotNetVersion.Net80]).toEqual(newHits);
    });

    it("appends new versionsSearched without duplicating existing ones", () => {
      const recordA = new DailyQueryRecord({
        queryDate: new Date("2024-06-01"),
        organization: "contoso",
        project: null,
        versionsSearched: [DotNetVersion.Net80],
        resultsByVersion: {},
      });

      const recordB = new DailyQueryRecord({
        queryDate: new Date("2024-06-01"),
        organization: "contoso",
        project: null,
        versionsSearched: [DotNetVersion.Net80, DotNetVersion.Net60],
        resultsByVersion: {},
      });

      recordA.merge(recordB);

      expect(recordA.versionsSearched).toEqual([
        DotNetVersion.Net80,
        DotNetVersion.Net60,
      ]);
    });

    it("accumulates hits without losing data from untouched versions", () => {
      const hitNet6 = makeHit({ dotnetVersion: DotNetVersion.Net60, repositoryName: "r6" });
      const hitNet8 = makeHit({ dotnetVersion: DotNetVersion.Net80, repositoryName: "r8" });
      const hitNet9 = makeHit({ dotnetVersion: DotNetVersion.Net90, repositoryName: "r9" });

      const recordA = new DailyQueryRecord({
        queryDate: new Date("2024-06-01"),
        organization: "contoso",
        project: null,
        versionsSearched: [DotNetVersion.Net60, DotNetVersion.Net80],
        resultsByVersion: {
          [DotNetVersion.Net60]: [hitNet6],
          [DotNetVersion.Net80]: [hitNet8],
        },
      });

      const recordB = new DailyQueryRecord({
        queryDate: new Date("2024-06-01"),
        organization: "contoso",
        project: null,
        versionsSearched: [DotNetVersion.Net90],
        resultsByVersion: {
          [DotNetVersion.Net90]: [hitNet9],
        },
      });

      recordA.merge(recordB);

      // Net60 and Net80 data is preserved
      expect(recordA.resultsByVersion[DotNetVersion.Net60]).toEqual([hitNet6]);
      expect(recordA.resultsByVersion[DotNetVersion.Net80]).toEqual([hitNet8]);
      // Net90 was added
      expect(recordA.resultsByVersion[DotNetVersion.Net90]).toEqual([hitNet9]);
      expect(recordA.totalResults).toBe(3);
    });
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("DEFAULT_BRANCHES", () => {
  it("contains develop, test, and master", () => {
    expect(DEFAULT_BRANCHES).toContain("develop");
    expect(DEFAULT_BRANCHES).toContain("test");
    expect(DEFAULT_BRANCHES).toContain("master");
  });

  it("has exactly 3 entries", () => {
    expect(DEFAULT_BRANCHES).toHaveLength(3);
  });
});

describe("VERSION_COLORS", () => {
  it("has an entry for every version moniker", () => {
    for (const version of ALL_DOTNET_VERSIONS) {
      const moniker = getDotNetMoniker(version);
      expect(VERSION_COLORS[moniker]).toBeDefined();
      expect(typeof VERSION_COLORS[moniker]).toBe("string");
    }
  });

  it("values are hex colour strings", () => {
    for (const color of Object.values(VERSION_COLORS)) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});
