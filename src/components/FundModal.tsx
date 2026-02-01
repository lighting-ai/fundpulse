import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { useDetailStore } from '../store/detailStore';
import { useFundStore } from '../store/fundStore';
import { NavChart } from './NavChart';
import { TopHoldings } from './TopHoldings';
import { fetchFundRealtime } from '../api/eastmoney';

interface FundModalProps {
  isOpen: boolean;
  onClose: () => void;
  fundCode: string;
}

type TabId = 'overview' | 'chart' | 'holdings' | 'ai';

export function FundModal({ isOpen, onClose, fundCode }: FundModalProps) {
  const { fundDetail, loadFundDetail, loadNavHistory } = useDetailStore();
  const { watchlist } = useFundStore();
  const [activeTab, setActiveTab] = useState<TabId>('chart');
  const [realtimeFundName, setRealtimeFundName] = useState<string>('');

  const fund = watchlist.find(f => f.fundCode === fundCode);
  
  // 优先使用 fundDetail 中的基金名称，其次使用实时数据中的，再使用 fund 中的，最后使用基金代码
  const displayFundName = fundDetail?.fundName || realtimeFundName || fund?.fundName || fundCode;

  useEffect(() => {
    if (isOpen && fundCode) {
      // 只在弹窗打开或基金代码变化时加载，避免重复加载
      loadFundDetail(fundCode);
      loadNavHistory(fundCode);
      
      // 如果 fundDetail 中没有基金名称，尝试从实时数据接口获取
      const fetchName = async () => {
        try {
          const realtimeData = await fetchFundRealtime(fundCode);
          if (realtimeData.name) {
            setRealtimeFundName(realtimeData.name);
          }
        } catch (error) {
          console.warn('从实时数据获取基金名称失败:', error);
        }
      };
      
      // 延迟一下，等待 fundDetail 加载完成
      const timer = setTimeout(() => {
        // 检查当前的 fundDetail，而不是依赖项中的
        const currentDetail = useDetailStore.getState().fundDetail;
        if (!currentDetail?.fundName) {
          fetchName();
        }
      }, 2000);
      
      return () => {
        clearTimeout(timer);
      };
    }
  }, [isOpen, fundCode, loadFundDetail, loadNavHistory]); // 移除 fundDetail 依赖，避免循环触发

  if (!isOpen) return null;

  const tabs = [
    { id: 'chart' as TabId, label: '净值走势', icon: 'ri-line-chart-line' },
    { id: 'holdings' as TabId, label: '重仓股票', icon: 'ri-stack-line' },
    { id: 'overview' as TabId, label: '基金概况', icon: 'ri-file-list-line' },
    { id: 'ai' as TabId, label: '🤖 AI 诊断', icon: 'ri-robot-2-line', highlight: true },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl h-[80vh] glass-card overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div>
            <h2 className="text-xl font-display font-bold text-text-primary">
              {displayFundName}
            </h2>
            <div className="flex items-center gap-3 mt-1 text-sm text-text-secondary">
              <span>{fundCode}</span>
              {fundDetail && (
                <>
                  <span className="w-1 h-1 rounded-full bg-text-tertiary" />
                  <span>{fundDetail.manager}</span>
                  {fundDetail.company && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-text-tertiary" />
                      <span>{fundDetail.company}</span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <i className="ri-close-line text-xl" />
          </button>
        </header>

        {/* Tab Navigation */}
        <nav className="flex items-center gap-1 px-6 border-b border-white/10 bg-black/20">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-all relative',
                activeTab === tab.id
                  ? tab.highlight
                    ? 'border-neon-purple text-neon-purple shadow-[0_2px_15px_rgba(191,90,242,0.3)]'
                    : 'border-neon-red text-neon-red'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              )}
            >
              <i className={tab.icon} />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-scanline">
          {activeTab === 'overview' && (
            <FundOverview fundCode={fundCode} fundDetail={fundDetail} fund={fund} />
          )}
          {activeTab === 'chart' && <NavChart />}
          {activeTab === 'holdings' && <TopHoldings />}
          {activeTab === 'ai' && <AIDiagnosis fundCode={fundCode} />}
        </div>
      </div>
    </div>
  );
}

// 基金概况组件
function FundOverview({ fundCode, fundDetail, fund }: any) {
  const { isLoading } = useDetailStore();

  // 加载中状态 - 显示骨架屏
  if (isLoading && !fundDetail) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-4">
              <div className="h-4 w-20 bg-white/10 rounded mb-3" />
              <div className="h-8 w-32 bg-white/10 rounded" />
            </div>
          ))}
        </div>
        <div className="text-center text-text-tertiary text-sm">
          <i className="ri-loader-4-line animate-spin inline-block mr-2" />
          正在加载基金概况...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 transition-opacity duration-300">
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <div className="text-text-secondary text-sm mb-2">最新净值</div>
          <div className="text-2xl font-mono font-bold text-text-primary">
            {fund?.nav?.toFixed(4) || '--'}
          </div>
          {fund?.estimateGrowth !== undefined && (
            <div
              className={clsx(
                'text-sm mt-2 font-mono',
                fund.estimateGrowth >= 0 ? 'text-up' : 'text-down'
              )}
            >
              {fund.estimateGrowth >= 0 ? '+' : ''}
              {fund.estimateGrowth.toFixed(2)}%
            </div>
          )}
        </div>

        {fundDetail ? (
          <>
            <div className="glass-card p-4">
              <div className="text-text-secondary text-sm mb-2">基金经理</div>
              <div className="text-lg font-medium text-text-primary">
                {fundDetail.manager || '--'}
              </div>
            </div>

            <div className="glass-card p-4">
              <div className="text-text-secondary text-sm mb-2">管理公司</div>
              <div className="text-lg font-medium text-text-primary">
                {fundDetail.company || '--'}
              </div>
            </div>

            <div className="glass-card p-4">
              <div className="text-text-secondary text-sm mb-2">成立日期</div>
              <div className="text-lg font-medium text-text-primary">
                {fundDetail.inceptionDate || '--'}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="glass-card p-4 opacity-50">
              <div className="text-text-secondary text-sm mb-2">基金经理</div>
              <div className="text-lg font-medium text-text-primary">--</div>
            </div>
            <div className="glass-card p-4 opacity-50">
              <div className="text-text-secondary text-sm mb-2">管理公司</div>
              <div className="text-lg font-medium text-text-primary">--</div>
            </div>
            <div className="glass-card p-4 opacity-50">
              <div className="text-text-secondary text-sm mb-2">成立日期</div>
              <div className="text-lg font-medium text-text-primary">--</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// AI诊断组件（占位符，后续实现）
function AIDiagnosis({ fundCode }: { fundCode: string }) {
  return (
    <div className="glass-card p-8 text-center">
      <i className="ri-robot-2-line text-5xl text-neon-purple mb-4 block" />
      <div className="text-text-secondary text-lg mb-2">AI 诊断功能</div>
      <div className="text-sm text-text-tertiary">
        此功能正在开发中，敬请期待
      </div>
    </div>
  );
}
