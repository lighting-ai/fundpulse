import { useEffect } from 'react';
import { useFundStore } from './store/fundStore';
import { useSettingsStore } from './store/settingsStore';
import { useAppStore } from './store/appStore';
import { Header } from './components/Header';
import { HomePage } from './components/HomePage';
import { PortfolioPage } from './components/PortfolioPage';
import { ScrollToTop } from './components/ScrollToTop';

function App() {
  const { loadWatchlist, updateRealtimeData } = useFundStore();
  const { getRefreshIntervalMs } = useSettingsStore();
  const { currentView } = useAppStore();

  // 初始化加载
  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  // 自动刷新实时数据（根据设置）
  useEffect(() => {
    const interval = setInterval(() => {
      updateRealtimeData();
    }, getRefreshIntervalMs());
    return () => clearInterval(interval);
  }, [updateRealtimeData, getRefreshIntervalMs]);

  return (
    <div className="min-h-screen bg-void">
      <Header />

      {currentView === 'home' ? <HomePage /> : <PortfolioPage />}

      {/* 底部免责声明 */}
      <footer className="mt-12 py-6 border-t border-border-subtle">
        <div className="container mx-auto px-4 text-center text-xs text-text-tertiary">
          数据仅供参考，不构成投资建议。市场有风险，入市需谨慎。
        </div>
      </footer>

      {/* 回到顶部按钮 */}
      <ScrollToTop />
    </div>
  );
}

export default App;
