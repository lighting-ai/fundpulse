import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { useDetailStore } from '../store/detailStore';
import { useFundStore } from '../store/fundStore';
import { NavChart } from './NavChart';
import { TopHoldings } from './TopHoldings';
import { NavHistoryList } from './NavHistoryList';
import { fetchFundRealtime } from '../api/eastmoney';
import { mergeFundData } from '../utils/fundDataManager';

interface FundModalProps {
  isOpen: boolean;
  onClose: () => void;
  fundCode: string;
}

type TabId = 'overview' | 'chart' | 'history' | 'holdings' | 'ai';

export function FundModal({ isOpen, onClose, fundCode }: FundModalProps) {
  const { fundDetail, overviewData, loadFundDetail, loadNavHistory, loadOverviewData } = useDetailStore();
  const { watchlist } = useFundStore();
  const [activeTab, setActiveTab] = useState<TabId>('chart');
  const [realtimeFundName, setRealtimeFundName] = useState<string>('');
  const [fundDisplayData, setFundDisplayData] = useState<Awaited<ReturnType<typeof mergeFundData>> | null>(null);

  const fund = watchlist.find(f => f.fundCode === fundCode);
  
  // 优先使用 fundDetail 中的基金名称，其次使用实时数据中的，再使用 fund 中的，最后使用基金代码
  const displayFundName = fundDetail?.fundName || realtimeFundName || fund?.fundName || fundCode;

  useEffect(() => {
    if (isOpen && fundCode) {
      // 只在弹窗打开或基金代码变化时加载，避免重复加载
      loadFundDetail(fundCode);
      loadNavHistory(fundCode);
      
      // 如果切换到概况标签，加载概况数据
      if (activeTab === 'overview') {
        loadOverviewData(fundCode);
      }
      
      // 获取基金显示数据（使用 FundDataManager）
      const fetchDisplayData = async () => {
        try {
          // 从 watchlist 中获取基金类型信息
          const fundInfo = watchlist.find(f => f.fundCode === fundCode);
          const displayData = await mergeFundData(
            fundCode,
            undefined,
            fundInfo?.fundType,
            fundInfo?.ftype,
            fundInfo?.fundName
          );
          // 只有成功获取到数据时才更新，失败时保留旧数据
          if (displayData) {
            setFundDisplayData(displayData);
            
            // 如果实时数据中有基金名称，也保存
            if (displayData.isRealtime) {
              try {
                const realtimeData = await fetchFundRealtime(fundCode);
                if (realtimeData.name) {
                  setRealtimeFundName(realtimeData.name);
                }
              } catch (error) {
                // ignore
              }
            }
          }
        } catch (error) {
          console.warn('获取基金显示数据失败:', error);
          // 失败时保留旧数据，不清零
        }
      };
      
      // 延迟一下，等待 fundDetail 加载完成
      const timer = setTimeout(() => {
        fetchDisplayData();
      }, 500);
      
      return () => {
        clearTimeout(timer);
      };
    }
  }, [isOpen, fundCode, activeTab, watchlist, loadFundDetail, loadNavHistory, loadOverviewData]); // 移除 fundDetail 依赖，避免循环触发

  // 当切换到概况标签时，加载概况数据
  useEffect(() => {
    if (isOpen && fundCode && activeTab === 'overview' && !overviewData) {
      loadOverviewData(fundCode);
    }
  }, [isOpen, fundCode, activeTab, overviewData, loadOverviewData]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'chart' as TabId, label: '净值走势', icon: 'ri-line-chart-line' },
    { id: 'history' as TabId, label: '历史净值', icon: 'ri-history-line' },
    { id: 'holdings' as TabId, label: '重仓股票', icon: 'ri-stack-line' },
    { id: 'overview' as TabId, label: '基金概况', icon: 'ri-file-list-line' },
    { id: 'ai' as TabId, label: '🤖 AI 诊断', icon: 'ri-robot-2-line', highlight: true },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full h-[calc(100vh-3.5rem)] sm:h-[80vh] sm:max-w-4xl sm:rounded-xl glass-card overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 mt-[3.75rem] sm:mt-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-white/5 relative">
          <div className="flex-1 min-w-0 pr-2">
            <h2 
              className="text-base sm:text-lg md:text-xl font-display font-bold text-text-primary truncate"
              title={displayFundName}
            >
              {displayFundName}
            </h2>
            <div className="flex items-center gap-1.5 sm:gap-3 mt-1 text-xs sm:text-sm text-text-secondary flex-wrap">
              <span className="font-mono">{fundCode}</span>
              {fundDetail && (
                <>
                  <span className="w-1 h-1 rounded-full bg-text-tertiary shrink-0" />
                  <span className="truncate">{fundDetail.manager}</span>
                  {fundDetail.company && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-text-tertiary shrink-0" />
                      <span className="truncate">{fundDetail.company}</span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-8 sm:h-8 rounded-full hover:bg-white/10 active:bg-white/20 active:scale-90 flex items-center justify-center transition-all duration-150 shrink-0"
            title="关闭"
          >
            <i className="ri-close-line text-xl text-text-primary" />
          </button>
        </header>

        {/* Tab Navigation */}
        <nav className="flex items-center gap-0.5 sm:gap-1 px-2 sm:px-6 border-b border-white/10 bg-black/20 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-[11px] sm:text-sm font-medium flex items-center gap-1 sm:gap-2 border-b-2 transition-all duration-150 relative whitespace-nowrap shrink-0',
                'active:scale-95',
                activeTab === tab.id
                  ? tab.highlight
                    ? 'border-neon-purple text-neon-purple shadow-[0_2px_15px_rgba(191,90,242,0.3)] active:shadow-[0_2px_10px_rgba(191,90,242,0.2)]'
                    : 'border-neon-red text-neon-red active:border-neon-red/80'
                  : 'border-transparent text-text-secondary hover:text-text-primary active:bg-white/5'
              )}
            >
              <i className={clsx('text-xs sm:text-base', tab.icon)} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-scanline">
          {activeTab === 'overview' && (
            <FundOverview displayData={fundDisplayData} overviewData={overviewData} />
          )}
          {activeTab === 'chart' && <NavChart />}
          {activeTab === 'history' && <NavHistoryList fundCode={fundCode} />}
          {activeTab === 'holdings' && <TopHoldings />}
          {activeTab === 'ai' && <AIDiagnosis />}
        </div>
      </div>
    </div>
  );
}

