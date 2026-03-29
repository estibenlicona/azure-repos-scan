import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import {
  DailyQueryRecord,
  DotNetVersion,
} from '../../../src/main/domain/models.js';

// Mock config so getAppDataPath returns a unique temp directory per run
const testDir = path.join(os.tmpdir(), `test-azure-repos-scan-${randomUUID()}`);

vi.mock('../../../src/main/infrastructure/config.js', () => ({
  getAppDataPath: () => testDir,
}));

// Import after mock is set up
const { JsonQueryStore } = await import(
  '../../../src/main/infrastructure/persistence/query-store.js'
);

function makeHit(overrides: Partial<{
  repositoryName: string;
  projectName: string;
  dotnetVersion: typeof DotNetVersion[keyof typeof DotNetVersion];
  branch: string;
}> = {}) {
  return {
    repositoryName: overrides.repositoryName ?? 'my-repo',
    projectName: overrides.projectName ?? 'my-project',
    dotnetVersion: overrides.dotnetVersion ?? DotNetVersion.Net80,
    branch: overrides.branch ?? 'main',
  };
}

function makeRecord(overrides: Partial<{
  queryDate: Date;
  organization: string;
  project: string | null;
  versionsSearched: (typeof DotNetVersion)[keyof typeof DotNetVersion][];
  resultsByVersion: Record<string, ReturnType<typeof makeHit>[]>;
}> = {}) {
  return new DailyQueryRecord({
    queryDate: overrides.queryDate ?? new Date(2024, 5, 15), // 2024-06-15
    organization: overrides.organization ?? 'my-org',
    project: overrides.project ?? null,
    versionsSearched: overrides.versionsSearched ?? [DotNetVersion.Net80],
    resultsByVersion: overrides.resultsByVersion ?? {
      'net8.0': [makeHit()],
    },
  });
}

describe('JsonQueryStore', () => {
  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should return empty list when file does not exist', async () => {
    const store = new JsonQueryStore();
    const records = await store.loadQueries();
    expect(records).toEqual([]);
  });

  it('should save and load a query record', async () => {
    const store = new JsonQueryStore();
    const record = makeRecord();
    await store.saveQuery(record);

    const loaded = await store.loadQueries();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].organization).toBe('my-org');
    expect(loaded[0].totalResults).toBe(1);
    expect(loaded[0].versionsSearched).toContain(DotNetVersion.Net80);
  });

  it('should merge records with same date', async () => {
    const store = new JsonQueryStore();
    const date = new Date(2024, 5, 15);

    const first = makeRecord({
      queryDate: date,
      versionsSearched: [DotNetVersion.Net80],
      resultsByVersion: { 'net8.0': [makeHit({ repositoryName: 'repo-a' })] },
    });
    await store.saveQuery(first);

    const second = makeRecord({
      queryDate: date,
      versionsSearched: [DotNetVersion.Net90],
      resultsByVersion: { 'net9.0': [makeHit({ repositoryName: 'repo-b', dotnetVersion: DotNetVersion.Net90 })] },
    });
    await store.saveQuery(second);

    const loaded = await store.loadQueries();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].versionsSearched).toContain(DotNetVersion.Net80);
    expect(loaded[0].versionsSearched).toContain(DotNetVersion.Net90);
    expect(loaded[0].resultsByVersion['net8.0']).toHaveLength(1);
    expect(loaded[0].resultsByVersion['net9.0']).toHaveLength(1);
  });

  it('should get query by date', async () => {
    const store = new JsonQueryStore();
    const date = new Date(2024, 5, 15);
    await store.saveQuery(makeRecord({ queryDate: date }));

    const found = await store.getQueryByDate(date);
    expect(found).not.toBeNull();
    expect(found!.organization).toBe('my-org');
  });

  it('should return null for non-existent date', async () => {
    const store = new JsonQueryStore();
    await store.saveQuery(makeRecord({ queryDate: new Date(2024, 5, 15) }));

    const result = await store.getQueryByDate(new Date(2099, 0, 1));
    expect(result).toBeNull();
  });

  it('should handle legacy moniker migration (e.g. "net5" → "net5.0")', async () => {
    const legacyJson = JSON.stringify([
      {
        query_date: '2024-06-15',
        organization: 'legacy-org',
        project: null,
        versions_searched: ['net5', 'net8'],
        results_by_version: {
          net5: [
            {
              repository_name: 'old-repo',
              project_name: 'old-proj',
              dotnet_version: 'net5',
              branch: 'main',
            },
          ],
          net8: [
            {
              repository_name: 'newer-repo',
              project_name: 'newer-proj',
              dotnet_version: 'net8',
              branch: 'develop',
            },
          ],
        },
      },
    ]);

    await writeFile(path.join(testDir, 'queries.json'), legacyJson, 'utf-8');

    const store = new JsonQueryStore();
    const records = await store.loadQueries();

    expect(records).toHaveLength(1);
    const record = records[0];

    // Versions should be migrated
    expect(record.versionsSearched).toContain(DotNetVersion.Net50);
    expect(record.versionsSearched).toContain(DotNetVersion.Net80);

    // Result keys should be migrated
    expect(record.resultsByVersion['net5.0']).toBeDefined();
    expect(record.resultsByVersion['net8.0']).toBeDefined();
    expect(record.resultsByVersion['net5']).toBeUndefined();

    // Hits should have migrated dotnetVersion
    expect(record.resultsByVersion['net5.0']![0].dotnetVersion).toBe(
      DotNetVersion.Net50,
    );
  });

  it('should handle serialization/deserialization roundtrip', async () => {
    const store = new JsonQueryStore();
    const date = new Date(2024, 11, 25); // 2024-12-25

    const original = makeRecord({
      queryDate: date,
      organization: 'roundtrip-org',
      project: 'specific-project',
      versionsSearched: [DotNetVersion.Net60, DotNetVersion.Net80],
      resultsByVersion: {
        'net6.0': [
          makeHit({ repositoryName: 'r1', projectName: 'p1', dotnetVersion: DotNetVersion.Net60, branch: 'develop' }),
          makeHit({ repositoryName: 'r2', projectName: 'p2', dotnetVersion: DotNetVersion.Net60, branch: 'main' }),
        ],
        'net8.0': [
          makeHit({ repositoryName: 'r3', projectName: 'p3', dotnetVersion: DotNetVersion.Net80, branch: 'test' }),
        ],
      },
    });

    await store.saveQuery(original);

    // Read the raw JSON to verify structure
    const raw = JSON.parse(
      await readFile(path.join(testDir, 'queries.json'), 'utf-8'),
    ) as unknown[];
    expect(raw).toHaveLength(1);

    // Load back through the store
    const loaded = await store.loadQueries();
    expect(loaded).toHaveLength(1);

    const rec = loaded[0];
    expect(rec.organization).toBe('roundtrip-org');
    expect(rec.project).toBe('specific-project');
    expect(rec.versionsSearched).toHaveLength(2);
    expect(rec.resultsByVersion['net6.0']).toHaveLength(2);
    expect(rec.resultsByVersion['net8.0']).toHaveLength(1);
    expect(rec.resultsByVersion['net8.0']![0].branch).toBe('test');
  });
});
