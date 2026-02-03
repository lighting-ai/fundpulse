import { useState, useEffect, useRef, useCallback } from 'react';
import clsx from 'clsx';
import { useFundStore } from '../store/fundStore';
import { useAppStore } from '../store/appStore';
import { useIndexStore } from '../store/indexStore';
import { useSettingsStore } from '../store/settingsStore';
import { SettingsModal } from './SettingsModal';

export function Header() {
  const { updateRealtimeData } = useFundStore();
  const { currentView, setCurrentView, triggerRankingRefresh, triggerSectorRefresh, triggerPortfolioRefresh } = useAppStore();
  const { refreshIndices } = useIndexStore();
  const { refreshInterval, getRefreshIntervalMs } = useSettingsStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 重置倒计时（不依赖 performRefresh，避免循环依赖）
  const resetCountdown = useCallback(() => {
    const intervalMs = getRefreshIntervalMs();
    const totalSeconds = Math.floor(intervalMs / 1000);
    
    // 清除旧的定时器
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (autoRefreshTimerRef.current) {
      clearTimeout(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = null;
    }
    
    // 重置倒计时数字
    setCountdown(totalSeconds);
    
    // 启动倒计时
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // 倒计时结束，触发自动刷新
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          return 0; // 刷新期间显示 0
        }
        return prev - 1;
      });
    }, 1000);
  }, [getRefreshIntervalMs]);

  // 执行刷新逻辑
  const performRefresh = useCallback(async () => {
    if (currentView === 'faq') {
      // FAQ 页面不需要刷新
      return;
    }
    
    setIsRefreshing(true);
    try {
      if (currentView === 'home') {
        // 首页：刷新指数、排行榜和热门板块
        triggerRankingRefresh(); // 触发排行榜刷新（同步操作）
        triggerSectorRefresh(); // 触发热门板块刷新（同步操作）
        await refreshIndices(); // 刷新指数数据
      } else {
        // 自选页：刷新自选列表
        await updateRealtimeData();
        // 触发自选页显示数据刷新
        triggerPortfolioRefresh();
      }
    } catch (error) {
      console.error('刷新失败:', error);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
        // 刷新完成后，重置倒计时开始下一轮
        resetCountdown();
      }, 1000);
    }
  }, [currentView, triggerRankingRefresh, triggerSectorRefresh, triggerPortfolioRefresh, refreshIndices, updateRealtimeData, resetCountdown]);

  // 监听倒计时到 0，触发自动刷新
  useEffect(() => {
    if (countdown === 0 && !isRefreshing && currentView !== 'faq') {
      performRefresh();
    }
  }, [countdown, isRefreshing, currentView, performRefresh]);

  // 手动刷新（用户点击）
  const handleRefresh = async () => {
    // 重置倒计时
    resetCountdown();
    // 执行刷新
    await performRefresh();
  };

  // 初始化倒计时和自动刷新
  useEffect(() => {
    if (currentView !== 'faq') {
      resetCountdown();
    } else {
      // FAQ 页面清除倒计时
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setCountdown(0);
    }
    
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (autoRefreshTimerRef.current) {
        clearTimeout(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    };
  }, [refreshInterval, currentView, resetCountdown]);

  return (
    <>
      <header 
        className="fixed top-0 left-0 right-0 z-[100] border-b border-border-subtle backdrop-blur-md"
        style={{
          background: 'linear-gradient(135deg, rgba(20, 20, 40, 0.98) 0%, rgba(15, 15, 25, 0.98) 100%)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100
        }}
      >
        <div className="container mx-auto px-2 sm:px-3 md:px-4 h-14 sm:h-16 md:h-20 flex items-center justify-between">
          {/* 品牌标识 - 移动端优化 */}
          <div className="flex items-center gap-2 sm:gap-4 md:gap-6 shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
              <i className="ri-bar-chart-grouped-line text-2xl sm:text-3xl md:text-4xl text-neon-red" />
              <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-display font-bold whitespace-nowrap">
                <span className="hidden sm:inline">FundPulse</span>
                <span className="sm:hidden">FP</span>
                <span className="text-neon-red ml-1 sm:ml-1.5">2.0</span>
              </h1>
            </div>
          </div>

          {/* 导航切换 - 移动端优化 */}
          <nav className="flex items-center gap-0.5 bg-white/5 backdrop-blur-xl rounded-lg sm:rounded-xl p-0.5 sm:p-1 border border-white/10 shadow-lg mx-2 sm:mx-4 flex-1 justify-center max-w-fit sm:max-w-none">
            <button
              onClick={() => setCurrentView('home')}
              className={clsx(
                'px-2 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-2.5 rounded-md sm:rounded-lg text-xs sm:text-sm md:text-base font-medium transition-all duration-300 relative overflow-hidden',
                'hover:bg-white/5 active:bg-white/10 active:scale-95',
                currentView === 'home'
                  ? 'text-white'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {/* 选中背景 - 优雅的渐变 */}
              {currentView === 'home' && (
                <>
                  <span className="absolute inset-0 bg-gradient-to-br from-white/15 via-white/10 to-white/5 rounded-md sm:rounded-lg" />
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 sm:w-10 md:w-12 h-0.5 bg-gradient-to-r from-transparent via-neon-blue to-transparent rounded-full opacity-80" />
                </>
              )}
              <span className="relative z-10">首页</span>
            </button>
            <button
              onClick={() => setCurrentView('portfolio')}
              className={clsx(
                'px-2 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-2.5 rounded-md sm:rounded-lg text-xs sm:text-sm md:text-base font-medium transition-all duration-300 relative overflow-hidden',
                'hover:bg-white/5 active:bg-white/10 active:scale-95',
                currentView === 'portfolio'
                  ? 'text-white'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {/* 选中背景 - 优雅的渐变 */}
              {currentView === 'portfolio' && (
                <>
                  <span className="absolute inset-0 bg-gradient-to-br from-white/15 via-white/10 to-white/5 rounded-md sm:rounded-lg" />
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 sm:w-10 md:w-12 h-0.5 bg-gradient-to-r from-transparent via-neon-blue to-transparent rounded-full opacity-80" />
                </>
              )}
              <span className="relative z-10">自选</span>
            </button>
            <button
              onClick={() => setCurrentView('faq')}
              className={clsx(
                'px-2 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-2.5 rounded-md sm:rounded-lg text-xs sm:text-sm md:text-base font-medium transition-all duration-300 relative overflow-hidden',
                'hover:bg-white/5 active:bg-white/10 active:scale-95',
                currentView === 'faq'
                  ? 'text-white'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {/* 选中背景 - 优雅的渐变 */}
              {currentView === 'faq' && (
                <>
                  <span className="absolute inset-0 bg-gradient-to-br from-white/15 via-white/10 to-white/5 rounded-md sm:rounded-lg" />
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 sm:w-10 md:w-12 h-0.5 bg-gradient-to-r from-transparent via-neon-blue to-transparent rounded-full opacity-80" />
                </>
              )}
              <span className="relative z-10">FAQ</span>
            </button>
          </nav>

          {/* 右侧操作按钮 - 移动端优化 */}
          <div className="flex items-center gap-1 sm:gap-2 md:gap-4 shrink-0">
            <a
              href="https://github.com/lighting-ai/fundpulse"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 sm:p-2 text-text-secondary hover:text-text-primary hover:text-neon-blue active:text-neon-blue active:scale-90 transition-all duration-150 rounded-lg hover:bg-white/5 active:bg-white/10"
              title="GitHub 开源地址"
            >
              <i className="ri-github-fill text-lg sm:text-xl" />
            </a>
            <button
              onClick={handleRefresh}
              className="relative p-1.5 sm:p-2 text-text-secondary hover:text-text-primary active:text-neon-blue active:scale-90 transition-all duration-150 rounded-lg hover:bg-white/5 active:bg-white/10 flex items-center justify-center"
              title={currentView === 'faq' ? '刷新数据' : `刷新数据 (${countdown}秒后自动刷新)`}
              disabled={currentView === 'faq'}
            >
              {currentView !== 'faq' ? (
                <>
                  {/* 圆形进度条背景 */}
                  <svg
                    className="absolute inset-0 w-full h-full transform -rotate-90"
                    viewBox="0 0 36 36"
                    style={{ width: '100%', height: '100%' }}
                  >
                    {/* 背景圆 */}
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.1)"
                      strokeWidth="2"
                    />
                    {/* 进度圆 */}
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray={`${2 * Math.PI * 16}`}
                      strokeDashoffset={`${2 * Math.PI * 16 * (1 - countdown / Math.floor(getRefreshIntervalMs() / 1000))}`}
                      className="text-neon-blue transition-all duration-1000"
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* 倒计时数字（显示在圆圈中心） */}
                  {!isRefreshing ? (
                    <span className="text-[12px] sm:text-[13px] font-mono font-semibold text-neon-blue z-10 relative">
                      {countdown}
                    </span>
                  ) : (
                    /* 刷新时显示旋转的刷新图标 */
                    <i className="ri-refresh-line text-lg sm:text-xl text-neon-blue refreshing z-10 relative" />
                  )}
                </>
              ) : (
                /* FAQ 页面显示普通刷新图标 */
                <i className="ri-refresh-line text-lg sm:text-xl relative z-10" />
              )}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 sm:p-2 text-text-secondary hover:text-text-primary active:text-neon-blue active:scale-90 transition-all duration-150 rounded-lg hover:bg-white/5 active:bg-white/10"
              title="设置"
            >
              <i className="ri-settings-3-line text-lg sm:text-xl" />
            </button>
          </div>
        </div>
      </header>
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
