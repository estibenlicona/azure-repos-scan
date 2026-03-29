import { create } from 'zustand';

export type PageId = 'dashboard' | 'scanner' | 'results';

interface NavState {
  activePage: PageId;
  navigateTo: (page: PageId) => void;
}

export const useNavStore = create<NavState>((set) => ({
  activePage: 'dashboard',
  navigateTo: (page) => set({ activePage: page }),
}));
