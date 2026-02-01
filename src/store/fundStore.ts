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
  userShares?: number; // 用户持仓份额（份）
  userCost?: number; // 用户持仓成本（买入时的净值）
  userAmount?: number; // 用户持仓金额（元）
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
  addFund: (code: string, amount?: number, cost?: number) => Promise<{ success: boolean; message: string }>;
  removeFund: (code: string) => Promise<void>;
  updateRealtimeData: () => Promise<void>;
  selectFund: (code: string | null) => void;
  refreshFund: (code: string) => Promise<void>;
  updateUserHolding: (code: string, amount: number, cost?: number) => Promise<void>;
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
        // 确保用户持仓数据被正确加载
        userShares: fund.userShares || 0,
        userCost: fund.userCost || 0,
        userAmount: fund.userAmount || 0,
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
  addFund: async (code: string, amount?: number, cost?: number) => {
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

      // 获取当前净值（用于计算持仓份额）
      let currentNav = 0;
      let userShares = 0;
      let userCostPrice = cost;
      
      if (amount && amount > 0) {
        try {
          const realtimeData = await fetchFundRealtime(code);
          currentNav = realtimeData.nav || 0;
          userCostPrice = cost || currentNav;
          userShares = userCostPrice > 0 ? amount / userCostPrice : 0;
        } catch (e) {
          console.warn('获取实时净值失败，稍后设置持仓:', e);
        }
      }

      // 添加到数据库
      await db.watchlist.add({
        fundCode: code,
        fundName: validation.name || code,
        addedAt: new Date(),
        sortOrder,
        userAmount: amount || 0,
        userShares: userShares,
        userCost: userCostPrice || 0,
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
      return { success: true, message: amount ? '添加成功，已设置持仓金额' : '添加成功' };
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
            // 保留用户持仓数据
            userShares: fund.userShares,
            userCost: fund.userCost,
            userAmount: fund.userAmount,
          };
        } catch (error) {
          return {
            ...fund,
            isLoading: false,
            error: error instanceof Error ? error.message : '获取失败',
            // 保留用户持仓数据
            userShares: fund.userShares,
            userCost: fund.userCost,
            userAmount: fund.userAmount,
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

  // 更新用户持仓
  updateUserHolding: async (code: string, amount: number, cost?: number) => {
    try {
      const { watchlist } = get();
      const fund = watchlist.find(f => f.fundCode === code);
      if (!fund) return;

      // 如果提供了持仓金额，计算持仓份额
      // 如果没有提供成本价，使用当前净值作为成本价
      const currentNav = fund.nav || fund.estimateNav || 0;
      const costPrice = cost || currentNav;
      const shares = amount > 0 && costPrice > 0 ? amount / costPrice : 0;

      // 更新数据库
      await db.watchlist.where('fundCode').equals(code).modify({
        userAmount: amount,
        userShares: shares,
        userCost: costPrice,
      });

      // 更新 store
      const updated = watchlist.map(f =>
        f.fundCode === code
          ? {
              ...f,
              userAmount: amount,
              userShares: shares,
              userCost: costPrice,
            }
          : f
      );
      set({ watchlist: updated });
    } catch (error) {
      console.error('更新持仓失败:', error);
    }
  },
}));
