import { useState } from 'react';
import clsx from 'clsx';
import { useFundStore } from '../store/fundStore';
import { useAppStore } from '../store/appStore';
import { IndexBar } from './IndexBar';
import { FundModal } from './FundModal';
import { FundRankingSection } from './FundRankingSection';
import { validateFundCode } from '../api/eastmoney';

export function HomePage() {
  const { selectedFundCode, selectFund } = useFundStore();
  const { setCurrentView } = useAppStore();
  const [showFundModal, setShowFundModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{ code: string; name: string } | null>(null);
  const [searchError, setSearchError] = useState('');

  const handleFundClick = (code: string) => {
    selectFund(code);
    setShowFundModal(true);
  };

  const handleSearch = async () => {
    const code = searchQuery.trim();
    if (!code) {
      setSearchError('请输入基金代码');
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      setSearchError('基金代码应为6位数字');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    setSearchResult(null);

    try {
      const validation = await validateFundCode(code);
      if (validation.valid && validation.name) {
        setSearchResult({ code, name: validation.name });
      } else {
        setSearchError('基金代码不存在或无法访问');
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : '搜索失败，请重试');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchResultClick = () => {
    if (searchResult) {
      handleFundClick(searchResult.code);
      setSearchQuery('');
      setSearchResult(null);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen bg-void bg-scanline pt-20">
      {/* Hero Section */}
      <div className="relative h-[40vh] flex flex-col items-center justify-center">
        {/* 背景光晕 */}
        <div className="absolute inset-0 bg-gradient-to-b from-neon-red/10 via-transparent to-transparent blur-3xl" />

        <h1 className="text-6xl font-display font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-neon-red/80 relative z-10">
          FundPulse <span className="text-neon-red">2.0</span>
        </h1>
        <p className="mt-4 text-xl text-text-secondary font-light tracking-wide relative z-10">
          实时透视 · 智能洞察 · 穿透持仓
        </p>

        {/* 全局搜索框 */}
        <div className="mt-8 w-full max-w-md relative z-10">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchError('');
                setSearchResult(null);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="输入6位基金代码搜索..."
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
          {searchResult && (
            <div className="mt-3 glass-card p-4 cursor-pointer hover:border-neon-blue/50 transition-all animate-in fade-in slide-in-from-top-2"
              onClick={handleSearchResultClick}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-text-primary">{searchResult.name}</div>
                  <div className="text-sm text-text-tertiary mt-1">基金代码: {searchResult.code}</div>
                </div>
                <i className="ri-arrow-right-line text-neon-blue text-xl" />
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {searchError && (
            <div className="mt-3 text-sm text-red-400 animate-in fade-in slide-in-from-top-2">
              {searchError}
            </div>
          )}
        </div>

        <button
          onClick={() => setCurrentView('portfolio')}
          className="mt-6 px-8 py-3 bg-neon-red/10 border border-neon-red/50 rounded-full text-neon-red hover:bg-neon-red/20 hover:shadow-[0_0_30px_rgba(255,45,85,0.4)] active:bg-neon-red/30 active:scale-95 active:shadow-[0_0_20px_rgba(255,45,85,0.3)] transition-all duration-150 relative z-10 font-medium"
        >
          开始体验 →
        </button>
      </div>

      {/* 双列市场概览 */}
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 p-6 max-w-[1920px] mx-auto">
        {/* 左列：全球指数流 */}
        <section className="glass-card p-4 h-[800px] overflow-hidden flex flex-col">
          <header className="flex items-center gap-2 mb-4 text-text-secondary flex-shrink-0">
            <i className="ri-globe-line text-neon-blue text-2xl" />
            <h3 className="font-display font-semibold text-xl">全球指数流</h3>
            <span className="ml-auto flex items-center gap-2 text-xs">
              <span className="live-dot" /> 实时
            </span>
          </header>

          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <IndexBar />
          </div>
        </section>

        {/* 右列：热门基金排行榜 */}
        <section className="glass-card p-4 h-[800px] overflow-hidden flex flex-col">
          <FundRankingSection onFundClick={handleFundClick} />
        </section>
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
