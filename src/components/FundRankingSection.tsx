import { useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { fetchFundRanking, RankedFund } from '../api/fundRanking';
import { useFundStore } from '../store/fundStore';
import { useAppStore } from '../store/appStore';

interface FundRankingSectionProps {
  onFundClick: (code: string) => void;
}

export function FundRankingSection({ onFundClick }: FundRankingSectionProps) {
  const [funds, setFunds] = useState<RankedFund[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState({
    type: "all" as const,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const { addFund } = useFundStore();
  const { refreshRankingTrigger } = useAppStore();
  const [showHoldingModal, setShowHoldingModal] = useState(false);
  const [pendingFund, setPendingFund] = useState<RankedFund | null>(null);
  const [holdingAmount, setHoldingAmount] = useState<string>('');
  const [holdingCost, setHoldingCost] = useState<string>('');
  const [holdingShares, setHoldingShares] = useState<string>('');
  const [inputMode, setInputMode] = useState<'amount' | 'shares'>('amount');
  const [isAdding, setIsAdding] = useState(false);
  const [addMessage, setAddMessage] = useState('');

  const loadRanking = useCallback(async () => {
    setIsLoading(true);
    try {
      // 今日热门：使用1nzf排序（日涨幅）
      const data = await fetchFundRanking({
        type: filters.type,
        sortBy: '1nzf', // 今日涨幅排序
        pageSize: 50,
        pageIndex: 1,
      });
      
      if (data && data.length > 0) {
        setFunds(data);
        console.log('加载成功，数据条数:', data.length);
      } else {
        console.warn('返回空数据');
        setFunds([]);
      }
    } catch (error) {
      console.error('加载排行榜失败:', error);
      setFunds([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters.type]);

  useEffect(() => {
    loadRanking();
    // 移除 loadRanking 依赖，避免重复调用
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.type, refreshRankingTrigger]); // 只监听 filters.type 和 refreshRankingTrigger

  const filteredFunds = funds.filter(fund => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return fund.name.toLowerCase().includes(query) || fund.code.includes(query);
  });


  const handleAddToWatchlist = async (fund: RankedFund, skipModal = false) => {
    if (skipModal) {
      // 直接添加，不显示持仓弹窗
      setIsAdding(true);
      try {
        const result = await addFund(fund.code);
        if (result.success) {
          setAddMessage('添加成功');
          setTimeout(() => setAddMessage(''), 2000);
        } else {
          setAddMessage(result.message);
        }
      } catch (error) {
        setAddMessage(error instanceof Error ? error.message : '添加失败');
      } finally {
        setIsAdding(false);
      }
      return;
    }

    // 显示持仓输入弹窗
    setPendingFund(fund);
    // 默认填充当前净值到持仓成本
    if (fund.nav && fund.nav > 0) {
      setHoldingCost(fund.nav.toFixed(4));
    } else {
      setHoldingCost('');
    }
    setShowHoldingModal(true);
  };

  const handleConfirmHolding = async () => {
    if (!pendingFund) return;

    setIsAdding(true);
    setAddMessage('');

    let amount = 0;
    let cost = parseFloat(holdingCost) || undefined;

    if (inputMode === 'amount') {
      // 金额模式：使用输入的金额
      amount = parseFloat(holdingAmount) || 0;
    } else {
      // 份额模式：需要先获取成本价，然后计算金额
      const shares = parseFloat(holdingShares) || 0;
      if (shares <= 0) {
        setAddMessage('请输入有效的持仓数量');
        setIsAdding(false);
        return;
      }

      if (!cost) {
        // 如果没有输入成本价，尝试使用当前净值
        cost = pendingFund.nav || undefined;
        if (!cost || cost <= 0) {
          setAddMessage('请先输入持仓成本价');
          setIsAdding(false);
          return;
        }
      }

      amount = shares * cost;
    }

    try {
      const result = await addFund(pendingFund.code, amount, cost);
      
      if (result.success) {
        setHoldingAmount('');
        setHoldingCost('');
        setHoldingShares('');
        setInputMode('amount');
        setPendingFund(null);
        setShowHoldingModal(false);
        setAddMessage('添加成功');
        setTimeout(() => setAddMessage(''), 2000);
      } else {
        setAddMessage(result.message);
      }
    } catch (error) {
      setAddMessage(error instanceof Error ? error.message : '添加失败，请重试');
    } finally {
      setIsAdding(false);
    }
  };

  const handleCloseHoldingModal = () => {
    setShowHoldingModal(false);
    setHoldingAmount('');
    setHoldingCost('');
    setHoldingShares('');
    setInputMode('amount');
    setPendingFund(null);
    setAddMessage('');
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-2 sm:mb-3 md:mb-4 flex-shrink-0">
        <div className="flex items-center gap-1 sm:gap-2 text-text-secondary">
          <i className="ri-fire-line text-neon-red text-lg sm:text-xl md:text-2xl" />
          <h3 className="font-display font-semibold text-sm sm:text-base md:text-lg lg:text-xl">热门基金排行榜</h3>
        </div>

        {/* 搜索栏 */}
        <div className="relative w-full sm:w-48 md:w-56 lg:w-72">
          <input
            type="text"
            placeholder="搜索基金代码/名称..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/30 border border-white/10 rounded-lg pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-xs sm:text-sm focus:border-neon-blue focus:outline-none focus:shadow-[0_0_15px_rgba(0,212,255,0.3)] transition-all"
          />
          <i className="ri-search-line absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm sm:text-base" />
        </div>
      </header>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 md:gap-3 mb-2 sm:mb-3 md:mb-4 pb-2 sm:pb-3 md:pb-4 border-b border-white/10 flex-shrink-0">
        {/* 基金类型 */}
        <div className="flex items-center gap-0.5 sm:gap-1 bg-black/20 rounded-lg p-0.5 sm:p-1 overflow-x-auto scrollbar-hide">
          {[
            { id: "all", label: "全部" },
            { id: "gp", label: "股票型" },
            { id: "hh", label: "混合型" },
            { id: "zq", label: "债券型" },
            { id: "zs", label: "指数型" },
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => setFilters({ ...filters, type: type.id as any })}
              className={clsx(
                'px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium transition-all duration-150 whitespace-nowrap',
                filters.type === type.id
                  ? 'bg-neon-red/20 text-neon-red active:bg-neon-red/30 active:scale-95'
                  : 'text-text-secondary hover:text-white active:bg-white/10 active:scale-95'
              )}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />
      </div>

      {/* 列表 - 固定高度，可滚动 */}
      <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 sm:py-10 md:py-12">
            <div className="text-text-tertiary text-xs sm:text-sm">加载中...</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[10px] sm:text-xs md:text-sm min-w-[450px] sm:min-w-[700px] md:min-w-[800px] lg:min-w-[900px]">
              <thead className="text-[9px] sm:text-[10px] md:text-xs text-text-tertiary uppercase tracking-wider sticky top-0 bg-surface/80 backdrop-blur border-b border-white/5">
                <tr>
                  <th className="py-1.5 sm:py-2 pl-1 sm:pl-2 w-[100px] sm:w-[120px] md:w-[140px] lg:w-[160px]">基金名称</th>
                  <th className="py-1.5 sm:py-2 text-right w-[65px] sm:w-[75px] md:w-[85px]">单位净值</th>
                  <th className="py-1.5 sm:py-2 text-right hidden sm:table-cell w-[75px] md:w-[85px]">累计净值</th>
                  <th className="py-1.5 sm:py-2 text-right w-[65px] sm:w-[75px] md:w-[85px]">日增长率</th>
                  <th className="py-1.5 sm:py-2 text-right hidden md:table-cell w-[65px] lg:w-[75px]">近1周</th>
                  <th className="py-1.5 sm:py-2 text-right hidden md:table-cell w-[65px] lg:w-[75px]">近1月</th>
                  <th className="py-1.5 sm:py-2 text-right hidden lg:table-cell w-[65px]">近3月</th>
                  <th className="py-1.5 sm:py-2 text-right hidden lg:table-cell w-[65px]">今年来</th>
                  <th className="py-1.5 sm:py-2 text-center w-[50px] sm:w-[70px]">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredFunds.map((fund, idx) => (
                  <tr
                    key={fund.code}
                    className="group hover:bg-white/5 transition-colors"
                  >
                    <td
                      className="py-2 sm:py-2.5 md:py-3 pl-1 sm:pl-2 cursor-pointer max-w-[100px] sm:max-w-[120px] md:max-w-[140px] lg:max-w-[160px]"
                      onClick={() => onFundClick(fund.code)}
                    >
                      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                        <span className="text-[9px] sm:text-[10px] md:text-xs text-text-tertiary w-4 sm:w-5 shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div 
                            className="font-medium text-text-primary truncate text-[10px] sm:text-xs md:text-sm"
                            title={fund.name}
                          >
                            {fund.name}
                          </div>
                          <div className="text-[8px] sm:text-[9px] md:text-[10px] text-text-tertiary flex items-center gap-1 sm:gap-1.5 mt-0.5 flex-wrap">
                            <span className="font-mono truncate">{fund.code}</span>
                            {fund.dataDate && (
                              <span className="px-1 py-0.5 rounded bg-white/5 text-[7px] sm:text-[8px] md:text-[9px] font-mono shrink-0">
                                {fund.dataDate}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={clsx(
                      'py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-right font-mono text-[9px] sm:text-[10px] md:text-xs whitespace-nowrap',
                      fund.dailyGrowth >= 0 ? 'text-up' : fund.dailyGrowth < 0 ? 'text-down' : 'text-text-primary'
                    )}>
                      {fund.nav > 0 ? fund.nav.toFixed(4) : '--'}
                    </td>
                    <td className={clsx(
                      'py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-right font-mono text-[9px] sm:text-[10px] md:text-xs hidden sm:table-cell whitespace-nowrap',
                      fund.dailyGrowth >= 0 ? 'text-up' : fund.dailyGrowth < 0 ? 'text-down' : 'text-text-primary'
                    )}>
                      {fund.accNav > 0 ? fund.accNav.toFixed(4) : '--'}
                    </td>
                    <td
                      className={clsx(
                        'py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-right font-mono text-[9px] sm:text-[10px] md:text-xs whitespace-nowrap',
                        fund.dailyGrowth >= 0 ? 'text-up' : 'text-down'
                      )}
                    >
                      {fund.dailyGrowth !== 0 ? (
                        <>
                          {fund.dailyGrowth >= 0 ? '+' : ''}
                          {fund.dailyGrowth.toFixed(2)}%
                        </>
                      ) : (
                        '--'
                      )}
                    </td>
                    <td
                      className={clsx(
                        'py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-right font-mono text-[9px] sm:text-[10px] md:text-xs hidden md:table-cell whitespace-nowrap',
                        fund.recent1Week >= 0 ? 'text-up' : 'text-down'
                      )}
                    >
                      {fund.recent1Week !== 0 ? (
                        <>
                          {fund.recent1Week >= 0 ? '+' : ''}
                          {fund.recent1Week.toFixed(2)}%
                        </>
                      ) : (
                        '--'
                      )}
                    </td>
                    <td
                      className={clsx(
                        'py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-right font-mono text-[9px] sm:text-[10px] md:text-xs hidden md:table-cell whitespace-nowrap',
                        fund.recent1Month >= 0 ? 'text-up' : 'text-down'
                      )}
                    >
                      {fund.recent1Month !== 0 ? (
                        <>
                          {fund.recent1Month >= 0 ? '+' : ''}
                          {fund.recent1Month.toFixed(2)}%
                        </>
                      ) : (
                        '--'
                      )}
                    </td>
                    <td
                      className={clsx(
                        'py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-right font-mono text-[9px] sm:text-[10px] md:text-xs hidden lg:table-cell whitespace-nowrap',
                        fund.recent3Month >= 0 ? 'text-up' : 'text-down'
                      )}
                    >
                      {fund.recent3Month !== 0 ? (
                        <>
                          {fund.recent3Month >= 0 ? '+' : ''}
                          {fund.recent3Month.toFixed(2)}%
                        </>
                      ) : (
                        '--'
                      )}
                    </td>
                    <td
                      className={clsx(
                        'py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-right font-mono text-[9px] sm:text-[10px] md:text-xs hidden lg:table-cell whitespace-nowrap',
                        fund.thisYear >= 0 ? 'text-up' : 'text-down'
                      )}
                    >
                      {fund.thisYear !== 0 ? (
                        <>
                          {fund.thisYear >= 0 ? '+' : ''}
                          {fund.thisYear.toFixed(2)}%
                        </>
                      ) : (
                        '--'
                      )}
                    </td>
                    <td className="py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-center">
                      <div className="flex items-center justify-center gap-1 sm:gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToWatchlist(fund);
                          }}
                          className="p-1 sm:p-1.5 rounded-lg bg-neon-blue/10 text-neon-blue hover:bg-neon-blue/20 active:bg-neon-blue/30 active:scale-95 transition-all duration-150"
                          title="加入自选"
                        >
                          <i className="ri-add-line text-xs sm:text-sm" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onFundClick(fund.code);
                          }}
                          className="p-1 sm:p-1.5 rounded-lg bg-neon-purple/10 text-neon-purple hover:bg-neon-purple/20 active:bg-neon-purple/30 active:scale-95 transition-all duration-150"
                          title="AI诊断"
                        >
                          <i className="ri-robot-2-line text-xs sm:text-sm" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 设置持仓金额弹窗 */}
      {showHoldingModal && pendingFund && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="glass-card p-4 sm:p-6 w-full max-w-md animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-text-primary">
                设置持仓金额
              </h3>
              <button
                onClick={handleCloseHoldingModal}
                className="text-text-tertiary hover:text-text-primary active:text-neon-red active:scale-90 transition-all duration-150 rounded-lg hover:bg-white/5 active:bg-white/10 p-1"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 基金信息 */}
              <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="text-xs text-text-tertiary mb-1">基金名称</div>
                <div className="text-sm font-medium text-text-primary">{pendingFund.name}</div>
                <div className="text-xs text-text-tertiary mt-1 font-mono">{pendingFund.code}</div>
              </div>

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
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue font-mono"
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
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue font-mono"
                    />
                    {holdingAmount && holdingCost && parseFloat(holdingAmount) > 0 && parseFloat(holdingCost) > 0 && (
                      <div className="mt-2 text-xs text-text-tertiary">
                        预计持仓份额：{(parseFloat(holdingAmount) / parseFloat(holdingCost)).toFixed(2)} 份
                      </div>
                    )}
                    {!holdingCost && pendingFund.nav > 0 && (
                      <div className="mt-2 text-xs text-text-tertiary">
                        当前净值：{pendingFund.nav.toFixed(4)} 元/份
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
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue font-mono"
                      autoFocus
                    />
                    {!holdingCost && pendingFund.nav > 0 && (
                      <div className="mt-2 text-xs text-text-tertiary">
                        当前净值：{pendingFund.nav.toFixed(4)} 元/份（可作为参考）
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-text-secondary mb-2">持仓数量（份）</label>
                    <input
                      type="number"
                      step="0.01"
                      value={holdingShares}
                      onChange={(e) => setHoldingShares(e.target.value)}
                      placeholder="请输入持仓数量"
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue font-mono"
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
                  onClick={handleCloseHoldingModal}
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
    </div>
  );
}
