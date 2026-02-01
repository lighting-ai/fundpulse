import React from 'react';
import { useDetailStore } from '../store/detailStore';

export function TopHoldings() {
  const { fundDetail, isLoading } = useDetailStore();

  if (!fundDetail || !fundDetail.topHoldings || fundDetail.topHoldings.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <i className="ri-stack-line text-4xl text-text-muted mb-3 block" />
        <div className="text-text-secondary">暂无重仓股数据</div>
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
                      className={`font-mono font-medium ${
                        holding.changePercent > 0
                          ? 'text-accent-red'
                          : holding.changePercent < 0
                          ? 'text-accent-green'
                          : 'text-text-tertiary'
                      }`}
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
