import { create } from 'zustand';
import { db, UserWatchlist, NavHistory } from '../db/schema';
import { fetchFundRealtime, fetchFundHistory, validateFundCode, searchFunds } from '../api/eastmoney';

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
      console.log('从数据库加载的基金列表:', list.map(f => ({ 
        code: f.fundCode, 
        category: f.category, 
        ftype: f.ftype,
        fundType: f.fundType 
      })));
      
      const funds: FundRealtimeInfo[] = list.map(fund => ({
        ...fund,
        isLoading: false,
        // 确保用户持仓数据被正确加载
        userShares: fund.userShares || 0,
        userCost: fund.userCost || 0,
        userAmount: fund.userAmount || 0,
        // 确保分类字段存在（兼容旧数据）
        category: fund.category || '',
        ftype: fund.ftype || '',
        fundType: fund.fundType || '',
      }));
      
      console.log('处理后的基金列表:', funds.map(f => ({ 
        code: f.fundCode, 
        category: f.category, 
        ftype: f.ftype,
        fundType: f.fundType 
      })));
      
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

    // 验证基金代码有效性并获取基金类型
    const validation = await validateFundCode(code);
    if (!validation.valid) {
      return { success: false, message: '基金代码不存在或无法访问' };
    }

    // 获取基金类型信息
    let ftype = '';
    let fundType = '';
    try {
      const searchResults = await searchFunds(code);
      const matchedFund = searchResults.find(r => r.code === code);
      if (matchedFund) {
        ftype = matchedFund.fundType || '';
        fundType = matchedFund.fundTypeCode || '';
      }
    } catch (e) {
      console.warn('获取基金类型失败，将使用空值:', e);
    }

    try {
      // 获取最大排序号
      const maxOrder = await db.watchlist.orderBy('sortOrder').last();
      const sortOrder = (maxOrder?.sortOrder || 0) + 1;

      // 计算持仓份额和成本价
      let userShares = 0;
      let userCostPrice = cost || 0;
      
      if (amount && amount > 0) {
        // 如果提供了成本价，直接使用
        if (cost && cost > 0) {
          userCostPrice = cost;
          userShares = amount / cost;
        } else {
          // 如果没有提供成本价，获取当前净值作为成本价
          try {
            const realtimeData = await fetchFundRealtime(code);
            const currentNav = realtimeData.nav || realtimeData.estimateNav || 0;
            if (currentNav > 0) {
              userCostPrice = currentNav;
              userShares = amount / currentNav;
            } else {
              console.warn('无法获取当前净值，持仓份额将设为0');
            }
          } catch (e) {
            console.warn('获取实时净值失败，稍后设置持仓:', e);
          }
        }
      }

      // 从 ftype 提取分类（不带中划线）
      const category = ftype ? ftype.split('-')[0] : '';

      // 添加到数据库
      await db.watchlist.add({
        fundCode: code,
        fundName: validation.name || code,
        addedAt: new Date(),
        sortOrder,
        category: category || '',
        ftype: ftype || '', // 原始值（可能带中划线）
        fundType: fundType || '',
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

  // 批量刷新基金类型
  refreshFundTypes: async () => {
    const { watchlist } = get();
    // 找出所有没有分类的基金（category 为空或 undefined）
    const fundsWithoutType = watchlist.filter(f => !f.category || f.category === '');
    
    if (fundsWithoutType.length === 0) {
      return { success: 0, failed: 0 };
    }

    console.log(`开始刷新 ${fundsWithoutType.length} 个基金的类型...`);

    let success = 0;
    let failed = 0;

    // 串行处理每个基金，避免搜索接口的防抖机制影响
    for (const fund of fundsWithoutType) {
      try {
        console.log(`正在刷新基金 ${fund.fundCode} 的类型...`);
        
        // 每个请求之间延迟，确保防抖机制不会影响
        await new Promise(resolve => setTimeout(resolve, 600)); // 延迟600ms，超过MIN_SEARCH_INTERVAL_MS
        
        const searchResults = await searchFunds(fund.fundCode);
        console.log(`基金 ${fund.fundCode} 搜索结果:`, searchResults.length, '条', searchResults.map(r => ({ code: r.code, name: r.name, fundType: r.fundType, fundTypeCode: r.fundTypeCode })));
        
        const matchedFund = searchResults.find(r => r.code === fund.fundCode);
        if (!matchedFund) {
          console.warn(`基金 ${fund.fundCode} 未在搜索结果中找到匹配项`);
          failed++;
          continue;
        }
        
        console.log(`基金 ${fund.fundCode} 匹配结果:`, {
          code: matchedFund.code,
          fundType: matchedFund.fundType,
          fundTypeCode: matchedFund.fundTypeCode
        });
        
        if (matchedFund.fundType || matchedFund.fundTypeCode) {
          // 从 ftype 提取分类（不带中划线）
          const ftypeValue = matchedFund.fundType || '';
          const category = ftypeValue ? ftypeValue.split('-')[0] : '';
          
          console.log(`基金 ${fund.fundCode} 准备更新: category=${category}, ftype=${ftypeValue}, fundType=${matchedFund.fundTypeCode}`);
          
          // 更新数据库（使用 put 而不是 modify，确保所有字段都更新）
          const existingFund = await db.watchlist.where('fundCode').equals(fund.fundCode).first();
          if (existingFund) {
            await db.watchlist.update(existingFund.id!, {
              category: category || '',
              ftype: ftypeValue || '', // 原始值（可能带中划线）
              fundType: matchedFund.fundTypeCode || '',
            });
            
            // 验证更新是否成功
            const updated = await db.watchlist.where('fundCode').equals(fund.fundCode).first();
            console.log(`基金 ${fund.fundCode} 类型更新成功: category=${updated?.category}, ftype=${updated?.ftype}, fundType=${updated?.fundType}`);
            
            if (!updated || updated.category !== category) {
              console.error(`基金 ${fund.fundCode} 更新验证失败！数据库中的值:`, updated);
            }
          } else {
            console.error(`基金 ${fund.fundCode} 在数据库中未找到，无法更新`);
          }
          
          success++;
        } else {
          console.warn(`基金 ${fund.fundCode} 匹配结果中没有类型信息`);
          failed++;
        }
      } catch (error) {
        console.error(`刷新基金 ${fund.fundCode} 类型失败:`, error);
        failed++;
      }
    }


    // 重新加载列表（无论成功与否都刷新，确保UI更新）
    console.log(`准备重新加载列表，成功 ${success} 个，失败 ${failed} 个`);
    
    // 强制重新加载列表
    const currentWatchlist = get().watchlist;
    console.log('刷新前的 watchlist:', currentWatchlist.map(f => ({ 
      code: f.fundCode, 
      category: f.category 
    })));
    
    await get().loadWatchlist();
    
    // 等待一下，确保状态更新完成
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 验证加载后的数据
    const { watchlist: updatedList } = get();
    console.log(`列表已重新加载，共 ${updatedList.length} 个基金`);
    console.log('刷新后的 watchlist:', updatedList.map(f => ({ 
      code: f.fundCode, 
      category: f.category,
      ftype: f.ftype 
    })));
    
    fundsWithoutType.forEach(fund => {
      const updated = updatedList.find(f => f.fundCode === fund.fundCode);
      if (updated) {
        console.log(`基金 ${fund.fundCode} 刷新后的状态: category=${updated.category}, ftype=${updated.ftype}, fundType=${updated.fundType}`);
        if (!updated.category || updated.category === '') {
          console.warn(`⚠️ 基金 ${fund.fundCode} 刷新后 category 仍为空！`);
        }
      } else {
        console.warn(`基金 ${fund.fundCode} 在刷新后的列表中未找到`);
      }
    });

    console.log(`刷新完成: 成功 ${success} 个，失败 ${failed} 个`);
    return { success, failed };
  },
}));
