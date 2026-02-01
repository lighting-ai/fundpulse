import React, { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { useFundStore } from '../store/fundStore';
import { FundModal } from './FundModal';

export function PortfolioPage() {
  const { watchlist, selectedFundCode, selectFund, removeFund, updateUserHolding, updateRealtimeData } = useFundStore();
  const [showFundModal, setShowFundModal] = useState(false);
  const [editingFundCode, setEditingFundCode] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

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

  // 计算累计收益
  const totalProfit = totalAssets - totalCost;
  const totalProfitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

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
                      <td className="py-4 pl-6">
                        <div className="font-medium text-text-primary">{fund.fundName}</div>
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
                              className="w-6 h-6 rounded bg-neon-blue/20 text-neon-blue hover:bg-neon-blue/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                              title="保存"
                            >
                              <i className="ri-check-line text-xs" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="w-6 h-6 rounded bg-white/10 text-text-secondary hover:bg-white/20 flex items-center justify-center transition-colors"
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
                          className="w-8 h-8 rounded-full bg-neon-purple/10 text-neon-purple hover:bg-neon-purple/20 hover:scale-110 transition-all flex items-center justify-center mx-auto"
                          title="AI 诊断"
                        >
                          <i className="ri-robot-2-line" />
                        </button>
                      </td>
                      <td className="py-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleFundClick(fund.fundCode)}
                            className="w-8 h-8 rounded-full bg-white/5 hover:bg-neon-blue/20 hover:text-neon-blue flex items-center justify-center transition-colors"
                            title="详情"
                          >
                            <i className="ri-bar-chart-box-line" />
                          </button>
                          <button
                            onClick={() => removeFund(fund.fundCode)}
                            className="w-8 h-8 rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition-colors"
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
