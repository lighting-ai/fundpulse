import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { fetchTencentIndices, TencentIndexData } from '../api/tencent';
import { FlipNumber } from './FlipNumber';

/**
 * 指数分类配置
 */
const CATEGORIES = [
  {
    id: 'cn',
    label: '沪深',
    codes: [
      'sh000001', // 上证指数
      'sh000016', // 上证50
      'sh000300', // 沪深300
      'sh000905', // 中证500
      'sh000852', // 中证1000
      'sh000688', // 科创50
      'sz399001', // 深证成指
      'sz399005', // 中小100
      'sz399006', // 创业板指
      'sz399002', // 深成指R
      'sz399003', // 成份Ｂ指
    ],
  },
  {
    id: 'hk',
    label: '港股',
    codes: ['hkHSI', 'hkHSCEI', 'hkHSTECH'],
  },
  {
    id: 'us',
    label: '美股',
    codes: ['usIXIC', 'usDJI', 'usSPX'],
  },
];

/**
 * 指数卡片组件
 * 按照 zhishu-layout.md 设计：
 * - 顶部：名称（左）+ PE（右上，小字灰色）
 * - 中间：最新价（超大，绝对主角）
 * - 底部：涨跌额（左，箭头+数字）+ 涨跌幅（右，红绿pill）
 */
function IndexCard({
  name,
  code,
  price,
  change,
  changePercent,
  pe,
}: {
  name: string;
  code: string;
  price: number;
  change: number;
  changePercent: number;
  pe: number;
}) {
  const isUp = change >= 0;

  return (
    <div className="relative flex-shrink-0 w-[55px] h-[42px] sm:w-[70px] sm:h-[52px] md:w-[90px] md:h-[64px] lg:w-[110px] lg:h-[76px] xl:w-[135px] xl:h-[93px] p-1 sm:p-1.5 md:p-2 lg:p-2.5 xl:p-3 rounded-md sm:rounded-lg md:rounded-xl lg:rounded-xl xl:rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:border-white/20 transition-all group overflow-hidden flex flex-col">
      {/* 顶部行：名称（左） + PE（右） */}
      <div className="flex items-start justify-between flex-shrink-0 mb-0.5">
        <div className="flex-1 min-w-0 pr-1">
          <div className="text-[6px] sm:text-[7px] md:text-[8px] lg:text-[9px] xl:text-[10px] font-medium text-text-primary tracking-wide truncate leading-tight">
            {name || code}
          </div>
          <div className="hidden sm:block text-[5px] sm:text-[5px] md:text-[6px] lg:text-[7px] text-text-tertiary font-mono mt-0.5 tracking-wider opacity-70 leading-tight">
            {code}
          </div>
        </div>

        {/* PE 放右上角，弱化显示（灰色小字） */}
        {pe > 0 ? (
          <div className="text-[5px] sm:text-[5px] md:text-[6px] lg:text-[7px] text-text-tertiary font-mono flex items-center gap-0.5 opacity-60 shrink-0">
            <span className="text-[4px] sm:text-[4px] md:text-[5px] lg:text-[6px]">PE</span>
            <span>{pe.toFixed(1)}</span>
          </div>
        ) : null}
      </div>

      {/* 中部：最新价（绝对主角，垂直居中） */}
      <div className="flex-1 flex items-center justify-center min-h-0 py-0.5">
        <div className="text-[8px] sm:text-[9px] md:text-[11px] lg:text-[14px] xl:text-[18px] font-mono font-bold text-white tracking-tighter tabular-nums leading-none group-hover:scale-[1.02] transition-transform">
          <FlipNumber value={price} decimals={2} />
        </div>
      </div>

      {/* 底部行：涨跌额（左） + 涨跌幅（右 pill） */}
      <div className="flex items-center justify-between pt-0.5 sm:pt-1 border-t border-white/5 flex-shrink-0 min-h-[11px] sm:min-h-[13px]">
        {/* 涨跌额：符号 ↑↓ 直接暗示含义 */}
        <div
          className={clsx(
            'flex items-center gap-0.5 text-[5px] sm:text-[6px] md:text-[7px] lg:text-[8px] xl:text-[9px] font-mono font-medium leading-tight',
            isUp ? 'text-red-400' : 'text-green-400'
          )}
        >
          <span className="text-[4px] sm:text-[5px] md:text-[6px] opacity-80">{isUp ? '↑' : '↓'}</span>
          <FlipNumber value={Math.abs(change)} decimals={2} />
        </div>

        {/* 涨跌幅：纯文字显示，无背景和边框 */}
        <div
          className={clsx(
            'text-[5px] sm:text-[6px] md:text-[7px] lg:text-[8px] xl:text-[9px] font-bold font-mono leading-tight whitespace-nowrap shrink-0',
            isUp ? 'text-red-400' : 'text-green-400'
          )}
        >
          {isUp ? '+' : ''}
          {changePercent.toFixed(2)}%
        </div>
      </div>

      {/* 背景光晕（根据涨跌） */}
      <div
        className={clsx(
          'absolute -bottom-1.5 sm:-bottom-2 md:-bottom-3 lg:-bottom-4 xl:-bottom-5 -right-1.5 sm:-right-2 md:-right-3 lg:-right-4 xl:-right-5 w-8 sm:w-10 md:w-12 lg:w-16 xl:w-20 h-8 sm:h-10 md:h-12 lg:h-16 xl:h-20 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none',
          isUp ? 'bg-red-500' : 'bg-green-500'
        )}
      />
    </div>
  );
}

