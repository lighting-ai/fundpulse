import { useEffect, useMemo, useState } from 'react';
import { useIndexStore } from '../store/indexStore';
import { useSettingsStore } from '../store/settingsStore';
import clsx from 'clsx';

import { MarketIndex } from '../db/schema';

// 指数分类
type IndexCategory = '沪深' | '港股' | '美股';

/**
 * 根据指数代码判断分类
 */
const getIndexCategory = (code: string): IndexCategory => {
  if (code.startsWith('SH') || code.startsWith('SZ')) {
    return '沪深';
  }
  if (code.startsWith('HSI') || code.startsWith('HSCEI') || code.startsWith('HSTECH')) {
    return '港股';
  }
  if (code.startsWith('IXIC') || code.startsWith('DJI') || code.startsWith('SPX')) {
    return '美股';
  }
  return '沪深'; // 默认
};

export function IndexBar() {
  const { indices, isLoading, loadIndices } = useIndexStore();
  const { getRefreshIntervalMs } = useSettingsStore();
  const [selectedCategory, setSelectedCategory] = useState<IndexCategory | null>(null);

  useEffect(() => {
    loadIndices();
    // 根据配置的刷新间隔自动刷新指数数据
    const interval = setInterval(() => {
      loadIndices();
    }, getRefreshIntervalMs());
    return () => clearInterval(interval);
  }, [loadIndices, getRefreshIntervalMs]);

  // 按分类分组
  const groupedIndices = useMemo(() => {
    const groups: Record<IndexCategory, MarketIndex[]> = {
      '沪深': [],
      '港股': [],
      '美股': [],
    };

    indices.forEach((index) => {
      const category = getIndexCategory(index.code);
      groups[category].push(index);
    });

    return Object.entries(groups)
      .filter(([, indices]) => indices.length > 0)
      .map(([category, indices]) => ({
        category: category as IndexCategory,
        indices,
      }));
  }, [indices]);

  // 自动选择第一个有数据的分类
  useEffect(() => {
    if (groupedIndices.length > 0 && !selectedCategory) {
      setSelectedCategory(groupedIndices[0].category);
    }
  }, [groupedIndices, selectedCategory]);

  // 获取当前选中分类的指数
  const currentIndices = useMemo(() => {
    if (!selectedCategory) return [];
    return groupedIndices.find(g => g.category === selectedCategory)?.indices || [];
  }, [selectedCategory, groupedIndices]);

  const renderIndexCard = (index: MarketIndex) => {
    const isUp = index.changePercent >= 0;
    const hasData = index.currentPrice !== 0;
    return (
      <div
        key={index.code}
        className="glass-card px-4 py-3 flex items-center justify-between hover:border-neon-blue/50 transition-all cursor-pointer group"
      >
        <div className="flex-1">
          <div className="text-sm font-medium text-text-primary group-hover:text-neon-blue transition-colors">
            {index.name}
          </div>
          <div className="text-xs text-text-tertiary mt-1 font-mono">{index.code}</div>
        </div>
        <div className="text-right">
          <div className={clsx(
            'text-lg font-mono font-bold group-hover:text-neon-blue transition-colors',
            hasData && isUp ? 'text-up' : hasData && !isUp ? 'text-down' : 'text-text-primary'
          )}>
            {hasData ? index.currentPrice.toFixed(2) : '--'}
          </div>
          {hasData && (
            <div
              className={clsx(
                'text-sm font-mono font-semibold flex items-center gap-1 justify-end mt-1',
                isUp ? 'text-up' : 'text-down'
              )}
            >
              {isUp ? (
                <i className="ri-arrow-up-line" />
              ) : (
                <i className="ri-arrow-down-line" />
              )}
              {Math.abs(index.changePercent).toFixed(2)}%
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* 分类标签 */}
      <div className="flex gap-2 mb-4 flex-shrink-0">
        {groupedIndices.map((group) => (
          <button
            key={group.category}
            onClick={() => setSelectedCategory(group.category)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex-shrink-0',
              'active:scale-95',
              selectedCategory === group.category
                ? 'bg-neon-red/20 text-white shadow-[0_0_15px_rgba(255,45,85,0.3)] border border-neon-red/50 active:shadow-[0_0_10px_rgba(255,45,85,0.2)]'
                : 'bg-black/30 text-text-secondary hover:text-white hover:bg-black/50 active:bg-black/60 border border-transparent'
            )}
          >
            {group.category}
          </button>
        ))}
      </div>

      {/* 指数列表 - 垂直滚动 */}
      <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide">
        {isLoading && indices.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-16" />
            ))}
          </div>
        ) : currentIndices.length === 0 ? (
          <div className="text-text-tertiary text-sm text-center py-8">
            暂无指数数据
          </div>
        ) : (
          currentIndices.map((index) => renderIndexCard(index))
        )}
      </div>
    </div>
  );
}
