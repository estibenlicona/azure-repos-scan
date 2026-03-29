export interface ScanStartParams {
  organization: string;
  pat: string;
  versions: string[];
  project?: string;
  branches?: string[];
}

export interface ScanProgress {
  current: number;
  total: number;
  message: string;
}

export interface DashboardLoadParams {
  date: string;
  branchFilter?: string;
}

export interface SaveDialogOptions {
  title: string;
  defaultPath: string;
  filters: Array<{ name: string; extensions: string[] }>;
}

export interface ElectronAPI {
  platform: string;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  scanStart: (params: ScanStartParams) => Promise<unknown>;
  onScanProgress: (callback: (data: ScanProgress) => void) => () => void;
  dashboardLoad: (params: DashboardLoadParams) => Promise<unknown>;
  dashboardDates: () => Promise<Array<{ date: string; count: number }>>;
  dashboardEvolution: (months?: number) => Promise<unknown>;
  exportExcel: (params: { hits: unknown[]; outputPath: string }) => Promise<string>;
  exportImage: (params: { imageData: string; outputPath: string }) => Promise<string>;
  showSaveDialog: (options: SaveDialogOptions) => Promise<string | null>;
  settingsGet: (key: string) => Promise<string>;
  settingsSet: (key: string, value: string) => Promise<void>;
  settingsGetBatch: (keys: string[]) => Promise<Record<string, string>>;
  settingsSetBatch: (entries: Record<string, string>) => Promise<void>;
  listProjects: (params: { organization: string; pat: string }) => Promise<unknown[]>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
