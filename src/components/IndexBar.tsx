import React, { useEffect, useMemo, useState, useRef, useLayoutEffect } from 'react';
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
  const marqueeRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [needsScroll, setNeedsScroll] = useState(false);

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
      .filter(([_, indices]) => indices.length > 0)
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

  // 检测是否需要滚动（使用 useLayoutEffect 确保在 DOM 更新后立即检测）
  useLayoutEffect(() => {
    const checkScroll = () => {
      if (marqueeRef.current && contentRef.current) {
        const containerWidth = marqueeRef.current.offsetWidth;
        // 计算单份内容的宽度（不包含复制的部分）
        const firstChild = contentRef.current.firstElementChild as HTMLElement;
        if (firstChild) {
          const singleContentWidth = Array.from(contentRef.current.children)
            .slice(0, currentIndices.length)
            .reduce((sum, child) => {
              const rect = child.getBoundingClientRect();
              return sum + rect.width + 16; // 16px 是 gap-4 的宽度
            }, 0);
          setNeedsScroll(singleContentWidth > containerWidth);
        }
      }
    };

    checkScroll();
    
    // 监听窗口大小变化
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [currentIndices]);

  const renderIndexCard = (index: MarketIndex, suffix: string = '') => {
    const isUp = index.changePercent >= 0;
    const hasData = index.currentPrice !== 0;
    return (
      <div
        key={`${index.code}${suffix}`}
        className="glass-card px-4 py-2 flex items-center gap-3 min-w-[140px] flex-shrink-0 hover:scale-105 transition-transform"
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
  };

  return (
    <div className="w-full bg-bg-deep/50 border-b border-border-subtle">
      <div className="container mx-auto px-4">
        <style>{`
          .index-scroll-container {
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
          }
          .index-scroll-container::-webkit-scrollbar {
            height: 6px;
          }
          .index-scroll-container::-webkit-scrollbar-track {
            background: transparent;
          }
          .index-scroll-container::-webkit-scrollbar-thumb {
            background-color: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
          }
          .index-scroll-container::-webkit-scrollbar-thumb:hover {
            background-color: rgba(255, 255, 255, 0.2);
          }
          
          /* 循环滚动动画 */
          @keyframes marquee {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-50%);
            }
          }
          
          .marquee-container {
            overflow: hidden;
            position: relative;
            width: 100%;
          }
          
          .marquee-content {
            display: flex;
            width: fit-content;
          }
          
          .marquee-content.scrolling {
            animation: marquee 30s linear infinite;
          }
          
          .marquee-content.scrolling:hover {
            animation-play-state: paused;
          }
          
          .marquee-content.no-scroll {
            justify-content: center;
            width: 100%;
          }
        `}</style>
      
        {isLoading && indices.length === 0 ? (
          <div className="flex flex-col gap-3 py-3">
            <div className="flex justify-center gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton w-20 h-8" />
              ))}
            </div>
            <div className="flex justify-center gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton w-32 h-10" />
              ))}
            </div>
          </div>
        ) : groupedIndices.length === 0 ? (
          <div className="text-text-tertiary text-sm text-center py-3">指数数据加载中...</div>
        ) : (
          <div className="flex flex-col gap-3 py-3">
            {/* 第一栏：分类标签 */}
            <div className="index-scroll-container scroll-smooth overflow-x-auto">
              <div className="flex gap-2 justify-center min-w-max">
                {groupedIndices.map((group) => (
                  <button
                    key={group.category}
                    onClick={() => setSelectedCategory(group.category)}
                    className={clsx(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0',
                      selectedCategory === group.category
                        ? 'bg-accent-blue text-white'
                        : 'bg-bg-elevated text-text-secondary hover:text-text-primary hover:bg-bg-elevated/80'
                    )}
                  >
                    {group.category}
                  </button>
                ))}
              </div>
            </div>

            {/* 第二栏：当前分类的指数列表 - 循环滚动 */}
            {currentIndices.length > 0 ? (
              <div ref={marqueeRef} className="marquee-container">
                <div 
                  ref={contentRef}
                  className={clsx(
                    'marquee-content gap-4',
                    needsScroll ? 'scrolling' : 'no-scroll'
                  )}
                >
                  {/* 如果需要滚动，复制一份内容以实现无缝循环 */}
                  {currentIndices.map((index) => renderIndexCard(index, '-original'))}
                  {needsScroll && currentIndices.map((index) => renderIndexCard(index, '-copy'))}
                </div>
              </div>
            ) : (
              <div className="text-text-tertiary text-sm text-center py-2">
                暂无指数数据
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
