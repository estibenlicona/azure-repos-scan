/**
 * JSON persistence for daily query records.
 *
 * Serialization format is intentionally compatible with the Python
 * implementation so both can read each other's files.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { getAppDataPath } from '../config.js';
import type { QueryStoragePort } from '../../domain/ports.js';
import {
  DailyQueryRecord,
  getDotNetMoniker,
  dotNetVersionFromMoniker,
} from '../../domain/models.js';
import type { DotNetVersion, CodeSearchHit } from '../../domain/models.js';

// ---------------------------------------------------------------------------
// Legacy moniker migration (files written before the ".0" suffix fix)
// ---------------------------------------------------------------------------

const LEGACY_MAP: Record<string, string> = {
  net5: 'net5.0',
  net6: 'net6.0',
  net7: 'net7.0',
  net8: 'net8.0',
  net9: 'net9.0',
  net10: 'net10.0',
};

function migrateMoniker(moniker: string): string {
  return LEGACY_MAP[moniker] ?? moniker;
}

// ---------------------------------------------------------------------------
// Date helpers — JSON stores dates as "YYYY-MM-DD"
// ---------------------------------------------------------------------------

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

// ---------------------------------------------------------------------------
// Serialization helpers (snake_case JSON ↔ camelCase TS)
// ---------------------------------------------------------------------------

interface HitDict {
  repository_name: string;
  project_name: string;
  dotnet_version: string;
  branch: string;
  csproj_count?: number;
}

interface RecordDict {
  query_date: string;
  organization: string;
  project: string | null;
  versions_searched: string[];
  results_by_version: Record<string, HitDict[]>;
}

function hitToDict(hit: CodeSearchHit): HitDict {
  return {
    repository_name: hit.repositoryName,
    project_name: hit.projectName,
    dotnet_version: getDotNetMoniker(hit.dotnetVersion),
    branch: hit.branch,
    csproj_count: hit.csprojCount,
  };
}

function hitFromDict(d: HitDict): CodeSearchHit {
  const moniker = migrateMoniker(d.dotnet_version ?? 'net8.0');
  const version = dotNetVersionFromMoniker(moniker);
  return {
    repositoryName: d.repository_name ?? '',
    projectName: d.project_name ?? '',
    dotnetVersion: version ?? ('NET_8' as DotNetVersion),
    branch: d.branch ?? '',
    csprojCount: d.csproj_count ?? 1,
  };
}

function recordToDict(record: DailyQueryRecord): RecordDict {
  const resultsByVersion: Record<string, HitDict[]> = {};
  for (const [key, hits] of Object.entries(record.resultsByVersion)) {
    resultsByVersion[key] = hits.map(hitToDict);
  }
  return {
    query_date: formatDate(record.queryDate),
    organization: record.organization,
    project: record.project,
    versions_searched: record.versionsSearched.map((v) => getDotNetMoniker(v)),
    results_by_version: resultsByVersion,
  };
}

function recordFromDict(d: RecordDict): DailyQueryRecord {
  // Migrate versions_searched
  const versionsSearched: DotNetVersion[] = [];
  for (const raw of d.versions_searched ?? []) {
    const migrated = migrateMoniker(raw);
    const v = dotNetVersionFromMoniker(migrated);
    if (v !== undefined) {
      versionsSearched.push(v);
    }
  }

  // Migrate results_by_version keys and parse hits
  const resultsByVersion: Record<string, CodeSearchHit[]> = {};
  for (const [key, hits] of Object.entries(d.results_by_version ?? {})) {
    const migratedKey = migrateMoniker(key);
    const parsed = hits.map(hitFromDict);
    if (migratedKey in resultsByVersion) {
      resultsByVersion[migratedKey]!.push(...parsed);
    } else {
      resultsByVersion[migratedKey] = parsed;
    }
  }

  return new DailyQueryRecord({
    queryDate: parseDate(d.query_date),
    organization: d.organization ?? '',
    project: d.project ?? null,
    versionsSearched,
    resultsByVersion,
  });
}

// ---------------------------------------------------------------------------
// JsonQueryStore
// ---------------------------------------------------------------------------

export class JsonQueryStore implements QueryStoragePort {
  private readonly filePath: string;

  constructor() {
    this.filePath = path.join(getAppDataPath(), 'queries.json');
  }

  async saveQuery(record: DailyQueryRecord): Promise<void> {
    const records = await this.loadQueries();
    const dateStr = formatDate(record.queryDate);
    const existing = records.find((r) => formatDate(r.queryDate) === dateStr);

    if (existing) {
      existing.merge(record);
    } else {
      records.push(record);
    }

    await this.write(records);
  }

  async loadQueries(): Promise<DailyQueryRecord[]> {
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      if (!raw.trim()) return [];
      const data = JSON.parse(raw) as RecordDict[];
      return data.map(recordFromDict);
    } catch {
      return [];
    }
  }

  async getQueryByDate(queryDate: Date): Promise<DailyQueryRecord | null> {
    const records = await this.loadQueries();
    const target = formatDate(queryDate);
    return records.find((r) => formatDate(r.queryDate) === target) ?? null;
  }

  private async write(records: DailyQueryRecord[]): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const data = records.map(recordToDict);
    await writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }
}
