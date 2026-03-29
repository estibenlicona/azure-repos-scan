import { describe, it, expect, beforeEach } from "vitest";

import {
  DotNetVersion,
  DailyQueryRecord,
  type CodeSearchHit,
} from "../../../src/main/domain/models";
import { BuildDashboardDataUseCase } from "../../../src/main/application/use-cases/build-dashboard-data";
import { FakeQueryStore } from "./fakes";

function makeHit(overrides: Partial<CodeSearchHit> = {}): CodeSearchHit {
  return {
    repositoryName: overrides.repositoryName ?? "repo-a",
    projectName: overrides.projectName ?? "proj-1",
    dotnetVersion: overrides.dotnetVersion ?? DotNetVersion.Net80,
    branch: overrides.branch ?? "develop",
  };
}

function makeRecord(
  date: string,
  resultsByVersion: Record<string, CodeSearchHit[]>,
  versionsSearched: DotNetVersion[] = [],
): DailyQueryRecord {
  return new DailyQueryRecord({
    queryDate: new Date(date),
    organization: "contoso",
    project: null,
    versionsSearched,
    resultsByVersion,
  });
}

describe("BuildDashboardDataUseCase", () => {
  let store: FakeQueryStore;
  let useCase: BuildDashboardDataUseCase;

  beforeEach(() => {
    store = new FakeQueryStore();
    useCase = new BuildDashboardDataUseCase(store);
  });

  it("should return null for unknown date", async () => {
    const result = await useCase.buildForDate("2024-01-01");
    expect(result).toBeNull();
  });

  it("should build dashboard data from stored query", async () => {
    const record = makeRecord("2024-06-15", {
      "net8.0": [makeHit({ repositoryName: "repo-a" })],
    });
    store.records.push(record);

    const dashboard = await useCase.buildForDate("2024-06-15");

    expect(dashboard).not.toBeNull();
    expect(dashboard!.organization).toBe("contoso");
    expect(dashboard!.queryDate).toBe("2024-06-15");
    expect(dashboard!.totalRepos).toBe(1);
    expect(dashboard!.totalCsprojs).toBe(1);
  });

  it("should group repos by version correctly", async () => {
    const record = makeRecord("2024-06-15", {
      "net6.0": [
        makeHit({
          repositoryName: "old-repo",
          dotnetVersion: DotNetVersion.Net60,
        }),
      ],
      "net8.0": [
        makeHit({
          repositoryName: "new-repo",
          dotnetVersion: DotNetVersion.Net80,
        }),
      ],
    });
    store.records.push(record);

    const dashboard = await useCase.buildForDate("2024-06-15");

    expect(dashboard).not.toBeNull();
    expect(dashboard!.totalRepos).toBe(2);

    const net6Repos = dashboard!.reposByVersion.get(DotNetVersion.Net60) ?? [];
    const net8Repos = dashboard!.reposByVersion.get(DotNetVersion.Net80) ?? [];
    expect(net6Repos.some((r) => r.repositoryName === "old-repo")).toBe(true);
    expect(net8Repos.some((r) => r.repositoryName === "new-repo")).toBe(true);
  });

  it("should calculate oldest version per repo", async () => {
    // Same repo appears in both net6 and net8 → oldest should be net6
    const record = makeRecord("2024-06-15", {
      "net6.0": [
        makeHit({
          repositoryName: "multi-repo",
          projectName: "proj-1",
          dotnetVersion: DotNetVersion.Net60,
        }),
      ],
      "net8.0": [
        makeHit({
          repositoryName: "multi-repo",
          projectName: "proj-1",
          dotnetVersion: DotNetVersion.Net80,
        }),
      ],
    });
    store.records.push(record);

    const dashboard = await useCase.buildForDate("2024-06-15");

    expect(dashboard).not.toBeNull();
    // Repo grouped under its oldest version
    const net6Repos = dashboard!.reposByVersion.get(DotNetVersion.Net60) ?? [];
    expect(net6Repos.some((r) => r.repositoryName === "multi-repo")).toBe(true);

    const repoSummary = net6Repos.find(
      (r) => r.repositoryName === "multi-repo",
    )!;
    expect(repoSummary.oldestVersion).toBe(DotNetVersion.Net60);
    expect(repoSummary.allVersions.has(DotNetVersion.Net60)).toBe(true);
    expect(repoSummary.allVersions.has(DotNetVersion.Net80)).toBe(true);
  });

  it("should filter by branch when specified", async () => {
    const record = makeRecord("2024-06-15", {
      "net8.0": [
        makeHit({ repositoryName: "repo-dev", branch: "develop" }),
        makeHit({ repositoryName: "repo-master", branch: "master" }),
      ],
    });
    store.records.push(record);

    const dashboard = await useCase.buildForDate("2024-06-15", "develop");

    expect(dashboard).not.toBeNull();
    expect(dashboard!.totalRepos).toBe(1);
    expect(dashboard!.branchFilter).toBe("develop");

    const repos = dashboard!.reposByVersion.get(DotNetVersion.Net80) ?? [];
    expect(repos).toHaveLength(1);
    expect(repos[0].repositoryName).toBe("repo-dev");
  });

  it("should build monthly evolution from multiple queries", async () => {
    store.records.push(
      makeRecord("2024-04-10", {
        "net6.0": [
          makeHit({
            repositoryName: "repo-a",
            dotnetVersion: DotNetVersion.Net60,
          }),
        ],
      }),
    );
    store.records.push(
      makeRecord("2024-05-15", {
        "net8.0": [
          makeHit({
            repositoryName: "repo-a",
            dotnetVersion: DotNetVersion.Net80,
          }),
          makeHit({
            repositoryName: "repo-b",
            dotnetVersion: DotNetVersion.Net80,
          }),
        ],
      }),
    );

    const snapshots = await useCase.buildMonthlyEvolution(6);

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].month).toBe("2024-04");
    expect(snapshots[1].month).toBe("2024-05");

    // April: 1 repo on net6
    expect(snapshots[0].reposByVersion.get(DotNetVersion.Net60)).toBe(1);
    // May: 2 repos on net8
    expect(snapshots[1].reposByVersion.get(DotNetVersion.Net80)).toBe(2);
  });

  it("should return available dates", async () => {
    store.records.push(
      makeRecord("2024-06-01", {}),
      makeRecord("2024-05-15", {}),
      makeRecord("2024-07-20", {}),
    );

    const dates = await useCase.getAvailableDates();

    expect(dates).toHaveLength(3);
    // Most recent first
    expect(dates[0].toISOString().slice(0, 10)).toBe("2024-07-20");
    expect(dates[1].toISOString().slice(0, 10)).toBe("2024-06-01");
    expect(dates[2].toISOString().slice(0, 10)).toBe("2024-05-15");
  });
});
