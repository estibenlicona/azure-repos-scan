import { ipcMain, BrowserWindow } from 'electron';
import { AxiosAzureDevOpsClient } from './infrastructure/adapters/azure-devops-client.js';
import { JsonQueryStore } from './infrastructure/persistence/query-store.js';
import { SettingsStore } from './infrastructure/persistence/settings-store.js';
import {
  SearchDotNetProjectsUseCase,
  BuildDashboardDataUseCase,
  ExportResultsUseCase,
  ListProjectsUseCase,
} from './application/index.js';
import {
  DotNetVersion,
} from './domain/models.js';
import type { CodeSearchHit } from './domain/models.js';

/** Map a DotNetVersion value back to its key name (e.g. 'NET_8' → 'Net80'). */
function getDotNetKey(version: string): string {
  const entry = Object.entries(DotNetVersion).find(([, v]) => v === version);
  return entry ? entry[0] : version;
}

const queryStore = new JsonQueryStore();
const settingsStore = new SettingsStore();

export function registerAppIpcHandlers(getMainWindow: () => BrowserWindow | null): void {

  // scan:start — Run the .NET search
  ipcMain.handle('scan:start', async (_event, params: {
    organization: string;
    pat: string;
    versions: string[];
    project?: string;
    branches?: string[];
  }) => {
    const client = new AxiosAzureDevOpsClient(params.organization, params.pat);
    const useCase = new SearchDotNetProjectsUseCase(client, queryStore, params.organization);

    const versions = params.versions
      .map((key) => DotNetVersion[key as keyof typeof DotNetVersion])
      .filter((v): v is DotNetVersion => v !== undefined);

    const record = await useCase.execute({
      versions,
      project: params.project,
      branches: params.branches,
      onProgress: (current, total, message) => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send('scan:progress', { current, total, message });
        }
      },
    });

    // Serialize hits for renderer (use key names like 'Net80' not monikers like 'net8.0')
    const hits = record.getAllHits().map((h) => ({
      repositoryName: h.repositoryName,
      projectName: h.projectName,
      dotnetVersion: getDotNetKey(h.dotnetVersion),
      branch: h.branch,
      csprojCount: h.csprojCount,
    }));

    return { hits, queryDate: record.queryDate.toISOString(), totalResults: record.totalResults };
  });

  // dashboard:dates — Get available query dates with counts
  ipcMain.handle('dashboard:dates', async () => {
    const dashboardUC = new BuildDashboardDataUseCase(queryStore);
    const entries = await dashboardUC.getAvailableDatesWithCounts();
    const result = entries.map((e) => {
      const d = e.date;
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { date: dateStr, count: e.count };
    });
    return result;
  });

  // dashboard:load — Load dashboard data for a date
  ipcMain.handle('dashboard:load', async (_event, params: {
    date: string;
    branchFilter?: string;
  }) => {
    const dashboardUC = new BuildDashboardDataUseCase(queryStore);
    const data = await dashboardUC.buildForDate(params.date, params.branchFilter);
    if (!data) return null;

    // Serialize for renderer (convert Map to Record, Set to Array)
    const reposByVersion: Record<string, Array<{
      repositoryName: string;
      projectName: string;
      oldestVersion: string;
      allVersions: string[];
      branches: string[];
      csprojCount: number;
    }>> = {};

    for (const [version, summaries] of data.reposByVersion) {
      const key = getDotNetKey(version);
      reposByVersion[key] = summaries.map((s) => ({
        repositoryName: s.repositoryName,
        projectName: s.projectName,
        oldestVersion: getDotNetKey(s.oldestVersion),
        allVersions: Array.from(s.allVersions).map((v) => getDotNetKey(v)),
        branches: Array.from(s.branches),
        csprojCount: s.csprojCount,
      }));
    }

    return {
      queryDate: data.queryDate,
      organization: data.organization,
      totalRepos: data.totalRepos,
      totalCsprojs: data.totalCsprojs,
      reposByVersion,
      branchesAvailable: Array.from(data.branchesAvailable),
    };
  });

  // dashboard:evolution — Load monthly evolution data
  ipcMain.handle('dashboard:evolution', async (_event, months?: number) => {
    const dashboardUC = new BuildDashboardDataUseCase(queryStore);
    const snapshots = await dashboardUC.buildMonthlyEvolution(months);
    return snapshots.map((s) => ({
      month: s.month,
      reposByVersion: Object.fromEntries(
        Array.from(s.reposByVersion.entries()).map(([k, v]) => [getDotNetKey(k), v]),
      ),
    }));
  });

  // export:excel — Export hits to Excel
  ipcMain.handle('export:excel', async (_event, params: {
    hits: Array<{ repositoryName: string; projectName: string; dotnetVersion: string; branch: string; csprojCount?: number }>;
    outputPath: string;
  }) => {
    const exportUC = new ExportResultsUseCase();
    const convertedHits: CodeSearchHit[] = params.hits.map((h) => ({
      repositoryName: h.repositoryName,
      projectName: h.projectName,
      dotnetVersion: DotNetVersion[h.dotnetVersion as keyof typeof DotNetVersion] ?? DotNetVersion.Net80,
      branch: h.branch,
      csprojCount: h.csprojCount ?? 1,
    }));
    return exportUC.execute(convertedHits, params.outputPath);
  });

  // settings:get
  ipcMain.handle('settings:get', async (_event, key: string) => {
    return settingsStore.get(key);
  });

  // settings:set
  ipcMain.handle('settings:set', async (_event, key: string, value: string) => {
    await settingsStore.set(key, value);
  });

  // settings:getBatch — get multiple keys in a single read
  ipcMain.handle('settings:getBatch', async (_event, keys: string[]) => {
    return settingsStore.getMultiple(keys);
  });

  // settings:setBatch — set multiple keys in a single write (avoids race conditions)
  ipcMain.handle('settings:setBatch', async (_event, entries: Record<string, string>) => {
    await settingsStore.setMultiple(entries);
  });

  // projects:list
  ipcMain.handle('projects:list', async (_event, params: {
    organization: string;
    pat: string;
  }) => {
    const client = new AxiosAzureDevOpsClient(params.organization, params.pat);
    const useCase = new ListProjectsUseCase(client);
    const projects = await useCase.execute();
    return projects.map((p) => ({
      id: p.id.value,
      name: p.name,
      description: p.description,
      url: p.url,
    }));
  });
}
