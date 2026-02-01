import { create } from 'zustand';
import { db, MarketIndex } from '../db/schema';
import { fetchMultipleIndices, INDEX_CODES } from '../api/index';

interface IndexStore {
  indices: MarketIndex[];
  isLoading: boolean;
  error: string | null;

  loadIndices: () => Promise<void>;
  refreshIndices: () => Promise<void>;
}

export const useIndexStore = create<IndexStore>((set, get) => ({
  indices: [],
  isLoading: false,
  error: null,

  // 加载指数数据
  loadIndices: async () => {
    set({ isLoading: true, error: null });
    try {
      // 先尝试从缓存读取
      const cached = await db.indices.toArray();
      if (cached.length > 0) {
        const now = Date.now();
        const validCache = cached.filter(
          idx => now - idx.updatedAt.getTime() < 5 * 60 * 1000 // 5分钟内有效
        );
        
        if (validCache.length > 0) {
          set({ indices: validCache });
        }
      }

      // 后台更新
      await get().refreshIndices();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载失败' });
    } finally {
      set({ isLoading: false });
    }
  },

  // 刷新指数数据
  refreshIndices: async () => {
    try {
      const keys = Object.keys(INDEX_CODES);
      const data = await fetchMultipleIndices(keys);

      const indices: MarketIndex[] = data.map(item => ({
        code: item.code,
        name: item.name,
        currentPrice: item.currentPrice,
        changePercent: item.changePercent,
        updatedAt: new Date(),
      }));

      // 更新数据库
      await db.indices.bulkPut(indices);

      set({ indices });
    } catch (error) {
      console.error('刷新指数数据失败:', error);
      set({ error: error instanceof Error ? error.message : '刷新失败' });
    }
  },
}));