// 基金概况组件
function FundOverview({ displayData, overviewData }: { fund?: any; displayData: Awaited<ReturnType<typeof mergeFundData>> | null; overviewData: any }) {
  const { isLoading } = useDetailStore();

  // 使用 FundDataManager 的数据
  const navValue = displayData?.netValue;
  const estimateGrowth = displayData?.changePercent;

  // 加载中状态 - 显示骨架屏
  if (isLoading && !overviewData) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

  const manager = overviewData?.currentFundManager?.[0];
  const performance = overviewData?.performanceEvaluation;
  const holderStructure = overviewData?.holderStructure;
  const assetAllocation = overviewData?.assetAllocation;

  return (
    <div className="space-y-4 sm:space-y-6 transition-opacity duration-300">
      {/* 现任基金经理 */}
      {manager ? (
        <div className="glass-card p-4 sm:p-6 border border-purple-500/20">
          <div className="flex items-start gap-3 sm:gap-4">
            {manager.pic && (
              <img
                src={manager.pic}
                alt={manager.name}
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-purple-500/30 object-cover shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base sm:text-lg font-bold text-text-primary">{manager.name}</h3>
                {manager.star > 0 && (
                  <div className="flex items-center gap-0.5">
                    {[...Array(manager.star)].map((_, i) => (
                      <i key={i} className="ri-star-fill text-yellow-400 text-xs" />
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                <div className="text-xs sm:text-sm text-text-secondary space-y-1">
                  <div>从业年限：{manager.workTime}</div>
                  <div>管理规模：{manager.fundSize}</div>
                </div>
                {/* 最新净值 - 横向紧凑显示 */}
                <div className="shrink-0 border border-pink-500/30 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 bg-black/20">
                  <div className="flex items-baseline gap-2 sm:gap-2.5">
                    <span className="text-text-secondary text-[10px] sm:text-xs whitespace-nowrap">最新净值</span>
                    <span className="text-base sm:text-lg md:text-xl font-mono font-bold text-text-primary">
                      {navValue ? navValue.toFixed(4) : '--'}
                    </span>
                    {estimateGrowth !== undefined && (
                      <span
                        className={clsx(
                          'text-xs sm:text-sm font-mono whitespace-nowrap',
                          estimateGrowth >= 0 ? 'text-red-400' : 'text-green-400'
                        )}
                      >
                        {estimateGrowth >= 0 ? '+' : ''}
                        {estimateGrowth.toFixed(2)}%
                      </span>
                    )}
                  </div>
                  {displayData && (
                    <div className="text-[9px] text-text-tertiary mt-1">
                      {displayData.statusLabel}
                    </div>
                  )}
                </div>
              </div>
              {manager.power && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="text-xs text-text-tertiary mb-2">综合评分：{manager.power.avr}分</div>
                  <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto scrollbar-hide">
                    {manager.power.categories.map((category: string, idx: number) => (
                      <div key={idx} className="flex flex-col items-center shrink-0 min-w-[60px] sm:min-w-[70px]">
                        <div className="text-[10px] sm:text-xs text-text-tertiary mb-1 truncate w-full text-center" title={category}>
                          {category}
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-purple-400">
                          {manager.power.data[idx]?.toFixed(0)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        // 如果没有基金经理数据，单独显示最新净值
        <div className="glass-card p-4 sm:p-6 border border-cyan-500/20">
          <div className="flex flex-col items-start gap-1">
            <div className="text-text-secondary text-xs sm:text-sm">最新净值</div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-text-primary leading-tight">
              {navValue ? navValue.toFixed(4) : '--'}
            </div>
            {estimateGrowth !== undefined && (
              <div
                className={clsx(
                  'text-sm sm:text-base font-mono leading-tight',
                  estimateGrowth >= 0 ? 'text-red-400' : 'text-green-400'
                )}
              >
                {estimateGrowth >= 0 ? '+' : ''}
                {estimateGrowth.toFixed(2)}%
              </div>
            )}
            {displayData && (
              <div className="text-xs text-text-tertiary mt-1">
                {displayData.statusLabel}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 业绩评价 */}
      {performance && (
        <div className="glass-card p-4 sm:p-6 border border-pink-500/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm sm:text-base font-bold text-text-primary">业绩评价</h3>
            <div className="text-lg sm:text-xl font-bold text-pink-400">
              {performance.avr}分
            </div>
          </div>
          <div className="space-y-3">
            {performance.categories.map((category: string, idx: number) => {
              const score = performance.data[idx] || 0;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-text-secondary">{category}</span>
                    <span className="text-text-primary font-mono">{score.toFixed(0)}分</span>
                  </div>
                  <div className="h-1.5 sm:h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-pink-500/50 to-pink-400 transition-all duration-500"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 持有人结构 */}
      {holderStructure && holderStructure.series.length > 0 && (
        <div className="glass-card p-4 sm:p-6 border border-cyan-500/20">
          <h3 className="text-sm sm:text-base font-bold text-text-primary mb-4">持有人结构</h3>
          <div className="space-y-3">
            {holderStructure.series.map((series: any, idx: number) => {
              const latestValue = series.data[series.data.length - 1] || 0;
              const colorMap: Record<string, string> = {
                '机构持有比例': 'from-cyan-500/50 to-cyan-400',
                '个人持有比例': 'from-purple-500/50 to-purple-400',
                '内部持有比例': 'from-pink-500/50 to-pink-400',
              };
              const colorClass = colorMap[series.name] || 'from-white/20 to-white/30';
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-text-secondary">{series.name}</span>
                    <span className="text-text-primary font-mono font-bold">{latestValue.toFixed(2)}%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={clsx('h-full bg-gradient-to-r transition-all duration-500', colorClass)}
                      style={{ width: `${latestValue}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {holderStructure.categories && holderStructure.categories.length > 0 && (
            <div className="mt-3 text-xs text-text-tertiary text-right">
              最新数据：{holderStructure.categories[holderStructure.categories.length - 1]}
            </div>
          )}
        </div>
      )}

      {/* 资产配置 */}
      {assetAllocation && assetAllocation.series.length > 0 && (
        <div className="glass-card p-4 sm:p-6 border border-purple-500/20">
          <h3 className="text-sm sm:text-base font-bold text-text-primary mb-4">资产配置</h3>
          <div className="space-y-3">
            {assetAllocation.series
              .filter((s: any) => s.type !== 'line') // 排除净资产折线图
              .map((series: any, idx: number) => {
                const latestValue = series.data[series.data.length - 1] || 0;
                const colorMap: Record<string, string> = {
                  '股票占净比': 'from-green-500/50 to-green-400',
                  '债券占净比': 'from-blue-500/50 to-blue-400',
                  '现金占净比': 'from-yellow-500/50 to-yellow-400',
                };
                const colorClass = colorMap[series.name] || 'from-white/20 to-white/30';
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-text-secondary">{series.name}</span>
                      <span className="text-text-primary font-mono font-bold">{latestValue.toFixed(2)}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={clsx('h-full bg-gradient-to-r transition-all duration-500', colorClass)}
                        style={{ width: `${latestValue}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
          {assetAllocation.categories && assetAllocation.categories.length > 0 && (
            <div className="mt-3 text-xs text-text-tertiary text-right">
              最新数据：{assetAllocation.categories[assetAllocation.categories.length - 1]}
            </div>
          )}
        </div>
      )}

      {/* 无数据提示 */}
      {!overviewData && !isLoading && (
        <div className="glass-card p-8 text-center">
          <i className="ri-information-line text-3xl text-text-tertiary mb-2 block" />
          <div className="text-text-secondary text-sm">暂无基金概况数据</div>
        </div>
      )}
    </div>
  );
}

// AI诊断组件（占位符，后续实现）
function AIDiagnosis() {
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
