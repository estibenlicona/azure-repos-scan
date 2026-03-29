import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { DotNetVersion, type CodeSearchHit } from "../../../src/main/domain/models";
import { ExportResultsUseCase } from "../../../src/main/application/use-cases/export-results";

function makeHit(overrides: Partial<CodeSearchHit> = {}): CodeSearchHit {
  return {
    repositoryName: overrides.repositoryName ?? "repo-a",
    projectName: overrides.projectName ?? "proj-1",
    dotnetVersion: overrides.dotnetVersion ?? DotNetVersion.Net80,
    branch: overrides.branch ?? "develop",
    csprojCount: overrides.csprojCount ?? 1,
  };
}

describe("ExportResultsUseCase", () => {
  const tempFiles: string[] = [];

  function tmpFilePath(name: string): string {
    const filePath = path.join(os.tmpdir(), name);
    tempFiles.push(filePath);
    return filePath;
  }

  afterEach(() => {
    for (const f of tempFiles) {
      try {
        fs.unlinkSync(f);
      } catch {
        // ignore
      }
    }
    tempFiles.length = 0;
  });

  it("should create Excel file at specified path", async () => {
    const useCase = new ExportResultsUseCase();
    const outputPath = tmpFilePath("test-export.xlsx");
    const hits: CodeSearchHit[] = [
      makeHit({ repositoryName: "repo-1", projectName: "proj-1" }),
      makeHit({
        repositoryName: "repo-2",
        projectName: "proj-2",
        dotnetVersion: DotNetVersion.Net60,
        branch: "master",
      }),
    ];

    const result = await useCase.execute(hits, outputPath);

    expect(result).toBe(outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);

    const stats = fs.statSync(outputPath);
    expect(stats.size).toBeGreaterThan(0);
  });

  it("should handle empty hits list", async () => {
    const useCase = new ExportResultsUseCase();
    const outputPath = tmpFilePath("test-export-empty.xlsx");

    const result = await useCase.execute([], outputPath);

    expect(result).toBe(outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);
  });
});
