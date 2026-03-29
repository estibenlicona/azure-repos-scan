import { create } from 'zustand';
import { ipcClient } from '../lib/ipc-client';

export interface RendererRepoSummary {
  repositoryName: string;
  projectName: string;
  oldestVersion: string;
  allVersions: string[];
  branches: string[];
  csprojCount: number;
}

export interface RendererDashboardData {
  queryDate: string;
  organization: string;
  totalRepos: number;
  totalCsprojs: number;
  reposByVersion: Record<string, RendererRepoSummary[]>;
  branchesAvailable: string[];
}

export interface RendererMonthlySnapshot {
  month: string;
  reposByVersion: Record<string, number>;
}

export type DashboardLoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; data: RendererDashboardData }
  | { status: 'empty' }
  | { status: 'error'; message: string };

interface DashboardState {
  availableDates: string[];
  selectedDate: string;
  branchFilter: string;
  loadState: DashboardLoadState;
  evolution: RendererMonthlySnapshot[];

  loadDates: () => Promise<void>;
  selectDate: (date: string) => Promise<void>;
  setBranchFilter: (branch: string) => Promise<void>;
  loadEvolution: (months?: number) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>()((set, get) => ({
  availableDates: [],
  selectedDate: '',
  branchFilter: 'all',
  loadState: { status: 'idle' },
  evolution: [],

  loadDates: async () => {
    try {
      const entries = await ipcClient.dashboard.dates();
      const sorted = entries.map((e) => e.date).sort().reverse();
      set({ availableDates: sorted });
      if (sorted.length > 0 && !get().selectedDate) {
        await get().selectDate(sorted[0]);
      }
    } catch {
      set({ availableDates: [] });
    }
  },

  selectDate: async (date) => {
    set({ selectedDate: date, loadState: { status: 'loading' } });
    try {
      const result = await ipcClient.dashboard.load({
        date,
        branchFilter: get().branchFilter !== 'all' ? get().branchFilter : undefined,
      });
      const data = result as RendererDashboardData | null;
      if (data) {
        set({ loadState: { status: 'loaded', data } });
      } else {
        set({ loadState: { status: 'empty' } });
      }
    } catch (error) {
      set({
        loadState: {
          status: 'error',
          message: error instanceof Error ? error.message : 'Error loading dashboard',
        },
      });
    }
  },

  setBranchFilter: async (branch) => {
    set({ branchFilter: branch });
    const { selectedDate } = get();
    if (selectedDate) {
      await get().selectDate(selectedDate);
    }
  },

  loadEvolution: async (months = 6) => {
    try {
      const result = await ipcClient.dashboard.evolution(months);
      set({ evolution: (result as RendererMonthlySnapshot[]) ?? [] });
    } catch {
      set({ evolution: [] });
    }
  },

  refresh: async () => {
    await get().loadDates();
    await get().loadEvolution();
  },
}));
