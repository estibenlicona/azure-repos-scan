import type {
  ElectronAPI,
  ScanStartParams,
  ScanProgress,
  DashboardLoadParams,
  SaveDialogOptions,
} from '../types/electron';

function getApi(): ElectronAPI {
  if (!window.electronAPI) throw new Error('electronAPI not available');
  return window.electronAPI;
}

export const ipcClient = {
  scan: {
    start: (params: ScanStartParams) => getApi().scanStart(params),
    onProgress: (cb: (data: ScanProgress) => void) => getApi().onScanProgress(cb),
  },
  dashboard: {
    load: (params: DashboardLoadParams) => getApi().dashboardLoad(params),
    dates: () => getApi().dashboardDates(),
    evolution: (months?: number) => getApi().dashboardEvolution(months),
  },
  export: {
    excel: (hits: unknown[], outputPath: string) => getApi().exportExcel({ hits, outputPath }),
    image: (imageData: string, outputPath: string) => getApi().exportImage({ imageData, outputPath }),
    saveDialog: (options: SaveDialogOptions) => getApi().showSaveDialog(options),
  },
  settings: {
    get: (key: string) => getApi().settingsGet(key),
    set: (key: string, value: string) => getApi().settingsSet(key, value),
    getBatch: (keys: string[]) => getApi().settingsGetBatch(keys),
    setBatch: (entries: Record<string, string>) => getApi().settingsSetBatch(entries),
  },
  projects: {
    list: (org: string, pat: string) => getApi().listProjects({ organization: org, pat }),
  },
};
