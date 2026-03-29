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
  getDotNetMoniker,
  dotNetVersionFromMoniker,
} from './domain/models.js';
import type { CodeSearchHit } from './domain/models.js';

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

    // Serialize hits for renderer
    const hits = record.getAllHits().map((h) => ({
      repositoryName: h.repositoryName,
      projectName: h.projectName,
      dotnetVersion: getDotNetMoniker(h.dotnetVersion),
      branch: h.branch,
    }));

    return { hits, queryDate: record.queryDate.toISOString(), totalResults: record.totalResults };
  });

  // dashboard:dates — Get available query dates
  ipcMain.handle('dashboard:dates', async () => {
    const dashboardUC = new BuildDashboardDataUseCase(queryStore);
    const dates = await dashboardUC.getAvailableDates();
    return dates.map((d) => d.toISOString().slice(0, 10));
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
      const moniker = getDotNetMoniker(version);
      reposByVersion[moniker] = summaries.map((s) => ({
        repositoryName: s.repositoryName,
        projectName: s.projectName,
        oldestVersion: getDotNetMoniker(s.oldestVersion),
        allVersions: Array.from(s.allVersions).map((v) => getDotNetMoniker(v)),
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
        Array.from(s.reposByVersion.entries()).map(([k, v]) => [getDotNetMoniker(k), v]),
      ),
    }));
  });

  // export:excel — Export hits to Excel
  ipcMain.handle('export:excel', async (_event, params: {
    hits: Array<{ repositoryName: string; projectName: string; dotnetVersion: string; branch: string }>;
    outputPath: string;
  }) => {
    const exportUC = new ExportResultsUseCase();
    // Convert renderer monikers back to domain CodeSearchHit objects
    const convertedHits: CodeSearchHit[] = params.hits.map((h) => ({
      repositoryName: h.repositoryName,
      projectName: h.projectName,
      dotnetVersion: dotNetVersionFromMoniker(h.dotnetVersion) ?? DotNetVersion.Net80,
      branch: h.branch,
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
