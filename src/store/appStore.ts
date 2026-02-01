import { create } from 'zustand';

export type ViewMode = 'home' | 'portfolio';

interface AppStore {
  currentView: ViewMode;
  setCurrentView: (view: ViewMode) => void;
  // 刷新触发器：用于触发首页排行榜刷新
  refreshRankingTrigger: number;
  triggerRankingRefresh: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  currentView: 'home',
  setCurrentView: (view: ViewMode) => set({ currentView: view }),
  refreshRankingTrigger: 0,
  triggerRankingRefresh: () => set((state) => ({ refreshRankingTrigger: state.refreshRankingTrigger + 1 })),
}));
