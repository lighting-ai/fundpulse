import { useState } from 'react';
import clsx from 'clsx';
import { useFundStore } from '../store/fundStore';
import { FundCard } from './FundCard';
import { HOT_FUNDS } from '../constants/hotFunds';
import { validateFundCode } from '../api/eastmoney';

export function FundList() {
  const { watchlist, addFund } = useFundStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHoldingModal, setShowHoldingModal] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addMessage, setAddMessage] = useState('');
  const [pendingFundCode, setPendingFundCode] = useState<string>('');
  const [holdingAmount, setHoldingAmount] = useState<string>('');
  const [holdingCost, setHoldingCost] = useState<string>('');

  const handleAdd = async (code?: string, skipHoldingModal = false) => {
    const codeToAdd = code || inputCode;
    if (!/^\d{6}$/.test(codeToAdd)) {
      setAddMessage('请输入6位基金代码');
      return;
    }

    // 如果跳过持仓弹窗，直接添加
    if (skipHoldingModal) {
      setIsAdding(true);
      setAddMessage('');
      
      try {
        const result = await addFund(codeToAdd);
        
        if (result.success) {
          setInputCode('');
          setAddMessage('');
          setShowAddModal(false);
        } else {
          setAddMessage(result.message);
        }
      } catch (error) {
        setAddMessage(error instanceof Error ? error.message : '添加失败，请重试');
      } finally {
        setIsAdding(false);
      }
      return;
    }

    // 先验证基金代码，然后显示持仓输入弹窗
    setIsAdding(true);
    setAddMessage('');
    
    try {
      // 验证基金代码有效性
      const validation = await validateFundCode(codeToAdd);
      
      if (!validation.valid) {
        setAddMessage('基金代码不存在或无法访问');
        setIsAdding(false);
        return;
      }

      // 尝试获取当前净值
      try {
        const { fetchFundRealtime } = await import('../api/eastmoney');
        const realtimeData = await fetchFundRealtime(codeToAdd);
        const currentNav = realtimeData.nav || realtimeData.estimateNav || 0;
        if (currentNav > 0) {
          setHoldingCost(currentNav.toFixed(4));
        }
      } catch (e) {
        // 获取净值失败不影响添加流程
        console.warn('获取当前净值失败:', e);
      }

      // 验证通过，显示持仓输入弹窗
      setPendingFundCode(codeToAdd);
      setShowAddModal(false);
      setShowHoldingModal(true);
      setIsAdding(false);
    } catch (error) {
      setAddMessage(error instanceof Error ? error.message : '验证失败，请重试');
      setIsAdding(false);
    }
  };

  const handleConfirmHolding = async () => {
    const amount = parseFloat(holdingAmount) || 0;
    const cost = parseFloat(holdingCost) || undefined;

    setIsAdding(true);
    setAddMessage('');
    
    try {
      const result = await addFund(pendingFundCode, amount, cost);
      
      if (result.success) {
        setHoldingAmount('');
        setHoldingCost('');
        setPendingFundCode('');
        setShowHoldingModal(false);
        setAddMessage('');
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
    setIsAdding(true);
    setAddMessage('');
    
    try {
      const result = await addFund(pendingFundCode);
      
      if (result.success) {
        setHoldingAmount('');
        setHoldingCost('');
        setPendingFundCode('');
        setShowHoldingModal(false);
        setAddMessage('');
      } else {
        setAddMessage(result.message);
      }
    } catch (error) {
      setAddMessage(error instanceof Error ? error.message : '添加失败，请重试');
    } finally {
      setIsAdding(false);
    }
  };

  if (watchlist.length === 0) {
    return (
      <>
        <div className="glass-card p-12 text-center mb-6">
          <i className="ri-inbox-2-line text-5xl text-text-muted mb-4 block" />
          <div className="text-text-secondary mb-6">暂无自选基金</div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-2 bg-accent-blue hover:bg-accent-blue/80 text-white rounded-lg transition-colors"
          >
            <i className="ri-add-circle-line mr-2" />
            添加第一个基金
          </button>
        </div>

        {/* 热门基金推荐 */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <i className="ri-fire-line text-xl text-up-primary" />
            <h3 className="text-lg font-semibold">热门基金推荐</h3>
          </div>
          <div className="space-y-2">
            {HOT_FUNDS.slice(0, 5).map((fund) => (
              <button
                key={fund.code}
                onClick={() => handleAdd(fund.code)}
                className="w-full glass-card p-3 text-left hover:border-accent-blue transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-text-primary">
                      {fund.name}
                    </div>
                    <div className="text-xs text-text-tertiary font-mono">
                      {fund.code}
                    </div>
                  </div>
                  <i className="ri-add-circle-line text-accent-cyan" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 添加基金弹窗 */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-card p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">添加自选基金</h3>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setInputCode('');
                    setAddMessage('');
                  }}
                  className="text-text-secondary hover:text-text-primary"
                >
                  <i className="ri-close-line text-xl" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-2">
                    基金代码（6位数字）
                  </label>
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => {
                      setInputCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                      setAddMessage('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAdd();
                      }
                    }}
                    placeholder="例如：000001"
                    className="w-full px-4 py-2 bg-bg-elevated border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:border-accent-blue"
                    autoFocus
                  />
                </div>

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
                    onClick={() => {
                      setShowAddModal(false);
                      setInputCode('');
                      setAddMessage('');
                    }}
                    className="flex-1 px-4 py-2 border border-border-subtle rounded-lg hover:bg-bg-elevated transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleAdd()}
                    disabled={isAdding || inputCode.length !== 6}
                    className="flex-1 px-4 py-2 bg-accent-blue hover:bg-accent-blue/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    {isAdding ? '添加中...' : '添加'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {watchlist.map((fund) => (
          <FundCard key={fund.fundCode} fund={fund} />
        ))}
      </div>

      <button
        onClick={() => setShowAddModal(true)}
        className="w-full mt-4 glass-card p-4 flex items-center justify-center gap-2 text-accent-cyan hover:border-accent-cyan transition-colors"
      >
        <i className="ri-add-circle-line text-xl" />
        <span>添加基金</span>
      </button>

      {/* 添加基金弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">添加自选基金</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setInputCode('');
                  setAddMessage('');
                }}
                className="text-text-secondary hover:text-text-primary"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  基金代码（6位数字）
                </label>
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setAddMessage('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAdd();
                    }
                  }}
                  placeholder="例如：000001"
                  className="w-full px-4 py-2 bg-bg-elevated border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:border-accent-blue"
                  autoFocus
                />
              </div>

              {/* 热门基金快捷添加 */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  热门基金
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {HOT_FUNDS.slice(0, 4).map((fund) => (
                    <button
                      key={fund.code}
                      onClick={() => handleAdd(fund.code)}
                      disabled={isAdding}
                      className="p-2 text-xs glass-card hover:border-accent-blue transition-colors disabled:opacity-50"
                    >
                      <div className="font-semibold text-text-primary truncate">
                        {fund.name}
                      </div>
                      <div className="text-text-tertiary font-mono">
                        {fund.code}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

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
                  onClick={() => {
                    setShowAddModal(false);
                    setInputCode('');
                    setAddMessage('');
                  }}
                  className="flex-1 px-4 py-2 border border-border-subtle rounded-lg hover:bg-bg-elevated transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => handleAdd()}
                  disabled={isAdding || inputCode.length !== 6}
                  className="flex-1 px-4 py-2 bg-accent-blue hover:bg-accent-blue/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {isAdding ? '添加中...' : '添加'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 持仓金额输入弹窗 */}
      {showHoldingModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">设置持仓金额</h3>
              <button
                onClick={() => {
                  setShowHoldingModal(false);
                  setHoldingAmount('');
                  setHoldingCost('');
                  setPendingFundCode('');
                }}
                className="text-text-secondary hover:text-text-primary"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="text-xs text-text-tertiary mb-1">基金代码</div>
                <div className="text-sm font-mono text-text-primary">{pendingFundCode}</div>
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
                    留空将使用当前净值作为成本价
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
                  className="flex-1 px-4 py-2 border border-border-subtle rounded-lg hover:bg-bg-elevated transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  跳过
                </button>
                <button
                  onClick={handleConfirmHolding}
                  disabled={isAdding}
                  className="flex-1 px-4 py-2 bg-accent-blue hover:bg-accent-blue/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {isAdding ? '添加中...' : '确认添加'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
