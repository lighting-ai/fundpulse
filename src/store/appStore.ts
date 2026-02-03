import { create } from 'zustand';

export type ViewMode = 'home' | 'portfolio' | 'faq';

interface AppStore {
  currentView: ViewMode;
  setCurrentView: (view: ViewMode) => void;
  // 刷新触发器：用于触发首页排行榜刷新
  refreshRankingTrigger: number;
  triggerRankingRefresh: () => void;
  // 刷新触发器：用于触发热门板块刷新
  refreshSectorTrigger: number;
  triggerSectorRefresh: () => void;
  // 刷新触发器：用于触发自选页显示数据刷新
  refreshPortfolioTrigger: number;
  triggerPortfolioRefresh: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  currentView: 'home',
  setCurrentView: (view: ViewMode) => set({ currentView: view }),
  refreshRankingTrigger: 0,
  triggerRankingRefresh: () => set((state) => ({ refreshRankingTrigger: state.refreshRankingTrigger + 1 })),
  refreshSectorTrigger: 0,
  triggerSectorRefresh: () => set((state) => ({ refreshSectorTrigger: state.refreshSectorTrigger + 1 })),
  refreshPortfolioTrigger: 0,
  triggerPortfolioRefresh: () => set((state) => ({ refreshPortfolioTrigger: state.refreshPortfolioTrigger + 1 })),
}));
