import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { fetchFundRanking, RankedFund } from '../api/fundRanking';
import { useFundStore } from '../store/fundStore';

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
  const [showHoldingModal, setShowHoldingModal] = useState(false);
  const [pendingFund, setPendingFund] = useState<RankedFund | null>(null);
  const [holdingAmount, setHoldingAmount] = useState<string>('');
  const [holdingCost, setHoldingCost] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);
  const [addMessage, setAddMessage] = useState('');

  useEffect(() => {
    loadRanking();
  }, [filters]);

  const loadRanking = async () => {
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
  };

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
    setShowHoldingModal(true);
  };

  const handleConfirmHolding = async () => {
    if (!pendingFund) return;

    const amount = parseFloat(holdingAmount) || 0;
    const cost = parseFloat(holdingCost) || undefined;

    setIsAdding(true);
    setAddMessage('');
    
    try {
      const result = await addFund(pendingFund.code, amount, cost);
      
      if (result.success) {
        setHoldingAmount('');
        setHoldingCost('');
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

  const handleSkipHolding = async () => {
    if (!pendingFund) return;

    setIsAdding(true);
    setAddMessage('');
    
    try {
      const result = await addFund(pendingFund.code);
      
      if (result.success) {
        setHoldingAmount('');
        setHoldingCost('');
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

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2 text-text-secondary">
          <i className="ri-fire-line text-neon-red text-2xl" />
          <h3 className="font-display font-semibold text-xl">热门基金排行榜</h3>
        </div>

        {/* 搜索栏 */}
        <div className="relative w-72">
          <input
            type="text"
            placeholder="搜索基金代码/名称..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/30 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-neon-blue focus:outline-none focus:shadow-[0_0_15px_rgba(0,212,255,0.3)] transition-all"
          />
          <i className="ri-search-line absolute left-3 top-2.5 text-text-tertiary" />
        </div>
      </header>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b border-white/10 flex-shrink-0">
        {/* 基金类型 */}
        <div className="flex items-center gap-1 bg-black/20 rounded-lg p-1">
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
                'px-3 py-1 rounded text-xs font-medium transition-all duration-150',
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
          <div className="flex items-center justify-center py-12">
            <div className="text-text-tertiary">加载中...</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[1000px]">
              <thead className="text-xs text-text-tertiary uppercase tracking-wider sticky top-0 bg-surface/80 backdrop-blur border-b border-white/5">
                <tr>
                  <th className="py-2 pl-2">基金名称</th>
                  <th className="py-2 text-right">单位净值</th>
                  <th className="py-2 text-right">累计净值</th>
                  <th className="py-2 text-right">日增长率</th>
                  <th className="py-2 text-right">近1周</th>
                  <th className="py-2 text-right">近1月</th>
                  <th className="py-2 text-right">近3月</th>
                  <th className="py-2 text-right">今年来</th>
                  <th className="py-2 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredFunds.map((fund, idx) => (
                  <tr
                    key={fund.code}
                    className="group hover:bg-white/5 transition-colors"
                  >
                    <td
                      className="py-3 pl-2 cursor-pointer"
                      onClick={() => onFundClick(fund.code)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-tertiary w-5">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-medium text-text-primary truncate max-w-[150px]">
                            {fund.name}
                          </div>
                          <div className="text-xs text-text-tertiary flex items-center gap-2">
                            {fund.code}
                            <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px]">
                              {fund.type}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={clsx(
                      'py-3 text-right font-mono',
                      fund.dailyGrowth >= 0 ? 'text-up' : fund.dailyGrowth < 0 ? 'text-down' : 'text-text-primary'
                    )}>
                      {fund.nav > 0 ? fund.nav.toFixed(4) : '--'}
                    </td>
                    <td className={clsx(
                      'py-3 text-right font-mono',
                      fund.dailyGrowth >= 0 ? 'text-up' : fund.dailyGrowth < 0 ? 'text-down' : 'text-text-primary'
                    )}>
                      {fund.accNav > 0 ? fund.accNav.toFixed(4) : '--'}
                    </td>
                    <td
                      className={clsx(
                        'py-3 text-right font-mono',
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
                        'py-3 text-right font-mono',
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
                        'py-3 text-right font-mono',
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
                        'py-3 text-right font-mono',
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
                        'py-3 text-right font-mono',
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
                    <td className="py-3 text-center">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToWatchlist(fund);
                          }}
                          className="p-1.5 rounded-lg bg-neon-blue/10 text-neon-blue hover:bg-neon-blue/20 active:bg-neon-blue/30 active:scale-95 transition-all duration-150"
                          title="加入自选"
                        >
                          <i className="ri-add-line" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onFundClick(fund.code);
                          }}
                          className="p-1.5 rounded-lg bg-neon-purple/10 text-neon-purple hover:bg-neon-purple/20 active:bg-neon-purple/30 active:scale-95 transition-all duration-150"
                          title="AI诊断"
                        >
                          <i className="ri-robot-2-line" />
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

      {/* 持仓金额输入弹窗 */}
      {showHoldingModal && pendingFund && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">设置持仓金额</h3>
              <button
                onClick={() => {
                  setShowHoldingModal(false);
                  setHoldingAmount('');
                  setHoldingCost('');
                  setPendingFund(null);
                }}
                className="text-text-secondary hover:text-text-primary active:text-neon-red active:scale-90 transition-all duration-150 rounded-lg hover:bg-white/5 active:bg-white/10 p-1"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="text-xs text-text-tertiary mb-1">基金名称</div>
                <div className="text-sm font-medium text-text-primary">{pendingFund.name}</div>
                <div className="text-xs text-text-tertiary mt-1 font-mono">{pendingFund.code}</div>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  持仓金额（元）<span className="text-text-tertiary ml-1">可选</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={holdingAmount}
                  onChange={(e) => setHoldingAmount(e.target.value)}
                  placeholder="例如：10000"
                  className="w-full px-4 py-2 bg-bg-elevated border border-border-subtle rounded-lg text-text-primary font-mono focus:outline-none focus:border-accent-blue"
                  autoFocus
                />
                <div className="text-xs text-text-tertiary mt-1">
                  输入您的持仓金额，系统将自动计算持仓份额
                </div>
              </div>

              {holdingAmount && parseFloat(holdingAmount) > 0 && (
                <div>
                  <label className="block text-sm text-text-secondary mb-2">
                    成本价（元/份）<span className="text-text-tertiary ml-1">可选</span>
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={holdingCost}
                    onChange={(e) => setHoldingCost(e.target.value)}
                    placeholder="留空则使用当前净值"
                    className="w-full px-4 py-2 bg-bg-elevated border border-border-subtle rounded-lg text-text-primary font-mono focus:outline-none focus:border-accent-blue"
                  />
                  <div className="text-xs text-text-tertiary mt-1">
                    留空将使用当前净值（{pendingFund.nav > 0 ? pendingFund.nav.toFixed(4) : '--'}）作为成本价
                  </div>
                </div>
              )}

              {addMessage && (
                <div
                  className={clsx(
                    'text-sm p-2 rounded',
                    addMessage.includes('成功')
                      ? 'text-down-primary bg-down-glow/20'
                      : 'text-up-primary bg-up-glow/20'
                  )}
                >
                  {addMessage}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleSkipHolding}
                  disabled={isAdding}
                  className="flex-1 px-4 py-2.5 border border-border-subtle rounded-lg hover:bg-bg-elevated active:bg-white/10 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 font-medium"
                >
                  跳过
                </button>
                <button
                  onClick={handleConfirmHolding}
                  disabled={isAdding}
                  className="flex-1 px-4 py-2.5 bg-neon-blue/20 hover:bg-neon-blue/30 active:bg-neon-blue/40 text-neon-blue disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 rounded-lg transition-all duration-150 font-medium shadow-lg hover:shadow-xl hover:shadow-neon-blue/20 active:shadow-md"
                >
                  {isAdding ? '添加中...' : '确认添加'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
