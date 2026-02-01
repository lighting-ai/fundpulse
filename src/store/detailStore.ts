import { create } from 'zustand';
import { db, FundDetail, NavHistory } from '../db/schema';
import { fetchFundDetail, fetchFundHistory } from '../api/eastmoney';

interface DetailStore {
  fundDetail: FundDetail | null;
  navHistory: NavHistory[];
  isLoading: boolean;
  error: string | null;
  timeRange: '30d' | '3m' | '6m' | '1y' | 'all';

  loadFundDetail: (code: string) => Promise<void>;
  loadNavHistory: (code: string, range?: DetailStore['timeRange']) => Promise<void>;
  setTimeRange: (range: DetailStore['timeRange']) => void;
}

export const useDetailStore = create<DetailStore>((set, get) => ({
  fundDetail: null,
  navHistory: [],
  isLoading: false,
  error: null,
  timeRange: '30d',

  // 加载基金详情
  loadFundDetail: async (code: string) => {
    set({ isLoading: true, error: null });
    try {
      // 先尝试从缓存读取
      const cached = await db.fundDetails.get(code);
      if (cached) {
        const now = Date.now();
        // 如果缓存未过期（24小时内），直接使用
        if (now - cached.updatedAt.getTime() < 24 * 60 * 60 * 1000) {
          set({ fundDetail: cached });
        }
      }

      // 后台更新
      try {
        const detail = await fetchFundDetail(code);
        const fundDetail: FundDetail = {
          fundCode: code,
          fundName: detail.fundName,
          manager: detail.manager,
          company: detail.company,
          inceptionDate: detail.inceptionDate,
          topHoldings: detail.topHoldings,
          updatedAt: new Date(),
        };

        await db.fundDetails.put(fundDetail);
        set({ fundDetail });
      } catch (error) {
        console.warn('获取基金详情失败，使用缓存:', error);
        if (cached) {
          set({ fundDetail: cached });
        }
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载失败' });
    } finally {
      set({ isLoading: false });
    }
  },

  // 加载净值历史
  loadNavHistory: async (code: string, range: DetailStore['timeRange'] = '30d') => {
    set({ isLoading: true, error: null });
    try {
      // 先尝试从缓存读取
      let cached = await db.navHistory
        .where('fundCode')
        .equals(code)
        .reverse()
        .toArray();

      // 根据时间范围过滤
      const now = new Date();
      const rangeMap = {
        '30d': 30,
        '3m': 90,
        '6m': 180,
        '1y': 365,
        'all': Infinity,
      };
      const days = rangeMap[range];
      const cutoffDate = days === Infinity 
        ? new Date(0) 
        : new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      cached = cached.filter(item => new Date(item.date) >= cutoffDate);

      if (cached.length > 0) {
        set({ navHistory: cached });
      }

      // 后台更新
      try {
        const history = await fetchFundHistory(code);
        const historyData: NavHistory[] = history.map(item => ({
          fundCode: code,
          date: item.date,
          nav: item.nav,
          accNav: item.accNav,
          dailyGrowth: item.dailyGrowth,
        }));

        // 增量更新（只添加不存在的记录）
        await db.navHistory.bulkPut(historyData);

        // 重新读取
        const updated = await db.navHistory
          .where('fundCode')
          .equals(code)
          .reverse()
          .toArray();
        
        const filtered = updated.filter(item => new Date(item.date) >= cutoffDate);
        set({ navHistory: filtered });
      } catch (error) {
        console.warn('获取历史净值失败，使用缓存:', error);
        if (cached.length > 0) {
          set({ navHistory: cached });
        }
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载失败' });
    } finally {
      set({ isLoading: false });
    }
  },

  // 设置时间范围
  setTimeRange: (range: DetailStore['timeRange']) => {
    set({ timeRange: range });
    const { fundDetail } = get();
    if (fundDetail) {
      get().loadNavHistory(fundDetail.fundCode, range);
    }
  },
}));
