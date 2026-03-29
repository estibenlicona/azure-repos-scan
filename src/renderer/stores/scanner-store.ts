import { create } from 'zustand';
import { ipcClient } from '../lib/ipc-client';

// Use string literals for DotNetVersion in renderer (avoid importing main process code)
export type DotNetVersionId = 'Net31' | 'Net50' | 'Net60' | 'Net70' | 'Net80' | 'Net90' | 'Net100';

export interface RendererCodeSearchHit {
  repositoryName: string;
  projectName: string;
  dotnetVersion: string;
  branch: string;
  csprojCount: number;
}

export type ScanState =
  | { status: 'idle' }
  | { status: 'scanning'; progress: number; total: number; message: string }
  | { status: 'complete'; hits: RendererCodeSearchHit[] }
  | { status: 'error'; message: string };

interface ScannerState {
  organization: string;
  pat: string;
  project: string;
  selectedVersions: DotNetVersionId[];
  selectedBranches: string[];
  scanState: ScanState;
  filteredHits: RendererCodeSearchHit[];
  versionFilter: string;
  nameFilter: string;
  currentPage: number;
  pageSize: number;
  history: Array<{ date: string; count: number }>;

  setOrganization: (org: string) => void;
  setPat: (pat: string) => void;
  setProject: (project: string) => void;
  toggleVersion: (version: DotNetVersionId) => void;
  selectAllVersions: () => void;
  selectNoVersions: () => void;
  toggleBranch: (branch: string) => void;
  selectAllBranches: () => void;
  selectNoBranches: () => void;
  setVersionFilter: (filter: string) => void;
  setNameFilter: (filter: string) => void;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  startScan: () => Promise<void>;
  loadHistory: () => Promise<void>;
  loadHistoryRecord: (date: string) => Promise<void>;
}

const ALL_VERSIONS: DotNetVersionId[] = ['Net31', 'Net50', 'Net60', 'Net70', 'Net80', 'Net90', 'Net100'];
const DEFAULT_BRANCHES = ['develop', 'test', 'master'];

function applyFilters(
  hits: RendererCodeSearchHit[],
  versionFilter: string,
  nameFilter: string,
): RendererCodeSearchHit[] {
  let result = hits;
  if (versionFilter && versionFilter !== 'all') {
    result = result.filter((h) => h.dotnetVersion === versionFilter);
  }
  if (nameFilter.trim()) {
    const term = nameFilter.trim().toLowerCase();
    result = result.filter((h) => h.repositoryName.toLowerCase().includes(term));
  }
  return result;
}

export const useScannerStore = create<ScannerState>()((set, get) => ({
  organization: '',
  pat: '',
  project: '',
  selectedVersions: [...ALL_VERSIONS],
  selectedBranches: [...DEFAULT_BRANCHES],
  scanState: { status: 'idle' },
  filteredHits: [],
  versionFilter: 'all',
  nameFilter: '',
  currentPage: 0,
  pageSize: 25,
  history: [],

  setOrganization: (org) => set({ organization: org }),
  setPat: (pat) => set({ pat }),
  setProject: (project) => set({ project }),

  toggleVersion: (version) =>
    set((state) => ({
      selectedVersions: state.selectedVersions.includes(version)
        ? state.selectedVersions.filter((v) => v !== version)
        : [...state.selectedVersions, version],
    })),
  selectAllVersions: () => set({ selectedVersions: [...ALL_VERSIONS] }),
  selectNoVersions: () => set({ selectedVersions: [] }),

  toggleBranch: (branch) =>
    set((state) => ({
      selectedBranches: state.selectedBranches.includes(branch)
        ? state.selectedBranches.filter((b) => b !== branch)
        : [...state.selectedBranches, branch],
    })),
  selectAllBranches: () => set({ selectedBranches: [...DEFAULT_BRANCHES] }),
  selectNoBranches: () => set({ selectedBranches: [] }),

  setVersionFilter: (filter) => {
    set((state) => {
      const hits = state.scanState.status === 'complete' ? state.scanState.hits : [];
      const filtered = applyFilters(hits, filter, state.nameFilter);
      return { versionFilter: filter, filteredHits: filtered, currentPage: 0 };
    });
  },
  setNameFilter: (filter) => {
    set((state) => {
      const hits = state.scanState.status === 'complete' ? state.scanState.hits : [];
      const filtered = applyFilters(hits, state.versionFilter, filter);
      return { nameFilter: filter, filteredHits: filtered, currentPage: 0 };
    });
  },
  setCurrentPage: (page) => set({ currentPage: page }),
  setPageSize: (size) => set({ pageSize: size, currentPage: 0 }),

  startScan: async () => {
    const { organization, pat, selectedVersions, project, selectedBranches } = get();

    set({ scanState: { status: 'scanning', progress: 0, total: 0, message: 'Iniciando escaneo...' } });

    const cleanup = ipcClient.scan.onProgress((data) => {
      set({ scanState: { status: 'scanning', progress: data.current, total: data.total, message: data.message } });
    });

    try {
      const result = await ipcClient.scan.start({
        organization,
        pat,
        versions: selectedVersions,
        project: project || undefined,
        branches: selectedBranches.length > 0 ? selectedBranches : undefined,
      });

      const hits = (result as { hits?: RendererCodeSearchHit[] })?.hits ?? [];
      set({
        scanState: { status: 'complete', hits },
        filteredHits: hits,
        versionFilter: 'all',
        currentPage: 0,
      });

      // Refresh history after successful scan
      void get().loadHistory();
    } catch (error) {
      set({
        scanState: {
          status: 'error',
          message: error instanceof Error ? error.message : 'Error desconocido',
        },
      });
    } finally {
      cleanup();
    }
  },

  loadHistory: async () => {
    try {
      const entries = await ipcClient.dashboard.dates();
      set({ history: entries.map((e) => ({ date: e.date, count: e.count })) });
    } catch {
      // Silently fail for history
    }
  },

  loadHistoryRecord: async (date) => {
    try {
      const result = await ipcClient.dashboard.load({ date });
      const data = result as {
        reposByVersion?: Record<string, Array<{
          repositoryName: string;
          projectName: string;
          oldestVersion: string;
          allVersions: string[];
          branches: string[];
          csprojCount: number;
        }>>;
      } | null;

      if (!data?.reposByVersion) {
        set({ scanState: { status: 'complete', hits: [] }, filteredHits: [], versionFilter: 'all', currentPage: 0 });
        return;
      }

      // Flatten repo summaries into individual hits for the results table
      const hits: RendererCodeSearchHit[] = [];
      for (const [version, repos] of Object.entries(data.reposByVersion)) {
        for (const repo of repos) {
          for (const branch of repo.branches) {
            hits.push({
              repositoryName: repo.repositoryName,
              projectName: repo.projectName,
              dotnetVersion: version,
              branch,
              csprojCount: repo.csprojCount,
            });
          }
        }
      }

      set({
        scanState: { status: 'complete', hits },
        filteredHits: hits,
        versionFilter: 'all',
        currentPage: 0,
      });
    } catch {
      // Silently fail
    }
  },
}));
