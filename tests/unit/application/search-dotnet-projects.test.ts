import { describe, it, expect, beforeEach } from "vitest";

import { DotNetVersion } from "../../../src/main/domain/models";
import { SearchDotNetProjectsUseCase } from "../../../src/main/application/use-cases/search-dotnet-projects";
import { FakeAzureDevOpsClient, FakeQueryStore } from "./fakes";

describe("SearchDotNetProjectsUseCase", () => {
  let client: FakeAzureDevOpsClient;
  let store: FakeQueryStore;
  let useCase: SearchDotNetProjectsUseCase;

  beforeEach(() => {
    client = new FakeAzureDevOpsClient();
    store = new FakeQueryStore();
    useCase = new SearchDotNetProjectsUseCase(client, store, "contoso");
  });

  it("should return empty record when no results found", async () => {
    const record = await useCase.execute({
      versions: [DotNetVersion.Net80],
    });

    expect(record.totalResults).toBe(0);
    expect(record.resultsByVersion["net8.0"] ?? []).toEqual([]);
  });

  it("should create hits from facets", async () => {
    client.addSearchResult("net8.0", "my-repo", "my-project");

    const record = await useCase.execute({
      versions: [DotNetVersion.Net80],
    });

    expect(record.totalResults).toBeGreaterThanOrEqual(1);
    const hits = record.resultsByVersion["net8.0"];
    expect(hits).toBeDefined();
    expect(hits!.some((h) => h.repositoryName === "my-repo")).toBe(true);
    expect(hits!.some((h) => h.projectName === "my-project")).toBe(true);
  });

  it("should deduplicate hits by (repository, branch)", async () => {
    // Both singular and plural queries match the same repo → should deduplicate
    client.addSearchResult("net8.0", "repo-a", "proj-1");

    const record = await useCase.execute({
      versions: [DotNetVersion.Net80],
    });

    const hits = record.resultsByVersion["net8.0"] ?? [];
    const uniqueKeys = new Set(
      hits.map((h) => `${h.repositoryName}\0${h.branch}`),
    );
    expect(uniqueKeys.size).toBe(hits.length);
  });

  it("should call onProgress callback", async () => {
    const progressCalls: Array<{
      current: number;
      total: number;
      message: string;
    }> = [];

    await useCase.execute({
      versions: [DotNetVersion.Net80],
      onProgress: (current, total, message) => {
        progressCalls.push({ current, total, message });
      },
    });

    // 2 queries per version (singular + plural) + final completion callback
    expect(progressCalls.length).toBeGreaterThanOrEqual(3);
    // First call should be step 0
    expect(progressCalls[0].current).toBe(0);
    // Last call should signal completion
    const last = progressCalls[progressCalls.length - 1];
    expect(last.current).toBe(last.total);
    expect(last.message).toBe("Búsqueda completada");
  });

  it("should save query to store", async () => {
    client.addSearchResult("net8.0", "repo-a", "proj-1");

    await useCase.execute({
      versions: [DotNetVersion.Net80],
    });

    expect(store.records).toHaveLength(1);
    expect(store.records[0].organization).toBe("contoso");
    expect(store.records[0].versionsSearched).toContain(DotNetVersion.Net80);
  });

  it("should handle multiple versions", async () => {
    client.addSearchResult("net6.0", "repo-old", "proj-1");
    client.addSearchResult("net8.0", "repo-new", "proj-1");

    const record = await useCase.execute({
      versions: [DotNetVersion.Net60, DotNetVersion.Net80],
    });

    const net6Hits = record.resultsByVersion["net6.0"] ?? [];
    const net8Hits = record.resultsByVersion["net8.0"] ?? [];

    expect(net6Hits.some((h) => h.repositoryName === "repo-old")).toBe(true);
    expect(net8Hits.some((h) => h.repositoryName === "repo-new")).toBe(true);
  });

  it("should handle branch-specific queries", async () => {
    client.addSearchResult("net8.0", "repo-a", "proj-1", "develop");
    client.addSearchResult("net8.0", "repo-b", "proj-1", "master");

    const record = await useCase.execute({
      versions: [DotNetVersion.Net80],
      branches: ["develop", "master"],
    });

    const hits = record.resultsByVersion["net8.0"] ?? [];
    const repoNames = hits.map((h) => h.repositoryName);
    expect(repoNames).toContain("repo-a");
    expect(repoNames).toContain("repo-b");

    const branches = new Set(hits.map((h) => h.branch));
    expect(branches.has("develop")).toBe(true);
    expect(branches.has("master")).toBe(true);
  });
});
