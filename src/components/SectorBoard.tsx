import { useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { fetchSectors, SectorData } from '../api/sector';
import { useAppStore } from '../store/appStore';
import { useSettingsStore } from '../store/settingsStore';

/**
 * 热门板块榜组件 - 紫调热力层级设计
 * 贴合整体紫调霓虹风格，根据涨跌强度自动着色背景
 */
export function SectorBoard() {
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [activeTab, setActiveTab] = useState<'up' | 'down'>('up');
  const [isLoading, setIsLoading] = useState(false);
  const { refreshSectorTrigger } = useAppStore();
  const { getRefreshIntervalMs } = useSettingsStore();

  const loadSectors = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchSectors(activeTab);
      setSectors(data.slice(0, 20)); // 显示前20条
    } catch (error) {
      console.error('加载板块数据失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  // 监听 activeTab 和 refreshSectorTrigger 变化，触发刷新
  useEffect(() => {
    loadSectors();
  }, [loadSectors, refreshSectorTrigger]);

  // 定时刷新：使用设置中的刷新间隔
  useEffect(() => {
    const interval = setInterval(() => {
      loadSectors();
    }, getRefreshIntervalMs());
    return () => clearInterval(interval);
  }, [loadSectors, getRefreshIntervalMs]);

  /**
   * 紫调热力背景计算
   * 根据涨跌幅度返回对应的背景样式
   */
  const getHeatStyle = (percent: number) => {
    const abs = Math.abs(percent);
    const isUp = percent >= 0;

    // 大涨：紫色发光背景 + 青色边框高亮
    if (abs >= 3) {
      return isUp
        ? 'bg-gradient-to-r from-pink-500/20 via-purple-500/10 to-transparent border-l-2 border-pink-500 shadow-[inset_0_0_30px_rgba(255,45,85,0.1)]'
        : 'bg-gradient-to-r from-cyan-500/20 via-purple-500/10 to-transparent border-l-2 border-cyan-500 shadow-[inset_0_0_30px_rgba(0,212,255,0.1)]';
    }
    // 中涨：浅紫背景
    else if (abs >= 1) {
      return 'bg-purple-500/10';
    }
    // 微涨：几乎透明
    return 'bg-purple-500/[0.02]';
  };

  return (
    <div className="w-full h-full rounded-2xl bg-[#0a0514]/60 backdrop-blur-xl border border-purple-500/20 overflow-hidden shadow-[0_0_40px_rgba(139,92,246,0.1)] flex flex-col">
      {/* Header - 紫调风格 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-purple-500/20 bg-purple-950/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <i className="ri-bar-chart-grouped-fill text-cyan-400 text-lg drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
          <h3 className="text-sm font-semibold text-purple-100 tracking-wide">
            热门板块
          </h3>
        </div>

        <div className="flex bg-black/40 rounded-lg p-0.5 border border-purple-500/30">
          <button
            onClick={() => setActiveTab('up')}
            className={clsx(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              activeTab === 'up'
                ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30 shadow-[0_0_10px_rgba(255,45,85,0.2)]'
                : 'text-purple-300/60 hover:text-purple-200'
            )}
          >
            强势板块
          </button>
          <button
            onClick={() => setActiveTab('down')}
            className={clsx(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              activeTab === 'down'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                : 'text-purple-300/60 hover:text-purple-200'
            )}
          >
            调整板块
          </button>
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {isLoading && sectors.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <i className="ri-loader-4-line animate-spin text-purple-300/60 mr-2" />
            <span className="text-purple-300/60">加载中...</span>
          </div>
        ) : sectors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <i className="ri-inbox-line text-purple-300/60 text-2xl mb-2" />
            <span className="text-purple-300/60 text-sm">
              {activeTab === 'up' ? '暂无上涨板块' : '暂无下跌板块'}
            </span>
          </div>
        ) : (
          <div className="divide-y divide-purple-500/10">
            {sectors.map((sector, index) => {
              const isUp = sector.changePercent >= 0;
              const rank = index + 1;
              const absPercent = Math.abs(sector.changePercent);
              const isTopRank = rank <= 3 && absPercent >= 2;

              return (
                <div
                  key={sector.code}
                  className={clsx(
                    'group flex items-center justify-between px-5 py-3.5',
                    'transition-all duration-300 cursor-pointer',
                    'hover:bg-purple-500/10',
                    getHeatStyle(sector.changePercent)
                  )}
                >
                  {/* 左侧：排名 + 板块信息 */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* 排名 - 紫调风格 */}
                    <div
                      className={clsx(
                        'w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono',
                        isTopRank
                          ? isUp
                            ? 'bg-pink-500/20 text-pink-400 border border-pink-500/40'
                            : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                          : 'text-purple-400/50 bg-purple-500/10'
                      )}
                    >
                      {rank}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="text-[15px] font-medium text-purple-50 truncate group-hover:text-white transition-colors">
                        {sector.name.replace('行业', '').replace('板块', '')}
                      </div>

                      {sector.leadingStock && (
                        <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
                          <span className="text-purple-400/60">▸</span>
                          <span className="text-purple-300/70 truncate max-w-[80px]">
                            {sector.leadingStock.name}
                          </span>
                          {sector.leadingStock.changePercent !== 0 && (
                            <span className={clsx('font-mono', isUp ? 'text-red-400/80' : 'text-green-400/80')}>
                              {sector.leadingStock.changePercent > 0 ? '+' : ''}
                              {sector.leadingStock.changePercent.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 中间：价格信息 */}
                  {sector.latestPrice !== undefined && sector.changeAmount !== undefined && (
                    <div className="flex flex-col items-end mr-4 text-xs tabular-nums">
                      <div className="text-purple-200/80 font-mono">
                        {sector.latestPrice.toFixed(2)}
                      </div>
                      <div className={clsx('font-mono text-[11px]', isUp ? 'text-red-400/70' : 'text-green-400/70')}>
                        {isUp ? '+' : ''}
                        {sector.changeAmount.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {/* 右侧：涨跌幅 - 霓虹大字 */}
                  <div
                    className={clsx(
                      'text-[18px] font-bold font-mono tracking-tight tabular-nums w-[80px] text-right',
                      isUp
                        ? 'text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.4)]'
                        : 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]'
                    )}
                  >
                    {sector.changePercent > 0 ? '+' : ''}
                    {sector.changePercent.toFixed(2)}%
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
