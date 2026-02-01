import React, { useState } from 'react';
import { useFundStore } from '../store/fundStore';
import { useAppStore } from '../store/appStore';
import { IndexBar } from './IndexBar';
import { FundModal } from './FundModal';
import { FundRankingSection } from './FundRankingSection';

export function HomePage() {
  const { selectedFundCode, selectFund } = useFundStore();
  const { setCurrentView } = useAppStore();
  const [showFundModal, setShowFundModal] = useState(false);

  const handleFundClick = (code: string) => {
    selectFund(code);
    setShowFundModal(true);
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

        <button
          onClick={() => setCurrentView('portfolio')}
          className="mt-8 px-8 py-3 bg-neon-red/10 border border-neon-red/50 rounded-full text-neon-red hover:bg-neon-red/20 hover:shadow-[0_0_30px_rgba(255,45,85,0.4)] transition-all relative z-10"
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
