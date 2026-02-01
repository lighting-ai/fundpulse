import React from 'react';
import clsx from 'clsx';
import { useFundStore } from '../store/fundStore';
import { useAppStore } from '../store/appStore';
import { SettingsModal } from './SettingsModal';

export function Header() {
  const { updateRealtimeData } = useFundStore();
  const { currentView, setCurrentView } = useAppStore();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await updateRealtimeData();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

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
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <i className="ri-bar-chart-grouped-line text-4xl text-neon-red" />
              <h1 className="text-3xl font-display font-bold">
                FundPulse <span className="text-neon-red">2.0</span>
              </h1>
            </div>
          </div>

          {/* 导航切换 - 优雅设计 */}
          <nav className="flex items-center gap-0.5 bg-white/5 backdrop-blur-xl rounded-xl p-1 border border-white/10 shadow-lg">
            <button
              onClick={() => setCurrentView('home')}
              className={clsx(
                'px-8 py-2.5 rounded-lg text-base font-medium transition-all duration-300 relative overflow-hidden',
                'hover:bg-white/5',
                currentView === 'home'
                  ? 'text-white'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {/* 选中背景 - 优雅的渐变 */}
              {currentView === 'home' && (
                <>
                  <span className="absolute inset-0 bg-gradient-to-br from-white/15 via-white/10 to-white/5 rounded-lg" />
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-gradient-to-r from-transparent via-neon-blue to-transparent rounded-full opacity-80" />
                </>
              )}
              <span className="relative z-10">首页</span>
            </button>
            <button
              onClick={() => setCurrentView('portfolio')}
              className={clsx(
                'px-8 py-2.5 rounded-lg text-base font-medium transition-all duration-300 relative overflow-hidden',
                'hover:bg-white/5',
                currentView === 'portfolio'
                  ? 'text-white'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {/* 选中背景 - 优雅的渐变 */}
              {currentView === 'portfolio' && (
                <>
                  <span className="absolute inset-0 bg-gradient-to-br from-white/15 via-white/10 to-white/5 rounded-lg" />
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-gradient-to-r from-transparent via-neon-blue to-transparent rounded-full opacity-80" />
                </>
              )}
              <span className="relative z-10">自选</span>
            </button>
          </nav>

          <div className="flex items-center gap-4">
            <button
              onClick={handleRefresh}
              className="p-2 text-text-secondary hover:text-text-primary transition-colors"
              title="刷新数据"
            >
              <i
                className={clsx(
                  'ri-refresh-line text-xl',
                  isRefreshing && 'refreshing'
                )}
              />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-text-secondary hover:text-text-primary transition-colors"
              title="设置"
            >
              <i className="ri-settings-3-line text-xl" />
            </button>
          </div>
        </div>
      </header>
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
