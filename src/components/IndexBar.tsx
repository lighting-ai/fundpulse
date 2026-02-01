import React, { useEffect } from 'react';
import { useIndexStore } from '../store/indexStore';
import clsx from 'clsx';

export function IndexBar() {
  const { indices, isLoading, loadIndices } = useIndexStore();

  useEffect(() => {
    loadIndices();
    // 每5分钟刷新一次
    const interval = setInterval(() => {
      loadIndices();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadIndices]);

  return (
    <div className="w-full overflow-x-auto bg-bg-deep/50 border-b border-border-subtle">
      <div className="flex gap-4 px-4 py-3 min-w-max justify-center">
        {isLoading && indices.length === 0 ? (
          <div className="flex gap-4">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="skeleton w-32 h-10" />
            ))}
          </div>
        ) : indices.length === 0 ? (
          <div className="text-text-tertiary text-sm">指数数据加载中...</div>
        ) : (
          indices.map((index) => {
            const isUp = index.changePercent >= 0;
            const hasData = index.currentPrice !== 0;
            return (
              <div
                key={index.code}
                className="glass-card px-4 py-2 flex items-center gap-3 min-w-[140px] hover:scale-105 transition-transform"
              >
                <div className="flex-1">
                  <div className="text-xs text-text-secondary">{index.name}</div>
                  <div className="text-sm font-mono font-bold text-text-primary">
                    {hasData ? index.currentPrice.toFixed(2) : '--'}
                  </div>
                </div>
                {hasData && (
                  <div
                    className={clsx(
                      'text-xs font-mono font-semibold flex items-center gap-1',
                      isUp ? 'text-up-primary' : 'text-down-primary'
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
            );
          })
        )}
      </div>
    </div>
  );
}
