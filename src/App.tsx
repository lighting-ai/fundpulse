import React, { useEffect } from 'react';
import { useFundStore } from './store/fundStore';
import { useDetailStore } from './store/detailStore';
import { useSettingsStore } from './store/settingsStore';
import { Header } from './components/Header';
import { IndexBar } from './components/IndexBar';
import { FundList } from './components/FundList';
import { NavChart } from './components/NavChart';
import { TopHoldings } from './components/TopHoldings';

function App() {
  const { watchlist, selectedFundCode, loadWatchlist, updateRealtimeData } = useFundStore();
  const { loadFundDetail, loadNavHistory } = useDetailStore();
  const { getRefreshIntervalMs } = useSettingsStore();

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

  // 加载选中基金的详情
  useEffect(() => {
    if (selectedFundCode) {
      loadFundDetail(selectedFundCode);
      loadNavHistory(selectedFundCode);
    }
  }, [selectedFundCode, loadFundDetail, loadNavHistory]);

  return (
    <div className="min-h-screen bg-bg-universe">
      <Header />
      <IndexBar />

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：自选基金列表 */}
          <aside className="lg:col-span-1">
            <FundList />
          </aside>

          {/* 右侧：详情区域 */}
          <div className="lg:col-span-2 space-y-6">
            {selectedFundCode ? (
              <>
                <NavChart />
                <TopHoldings />
              </>
            ) : (
              <div className="glass-card p-12 text-center">
                <i className="ri-line-chart-line text-5xl text-text-muted mb-4 block" />
                <div className="text-text-secondary text-lg mb-2">
                  选择一个基金查看详情
                </div>
                <div className="text-sm text-text-tertiary">
                  点击左侧基金卡片查看净值走势和重仓股信息
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 底部免责声明 */}
      <footer className="mt-12 py-6 border-t border-border-subtle">
        <div className="container mx-auto px-4 text-center text-xs text-text-tertiary">
          数据仅供参考，不构成投资建议。市场有风险，入市需谨慎。
        </div>
      </footer>
    </div>
  );
}

export default App;
