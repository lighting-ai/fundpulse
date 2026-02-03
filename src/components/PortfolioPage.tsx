import React, { useState, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { useFundStore } from '../store/fundStore';
import { useAppStore } from '../store/appStore';
import { FundModal } from './FundModal';
import { validateFundCode, fetchFundRealtime, searchFunds, FundSearchResult } from '../api/eastmoney';
import { mergeFundData, calculateTodayProfit, calculateTotalProfit } from '../utils/fundDataManager';
import { FlipNumber } from './FlipNumber';

export function PortfolioPage() {
  const { watchlist, selectedFundCode, selectFund, removeFund, updateUserHolding, addFund, refreshFundTypes } = useFundStore();
  const { refreshPortfolioTrigger } = useAppStore();
  const [showFundModal, setShowFundModal] = useState(false);
  const [displayMode, setDisplayMode] = useState<'list' | 'category'>('list'); // 展示模式：列表或分类
  const [isRefreshingTypes, setIsRefreshingTypes] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('全部'); // 选中的分类
  
  // 添加基金相关状态
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFundPreview, setShowFundPreview] = useState(false); // 基金信息预览弹窗
  const [showHoldingModal, setShowHoldingModal] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [searchResults, setSearchResults] = useState<FundSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [addMessage, setAddMessage] = useState('');
  const [pendingFundCode, setPendingFundCode] = useState<string>('');
  const [pendingFundInfo, setPendingFundInfo] = useState<{ code: string; name: string; nav: number; estimateNav?: number } | null>(null);
  const [holdingAmount, setHoldingAmount] = useState<string>('');
  const [holdingCost, setHoldingCost] = useState<string>('');
  const [holdingShares, setHoldingShares] = useState<string>('');
  const [inputMode, setInputMode] = useState<'amount' | 'shares'>('amount'); // 输入模式：金额模式 或 份额模式
  const [editingHoldingFundCode, setEditingHoldingFundCode] = useState<string | null>(null); // 正在编辑持仓的基金代码
  const [isEditingHolding, setIsEditingHolding] = useState(false); // 是否为编辑模式（false=添加，true=修改）

  // 存储每个基金的最新净值数据（使用 FundDataManager）
  // mergeFundData 可能返回 null（获取失败），所以类型是 FundDisplayData | null
  const [fundDisplayData, setFundDisplayData] = useState<Map<string, NonNullable<Awaited<ReturnType<typeof mergeFundData>>>>>(new Map());

  // 加载所有基金的最新净值数据（使用 FundDataManager，考虑盘中/盘后逻辑）
  const loadFundDisplayData = async () => {
    if (watchlist.length === 0) {
      // 不清空现有数据，保持显示
      return;
    }
    
    // 获取当前状态（使用函数式更新确保获取最新值）
    setFundDisplayData(prevMap => {
      // 创建新 map，保留所有旧数据
      const newMap = new Map(prevMap);
      
      // 并行加载所有基金数据
      (async () => {
        const updates = await Promise.allSettled(
          watchlist.map(async (fund) => {
            try {
              const displayData = await mergeFundData(
                fund.fundCode,
                undefined,
                fund.fundType,
                fund.ftype,
                fund.fundName
              );
              // 只有成功获取到数据时才返回，null 表示获取失败，保留旧数据
              if (displayData) {
                return { code: fund.fundCode, data: displayData };
              }
              return null;
            } catch (error) {
              console.warn(`获取基金 ${fund.fundCode} 显示数据失败:`, error);
              // 如果加载失败，返回 null，保留旧数据
              return null;
            }
          })
        );
        
        // 处理加载结果：只有成功获取到数据时才更新
        updates.forEach(result => {
          if (result.status === 'fulfilled' && result.value && result.value.data) {
            // 只有数据不为 null 时才更新
            newMap.set(result.value.code, result.value.data);
          }
          // 如果失败或返回 null，newMap 中已经保留了旧数据，不需要处理
        });
        
        // 所有数据加载完成后，一次性更新状态（保留未更新的旧数据）
        setFundDisplayData(new Map(newMap));
      })();
      
      // 先返回旧数据，避免清空
      return prevMap;
    });
  };

  // 初始加载和 watchlist 变化时重新加载
  useEffect(() => {
    loadFundDisplayData();
  }, [watchlist]);

  // 监听刷新触发器，当 Header 触发刷新时重新加载显示数据
  useEffect(() => {
    if (refreshPortfolioTrigger > 0) {
      // 延迟一下，等待 updateRealtimeData 完成
      setTimeout(() => {
        loadFundDisplayData();
      }, 500);
    }
  }, [refreshPortfolioTrigger]);

  // 注意：自动刷新已由 Header 的倒计时统一控制，页面加载时不再自动刷新
  // 首次数据加载由 watchlist 变化时的 useEffect 触发

  // 计算总资产（估算）：使用 FundDataManager 的净值数据
  // 如果 displayData 未加载，使用 fund 中的后备数据，避免清零
  const totalAssets = watchlist.reduce((sum, fund) => {
    const userShares = fund.userShares || 0;
    const displayData = fundDisplayData.get(fund.fundCode);
    // 优先使用 displayData，如果没有则使用 fund 中的后备数据
    const currentNav = displayData?.netValue || fund.estimateNav || fund.nav || 0;
    return sum + currentNav * userShares;
  }, 0);

  // 计算总成本
  const totalCost = watchlist.reduce((sum, fund) => {
    const userShares = fund.userShares || 0;
    const userCost = fund.userCost || 0;
    return sum + userCost * userShares;
  }, 0);

  // 计算今日盈亏：使用 FundDataManager 的计算函数
  // 如果 displayData 未加载，使用 fund 中的后备数据计算，避免清零
  const todayChange = watchlist.reduce((sum, fund) => {
    const userShares = fund.userShares || 0;
    const displayData = fundDisplayData.get(fund.fundCode);
    
    if (displayData) {
      // 使用 FundDataManager 的数据
      return sum + calculateTodayProfit(displayData.netValue, displayData.previousNav, userShares);
    } else if (fund.estimateNav && fund.nav && userShares) {
      // 使用 fund 中的后备数据
      return sum + calculateTodayProfit(fund.estimateNav, fund.nav, userShares);
    }
    
    return sum;
  }, 0);

  // 计算今日盈亏百分比：加权平均
  // 如果 displayData 未加载，使用 fund 中的后备数据计算，避免清零
  const todayChangePercent = watchlist.reduce((sum, fund) => {
    const userShares = fund.userShares || 0;
    const displayData = fundDisplayData.get(fund.fundCode);
    
    if (!userShares) return sum;
    
    let fundPercent = 0;
    let fundValue = 0;
    
    if (displayData) {
      // 使用 FundDataManager 的数据
      fundPercent = displayData.changePercent;
      fundValue = displayData.netValue * userShares;
    } else if (fund.estimateNav && fund.nav) {
      // 使用 fund 中的后备数据
      fundPercent = ((fund.estimateNav - fund.nav) / fund.nav) * 100;
      fundValue = (fund.estimateNav || fund.nav) * userShares;
    } else {
      return sum;
    }
    
    return sum + (fundPercent * fundValue);
  }, 0) / (totalAssets > 0 ? totalAssets : 1);

  // 计算累计收益总和：使用 FundDataManager 的计算函数
  // 如果 displayData 未加载，使用 fund 中的后备数据计算，避免清零
  const totalProfit = watchlist.reduce((sum, fund) => {
    const userShares = fund.userShares || 0;
    const userCost = fund.userCost || 0;
    const displayData = fundDisplayData.get(fund.fundCode);
    
    if (!userShares || !userCost) return sum;
    
    if (displayData) {
      // 使用 FundDataManager 的数据
      return sum + calculateTotalProfit(displayData.netValue, userCost, userShares);
    } else {
      // 使用 fund 中的后备数据
      const currentNav = fund.estimateNav || fund.nav || 0;
      if (currentNav > 0) {
        return sum + calculateTotalProfit(currentNav, userCost, userShares);
      }
    }
    
    return sum;
  }, 0);

  // 计算累计收益百分比：相对于总成本
  const totalProfitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  // 注意：自动刷新已由 Header 的倒计时统一控制，这里不再需要自动刷新逻辑

  const handleFundClick = (code: string) => {
    selectFund(code);
    setShowFundModal(true);
  };

  // 处理搜索基金
  const handleSearch = async () => {
    const keyword = inputCode.trim();
    if (!keyword) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setAddMessage('');
    
    try {
      const results = await searchFunds(keyword);
      setSearchResults(results);
      if (results.length === 0) {
        setAddMessage('未找到匹配的基金');
      }
    } catch (error) {
      setAddMessage(error instanceof Error ? error.message : '搜索失败，请重试');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 处理选择搜索结果
  const handleSelectSearchResult = async (result: FundSearchResult) => {
    const codeToAdd = result.code;
    setIsValidating(true);
    setAddMessage('');
    setSearchResults([]);
    setInputCode(codeToAdd);
    
    try {
      // 获取基金实时数据（包含净值信息）
      try {
        const realtimeData = await fetchFundRealtime(codeToAdd);
        setPendingFundCode(codeToAdd);
        setPendingFundInfo({
          code: codeToAdd,
          name: result.name,
          nav: realtimeData.nav || 0,
          estimateNav: realtimeData.estimateNav,
        });
        setShowFundPreview(true);
        setShowAddModal(false);
      } catch {
        // 如果获取实时数据失败，仍然显示预览（只有名称）
        setPendingFundCode(codeToAdd);
        setPendingFundInfo({
          code: codeToAdd,
          name: result.name,
          nav: result.nav || 0,
        });
        setShowFundPreview(true);
        setShowAddModal(false);
      }
    } catch (error) {
      setAddMessage(error instanceof Error ? error.message : '验证失败，请重试');
    } finally {
      setIsValidating(false);
    }
  };

  // 处理添加基金 - 先验证并显示基金信息预览（保留旧逻辑作为备用）
  const handleAdd = async (code?: string) => {
    const codeToAdd = code || inputCode;
    if (!codeToAdd.trim()) {
      setAddMessage('请输入基金代码或名称');
      return;
    }

    // 如果是6位数字，直接使用旧逻辑
    if (/^\d{6}$/.test(codeToAdd)) {
      setIsValidating(true);
      setAddMessage('');
      
      try {
        // 验证基金代码并获取基本信息
        const validation = await validateFundCode(codeToAdd);
        if (!validation.valid) {
          setAddMessage('基金代码不存在或无法访问');
          setIsValidating(false);
          return;
        }

        // 获取基金实时数据（包含净值信息）
        try {
          const realtimeData = await fetchFundRealtime(codeToAdd);
          setPendingFundCode(codeToAdd);
          setPendingFundInfo({
            code: codeToAdd,
            name: validation.name || codeToAdd,
            nav: realtimeData.nav || 0,
            estimateNav: realtimeData.estimateNav,
          });
          setShowFundPreview(true);
          setShowAddModal(false);
        } catch {
          // 如果获取实时数据失败，仍然显示预览（只有名称）
          setPendingFundCode(codeToAdd);
          setPendingFundInfo({
            code: codeToAdd,
            name: validation.name || codeToAdd,
            nav: 0,
          });
          setShowFundPreview(true);
          setShowAddModal(false);
        }
      } catch (error) {
        setAddMessage(error instanceof Error ? error.message : '验证失败，请重试');
      } finally {
        setIsValidating(false);
      }
    } else {
      // 否则触发搜索
      await handleSearch();
    }
  };

  // 直接添加基金（不设置持仓）
  const handleAddWithoutHolding = async () => {
    if (!pendingFundCode) return;

    setIsAdding(true);
    setAddMessage('');
    
    try {
      const result = await addFund(pendingFundCode);
      
      if (result.success) {
        setInputCode('');
        setAddMessage('');
        setShowFundPreview(false);
        setPendingFundCode('');
        setPendingFundInfo(null);
      } else {
        setAddMessage(result.message);
      }
    } catch (error) {
      setAddMessage(error instanceof Error ? error.message : '添加失败，请重试');
    } finally {
      setIsAdding(false);
    }
  };

  // 打开持仓设置弹窗
  const handleOpenHoldingModal = () => {
    if (pendingFundInfo) {
      // 如果已有净值信息，预填成本价
      if (pendingFundInfo.nav > 0) {
        setHoldingCost(pendingFundInfo.nav.toFixed(4));
      } else if (pendingFundInfo.estimateNav && pendingFundInfo.estimateNav > 0) {
        setHoldingCost(pendingFundInfo.estimateNav.toFixed(4));
      }
    }
    setShowFundPreview(false);
    setShowHoldingModal(true);
  };

  // 打开修改持仓弹窗
  const handleOpenEditHolding = (fundCode: string) => {
    const fund = watchlist.find(f => f.fundCode === fundCode);
    if (!fund) return;

    setEditingHoldingFundCode(fundCode);
    setIsEditingHolding(true);
    
    // 预填当前持仓数据
    if (fund.userAmount && fund.userAmount > 0) {
      // 如果有持仓金额，使用金额模式
      setInputMode('amount');
      setHoldingAmount(fund.userAmount.toFixed(2));
      setHoldingCost(fund.userCost ? fund.userCost.toFixed(4) : '');
      setHoldingShares('');
    } else if (fund.userShares && fund.userShares > 0) {
      // 如果有持仓份额，使用份额模式
      setInputMode('shares');
      setHoldingShares(fund.userShares.toFixed(2));
      setHoldingCost(fund.userCost ? fund.userCost.toFixed(4) : '');
      setHoldingAmount('');
    } else {
      // 默认使用金额模式
      setInputMode('amount');
      setHoldingAmount('');
      setHoldingCost('');
      setHoldingShares('');
    }
    
    setAddMessage('');
    setShowHoldingModal(true);
  };

  // 关闭持仓弹窗
  const handleCloseHoldingModal = () => {
    setShowHoldingModal(false);
    setHoldingAmount('');
    setHoldingCost('');
    setHoldingShares('');
    setInputMode('amount');
    setEditingHoldingFundCode(null);
    setIsEditingHolding(false);
    setAddMessage('');
    // 如果是添加模式，返回到预览弹窗
    if (!isEditingHolding && pendingFundInfo) {
      setShowFundPreview(true);
    }
  };

  const handleConfirmHolding = async () => {
    const fundCode = isEditingHolding ? editingHoldingFundCode : pendingFundCode;
    if (!fundCode) return;

    setIsAdding(true);
    setAddMessage('');

    let amount = 0;
    let cost: number | undefined = undefined;

    if (inputMode === 'amount') {
      // 金额模式：输入金额和成本价，计算份额
      amount = parseFloat(holdingAmount) || 0;
      cost = parseFloat(holdingCost) || undefined;
    } else {
      // 份额模式：输入成本价和数量，计算金额
      const shares = parseFloat(holdingShares) || 0;
      if (shares <= 0) {
        setAddMessage('请输入持仓数量');
        setIsAdding(false);
        return;
      }

      cost = parseFloat(holdingCost) || undefined;
      
      if (cost && cost > 0) {
        // 如果输入了成本价，直接计算金额
        amount = shares * cost;
      } else {
        // 如果没有输入成本价，获取当前净值作为成本价
        const realtimeData = await fetchFundRealtime(fundCode).catch(() => null);
        if (realtimeData) {
          const currentNav = realtimeData.nav || realtimeData.estimateNav || 0;
          if (currentNav > 0) {
            cost = currentNav;
            amount = shares * cost;
          } else {
            setAddMessage('无法获取当前净值，请手动输入成本价');
            setIsAdding(false);
            return;
          }
        } else {
          setAddMessage('获取当前净值失败，请手动输入成本价');
          setIsAdding(false);
          return;
        }
      }
    }

    if (isEditingHolding) {
      // 修改模式：更新持仓
      try {
        await updateUserHolding(fundCode, amount, cost);
        setAddMessage('修改成功');
        setTimeout(() => {
          handleCloseHoldingModal();
        }, 1000);
      } catch (error) {
        setAddMessage(error instanceof Error ? error.message : '修改失败，请重试');
      } finally {
        setIsAdding(false);
      }
    } else {
      // 添加模式：添加基金
      const result = await addFund(fundCode, amount, cost);
      
      if (result.success) {
        setHoldingAmount('');
        setHoldingCost('');
        setHoldingShares('');
        setPendingFundCode('');
        setPendingFundInfo(null);
        setShowHoldingModal(false);
        setShowFundPreview(false);
        setShowAddModal(false);
        setInputCode('');
        setAddMessage('');
        setInputMode('amount');
      } else {
        setAddMessage(result.message);
      }
      
      setIsAdding(false);
    }
  };


  const handleAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  // 获取基金分类（使用 category 字段，如果没有则显示 --）
  const getFundCategory = (category?: string): string => {
    return category || '--';
  };

  // 按分类分组基金
  const groupedFunds = useMemo(() => {
    const groups: Record<string, typeof watchlist> = {};
    watchlist.forEach(fund => {
      const category = getFundCategory(fund.category);
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(fund);
    });
    return groups;
  }, [watchlist]);

  // 获取所有分类列表（用于标签页）
  const categories = useMemo(() => {
    const cats = ['全部', ...Object.keys(groupedFunds).sort()];
    return cats;
  }, [groupedFunds]);

  // 根据选中的分类过滤基金列表
  const filteredWatchlist = useMemo(() => {
    if (displayMode === 'list') {
      return watchlist;
    }
    if (selectedCategory === '全部') {
      return watchlist;
    }
    return groupedFunds[selectedCategory] || [];
  }, [watchlist, displayMode, selectedCategory, groupedFunds]);

  // 检查是否有未分类的基金（category 为空）
  const hasUncategorizedFunds = watchlist.some(f => !f.category || f.category === '');

  // 切换展示模式
  const handleToggleDisplayMode = () => {
    if (displayMode === 'list') {
      // 从列表切换到分类展示
      if (hasUncategorizedFunds) {
        const confirmed = confirm('存在未分类的基金（显示为--），是否先刷新基金类型？\n\n点击"确定"将刷新基金类型，点击"取消"将直接切换（未分类基金将显示在"--"分类中）');
        if (confirmed) {
          handleRefreshFundTypes();
          return;
        }
      }
      setDisplayMode('category');
      setSelectedCategory('全部'); // 切换到分类模式时，默认选择"全部"
    } else {
      // 从分类切换到列表
      setDisplayMode('list');
      setSelectedCategory('全部'); // 重置分类选择
    }
  };

  // 批量刷新基金类型
  const handleRefreshFundTypes = async () => {
    setIsRefreshingTypes(true);
    try {
      const result = await refreshFundTypes();
      
      // 等待状态更新完成（Zustand 状态更新是同步的，但需要等待数据库操作完成）
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 验证 watchlist 是否已更新（watchlist 会自动从 store 更新）
      console.log('刷新完成后的 watchlist:', watchlist.map(f => ({ 
        code: f.fundCode, 
        category: f.category, 
        ftype: f.ftype 
      })));
      
      if (result.success > 0) {
        alert(`成功刷新 ${result.success} 个基金的类型${result.failed > 0 ? `，${result.failed} 个失败` : ''}`);
      } else if (result.failed > 0) {
        alert(`刷新失败，共 ${result.failed} 个基金`);
      } else {
        alert('所有基金类型已是最新');
      }
    } catch (error) {
      console.error('刷新基金类型失败:', error);
      alert('刷新基金类型失败，请重试');
    } finally {
      setIsRefreshingTypes(false);
    }
  };

  return (
    <div className="min-h-screen bg-void bg-scanline pt-20">
      {/* 资产概览卡片区 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 p-3 sm:p-4 md:p-6 max-w-[1400px] mx-auto">
        {/* 总资产 */}
        <div className="glass-card p-2.5 sm:p-3 md:p-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 sm:w-24 h-20 sm:h-24 bg-neon-blue/10 rounded-full blur-3xl -mr-4 sm:-mr-6 -mt-4 sm:-mt-6" />
          <div className="relative">
            <div className="text-text-secondary text-xs mb-0.5 sm:mb-1 flex items-center gap-1">
              <i className="ri-wallet-3-line text-xs sm:text-sm" /> <span className="truncate">总资产 (估算)</span>
            </div>
            <div className="text-lg sm:text-xl md:text-2xl font-mono font-bold text-text-primary tracking-tight">
              <FlipNumber value={totalAssets} decimals={2} prefix="¥" />
            </div>
            <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-text-tertiary">
              <span>持仓 {watchlist.length} 只基金</span>
              {totalCost > 0 && (
                <span className="ml-1">
                  · 成本 ¥{totalCost.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 今日盈亏和累计收益 */}
        <div className="glass-card p-2.5 sm:p-3 md:p-4 relative overflow-hidden">
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {/* 今日盈亏 */}
            <div className="relative">
              <div
                className={clsx(
                  'absolute top-0 right-0 w-16 sm:w-20 h-16 sm:h-20 rounded-full blur-3xl -mr-3 sm:-mr-4 -mt-3 sm:-mt-4',
                  todayChange >= 0 ? 'bg-up/10' : 'bg-down/10'
                )}
              />
              <div className="relative">
                <div className="text-text-secondary text-xs mb-0.5 sm:mb-1 flex items-center gap-1">
                  <i className="ri-line-chart-fill text-xs sm:text-sm" /> <span className="truncate">今日盈亏</span>
                </div>
                <div
                  className={clsx(
                    'text-base sm:text-lg md:text-xl font-mono font-bold tracking-tight',
                    todayChange >= 0 ? 'text-up' : 'text-down'
                  )}
                >
                  {todayChange >= 0 ? '+' : ''}¥<FlipNumber value={todayChange} decimals={2} />
                </div>
                <div
                  className={clsx(
                    'mt-0.5 sm:mt-1 text-[10px] sm:text-xs',
                    todayChangePercent >= 0 ? 'text-up' : 'text-down'
                  )}
                >
                  <FlipNumber 
                    value={todayChangePercent} 
                    decimals={2} 
                    prefix={todayChangePercent >= 0 ? '+' : ''}
                    suffix="%"
                  />
                  {' '}{todayChange >= 0 ? '↑' : '↓'}
                </div>
              </div>
            </div>

            {/* 累计收益 */}
            <div className="relative border-l border-white/10 pl-2 sm:pl-3">
              <div
                className={clsx(
                  'absolute top-0 right-0 w-16 sm:w-20 h-16 sm:h-20 rounded-full blur-3xl -mr-3 sm:-mr-4 -mt-3 sm:-mt-4',
                  totalProfit >= 0 ? 'bg-up/10' : 'bg-down/10'
                )}
              />
              <div className="relative">
                <div className="text-text-secondary text-xs mb-0.5 sm:mb-1 flex items-center gap-1">
                  <i className="ri-stock-line text-xs sm:text-sm" /> <span className="truncate">累计收益</span>
                </div>
                <div
                  className={clsx(
                    'text-base sm:text-lg md:text-xl font-mono font-bold tracking-tight',
                    totalProfit >= 0 ? 'text-up' : 'text-down'
                  )}
                >
                  {totalProfit >= 0 ? '+' : ''}¥<FlipNumber value={totalProfit} decimals={2} />
                </div>
                <div
                  className={clsx(
                    'mt-0.5 sm:mt-1 text-[10px] sm:text-xs',
                    totalProfitPercent >= 0 ? 'text-up' : 'text-down'
                  )}
                >
                  <FlipNumber 
                    value={totalProfitPercent} 
                    decimals={2} 
                    prefix={totalProfitPercent >= 0 ? '+' : ''}
                    suffix="%"
                  />
                  {' '}{totalProfit >= 0 ? '↑' : '↓'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI 健康分 */}
        <div
          className="glass-card p-2.5 sm:p-3 md:p-4 relative overflow-hidden cursor-pointer hover:border-neon-purple/50 transition-all group"
          onClick={() => {
            // TODO: 打开AI选择器
            console.log('打开AI诊断');
          }}
        >
          <div className="absolute top-0 right-0 w-20 sm:w-24 h-20 sm:h-24 bg-neon-purple/10 rounded-full blur-3xl -mr-4 sm:-mr-6 -mt-4 sm:-mt-6 group-hover:bg-neon-purple/20 transition-colors" />
          <div className="relative">
            <div className="text-text-secondary text-xs mb-0.5 sm:mb-1 flex items-center gap-1">
              <i className="ri-robot-2-line text-neon-purple text-xs sm:text-sm" /> <span className="truncate">🤖 AI 健康分</span>
            </div>
            <div className="flex items-end gap-1 sm:gap-1.5">
              <span className="text-lg sm:text-xl md:text-2xl font-mono font-bold text-neon-purple">--</span>
              <span className="text-xs text-text-tertiary mb-0.5">/100</span>
            </div>
            <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-text-tertiary flex items-center gap-1">
              <span className="truncate">点击开始诊断</span>
              <i className="ri-arrow-right-line text-xs" />
            </div>
          </div>
          {/* 装饰性扫描线 */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-neon-purple to-transparent opacity-50" />
        </div>
      </div>

      {/* 自选基金列表 */}
      <div className="px-3 sm:px-4 md:px-6 pb-4 sm:pb-6 max-w-[1400px] mx-auto">
        {/* 添加基金按钮 */}
        <div className="mb-3 sm:mb-4 flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-semibold text-text-primary">我的自选</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-neon-blue/20 text-neon-blue rounded-lg hover:bg-neon-blue/30 active:bg-neon-blue/40 active:scale-95 transition-all duration-150 flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base font-medium shadow-lg hover:shadow-xl hover:shadow-neon-blue/20 active:shadow-md"
          >
            <i className="ri-add-line text-sm sm:text-base" />
            <span className="hidden sm:inline">添加基金</span>
            <span className="sm:hidden">添加</span>
          </button>
        </div>

        {/* 移动端：卡片布局 (< md) */}
        <div className="md:hidden space-y-3 sm:space-y-4">
          {watchlist.length === 0 ? (
            <div className="glass-card p-8 sm:p-12 text-center">
              <i className="ri-inbox-line text-4xl text-text-tertiary mb-4 block" />
              <div className="text-text-tertiary text-sm sm:text-base">暂无自选基金，请前往首页添加</div>
            </div>
          ) : (
            watchlist.map((fund, index) => {
              const userShares = fund.userShares || 0;
              const userCost = fund.userCost || 0;
              const displayData = fundDisplayData.get(fund.fundCode);
              
              // 使用 FundDataManager 的数据（如果还没有加载完成，使用 fund 中的后备数据）
              const currentNav = displayData?.netValue || fund.estimateNav || fund.nav || 0;
              const currentValue = currentNav * userShares;
              const costValue = userCost * userShares;
              
              // 使用 FundDataManager 的计算函数
              const todayProfit = displayData 
                ? calculateTodayProfit(displayData.netValue, displayData.previousNav, userShares)
                : 0;
              // 累计收益：必须使用 FundDataManager 的净值（盘中/盘后逻辑）
              // 如果 displayData 还没有加载，暂时使用 fund 中的净值，但会在加载完成后更新
              const profit = displayData && userCost
                ? calculateTotalProfit(displayData.netValue, userCost, userShares)
                : userCost && userShares && currentNav
                  ? calculateTotalProfit(currentNav, userCost, userShares)
                  : currentValue - costValue;
              const profitPercent = userCost > 0 && currentNav > 0 ? ((currentNav - userCost) / userCost) * 100 : 0;

              return (
                <div
                  key={fund.fundCode}
                  className="glass-card p-4 rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm hover:border-white/20 transition-all animate-in fade-in slide-in-from-bottom-2"
                  style={{
                    animationDelay: `${index * 50}ms`,
                    animationDuration: '0.4s',
                    animationFillMode: 'both',
                  }}
                >
                  {/* Header: 基金名称 */}
                  <div className="flex items-start justify-between mb-3 relative">
                    <div className="flex-1 min-w-0 pr-2" onClick={() => handleFundClick(fund.fundCode)}>
                      <h3 className="text-base sm:text-[17px] font-semibold text-white mb-1 truncate">
                        {fund.fundName}
                      </h3>
                      <div className="text-xs sm:text-[13px] text-white/60 font-mono flex items-center gap-2">
                        <span>{fund.fundCode}</span>
                        {fund.category ? (
                          <>
                            <span className="text-white/40">·</span>
                            <span className="text-white/50">{fund.category}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-white/40">·</span>
                            <span className="text-white/30">--</span>
                          </>
                        )}
                      </div>
                    </div>
                    {/* AI标识按钮 - 右上角 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: 打开AI诊断（功能待开发）
                        console.log('AI诊断', fund.fundCode);
                      }}
                      className="absolute top-0 right-0 p-2 rounded-lg bg-neon-purple/10 text-neon-purple hover:bg-neon-purple/20 active:bg-neon-purple/30 transition-colors flex items-center justify-center shrink-0"
                      title="AI 诊断（功能开发中）"
                    >
                      <i className="ri-robot-2-line text-base sm:text-lg" />
                    </button>
                  </div>

                  {/* 最新净值/涨跌幅 */}
                  {displayData && (
                    <div className="mb-3 pb-3 border-b border-white/10">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] sm:text-xs text-white/60">最新净值</div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm sm:text-base font-mono font-semibold text-white tabular-nums">
                            <FlipNumber value={displayData.netValue} decimals={4} />
                          </span>
                          <span className={clsx(
                            'text-xs sm:text-sm font-mono tabular-nums',
                            displayData.changePercent >= 0 ? 'text-red-400' : 'text-green-400'
                          )}>
                            <FlipNumber 
                              value={displayData.changePercent} 
                              decimals={2} 
                              prefix={displayData.changePercent >= 0 ? '+' : ''}
                              suffix="%"
                            />
                          </span>
                        </div>
                      </div>
                      <div className="text-[10px] text-white/40 mt-1">
                        {displayData.statusLabel}
                      </div>
                    </div>
                  )}

                  {/* 数据网格：持有金额、今日盈亏、累计收益 */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4">
                    {/* 持有金额 */}
                    <div className="text-center sm:text-right">
                      <div className="text-[10px] sm:text-xs text-white/60 mb-1">持有金额</div>
                      <div 
                        className="text-sm sm:text-[15px] font-medium text-white font-mono tabular-nums cursor-pointer hover:text-white/80 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditHolding(fund.fundCode);
                        }}
                      >
                        ¥<FlipNumber value={currentValue} decimals={2} />
                      </div>
                      <div 
                        className="text-[10px] sm:text-[11px] text-white/60 font-mono tabular-nums cursor-pointer hover:text-white/80 transition-colors mt-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditHolding(fund.fundCode);
                        }}
                      >
                        {userShares > 0 ? `${userShares.toFixed(2)}份` : '点击输入'}
                      </div>
                    </div>

                    {/* 今日盈亏 */}
                    <div className="text-center sm:text-right">
                      <div className="text-[10px] sm:text-xs text-white/60 mb-1">今日盈亏</div>
                      <div className={clsx(
                        'text-sm sm:text-[15px] font-medium font-mono tabular-nums',
                        todayProfit >= 0 ? 'text-red-400' : 'text-green-400'
                      )}>
                        {todayProfit >= 0 ? '+' : ''}¥<FlipNumber value={todayProfit} decimals={2} />
                      </div>
                      <div className={clsx(
                        'text-[10px] sm:text-[11px] font-mono tabular-nums',
                        todayProfit >= 0 ? 'text-red-400' : 'text-green-400'
                      )}>
                        {displayData ? (
                          <FlipNumber 
                            value={displayData.changePercent} 
                            decimals={2} 
                            prefix={displayData.changePercent >= 0 ? '+' : ''}
                            suffix="%"
                          />
                        ) : (
                          '--'
                        )}
                      </div>
                    </div>

                    {/* 累计收益 */}
                    <div className="text-center sm:text-right">
                      <div className="text-[10px] sm:text-xs text-white/60 mb-1">累计收益</div>
                      <div className={clsx(
                        'text-sm sm:text-[15px] font-medium font-mono tabular-nums',
                        profit >= 0 ? 'text-red-400' : 'text-green-400'
                      )}>
                        {profit >= 0 ? '+' : ''}¥<FlipNumber value={profit} decimals={2} />
                      </div>
                      <div className={clsx(
                        'text-[10px] sm:text-[11px] font-mono tabular-nums',
                        profitPercent >= 0 ? 'text-red-400' : 'text-green-400'
                      )}>
                        <FlipNumber 
                          value={profitPercent} 
                          decimals={2} 
                          prefix={profitPercent >= 0 ? '+' : ''}
                          suffix="%"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2 pt-3 border-t border-white/10">
                    <button
                      onClick={() => handleFundClick(fund.fundCode)}
                      className="flex-1 py-2 rounded-lg bg-white/5 text-white text-xs sm:text-sm active:bg-white/10 transition-colors"
                    >
                      详情
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditHolding(fund.fundCode);
                      }}
                      className="flex-1 py-2 rounded-lg bg-white/5 text-white text-xs sm:text-sm active:bg-white/10 transition-colors"
                    >
                      修改
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`确定要删除 ${fund.fundName} 吗？`)) {
                          removeFund(fund.fundCode);
                        }
                      }}
                      className="flex-1 py-2 rounded-lg bg-red-500/20 text-red-400 text-xs sm:text-sm active:bg-red-500/30 transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 桌面端：表格布局 (≥ md) */}
        <div className="hidden md:block glass-card overflow-hidden">
          {/* 表格头部工具栏 */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
              <button
                onClick={handleToggleDisplayMode}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150',
                  displayMode === 'list'
                    ? 'bg-neon-blue/20 text-neon-blue border-2 border-neon-blue'
                    : 'bg-white/5 text-text-secondary hover:bg-white/10 border-2 border-transparent'
                )}
              >
                {displayMode === 'list' ? '切换到分类模式' : '切换到列表模式'}
              </button>
              {displayMode === 'category' && hasUncategorizedFunds && (
                <button
                  onClick={handleRefreshFundTypes}
                  disabled={isRefreshingTypes}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 bg-white/5 text-text-secondary hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  title="刷新基金类型"
                >
                  <i className={clsx('ri-refresh-line', isRefreshingTypes && 'animate-spin')} />
                  刷新类型
                </button>
              )}
            </div>
            {displayMode === 'category' && hasUncategorizedFunds && (
              <div className="text-xs text-text-tertiary flex items-center gap-2">
                <i className="ri-information-line" />
                <span>存在未分类基金，点击刷新类型按钮更新</span>
              </div>
            )}
          </div>
          
          {/* 分类标签页（仅在分类模式下显示） */}
          {displayMode === 'category' && (
            <div className="px-6 py-3 border-b border-white/10 bg-white/5 flex items-center gap-2 flex-wrap">
              {categories.map((category) => {
                const count = category === '全部' ? watchlist.length : (groupedFunds[category]?.length || 0);
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={clsx(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                      selectedCategory === category
                        ? 'bg-neon-blue/20 text-neon-blue border-2 border-neon-blue shadow-lg shadow-neon-blue/20'
                        : 'bg-white/5 text-text-secondary hover:bg-white/10 border-2 border-transparent'
                    )}
                  >
                    {category}
                    {count > 0 && (
                      <span className={clsx(
                        'ml-2 text-xs',
                        selectedCategory === category ? 'text-neon-blue/80' : 'text-text-tertiary'
                      )}>
                        {count}只
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <table className="w-full text-left table-fixed">
            <thead className="bg-white/5 text-xs text-text-tertiary uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="py-3 pl-6 w-[200px]">基金名称</th>
                <th className="py-3 w-[100px]">类型</th>
                <th className="py-3 w-[130px]">最新净值</th>
                <th className="py-3 w-[150px]">持有金额</th>
                <th className="py-3 w-[130px]">今日盈亏</th>
                <th className="py-3 w-[130px]">累计收益</th>
                <th className="py-3 pr-6 text-right w-[100px]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredWatchlist.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-tertiary">
                    {displayMode === 'category' && selectedCategory !== '全部'
                      ? `暂无"${selectedCategory}"分类的基金`
                      : '暂无自选基金，请前往首页添加'}
                  </td>
                </tr>
              ) : (
                // 显示过滤后的基金列表（列表模式和分类模式共用）
                filteredWatchlist.map((fund) => {
                  const userShares = fund.userShares || 0;
                  const userCost = fund.userCost || 0;
                  const displayData = fundDisplayData.get(fund.fundCode);
                  
                  // 使用 FundDataManager 的数据（如果还没有加载完成，使用 fund 中的后备数据）
                  const currentNav = displayData?.netValue || fund.estimateNav || fund.nav || 0;
                  const currentValue = currentNav * userShares;
                  const costValue = userCost * userShares;
                  
                  // 使用 FundDataManager 的计算函数
                  const todayProfit = displayData 
                    ? calculateTodayProfit(displayData.netValue, displayData.previousNav, userShares)
                    : 0;
                  // 累计收益：必须使用 FundDataManager 的净值（盘中/盘后逻辑）
                  // 如果 displayData 还没有加载，暂时使用 fund 中的净值，但会在加载完成后更新
                  const profit = displayData && userCost
                    ? calculateTotalProfit(displayData.netValue, userCost, userShares)
                    : userCost && userShares && currentNav
                      ? calculateTotalProfit(currentNav, userCost, userShares)
                      : currentValue - costValue;
                  const profitPercent = userCost > 0 && currentNav > 0 ? ((currentNav - userCost) / userCost) * 100 : 0;

                  return (
                    <tr
                      key={fund.fundCode}
                      className="group hover:bg-white/[0.03] transition-colors border-b border-white/5"
                    >
                      <td 
                        className="py-4 pl-6 cursor-pointer hover:bg-white/[0.02] transition-colors group/name"
                        onClick={() => handleFundClick(fund.fundCode)}
                        title="点击查看详情"
                      >
                        <div className="font-medium text-text-primary group-hover/name:text-neon-blue transition-colors flex items-center gap-2">
                          {fund.fundName}
                          <i className="ri-external-link-line text-xs opacity-0 group-hover/name:opacity-100 transition-opacity text-neon-blue" />
                        </div>
                        <div className="text-xs text-text-tertiary mt-1 font-mono">
                          {fund.fundCode}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm text-text-primary">
                          {fund.category || '--'}
                        </div>
                      </td>
                      <td className="py-4">
                        {displayData ? (
                          <>
                            <div className="font-mono text-text-primary tabular-nums">
                              <FlipNumber value={displayData.netValue} decimals={4} />
                            </div>
                            <div className={clsx(
                              'text-xs mt-0.5 font-mono tabular-nums',
                              displayData.changePercent >= 0 ? 'text-red-400' : 'text-green-400'
                            )}>
                              <FlipNumber 
                                value={displayData.changePercent} 
                                decimals={2} 
                                prefix={displayData.changePercent >= 0 ? '+' : ''}
                                suffix="%"
                              />
                            </div>
                            <div className="text-[10px] text-text-tertiary mt-0.5">
                              {displayData.statusLabel}
                            </div>
                          </>
                        ) : (
                          <span className="text-text-tertiary">--</span>
                        )}
                      </td>
                      <td className="py-4">
                        <div 
                          className="cursor-pointer hover:bg-white/[0.02] rounded px-2 py-1 -mx-2 transition-colors group/edit"
                          onClick={() => handleOpenEditHolding(fund.fundCode)}
                          title="点击修改持仓"
                        >
                          <div className="font-mono text-text-primary tabular-nums">
                            ¥<FlipNumber value={currentValue} decimals={2} />
                          </div>
                          <div className="text-xs text-text-tertiary flex items-center gap-1 mt-0.5">
                            {userShares > 0 ? (
                              <>
                                <span className="font-mono tabular-nums">{userShares.toFixed(2)} 份</span>
                                <i className="ri-edit-line opacity-0 group-hover/edit:opacity-100 transition-opacity text-xs" />
                              </>
                            ) : (
                              <span className="text-text-tertiary/50">点击输入持仓金额</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <div
                          className={clsx(
                            'font-mono tabular-nums',
                            todayProfit >= 0 ? 'text-red-400' : 'text-green-400'
                          )}
                        >
                          {todayProfit >= 0 ? '+' : ''}¥<FlipNumber value={todayProfit} decimals={2} />
                        </div>
                        <div
                          className={clsx(
                            'text-xs mt-0.5',
                            todayProfit >= 0 ? 'text-red-400' : 'text-green-400'
                          )}
                        >
                          {displayData ? (
                            <FlipNumber 
                              value={displayData.changePercent} 
                              decimals={2} 
                              prefix={displayData.changePercent >= 0 ? '+' : ''}
                              suffix="%"
                            />
                          ) : (
                            '--'
                          )}
                        </div>
                      </td>
                      <td className="py-4">
                        <div
                          className={clsx(
                            'font-mono tabular-nums',
                            profit >= 0 ? 'text-red-400' : 'text-green-400'
                          )}
                        >
                          {profit >= 0 ? '+' : ''}¥<FlipNumber value={profit} decimals={2} />
                        </div>
                        <div
                          className={clsx(
                            'text-xs mt-0.5',
                            profitPercent >= 0 ? 'text-red-400' : 'text-green-400'
                          )}
                        >
                          <FlipNumber 
                            value={profitPercent} 
                            decimals={2} 
                            prefix={profitPercent >= 0 ? '+' : ''}
                            suffix="%"
                          />
                        </div>
                      </td>
                      <td className="py-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleFundClick(fund.fundCode)}
                            className="w-8 h-8 rounded-full bg-white/5 hover:bg-neon-blue/20 hover:text-neon-blue active:bg-neon-blue/30 active:scale-90 flex items-center justify-center transition-all duration-150"
                            title="详情"
                          >
                            <i className="ri-bar-chart-box-line" />
                          </button>
                          <button
                            onClick={() => handleOpenEditHolding(fund.fundCode)}
                            className="w-8 h-8 rounded-full bg-white/5 hover:bg-neon-blue/20 hover:text-neon-blue active:bg-neon-blue/30 active:scale-90 flex items-center justify-center transition-all duration-150"
                            title="修改持仓"
                          >
                            <i className="ri-edit-line" />
                          </button>
                          <button
                            onClick={() => removeFund(fund.fundCode)}
                            className="w-8 h-8 rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-400 active:bg-red-500/30 active:scale-90 flex items-center justify-center transition-all duration-150"
                            title="删除"
                          >
                            <i className="ri-delete-bin-line" />
                          </button>
                          <button
                            onClick={() => {
                              // TODO: 打开AI诊断（功能待开发）
                              console.log('AI诊断', fund.fundCode);
                            }}
                            className="w-8 h-8 rounded-full bg-neon-purple/10 text-neon-purple hover:bg-neon-purple/20 hover:scale-110 active:bg-neon-purple/30 active:scale-90 flex items-center justify-center transition-all duration-150"
                            title="AI 诊断（功能开发中）"
                          >
                            <i className="ri-robot-2-line" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 添加基金弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="glass-card p-6 w-full max-w-md animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-primary">添加基金</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setInputCode('');
                  setAddMessage('');
                }}
                className="text-text-tertiary hover:text-text-primary active:text-neon-red active:scale-90 transition-all duration-150 rounded-lg hover:bg-white/5 active:bg-white/10 p-1"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">基金代码</label>
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value);
                    setAddMessage('');
                    setSearchResults([]);
                  }}
                  onKeyDown={handleAddKeyDown}
                  placeholder="输入基金代码或名称搜索..."
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                  autoFocus
                  disabled={isValidating || isSearching}
                />
              </div>

              {/* 搜索结果列表 */}
              {searchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-white/10 rounded-lg bg-black/30">
                  {searchResults.map((result) => (
                    <div
                      key={result.code}
                      onClick={() => handleSelectSearchResult(result)}
                      className="p-3 cursor-pointer hover:bg-white/5 transition-all border-b border-white/5 last:border-b-0"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-text-primary truncate">{result.name}</div>
                          <div className="text-xs text-text-tertiary mt-1 flex items-center gap-2">
                            <span>代码: {result.code}</span>
                            {result.fundType && <span className="text-text-quaternary">·</span>}
                            {result.fundType && <span>{result.fundType}</span>}
                          </div>
                        </div>
                        <i className="ri-arrow-right-line text-neon-blue text-lg ml-2 flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isSearching && (
                <div className="text-sm text-text-tertiary text-center py-2">
                  搜索中...
                </div>
              )}

              {addMessage && (
                <div className={clsx(
                  'text-sm p-2 rounded',
                  addMessage.includes('成功') ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'
                )}>
                  {addMessage}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => handleAdd()}
                  disabled={isValidating || !inputCode.trim()}
                  className={clsx(
                    'flex-1 px-4 py-2.5 rounded-lg font-medium transition-all duration-150',
                    isValidating || !inputCode.trim()
                      ? 'bg-white/5 text-text-tertiary cursor-not-allowed disabled:active:scale-100'
                      : 'bg-neon-blue/20 text-neon-blue hover:bg-neon-blue/30 active:bg-neon-blue/40 active:scale-95 shadow-lg hover:shadow-xl hover:shadow-neon-blue/20 active:shadow-md'
                  )}
                >
                  {isValidating ? '验证中...' : '下一步'}
                </button>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setInputCode('');
                    setAddMessage('');
                  }}
                  className="px-4 py-2.5 bg-white/5 text-text-secondary rounded-lg hover:bg-white/10 active:bg-white/15 active:scale-95 transition-all duration-150 font-medium"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 基金信息预览弹窗 */}
      {showFundPreview && pendingFundInfo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="glass-card p-6 w-full max-w-md animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-primary">基金信息</h3>
              <button
                onClick={() => {
                  setShowFundPreview(false);
                  setPendingFundCode('');
                  setPendingFundInfo(null);
                }}
                className="text-text-tertiary hover:text-text-primary active:text-neon-red active:scale-90 transition-all duration-150 rounded-lg hover:bg-white/5 active:bg-white/10 p-1"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 基金基本信息 */}
              <div className="bg-white/5 rounded-lg p-4 space-y-3">
                <div>
                  <div className="text-sm text-text-tertiary mb-1">基金名称</div>
                  <div className="text-lg font-semibold text-text-primary">{pendingFundInfo.name}</div>
                </div>
                <div>
                  <div className="text-sm text-text-tertiary mb-1">基金代码</div>
                  <div className="text-base font-mono text-text-primary">{pendingFundInfo.code}</div>
                </div>
                {pendingFundInfo.nav > 0 && (
                  <div>
                    <div className="text-sm text-text-tertiary mb-1">最新净值</div>
                    <div className="text-xl font-mono font-bold text-text-primary">
                      ¥{pendingFundInfo.nav.toFixed(4)}
                    </div>
                  </div>
                )}
                {pendingFundInfo.estimateNav && pendingFundInfo.estimateNav > 0 && (
                  <div>
                    <div className="text-sm text-text-tertiary mb-1">估算净值</div>
                    <div className="text-xl font-mono font-bold text-neon-blue">
                      ¥{pendingFundInfo.estimateNav.toFixed(4)}
                      <span className="text-xs text-text-tertiary ml-2">(盘中估值)</span>
                    </div>
                  </div>
                )}
              </div>

              {addMessage && (
                <div className={clsx(
                  'text-sm p-2 rounded',
                  addMessage.includes('成功') ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'
                )}>
                  {addMessage}
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleOpenHoldingModal}
                  disabled={isAdding}
                  className={clsx(
                    'w-full px-4 py-3 rounded-lg font-medium transition-all duration-150 flex items-center justify-center gap-2',
                    isAdding
                      ? 'bg-white/5 text-text-tertiary cursor-not-allowed disabled:active:scale-100'
                      : 'bg-neon-blue/20 text-neon-blue hover:bg-neon-blue/30 active:bg-neon-blue/40 active:scale-95 shadow-lg hover:shadow-xl hover:shadow-neon-blue/20 active:shadow-md'
                  )}
                >
                  <i className="ri-wallet-3-line" />
                  设置持仓信息
                </button>
                <button
                  onClick={handleAddWithoutHolding}
                  disabled={isAdding}
                  className={clsx(
                    'w-full px-4 py-2.5 rounded-lg font-medium transition-all duration-150',
                    isAdding
                      ? 'bg-white/5 text-text-tertiary cursor-not-allowed disabled:active:scale-100'
                      : 'bg-white/5 text-text-secondary hover:bg-white/10 active:bg-white/15 active:scale-95'
                  )}
                >
                  {isAdding ? '添加中...' : '直接添加（不设置持仓）'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 设置持仓金额弹窗（添加/修改共用） */}
      {showHoldingModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="glass-card p-4 sm:p-6 w-full max-w-md animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-text-primary">
                {isEditingHolding ? '修改持仓' : '设置持仓金额'}
              </h3>
              <button
                onClick={handleCloseHoldingModal}
                className="text-text-tertiary hover:text-text-primary active:text-neon-red active:scale-90 transition-all duration-150 rounded-lg hover:bg-white/5 active:bg-white/10 p-1"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>

            {/* 基金信息（修改模式显示） */}
            {isEditingHolding && editingHoldingFundCode && (
              <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="text-sm font-medium text-text-primary">
                  {watchlist.find(f => f.fundCode === editingHoldingFundCode)?.fundName}
                </div>
                <div className="text-xs text-text-tertiary mt-1 font-mono">
                  {editingHoldingFundCode}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {/* 输入模式切换 */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => {
                    setInputMode('amount');
                    setHoldingAmount('');
                    setHoldingShares('');
                  }}
                  className={clsx(
                    'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                    inputMode === 'amount'
                      ? 'bg-neon-blue/20 text-neon-blue border-2 border-neon-blue shadow-[0_0_20px_rgba(0,212,255,0.3)] active:scale-95'
                      : 'bg-white/5 text-text-secondary hover:bg-white/10 active:bg-white/15 active:scale-95 border-2 border-transparent'
                  )}
                >
                  按金额输入
                </button>
                <button
                  onClick={() => {
                    setInputMode('shares');
                    setHoldingAmount('');
                    setHoldingShares('');
                  }}
                  className={clsx(
                    'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                    inputMode === 'shares'
                      ? 'bg-neon-blue/20 text-neon-blue border-2 border-neon-blue shadow-[0_0_20px_rgba(0,212,255,0.3)] active:scale-95'
                      : 'bg-white/5 text-text-secondary hover:bg-white/10 active:bg-white/15 active:scale-95 border-2 border-transparent'
                  )}
                >
                  按数量输入
                </button>
              </div>

              {inputMode === 'amount' ? (
                <>
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">持仓金额（元）</label>
                    <input
                      type="number"
                      step="0.01"
                      value={holdingAmount}
                      onChange={(e) => setHoldingAmount(e.target.value)}
                      placeholder="请输入持仓金额（可选）"
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-text-secondary mb-2">持仓成本（元/份，可选）</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={holdingCost}
                      onChange={(e) => setHoldingCost(e.target.value)}
                      placeholder="请输入持仓成本，不填则使用当前净值"
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                    />
                    {holdingAmount && holdingCost && parseFloat(holdingAmount) > 0 && parseFloat(holdingCost) > 0 && (
                      <div className="mt-2 text-xs text-text-tertiary">
                        预计持仓份额：{(parseFloat(holdingAmount) / parseFloat(holdingCost)).toFixed(2)} 份
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">持仓成本（元/份）</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={holdingCost}
                      onChange={(e) => setHoldingCost(e.target.value)}
                      placeholder="请输入持仓成本价"
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-text-secondary mb-2">持仓数量（份）</label>
                    <input
                      type="number"
                      step="0.01"
                      value={holdingShares}
                      onChange={(e) => setHoldingShares(e.target.value)}
                      placeholder="请输入持仓数量"
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                    />
                    {holdingCost && holdingShares && parseFloat(holdingCost) > 0 && parseFloat(holdingShares) > 0 && (
                      <div className="mt-2 text-xs text-text-tertiary">
                        预计持仓金额：¥{(parseFloat(holdingCost) * parseFloat(holdingShares)).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>
                </>
              )}

              {addMessage && (
                <div className={clsx(
                  'text-sm p-2 rounded',
                  addMessage.includes('成功') ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'
                )}>
                  {addMessage}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleConfirmHolding}
                  disabled={isAdding}
                  className={clsx(
                    'flex-1 px-4 py-2.5 rounded-lg font-medium transition-all duration-150',
                    isAdding
                      ? 'bg-white/5 text-text-tertiary cursor-not-allowed disabled:active:scale-100'
                      : 'bg-neon-blue/20 text-neon-blue hover:bg-neon-blue/30 active:bg-neon-blue/40 active:scale-95 shadow-lg hover:shadow-xl hover:shadow-neon-blue/20 active:shadow-md'
                  )}
                >
                  {isAdding ? '添加中...' : '确认添加'}
                </button>
                <button
                  onClick={() => {
                    setShowHoldingModal(false);
                    setHoldingAmount('');
                    setHoldingCost('');
                    setHoldingShares('');
                    setInputMode('amount');
                    // 返回到预览弹窗
                    if (pendingFundInfo) {
                      setShowFundPreview(true);
                    }
                  }}
                  disabled={isAdding}
                  className="px-4 py-2.5 bg-white/5 text-text-secondary rounded-lg hover:bg-white/10 active:bg-white/15 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 font-medium"
                >
                  返回
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 基金详情弹窗 */}
      {selectedFundCode && (
        <FundModal
          isOpen={showFundModal}
          onClose={() => {
            setShowFundModal(false);
            selectFund(null);
          }}
          fundCode={selectedFundCode}
        />
      )}
    </div>
  );
}
