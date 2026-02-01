import React from 'react';
import { useFundStore } from '../store/fundStore';
import clsx from 'clsx';

interface FundCardProps {
  fund: {
    fundCode: string;
    fundName: string;
    nav?: number;
    estimateNav?: number;
    estimateGrowth?: number;
    valuationTime?: string;
    isLoading?: boolean;
    error?: string;
  };
}

export function FundCard({ fund }: FundCardProps) {
  const { selectedFundCode, selectFund, removeFund } = useFundStore();
  const isSelected = selectedFundCode === fund.fundCode;
  const isUp = (fund.estimateGrowth || 0) >= 0;
  const displayNav = fund.estimateNav || fund.nav || 0;
  const displayGrowth = fund.estimateGrowth || 0;

  const handleClick = () => {
    selectFund(isSelected ? null : fund.fundCode);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`确定要删除 ${fund.fundName} 吗？`)) {
      removeFund(fund.fundCode);
    }
  };

  return (
    <div
      className={clsx(
        'glass-card p-4 cursor-pointer list-item relative group',
        isSelected && 'active'
      )}
      onClick={handleClick}
    >
      {/* 选中指示条 */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-blue rounded-l-2xl" />
      )}

      {/* 删除按钮 */}
      <button
        onClick={handleRemove}
        className="absolute top-2 right-2 p-1 text-text-secondary hover:text-up-primary transition-colors opacity-0 hover:opacity-100"
        aria-label="删除"
      >
        <i className="ri-delete-bin-6-line text-lg" />
      </button>

      {/* 基金信息 */}
      <div className="mb-3">
        <div className="text-sm font-semibold text-text-primary mb-1">
          {fund.fundName}
        </div>
        <div className="text-xs text-text-tertiary font-mono">
          {fund.fundCode}
        </div>
      </div>

      {/* 净值信息 */}
      {fund.isLoading ? (
        <div className="skeleton h-8 w-24 mb-2" />
      ) : fund.error ? (
        <div className="text-xs text-text-tertiary">{fund.error}</div>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-mono font-bold text-text-primary">
              ¥{displayNav.toFixed(4)}
            </span>
            {fund.estimateNav && (
              <span className="live-indicator" title="实时数据" />
            )}
          </div>
          <div className="flex items-center justify-between">
            <div
              className={clsx(
                'text-sm font-mono font-semibold flex items-center gap-1',
                isUp ? 'text-up-primary' : 'text-down-primary'
              )}
            >
              {isUp ? (
                <i className="ri-arrow-up-line" />
              ) : (
                <i className="ri-arrow-down-line" />
              )}
              {Math.abs(displayGrowth).toFixed(2)}%
            </div>
            {fund.valuationTime && (
              <div className="text-xs text-text-tertiary">
                {fund.valuationTime}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
