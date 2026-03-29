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

  dashboardDates: (): Promise<string[]> => ipcRenderer.invoke('dashboard:dates'),

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

  // Projects
  listProjects: (params: {
    organization: string;
    pat: string;
  }): Promise<unknown[]> => ipcRenderer.invoke('projects:list', params),
});
