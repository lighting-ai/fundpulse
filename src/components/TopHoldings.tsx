import React from 'react';
import { useDetailStore } from '../store/detailStore';
import clsx from 'clsx';

export function TopHoldings() {
  const { fundDetail, isLoading } = useDetailStore();

  // 加载中状态 - 显示骨架屏
  if (isLoading && (!fundDetail || !fundDetail.topHoldings || fundDetail.topHoldings.length === 0)) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-white/10 rounded" />
            <div className="h-6 w-32 bg-white/10 rounded" />
          </div>
          <div className="h-4 w-24 bg-white/10 rounded" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-white/5">
              <div className="flex-1">
                <div className="h-5 w-24 bg-white/10 rounded mb-2" />
                <div className="h-4 w-16 bg-white/5 rounded" />
              </div>
              <div className="h-5 w-16 bg-white/10 rounded mr-4" />
              <div className="h-5 w-20 bg-white/10 rounded" />
            </div>
          ))}
        </div>
        <div className="mt-4 text-center text-text-tertiary text-sm">
          <i className="ri-loader-4-line animate-spin inline-block mr-2" />
          正在加载重仓股数据...
        </div>
      </div>
    );
  }

  if (!fundDetail || !fundDetail.topHoldings || fundDetail.topHoldings.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <i className="ri-stack-line text-4xl text-text-muted mb-3 block" />
        <div className="text-text-secondary">暂无重仓股数据</div>
        <div className="text-sm text-text-tertiary mt-2">
          数据可能正在加载中，请稍候...
        </div>
      </div>
    );
  }

  const totalRatio = fundDetail.topHoldings.reduce((sum, h) => sum + h.ratio, 0);

  return (
    <div className="glass-card p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <i className="ri-stack-line text-xl text-text-secondary" />
          <h3 className="text-lg font-semibold text-text-primary">前十大重仓股</h3>
        </div>
        <span className="text-xs text-text-tertiary">
          持仓合计: {totalRatio.toFixed(2)}%
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-tertiary border-b border-white/10">
              <th className="text-left py-3 px-2 font-normal">股票名称</th>
              <th className="text-right py-3 px-2 font-normal">持仓占比</th>
              <th className="text-right py-3 px-2 font-normal">涨跌幅</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {fundDetail.topHoldings.map((holding) => (
              <tr
                key={holding.stockCode}
                className="hover:bg-white/5 transition-colors"
              >
                <td className="py-3 px-2">
                  <div className="flex flex-col">
                    <span className="text-text-primary font-medium">
                      {holding.stockName || '未知'}
                    </span>
                    <span className="text-xs text-text-tertiary font-mono">
                      {holding.stockCode}
                    </span>
                  </div>
                </td>
                <td className="text-right py-3 px-2">
                  <span className="text-text-primary font-mono font-semibold">
                    {holding.ratio.toFixed(2)}%
                  </span>
                </td>
                <td className="text-right py-3 px-2">
                  {holding.changePercent !== undefined ? (
                    <span
                      className={clsx(
                        'font-mono font-medium',
                        holding.changePercent > 0
                          ? 'text-up'
                          : holding.changePercent < 0
                          ? 'text-down'
                          : 'text-text-tertiary'
                      )}
                    >
                      {holding.changePercent > 0 ? '+' : ''}
                      {holding.changePercent.toFixed(2)}%
                    </span>
                  ) : (
                    <span className="text-text-tertiary">--</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
