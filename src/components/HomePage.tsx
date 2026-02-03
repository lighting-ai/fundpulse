import { useState } from 'react';
import clsx from 'clsx';
import { useFundStore } from '../store/fundStore';
import { useAppStore } from '../store/appStore';
import { IndexSection } from './IndexSection';
import { SectorBoard } from './SectorBoard';
import { FundModal } from './FundModal';
import { FundRankingSection } from './FundRankingSection';
import { searchFunds, FundSearchResult, fetchFundRealtime } from '../api/eastmoney';

export function HomePage() {
  const { selectedFundCode, selectFund, addFund } = useFundStore();
  const { setCurrentView } = useAppStore();
  const [showFundModal, setShowFundModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<FundSearchResult[]>([]);
  const [searchError, setSearchError] = useState('');
  
  // 添加基金相关状态
  const [showFundPreview, setShowFundPreview] = useState(false);
  const [showHoldingModal, setShowHoldingModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addMessage, setAddMessage] = useState('');
  const [pendingFundCode, setPendingFundCode] = useState<string>('');
  const [pendingFundInfo, setPendingFundInfo] = useState<{ code: string; name: string; nav: number; estimateNav?: number } | null>(null);
  const [holdingAmount, setHoldingAmount] = useState<string>('');
  const [holdingCost, setHoldingCost] = useState<string>('');
  const [holdingShares, setHoldingShares] = useState<string>('');
  const [inputMode, setInputMode] = useState<'amount' | 'shares'>('amount');

  const handleFundClick = (code: string) => {
    selectFund(code);
    setShowFundModal(true);
  };

  const handleSearch = async () => {
    const keyword = searchQuery.trim();
    if (!keyword) {
      setSearchError('请输入基金代码或名称');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    setSearchResults([]);

    try {
      const results = await searchFunds(keyword);
      if (results.length > 0) {
        setSearchResults(results);
      } else {
        setSearchError('未找到匹配的基金');
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : '搜索失败，请重试');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchResultClick = (result: FundSearchResult) => {
    handleFundClick(result.code);
    setSearchQuery('');
    setSearchResults([]);
  };

  // 处理快捷添加自选
  const handleQuickAdd = async (result: FundSearchResult) => {
    const codeToAdd = result.code;
    setIsValidating(true);
    setAddMessage('');
    setSearchResults([]);
    
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
      } catch {
        // 如果获取实时数据失败，仍然显示预览（只有名称）
        setPendingFundCode(codeToAdd);
        setPendingFundInfo({
          code: codeToAdd,
          name: result.name,
          nav: result.nav || 0,
        });
        setShowFundPreview(true);
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
        setSearchQuery('');
        setSearchResults([]);
        setAddMessage('已添加成功，可切换到自选页面查看');
        setTimeout(() => {
          setShowFundPreview(false);
          setPendingFundCode('');
          setPendingFundInfo(null);
          setAddMessage('');
        }, 2000);
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

  // 关闭持仓弹窗
  const handleCloseHoldingModal = () => {
    setShowHoldingModal(false);
    setHoldingAmount('');
    setHoldingCost('');
    setHoldingShares('');
    setInputMode('amount');
    setAddMessage('');
    // 返回到预览弹窗
    if (pendingFundInfo) {
      setShowFundPreview(true);
    }
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

    // 添加基金
    const result = await addFund(pendingFundCode, amount, cost);
    
    if (result.success) {
      setSearchQuery('');
      setSearchResults([]);
      setAddMessage('已添加成功，可切换到自选页面查看');
      setTimeout(() => {
        setHoldingAmount('');
        setHoldingCost('');
        setHoldingShares('');
        setPendingFundCode('');
        setPendingFundInfo(null);
        setShowHoldingModal(false);
        setShowFundPreview(false);
        setAddMessage('');
        setInputMode('amount');
      }, 2000);
    } else {
      setAddMessage(result.message);
    }
    
    setIsAdding(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen bg-void bg-scanline pt-20">
      {/* Hero Section */}
      <div className="relative h-[30vh] sm:h-[35vh] md:h-[40vh] flex flex-col items-center justify-center px-4">
        {/* 背景光晕 */}
        <div className="absolute inset-0 bg-gradient-to-b from-neon-red/10 via-transparent to-transparent blur-3xl" />

        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-neon-red/80 relative z-10">
          FundPulse <span className="text-neon-red">2.0.1</span>
        </h1>
        <p className="mt-2 sm:mt-3 md:mt-4 text-sm sm:text-base md:text-lg lg:text-xl text-text-secondary font-light tracking-wide relative z-10">
          实时透视 · 智能洞察 · 穿透持仓
        </p>

        {/* 全局搜索框 */}
        <div className="mt-4 sm:mt-6 md:mt-8 w-full max-w-md relative z-10">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchError('');
                setSearchResults([]);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="输入基金代码或名称搜索..."
              className="w-full px-4 py-3 pl-12 pr-24 bg-white/5 border border-white/10 rounded-full text-text-primary placeholder-text-tertiary focus:outline-none focus:border-neon-blue focus:ring-2 focus:ring-neon-blue/20 transition-all"
            />
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className={clsx(
                'absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150',
                isSearching || !searchQuery.trim()
                  ? 'bg-white/5 text-text-tertiary cursor-not-allowed disabled:active:scale-100'
                  : 'bg-neon-blue/20 text-neon-blue hover:bg-neon-blue/30 active:bg-neon-blue/40 active:scale-95 shadow-lg hover:shadow-xl hover:shadow-neon-blue/20 active:shadow-md'
              )}
            >
              {isSearching ? '搜索中...' : '搜索'}
            </button>
          </div>
          
          {/* 搜索结果 */}
          {searchResults.length > 0 && (
            <div className="mt-3 glass-card max-h-60 overflow-y-auto">
              {searchResults.map((result) => (
                <div
                  key={result.code}
                  className="p-3 hover:bg-white/5 transition-all border-b border-white/5 last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => handleSearchResultClick(result)}
                    >
                      <div className="font-medium text-text-primary truncate">{result.name}</div>
                      <div className="text-xs text-text-tertiary mt-1 flex items-center gap-2">
                        <span>代码: {result.code}</span>
                        {result.fundType && <span className="text-text-quaternary">·</span>}
                        {result.fundType && <span>{result.fundType}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickAdd(result);
                        }}
                        className="px-2 py-1 text-xs bg-neon-blue/20 text-neon-blue rounded hover:bg-neon-blue/30 active:bg-neon-blue/40 active:scale-95 transition-all duration-150 flex items-center gap-1"
                        title="添加到自选"
                      >
                        <i className="ri-add-line" />
                        <span className="hidden sm:inline">自选</span>
                      </button>
                      <button
                        onClick={() => handleSearchResultClick(result)}
                        className="p-1 text-neon-blue hover:bg-white/5 rounded transition-all"
                        title="查看详情"
                      >
                        <i className="ri-arrow-right-line text-lg" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 错误提示 */}
          {searchError && (
            <div className="mt-3 text-sm text-red-400 animate-in fade-in slide-in-from-top-2">
              {searchError}
            </div>
          )}
        </div>

        {/* 只在没有搜索关键词和搜索结果时显示"开始体验"按钮 */}
        {!searchQuery.trim() && searchResults.length === 0 && !isSearching && (
          <button
            onClick={() => setCurrentView('portfolio')}
            className="mt-6 px-8 py-3 bg-neon-red/10 border border-neon-red/50 rounded-full text-neon-red hover:bg-neon-red/20 hover:shadow-[0_0_30px_rgba(255,45,85,0.4)] active:bg-neon-red/30 active:scale-95 active:shadow-[0_0_20px_rgba(255,45,85,0.3)] transition-all duration-150 relative z-10 font-medium"
          >
            开始体验 →
          </button>
        )}
      </div>

      {/* v2.0.1 布局：指数条 + 双列（板块+基金） */}
      <div className="max-w-[1400px] mx-auto px-2 sm:px-3 md:px-4 lg:px-6 py-2 sm:py-3 md:py-4 space-y-2 sm:space-y-3 md:space-y-4">
        {/* 1. 指数条（非全宽，与下方同宽） */}
        <IndexSection />

        {/* 2. 双列内容区（板块 + 基金） */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[360px_1fr] gap-2 sm:gap-3 md:gap-4">
          {/* 左列：热门板块榜 */}
          <section className="glass-card p-2 sm:p-3 md:p-4 h-[400px] sm:h-[500px] md:h-[550px] lg:h-[600px] overflow-hidden flex flex-col">
            <SectorBoard />
          </section>

          {/* 右列：热门基金排行榜 */}
          <section className="glass-card p-2 sm:p-3 md:p-4 h-[400px] sm:h-[500px] md:h-[550px] lg:h-[600px] overflow-hidden flex flex-col">
            <FundRankingSection onFundClick={handleFundClick} />
          </section>
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
