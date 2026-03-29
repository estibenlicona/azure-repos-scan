/** Use case: build dashboard data from stored query records. */

import type {
  CodeSearchHit,
  DotNetVersion,
  MonthlySnapshot,
  RepoSummary,
} from "../../domain/models";
import { getDotNetSortKey } from "../../domain/models";
import type { QueryStoragePort } from "../../domain/ports";

/** Format a Date as YYYY-MM-DD using local timezone. */
function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface DashboardData {
  readonly queryDate: string;
  readonly organization: string;
  readonly totalRepos: number;
  readonly totalCsprojs: number;
  readonly reposByVersion: ReadonlyMap<DotNetVersion, readonly RepoSummary[]>;
  readonly branchesAvailable: readonly string[];
  readonly branchFilter?: string;
}

/** Group hits by repository, determining the oldest version per repo. */
function groupHitsIntoRepos(
  hits: readonly CodeSearchHit[],
  branchFilter?: string,
): RepoSummary[] {
  const filtered = branchFilter
    ? hits.filter((h) => h.branch === branchFilter)
    : hits;

  const groups = new Map<string, CodeSearchHit[]>();
  for (const hit of filtered) {
    const key = `${hit.repositoryName}\0${hit.projectName}`;
    const list = groups.get(key);
    if (list) {
      list.push(hit);
    } else {
      groups.set(key, [hit]);
    }
  }

  const summaries: RepoSummary[] = [];
  for (const repoHits of groups.values()) {
    const versions = new Set(repoHits.map((h) => h.dotnetVersion));
    const branches = new Set(repoHits.map((h) => h.branch));

    let oldest: DotNetVersion = repoHits[0].dotnetVersion;
    for (const v of versions) {
      if (getDotNetSortKey(v) < getDotNetSortKey(oldest)) {
        oldest = v;
      }
    }

    summaries.push({
      repositoryName: repoHits[0].repositoryName,
      projectName: repoHits[0].projectName,
      oldestVersion: oldest,
      allVersions: versions,
      branches,
      csprojCount: repoHits.reduce((sum, h) => sum + (h.csprojCount ?? 1), 0),
      hits: repoHits,
    });
  }

  return summaries;
}

export class BuildDashboardDataUseCase {
  constructor(private readonly store: QueryStoragePort) {}

  /** Build dashboard data for a specific date. */
  async buildForDate(
    queryDate: string,
    branchFilter?: string,
  ): Promise<DashboardData | null> {
    // Parse as local date (YYYY-MM-DD) to match how the store formats dates
    const [y, m, d] = queryDate.split('-').map(Number) as [number, number, number];
    const record = await this.store.getQueryByDate(new Date(y, m - 1, d));
    if (record === null) {
      return null;
    }

    const allHits = record.getAllHits();
    const summaries = groupHitsIntoRepos(allHits, branchFilter);

    const reposByVersion = new Map<DotNetVersion, RepoSummary[]>();
    for (const s of summaries) {
      const list = reposByVersion.get(s.oldestVersion);
      if (list) {
        list.push(s);
      } else {
        reposByVersion.set(s.oldestVersion, [s]);
      }
    }

    const branchesAvailable = [
      ...new Set(allHits.map((h) => h.branch)),
    ].sort();

    return {
      queryDate: record.queryDate.toISOString().slice(0, 10),
      organization: record.organization,
      totalRepos: summaries.length,
      totalCsprojs: summaries.reduce((sum, s) => sum + s.csprojCount, 0),
      reposByVersion,
      branchesAvailable,
      branchFilter,
    };
  }

  /** Build monthly evolution of repos by version. Takes the most recent record per month. */
  async buildMonthlyEvolution(months = 6): Promise<MonthlySnapshot[]> {
    const records = await this.store.loadQueries();
    if (records.length === 0) {
      return [];
    }

    // Group by month, keep the most recent record per month
    const byMonth = new Map<
      string,
      { date: Date; record: (typeof records)[0] }
    >();
    for (const rec of records) {
      const d = rec.queryDate;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const existing = byMonth.get(monthKey);
      if (!existing || d > existing.date) {
        byMonth.set(monthKey, { date: d, record: rec });
      }
    }

    // Sort months and limit
    const sortedMonths = [...byMonth.keys()].sort().slice(-months);

    const snapshots: MonthlySnapshot[] = [];
    for (const monthKey of sortedMonths) {
      const entry = byMonth.get(monthKey)!;
      const allHits = entry.record.getAllHits();
      const summaries = groupHitsIntoRepos(allHits);

      const versionCounts = new Map<DotNetVersion, number>();
      for (const s of summaries) {
        versionCounts.set(
          s.oldestVersion,
          (versionCounts.get(s.oldestVersion) ?? 0) + 1,
        );
      }

      snapshots.push({ month: monthKey, reposByVersion: versionCounts });
    }

    return snapshots;
  }

  /** Get available dates in the history, most recent first. */
  async getAvailableDates(): Promise<Date[]> {
    const records = await this.store.loadQueries();
    const dateSet = new Map<string, Date>();
    for (const r of records) {
      const key = formatLocalDate(r.queryDate);
      if (!dateSet.has(key) || r.queryDate > dateSet.get(key)!) {
        dateSet.set(key, r.queryDate);
      }
    }
    return [...dateSet.values()].sort((a, b) => b.getTime() - a.getTime());
  }

  /** Get available dates with their result counts, most recent first. */
  async getAvailableDatesWithCounts(): Promise<Array<{ date: Date; count: number }>> {
    const records = await this.store.loadQueries();
    const dateMap = new Map<string, { date: Date; count: number }>();
    for (const r of records) {
      const key = formatLocalDate(r.queryDate);
      const existing = dateMap.get(key);
      if (!existing || r.queryDate > existing.date) {
        dateMap.set(key, { date: r.queryDate, count: r.totalResults });
      }
    }
    return [...dateMap.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
  }
}
