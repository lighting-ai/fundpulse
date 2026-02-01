import React from 'react';
import clsx from 'clsx';
import { useFundStore } from '../store/fundStore';
import { SettingsModal } from './SettingsModal';

export function Header() {
  const { updateRealtimeData } = useFundStore();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await updateRealtimeData();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <>
      <header className="sticky top-0 z-40 glass-card border-b border-border-subtle">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <i className="ri-bar-chart-grouped-line text-2xl text-accent-blue" />
            <h1 className="text-xl font-bold">FundPulse</h1>
          </div>

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
