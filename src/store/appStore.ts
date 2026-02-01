import { create } from 'zustand';

export type ViewMode = 'home' | 'portfolio';

interface AppStore {
  currentView: ViewMode;
  setCurrentView: (view: ViewMode) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  currentView: 'home',
  setCurrentView: (view: ViewMode) => set({ currentView: view }),
}));
