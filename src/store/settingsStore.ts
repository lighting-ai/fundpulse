import { create } from 'zustand';

export type RefreshInterval = '30s' | '1m' | '5m';

interface SettingsStore {
  refreshInterval: RefreshInterval;
  setRefreshInterval: (interval: RefreshInterval) => void;
  getRefreshIntervalMs: () => number;
}

// 从 localStorage 读取设置
const getStoredInterval = (): RefreshInterval => {
  try {
    const stored = localStorage.getItem('fundpulse-refresh-interval');
    if (stored && ['30s', '1m', '5m'].includes(stored)) {
      return stored as RefreshInterval;
    }
  } catch (e) {
    // ignore
  }
  return '30s';
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  refreshInterval: getStoredInterval(),
  setRefreshInterval: (interval: RefreshInterval) => {
    set({ refreshInterval: interval });
    try {
      localStorage.setItem('fundpulse-refresh-interval', interval);
    } catch (e) {
      // ignore
    }
  },
  getRefreshIntervalMs: () => {
    const interval = get().refreshInterval;
    switch (interval) {
      case '30s':
        return 30 * 1000;
      case '1m':
        return 60 * 1000;
      case '5m':
        return 5 * 60 * 1000;
      default:
        return 30 * 1000;
    }
  },
}));
