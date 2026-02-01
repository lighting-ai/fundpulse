import { create } from 'zustand';
import { db, UserWatchlist, NavHistory, FundDetail } from '../db/schema';
import { fetchFundRealtime, fetchFundHistory, fetchFundDetail, validateFundCode } from '../api/eastmoney';

export interface FundRealtimeInfo extends UserWatchlist {
  nav?: number;
  estimateNav?: number;
  estimateGrowth?: number;
  valuationTime?: string;
  isLoading?: boolean;
  error?: string;
}

interface FundStore {
  // 自选基金列表
  watchlist: FundRealtimeInfo[];
  // 当前选中的基金代码
  selectedFundCode: string | null;
  // 加载状态
  isLoading: boolean;
  // 错误信息
  error: string | null;

  // Actions
  loadWatchlist: () => Promise<void>;
  addFund: (code: string) => Promise<{ success: boolean; message: string }>;
  removeFund: (code: string) => Promise<void>;
  updateRealtimeData: () => Promise<void>;
  selectFund: (code: string | null) => void;
  refreshFund: (code: string) => Promise<void>;
}

export const useFundStore = create<FundStore>((set, get) => ({
  watchlist: [],
  selectedFundCode: null,
  isLoading: false,
  error: null,

  // 加载自选列表
  loadWatchlist: async () => {
    set({ isLoading: true, error: null });
    try {
      const list = await db.watchlist.orderBy('sortOrder').toArray();
      const funds: FundRealtimeInfo[] = list.map(fund => ({
        ...fund,
        isLoading: false,
      }));
      set({ watchlist: funds });
      
      // 立即更新实时数据
      await get().updateRealtimeData();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载失败' });
    } finally {
      set({ isLoading: false });
    }
  },

  // 添加基金
  addFund: async (code: string) => {
    // 验证代码格式
    if (!/^\d{6}$/.test(code)) {
      return { success: false, message: '基金代码格式错误（应为6位数字）' };
    }

    // 检查是否已存在
    const existing = await db.watchlist.where('fundCode').equals(code).first();
    if (existing) {
      return { success: false, message: '该基金已在自选列表中' };
    }

    // 验证基金代码有效性
    const validation = await validateFundCode(code);
    if (!validation.valid) {
      return { success: false, message: '基金代码不存在或无法访问' };
    }

    try {
      // 获取最大排序号
      const maxOrder = await db.watchlist.orderBy('sortOrder').last();
      const sortOrder = (maxOrder?.sortOrder || 0) + 1;

      // 添加到数据库
      await db.watchlist.add({
        fundCode: code,
        fundName: validation.name || code,
        addedAt: new Date(),
        sortOrder,
      });

      // 立即拉取历史数据
      try {
        const history = await fetchFundHistory(code);
        const historyData: NavHistory[] = history.map(item => ({
          fundCode: code,
          date: item.date,
          nav: item.nav,
          accNav: item.accNav,
          dailyGrowth: item.dailyGrowth,
        }));
        await db.navHistory.bulkPut(historyData);
      } catch (e) {
        console.warn('拉取历史数据失败，稍后重试:', e);
      }

      // 重新加载列表
      await get().loadWatchlist();
      return { success: true, message: '添加成功' };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : '添加失败' };
    }
  },

  // 删除基金
  removeFund: async (code: string) => {
    try {
      await db.watchlist.where('fundCode').equals(code).delete();
      // 可选：同时删除历史数据（或保留用于离线查看）
      // await db.navHistory.where('fundCode').equals(code).delete();
      
      // 如果删除的是当前选中的基金，清空选中状态
      if (get().selectedFundCode === code) {
        set({ selectedFundCode: null });
      }

      await get().loadWatchlist();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '删除失败' });
    }
  },

  // 更新实时数据
  updateRealtimeData: async () => {
    const { watchlist } = get();
    if (watchlist.length === 0) return;

    // 标记为加载中
    set({
      watchlist: watchlist.map(fund => ({ ...fund, isLoading: true })),
    });

    // 并发获取所有基金的实时数据
    const updates = await Promise.allSettled(
      watchlist.map(async (fund) => {
        try {
          const data = await fetchFundRealtime(fund.fundCode);
          return {
            ...fund,
            nav: data.nav,
            estimateNav: data.estimateNav,
            estimateGrowth: data.estimateGrowth,
            valuationTime: data.valuationTime,
            fundName: data.name || fund.fundName,
            isLoading: false,
            error: undefined,
          };
        } catch (error) {
          return {
            ...fund,
            isLoading: false,
            error: error instanceof Error ? error.message : '获取失败',
          };
        }
      })
    );

    const updatedList = updates.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return { ...watchlist[updates.indexOf(result)], isLoading: false, error: '请求失败' };
    });

    set({ watchlist: updatedList });
  },

  // 选择基金
  selectFund: (code: string | null) => {
    set({ selectedFundCode: code });
  },

  // 刷新单个基金数据
  refreshFund: async (code: string) => {
    try {
      // 更新实时数据
      const data = await fetchFundRealtime(code);
      const { watchlist } = get();
      const updated = watchlist.map(fund =>
        fund.fundCode === code
          ? {
              ...fund,
              nav: data.nav,
              estimateNav: data.estimateNav,
              estimateGrowth: data.estimateGrowth,
              valuationTime: data.valuationTime,
              fundName: data.name || fund.fundName,
            }
          : fund
      );
      set({ watchlist: updated });

      // 更新历史数据
      const history = await fetchFundHistory(code);
      const historyData: NavHistory[] = history.map(item => ({
        fundCode: code,
        date: item.date,
        nav: item.nav,
        accNav: item.accNav,
        dailyGrowth: item.dailyGrowth,
      }));
      await db.navHistory.bulkPut(historyData);
    } catch (error) {
      console.error('刷新基金数据失败:', error);
    }
  },
}));
