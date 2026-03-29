import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  platform: process.platform,
  minimize: (): void => ipcRenderer.send('window:minimize'),
  maximize: (): void => ipcRenderer.send('window:maximize'),
  close: (): void => ipcRenderer.send('window:close'),

  // Scanner
  scanStart: (params: {
    organization: string;
    pat: string;
    versions: string[];
    project?: string;
    branches?: string[];
  }): Promise<unknown> => ipcRenderer.invoke('scan:start', params),

  onScanProgress: (callback: (data: { current: number; total: number; message: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { current: number; total: number; message: string }): void => {
      callback(data);
    };
    ipcRenderer.on('scan:progress', handler);
    return () => ipcRenderer.removeListener('scan:progress', handler);
  },

  // Dashboard
  dashboardLoad: (params: {
    date: string;
    branchFilter?: string;
  }): Promise<unknown> => ipcRenderer.invoke('dashboard:load', params),

  dashboardDates: (): Promise<Array<{ date: string; count: number }>> => ipcRenderer.invoke('dashboard:dates'),

  dashboardEvolution: (months?: number): Promise<unknown> =>
    ipcRenderer.invoke('dashboard:evolution', months),

  // Export
  exportExcel: (params: {
    hits: unknown[];
    outputPath: string;
  }): Promise<string> => ipcRenderer.invoke('export:excel', params),

  exportImage: (params: {
    imageData: string;
    outputPath: string;
  }): Promise<string> => ipcRenderer.invoke('export:image', params),

  exportPdf: (outputPath: string): Promise<string> =>
    ipcRenderer.invoke('export:pdf', outputPath),

  showSaveDialog: (options: {
    title: string;
    defaultPath: string;
    filters: Array<{ name: string; extensions: string[] }>;
  }): Promise<string | null> => ipcRenderer.invoke('dialog:save', options),

  // Settings
  settingsGet: (key: string): Promise<string> =>
    ipcRenderer.invoke('settings:get', key),

  settingsSet: (key: string, value: string): Promise<void> =>
    ipcRenderer.invoke('settings:set', key, value),

  settingsGetBatch: (keys: string[]): Promise<Record<string, string>> =>
    ipcRenderer.invoke('settings:getBatch', keys),

  settingsSetBatch: (entries: Record<string, string>): Promise<void> =>
    ipcRenderer.invoke('settings:setBatch', entries),

  // Projects
  listProjects: (params: {
    organization: string;
    pat: string;
  }): Promise<unknown[]> => ipcRenderer.invoke('projects:list', params),
});
