import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { useFundStore } from '../store/fundStore';
import { FundModal } from './FundModal';
import { validateFundCode, fetchFundRealtime } from '../api/eastmoney';

export function PortfolioPage() {
  const { watchlist, selectedFundCode, selectFund, removeFund, updateUserHolding, updateRealtimeData, addFund } = useFundStore();
  const [showFundModal, setShowFundModal] = useState(false);
  const [editingFundCode, setEditingFundCode] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  
  // 添加基金相关状态
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFundPreview, setShowFundPreview] = useState(false); // 基金信息预览弹窗
  const [showHoldingModal, setShowHoldingModal] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [addMessage, setAddMessage] = useState('');
  const [pendingFundCode, setPendingFundCode] = useState<string>('');
  const [pendingFundInfo, setPendingFundInfo] = useState<{ code: string; name: string; nav: number; estimateNav?: number } | null>(null);
  const [holdingAmount, setHoldingAmount] = useState<string>('');
  const [holdingCost, setHoldingCost] = useState<string>('');
  const [holdingShares, setHoldingShares] = useState<string>('');
  const [inputMode, setInputMode] = useState<'amount' | 'shares'>('amount'); // 输入模式：金额模式 或 份额模式

  // 计算总资产（估算）
  const totalAssets = watchlist.reduce((sum, fund) => {
    const userShares = fund.userShares || 0;
    const currentNav = fund.estimateNav || fund.nav || 0;
    return sum + currentNav * userShares;
  }, 0);

  // 计算总成本
  const totalCost = watchlist.reduce((sum, fund) => {
    const userShares = fund.userShares || 0;
    const userCost = fund.userCost || 0;
    return sum + userCost * userShares;
  }, 0);

  // 计算今日盈亏
  const todayChange = watchlist.reduce((sum, fund) => {
    const userShares = fund.userShares || 0;
    const currentNav = fund.estimateNav || fund.nav || 0;
    if (!currentNav || !userShares || fund.estimateGrowth === undefined) return sum;
    const change = (fund.estimateGrowth / 100) * currentNav * userShares;
    return sum + change;
  }, 0);

  const todayChangePercent = totalAssets > 0 ? (todayChange / totalAssets) * 100 : 0;

  // 自动定时更新实时数据（每30秒）
  useEffect(() => {
    const interval = setInterval(() => {
      updateRealtimeData();
    }, 30000); // 30秒更新一次

    return () => clearInterval(interval);
  }, [updateRealtimeData]);

  // 处理持仓金额输入
  const handleAmountInput = (fundCode: string, currentAmount: number) => {
    setEditingFundCode(fundCode);
    setEditingAmount(currentAmount > 0 ? currentAmount.toString() : '');
    // 聚焦输入框
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  // 保存持仓金额
  const handleSaveAmount = async (fundCode: string) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const amount = parseFloat(editingAmount) || 0;
      await updateUserHolding(fundCode, amount);
      setEditingFundCode(null);
      setEditingAmount('');
    } finally {
      setIsSaving(false);
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingFundCode(null);
    setEditingAmount('');
  };

  const handleFundClick = (code: string) => {
    selectFund(code);
    setShowFundModal(true);
  };

  // 处理添加基金 - 先验证并显示基金信息预览
  const handleAdd = async (code?: string) => {
    const codeToAdd = code || inputCode;
    if (!/^\d{6}$/.test(codeToAdd)) {
      setAddMessage('请输入6位基金代码');
      return;
    }

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

  const handleConfirmHolding = async () => {
    if (!pendingFundCode) return;

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
        const realtimeData = await fetchFundRealtime(pendingFundCode).catch(() => null);
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

    const result = await addFund(pendingFundCode, amount, cost);
    
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
  };


  const handleAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  return (
    <div className="min-h-screen bg-void bg-scanline pt-20">
      {/* 资产概览卡片区 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 max-w-[1920px] mx-auto">
        {/* 总资产 */}
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-neon-blue/10 rounded-full blur-3xl -mr-10 -mt-10" />
          <div className="relative">
            <div className="text-text-secondary text-sm mb-1 flex items-center gap-2">
              <i className="ri-wallet-3-line" /> 总资产 (估算)
            </div>
            <div className="text-3xl font-mono font-bold text-text-primary tracking-tight">
              ¥{totalAssets.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
            </div>
            <div className="mt-2 text-xs text-text-tertiary">
              持仓 {watchlist.length} 只基金
              {totalCost > 0 && (
                <span className="ml-2">
                  · 成本 ¥{totalCost.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 今日盈亏 */}
        <div className="glass-card p-5 relative overflow-hidden">
          <div
            className={clsx(
              'absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10',
              todayChange >= 0 ? 'bg-up/10' : 'bg-down/10'
            )}
          />
          <div className="relative">
            <div className="text-text-secondary text-sm mb-1 flex items-center gap-2">
              <i className="ri-line-chart-fill" /> 今日盈亏
            </div>
            <div
              className={clsx(
                'text-3xl font-mono font-bold tracking-tight',
                todayChange >= 0 ? 'text-up' : 'text-down'
              )}
            >
              {todayChange >= 0 ? '+' : ''}¥{todayChange.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
            </div>
            <div
              className={clsx(
                'mt-2 text-xs',
                todayChange >= 0 ? 'text-up' : 'text-down'
              )}
            >
              {todayChangePercent >= 0 ? '+' : ''}
              {todayChangePercent.toFixed(2)}% {todayChange >= 0 ? '↑' : '↓'}
            </div>
          </div>
        </div>

        {/* AI 健康分 */}
        <div
          className="glass-card p-5 relative overflow-hidden cursor-pointer hover:border-neon-purple/50 transition-all group"
          onClick={() => {
            // TODO: 打开AI选择器
            console.log('打开AI诊断');
          }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-neon-purple/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-neon-purple/20 transition-colors" />
          <div className="relative">
            <div className="text-text-secondary text-sm mb-1 flex items-center gap-2">
              <i className="ri-robot-2-line text-neon-purple" /> 🤖 AI 健康分
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-mono font-bold text-neon-purple">--</span>
              <span className="text-sm text-text-tertiary mb-1">/100</span>
            </div>
            <div className="mt-2 text-xs text-text-tertiary flex items-center gap-1">
              点击开始诊断
              <i className="ri-arrow-right-line" />
            </div>
          </div>
          {/* 装饰性扫描线 */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-neon-purple to-transparent opacity-50" />
        </div>
      </div>

      {/* 自选基金列表 */}
      <div className="px-6 pb-6 max-w-[1920px] mx-auto">
        {/* 添加基金按钮 */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-text-primary">我的自选</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-neon-blue/20 text-neon-blue rounded-lg hover:bg-neon-blue/30 active:bg-neon-blue/40 active:scale-95 transition-all duration-150 flex items-center gap-2 font-medium shadow-lg hover:shadow-xl hover:shadow-neon-blue/20 active:shadow-md"
          >
            <i className="ri-add-line" />
            添加基金
          </button>
        </div>

        <div className="glass-card overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-white/5 text-xs text-text-tertiary uppercase tracking-wider">
              <tr>
                <th className="py-3 pl-6">基金名称</th>
                <th className="py-3">持有金额</th>
                <th className="py-3">今日盈亏</th>
                <th className="py-3">累计收益</th>
                <th className="py-3 text-center">AI</th>
                <th className="py-3 pr-6 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {watchlist.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-text-tertiary">
                    暂无自选基金，请前往首页添加
                  </td>
                </tr>
              ) : (
                watchlist.map((fund) => {
                  const userShares = fund.userShares || 0;
                  const userCost = fund.userCost || 0;
                  const currentNav = fund.estimateNav || fund.nav || 0;
                  const currentValue = currentNav * userShares;
                  const costValue = userCost * userShares;
                  const profit = currentValue - costValue;
                  const profitPercent = userCost > 0 ? ((currentNav - userCost) / userCost) * 100 : 0;
                  
                  // 今日盈亏：使用估算涨跌幅计算
                  const todayProfit = fund.estimateGrowth !== undefined && currentNav && userShares
                    ? (fund.estimateGrowth / 100) * currentNav * userShares
                    : 0;

                  return (
                    <tr
                      key={fund.fundCode}
                      className="group hover:bg-white/5 transition-colors"
                    >
                      <td 
                        className="py-4 pl-6 cursor-pointer hover:bg-white/5 transition-colors group/name"
                        onClick={() => handleFundClick(fund.fundCode)}
                        title="点击查看详情"
                      >
                        <div className="font-medium text-text-primary group-hover/name:text-neon-blue transition-colors flex items-center gap-2">
                          {fund.fundName}
                          <i className="ri-external-link-line text-xs opacity-0 group-hover/name:opacity-100 transition-opacity text-neon-blue" />
                        </div>
                        <div className="text-xs text-text-tertiary mt-1">
                          {fund.fundCode}
                        </div>
                      </td>
                      <td className="py-4">
                        {editingFundCode === fund.fundCode ? (
                          <div className="flex items-center gap-2">
                            <input
                              ref={inputRef}
                              type="number"
                              step="0.01"
                              min="0"
                              value={editingAmount}
                              onChange={(e) => setEditingAmount(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveAmount(fund.fundCode);
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit();
                                }
                              }}
                              onBlur={(e) => {
                                // 如果点击的是保存或取消按钮，不触发保存
                                if (e.relatedTarget === saveButtonRef.current || 
                                    e.relatedTarget?.closest('button')) {
                                  return;
                                }
                                // 延迟执行，让按钮点击事件先处理
                                setTimeout(() => {
                                  if (editingFundCode === fund.fundCode) {
                                    handleSaveAmount(fund.fundCode);
                                  }
                                }, 200);
                              }}
                              className="w-24 px-2 py-1 bg-white/10 border border-white/20 rounded text-text-primary font-mono text-sm focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                              placeholder="输入金额"
                              autoFocus
                            />
                            <button
                              ref={saveButtonRef}
                              onClick={() => handleSaveAmount(fund.fundCode)}
                              disabled={isSaving}
                              className="w-6 h-6 rounded bg-neon-blue/20 text-neon-blue hover:bg-neon-blue/30 active:bg-neon-blue/40 active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center transition-all duration-150"
                              title="保存"
                            >
                              <i className="ri-check-line text-xs" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="w-6 h-6 rounded bg-white/10 text-text-secondary hover:bg-white/20 active:bg-white/30 active:scale-90 flex items-center justify-center transition-all duration-150"
                              title="取消"
                            >
                              <i className="ri-close-line text-xs" />
                            </button>
                          </div>
                        ) : (
                          <div 
                            className="cursor-pointer hover:bg-white/5 rounded px-2 py-1 -mx-2 transition-colors group/edit"
                            onClick={() => handleAmountInput(fund.fundCode, fund.userAmount || 0)}
                            title="点击编辑持仓金额"
                          >
                            <div className="font-mono text-text-primary">
                              ¥{currentValue.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-xs text-text-tertiary flex items-center gap-1">
                              {userShares > 0 ? (
                                <>
                                  <span>{userShares.toFixed(2)} 份</span>
                                  <i className="ri-edit-line opacity-0 group-hover/edit:opacity-100 transition-opacity text-xs" />
                                </>
                              ) : (
                                <span className="text-text-tertiary/50">点击输入持仓金额</span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-4">
                        <div
                          className={clsx(
                            'font-mono',
                            todayProfit >= 0 ? 'text-up' : 'text-down'
                          )}
                        >
                          {todayProfit >= 0 ? '+' : ''}
                          ¥{todayProfit.toFixed(2)}
                        </div>
                        <div
                          className={clsx(
                            'text-xs',
                            (fund.estimateGrowth || 0) >= 0 ? 'text-up' : 'text-down'
                          )}
                        >
                          {(fund.estimateGrowth || 0) >= 0 ? '+' : ''}
                          {fund.estimateGrowth?.toFixed(2) || '0.00'}%
                        </div>
                      </td>
                      <td className="py-4">
                        <div
                          className={clsx(
                            'font-mono',
                            profit >= 0 ? 'text-up' : 'text-down'
                          )}
                        >
                          {profit >= 0 ? '+' : ''}¥{profit.toFixed(2)}
                        </div>
                        <div
                          className={clsx(
                            'text-xs',
                            profitPercent >= 0 ? 'text-up' : 'text-down'
                          )}
                        >
                          {profitPercent >= 0 ? '+' : ''}
                          {profitPercent.toFixed(2)}%
                        </div>
                      </td>
                      <td className="py-4 text-center">
                        <button
                          onClick={() => {
                            // TODO: 打开AI诊断
                            console.log('AI诊断', fund.fundCode);
                          }}
                          className="w-8 h-8 rounded-full bg-neon-purple/10 text-neon-purple hover:bg-neon-purple/20 hover:scale-110 active:bg-neon-purple/30 active:scale-95 transition-all duration-150 flex items-center justify-center mx-auto"
                          title="AI 诊断"
                        >
                          <i className="ri-robot-2-line" />
                        </button>
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
                            onClick={() => removeFund(fund.fundCode)}
                            className="w-8 h-8 rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-400 active:bg-red-500/30 active:scale-90 flex items-center justify-center transition-all duration-150"
                            title="删除"
                          >
                            <i className="ri-delete-bin-line" />
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
                  }}
                  onKeyDown={handleAddKeyDown}
                  placeholder="请输入6位基金代码"
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                  autoFocus
                  disabled={isValidating}
                />
              </div>

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

      {/* 设置持仓金额弹窗 */}
      {showHoldingModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="glass-card p-6 w-full max-w-md animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-primary">设置持仓金额</h3>
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
                className="text-text-tertiary hover:text-text-primary active:text-neon-red active:scale-90 transition-all duration-150 rounded-lg hover:bg-white/5 active:bg-white/10 p-1"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>

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