/**
 * 指数条组件（带分类Tab）
 * 按照 v2.0.1 设计：非全宽，有分类Tab，下方横向滚动
 */
export function IndexSection() {
  const [activeCategory, setActiveCategory] = useState('cn');
  const [indices, setIndices] = useState<TencentIndexData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [shouldScroll, setShouldScroll] = useState(false);

  const currentCategory = CATEGORIES.find((cat) => cat.id === activeCategory);

  // 加载指数数据
  useEffect(() => {
    if (!currentCategory) return;

    const loadIndices = async () => {
      setIsLoading(true);
      try {
        const data = await fetchTencentIndices(currentCategory.codes);
        setIndices(data);
      } catch (error) {
        console.error('加载指数数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadIndices();
    // 注意：自动刷新已由 Header 的倒计时统一控制，这里不再需要自动刷新逻辑
  }, [activeCategory, currentCategory]);

  // 判断是否需要滚动：使用实际 DOM 尺寸来判断
  useEffect(() => {
    // 如果正在加载或没有数据，不启用滚动
    if (isLoading || indices.length === 0) {
      setShouldScroll(false);
      return;
    }

    const container = containerRef.current;
    if (!container) {
      // 容器还没准备好时，暂时不设置滚动状态
      setShouldScroll(false);
      return;
    }

    let checkCount = 0; // 限制检查次数，避免重复输出
    const checkScroll = () => {
      const container = containerRef.current;
      if (!container) return;
      
      // 使用 scrollWidth（内容总宽度）和 clientWidth（可见宽度）来判断
      // 如果内容总宽度大于可见宽度，说明需要滚动
      const scrollWidth = container.scrollWidth;
      const clientWidth = container.clientWidth;
      
      // 对于沪深（11个指数），强制启用滚动
      // 对于其他分类，根据实际尺寸判断
      const needsScroll = activeCategory === 'cn' && indices.length >= 8
        ? true
        : scrollWidth > clientWidth + 2; // +2 避免浮点数误差和边框
      
      // 只在第一次检查时输出调试信息，避免重复输出
      if (checkCount === 0 && process.env.NODE_ENV === 'development') {
        console.log('[IndexSection] 滚动检查:', {
          scrollWidth,
          clientWidth,
          needsScroll,
          indicesCount: indices.length,
          category: activeCategory,
          forceScroll: activeCategory === 'cn' && indices.length >= 8
        });
      }
      checkCount++;
      
      setShouldScroll(needsScroll);
    };

    // 等待 DOM 渲染后检查（只检查一次）
    const timer = setTimeout(() => {
      checkScroll();
    }, 100);
    
    // 使用 ResizeObserver 监听容器尺寸变化（防抖处理）
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimer: NodeJS.Timeout | null = null;
    if (container && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        // 防抖：延迟检查，避免频繁触发
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          checkCount = 0; // 重置计数，允许输出一次
          checkScroll();
        }, 200);
      });
      resizeObserver.observe(container);
    }
    
    // 监听窗口大小变化（防抖处理）
    let resizeHandler: (() => void) | null = null;
    let windowResizeTimer: NodeJS.Timeout | null = null;
    resizeHandler = () => {
      if (windowResizeTimer) clearTimeout(windowResizeTimer);
      windowResizeTimer = setTimeout(() => {
        checkCount = 0; // 重置计数，允许输出一次
        checkScroll();
      }, 200);
    };
    window.addEventListener('resize', resizeHandler);
    
    return () => {
      clearTimeout(timer);
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('resize', resizeHandler!);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [indices, isLoading, activeCategory]);

  // 自动滚动动画（仅在数据足够多时启用，速度适中）
  useEffect(() => {
    const container = containerRef.current;
    if (!container || indices.length === 0 || isDragging || !shouldScroll) {
      return;
    }

    // 确保容器可以滚动
    if (container.scrollWidth <= container.clientWidth) {
      return;
    }

    let animationId: number;
    let lastTime = performance.now();
    const scrollSpeed = 0.5; // 像素/帧，约 30 像素/秒（60fps），速度适中
    
    const scroll = (currentTime: number) => {
      if (!isDragging && container && shouldScroll) {
        // 使用时间差来确保滚动速度一致
        const deltaTime = currentTime - lastTime;
        const scrollAmount = (scrollSpeed * deltaTime) / 16.67; // 16.67ms 是 60fps 的帧时间
        
        container.scrollLeft += scrollAmount;
        
        // 滚动到末尾时重置到开头
        const maxScroll = container.scrollWidth - container.clientWidth;
        if (container.scrollLeft >= maxScroll - 0.5) {
          container.scrollLeft = 0;
        }
        
        lastTime = currentTime;
      }
      animationId = requestAnimationFrame(scroll);
    };
    
    lastTime = performance.now();
    animationId = requestAnimationFrame(scroll);
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [indices, isDragging, shouldScroll]);

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

  return (
    <div className="glass-card p-2 sm:p-3 md:p-4">
      {/* 分类 Tab */}
      <div className="flex items-center gap-1 sm:gap-2 mb-2 sm:mb-3 md:mb-4 border-b border-white/10 pb-2 sm:pb-2.5 md:pb-3">
        <div className="flex bg-black/30 rounded-lg p-0.5 sm:p-1 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={clsx(
                'px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-xs md:text-sm font-medium transition-all whitespace-nowrap',
                activeCategory === cat.id
                  ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(255,45,85,0.3)]'
                  : 'text-text-secondary hover:text-white'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1 sm:gap-2 text-[9px] sm:text-[10px] md:text-xs text-text-tertiary shrink-0">
          <span className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="hidden sm:inline">实时更新</span>
        </div>
      </div>

      {/* 横向滚动指数 */}
      <div className="relative">
        {isLoading && indices.length === 0 ? (
          <div className="flex items-center justify-center py-4 sm:py-6 md:py-8">
            <i className="ri-loader-4-line animate-spin text-text-tertiary mr-2 text-sm sm:text-base" />
            <span className="text-text-tertiary text-xs sm:text-sm">加载中...</span>
          </div>
        ) : indices.length === 0 ? (
          <div className="text-center py-4 sm:py-6 md:py-8 text-text-tertiary text-xs sm:text-sm">
            暂无数据
          </div>
        ) : (
          <div
            ref={containerRef}
            className={clsx(
              'flex gap-1 sm:gap-1.5 md:gap-2 lg:gap-2.5 pb-1',
              shouldScroll
                ? 'overflow-x-auto scrollbar-hide cursor-grab'
                : 'overflow-hidden justify-center items-center',
              isDragging && 'cursor-grabbing'
            )}
            style={shouldScroll ? { 
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch', // iOS 平滑滚动
              scrollPaddingLeft: '4px',
              scrollPaddingRight: '4px'
            } : { 
              justifyContent: 'center',
              overflowX: 'hidden'
            }}
            onMouseDown={shouldScroll ? handleMouseDown : undefined}
            onMouseMove={shouldScroll ? handleMouseMove : undefined}
            onMouseUp={shouldScroll ? handleMouseUp : undefined}
            onMouseLeave={shouldScroll ? handleMouseLeave : undefined}
          >
            {/* 只显示一份数据，不重复 */}
            {indices.map((idx) => (
              <IndexCard
                key={idx.code}
                name={idx.name}
                code={idx.code}
                price={idx.price}
                change={idx.change}
                changePercent={idx.changePercent}
                pe={idx.pe}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
