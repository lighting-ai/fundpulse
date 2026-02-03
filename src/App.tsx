import { useEffect } from 'react';
import { useFundStore } from './store/fundStore';
import { useSettingsStore } from './store/settingsStore';
import { useAppStore } from './store/appStore';
import { Header } from './components/Header';
import { HomePage } from './components/HomePage';
import { PortfolioPage } from './components/PortfolioPage';
import { FAQPage } from './components/FAQPage';
import { ScrollToTop } from './components/ScrollToTop';

function App() {
  const { loadWatchlist, updateRealtimeData } = useFundStore();
  const { getRefreshIntervalMs } = useSettingsStore();
  const { currentView } = useAppStore();

  // 初始化加载
  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  const renderContent = () => {
    switch (currentView) {
      case 'home':
        return <HomePage />;
      case 'portfolio':
        return <PortfolioPage />;
      case 'faq':
        return <FAQPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="min-h-screen bg-void">
      <Header />

      {renderContent()}

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
