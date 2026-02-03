import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { fetchTencentIndices, TencentIndexData } from '../api/tencent';
import { FlipNumber } from './FlipNumber';

/**
 * 横向指数滚动条组件
 * 自动循环滚动，支持触摸滑动
 */
export function IndexMarquee() {
  const [indices, setIndices] = useState<TencentIndexData[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // 指数代码列表
  const indexCodes = [
    'sh000001', // 上证指数
    'sz399001', // 深证成指
    'sz399006', // 创业板指
    'sh000300', // 沪深300
    'hkHSI',    // 恒生指数
    'hkHSCEI',  // 恒生国企指数
    'usIXIC',   // 纳斯达克
    'usDJI',    // 道琼斯
  ];

  // 获取数据
  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchTencentIndices(indexCodes);
        setIndices(data);
      } catch (error) {
        console.error('加载指数数据失败:', error);
      }
    };
    
    load();
    // 注意：自动刷新已由 Header 的倒计时统一控制，这里不再需要自动刷新逻辑
  }, []);

  // 自动滚动动画
  useEffect(() => {
    const container = containerRef.current;
    if (!container || indices.length === 0 || isDragging) return;

    let animationId: number;
    const scroll = () => {
      if (!isDragging && container) {
        container.scrollLeft += 0.8;
        if (container.scrollLeft >= container.scrollWidth / 2) {
          container.scrollLeft = 0; // 无缝循环
        }
      }
      animationId = requestAnimationFrame(scroll);
    };
    animationId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animationId);
  }, [indices, isDragging]);

  // 鼠标拖拽处理
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    if (containerRef.current) {
      setStartX(e.pageX - containerRef.current.offsetLeft);
      setScrollLeft(containerRef.current.scrollLeft);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    containerRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  if (indices.length === 0) {
    return (
      <div className="relative w-full bg-surface/50 border-y border-white/5 overflow-hidden py-4">
        <div className="flex items-center justify-center text-text-tertiary">
          <i className="ri-loader-4-line animate-spin mr-2" />
          加载指数数据中...
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full bg-surface/50 border-y border-white/5 overflow-hidden">
      {/* 左右渐变遮罩 */}
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-[var(--bg-void)] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[var(--bg-void)] to-transparent z-10 pointer-events-none" />

      <div
        ref={containerRef}
        className={clsx(
          'flex gap-4 px-6 py-4 overflow-x-auto scrollbar-hide',
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* 双份数据实现无缝循环 */}
        {[...indices, ...indices].map((idx, i) => (
          <div
            key={`${idx.code}-${i}`}
            className="relative flex-shrink-0 w-[220px] p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm group hover:border-white/20 transition-all"
          >
            {/* 涨跌渐变背景 */}
            {idx.change > 0 && (
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 animate-pulse rounded-xl" />
            )}
            {idx.change < 0 && (
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 via-green-500/5 to-green-500/0 animate-pulse rounded-xl" />
            )}

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-secondary">{idx.name}</span>
                <span
                  className={clsx(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    idx.change >= 0
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-green-500/20 text-green-400'
                  )}
                >
                  {idx.change >= 0 ? '+' : ''}
                  {idx.changePercent.toFixed(2)}%
                </span>
              </div>

              <div className="text-3xl font-mono font-bold text-text-primary tracking-tighter">
                <FlipNumber value={idx.price} decimals={2} />
              </div>

              <div
                className={clsx(
                  'text-sm font-mono mt-1 flex items-center gap-1',
                  idx.change >= 0 ? 'trend-up' : 'trend-down'
                )}
              >
                {idx.change >= 0 ? '↑' : '↓'}
                <FlipNumber value={Math.abs(idx.change)} decimals={2} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
