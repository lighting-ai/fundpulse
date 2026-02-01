```

```

## 💻 完整 React 实现

**TypeScript**复制

```typescript
// api/fundRanking.ts
export interface RankedFund {
  code: string;           // 基金代码
  name: string;           // 基金简称
  pinyin: string;         // 拼音
  type: string;           // 类型（混合型、股票型等）
  manager: string;        // 基金经理
  nav: number;            // 单位净值
  accNav: number;         // 累计净值
  dailyGrowth: number;    // 日增长率%
  recent1Week: number;    // 近1周%
  recent1Month: number;   // 近1月%
  recent3Month: number;   // 近3月%
  recent6Month: number;   // 近6月%
  recent1Year: number;    // 近1年%
  recent2Year: number;    // 近2年%
  recent3Year: number;    // 近3年%
  thisYear: number;       // 今年来%
  sinceInception: number; // 成立来%
}

// 字段索引映射（根据实际返回调整）
const FIELD_INDEX = {
  code: 0,
  name: 1,
  pinyin: 2,
  type: 3,
  manager: 4,        // 注意：这个位置可能变动
  nav: 5,
  accNav: 6,
  dailyGrowth: 7,
  recent1Week: 8,
  recent1Month: 9,
  recent3Month: 10,
  recent6Month: 11,
  recent1Year: 12,
  recent2Year: 13,
  recent3Year: 14,
  thisYear: 15,
  sinceInception: 16
};

/**
 * 加载基金排行榜（JSONP方式）
 */
export const fetchFundRanking = (options: {
  type?: 'all' | 'gp' | 'hh' | 'zq' | 'zs' | 'qdii';
  sortBy?: '1nzf' | '1y' | '3y' | '6y' | '1n' | 'jn' | 'ln';
  pageSize?: number;
  pageIndex?: number;
} = {}): Promise<RankedFund[]> => {
  const {
    type = 'all',
    sortBy = '1y',     // 默认近1月热门
    pageSize = 50,
    pageIndex = 1
  } = options;

  // 计算日期范围（近1年）
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  
  const fmt = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '');

  const params = new URLSearchParams({
    op: 'ph',
    dt: 'kf',
    ft: type,
    rs: '',
    gs: '0',
    sc: sortBy,
    st: 'desc',
    sd: fmt(start),
    ed: fmt(end),
    qdii: type === 'qdii' ? '1' : '',
    pi: pageIndex.toString(),
    pn: pageSize.toString(),
    dx: '1',
    _: Date.now().toString()
  });

  return new Promise((resolve, reject) => {
    const callbackName = `rank_${Date.now()}`;
    const script = document.createElement('script');
    let cleaned = false;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (script.parentNode) script.parentNode.removeChild(script);
      delete (window as any).rankData;
      clearTimeout(timeout);
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('请求超时'));
    }, 15000);

    // 拦截全局变量
    Object.defineProperty(window, 'rankData', {
      configurable: true,
      set: function(value) {
        cleanup();
      
        if (!value || !Array.isArray(value.datas)) {
          reject(new Error('数据格式错误'));
          return;
        }

        try {
          const funds: RankedFund[] = value.datas.map((row: string) => {
            const cols = row.split(',');
            return {
              code: cols[FIELD_INDEX.code] || '',
              name: cols[FIELD_INDEX.name] || '',
              pinyin: cols[FIELD_INDEX.pinyin] || '',
              type: cols[FIELD_INDEX.type] || '混合型',
              manager: cols[FIELD_INDEX.manager] || '-',
              nav: parseFloat(cols[FIELD_INDEX.nav]) || 0,
              accNav: parseFloat(cols[FIELD_INDEX.accNav]) || 0,
              dailyGrowth: parseFloat(cols[FIELD_INDEX.dailyGrowth]) || 0,
              recent1Week: parseFloat(cols[FIELD_INDEX.recent1Week]) || 0,
              recent1Month: parseFloat(cols[FIELD_INDEX.recent1Month]) || 0,
              recent3Month: parseFloat(cols[FIELD_INDEX.recent3Month]) || 0,
              recent6Month: parseFloat(cols[FIELD_INDEX.recent6Month]) || 0,
              recent1Year: parseFloat(cols[FIELD_INDEX.recent1Year]) || 0,
              recent2Year: parseFloat(cols[FIELD_INDEX.recent2Year]) || 0,
              recent3Year: parseFloat(cols[FIELD_INDEX.recent3Year]) || 0,
              thisYear: parseFloat(cols[FIELD_INDEX.thisYear]) || 0,
              sinceInception: parseFloat(cols[FIELD_INDEX.sinceInception]) || 0
            };
          });
        
          resolve(funds);
        } catch (err) {
          reject(err);
        }
      }
    });

    script.src = `https://fund.eastmoney.com/data/rankhandler.aspx?${params.toString()}`;
    script.onerror = () => {
      cleanup();
      reject(new Error('脚本加载失败'));
    };
  
    document.body.appendChild(script);
  });
};
```

## 🎣 React Hook 封装

**TypeScript**复制

```typescript
// hooks/useRanking.ts
import { useState, useEffect, useCallback } from 'react';
import { fetchFundRanking, RankedFund } from '../api/fundRanking';

interface UseRankingOptions {
  type?: 'all' | 'gp' | 'hh' | 'zq' | 'zs' | 'qdii';
  sortBy?: '1nzf' | '1y' | '3y' | '6y' | '1n' | 'jn' | 'ln';
  pageSize?: number;
  autoLoad?: boolean;
}

export const useRanking = (options: UseRankingOptions = {}) => {
  const { autoLoad = true, ...fetchOptions } = options;
  
  const [funds, setFunds] = useState<RankedFund[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (overrideOptions?: Partial<UseRankingOptions>) => {
    setLoading(true);
    setError(null);
  
    try {
      const data = await fetchFundRanking({
        ...fetchOptions,
        ...overrideOptions
      });
      setFunds(data);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载失败';
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, [fetchOptions.type, fetchOptions.sortBy, fetchOptions.pageSize]);

  // 切换排序
  const sort = useCallback((sortBy: UseRankingOptions['sortBy']) => {
    return load({ sortBy });
  }, [load]);

  // 切换类型
  const filterType = useCallback((type: UseRankingOptions['type']) => {
    return load({ type });
  }, [load]);

  useEffect(() => {
    if (autoLoad) load();
  }, []);

  return {
    funds,
    loading,
    error,
    load,
    sort,
    filterType,
    refresh: () => load()
  };
};
```

## 🎨 UI 组件（集成到首页）

**tsx**复制

```tsx
// components/FundRankingSection.tsx
import { useRanking } from '../hooks/useRanking';
import { useState } from 'react';

export const FundRankingSection = () => {
  const { funds, loading, error, sort, filterType } = useRanking({
    type: 'all',
    sortBy: '1y',
    pageSize: 50
  });

  const [searchTerm, setSearchTerm] = useState('');

  const filteredFunds = funds.filter(f => 
    f.name.includes(searchTerm) || f.code.includes(searchTerm)
  );

  return (
    <div className="glass-card p-4 flex flex-col h-[600px]">
      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-1 bg-black/20 rounded-lg p-1">
          {[
            { id: 'all', label: '全部' },
            { id: 'gp', label: '股票型' },
            { id: 'hh', label: '混合型' },
            { id: 'zs', label: '指数型' },
            { id: 'zq', label: '债券型' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => filterType(t.id as any)}
              className="px-3 py-1 rounded-md text-sm transition-colors hover:text-white text-text-secondary"
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* 排序选择 */}
        <select 
          onChange={(e) => sort(e.target.value as any)}
          className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="1y">🔥 近1月热门</option>
          <option value="1nzf">📈 今日涨幅</option>
          <option value="3y">📊 近3月</option>
          <option value="1n">🏆 近1年</option>
          <option value="jn">🗓️ 今年来</option>
        </select>
      </div>

      {/* 搜索 */}
      <div className="relative mb-4">
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="搜索基金代码/名称..."
          className="w-full bg-black/30 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-neon-blue focus:outline-none"
        />
        <i className="ri-search-line absolute left-3 top-2.5 text-text-tertiary" />
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-text-secondary">
            <i className="ri-loader-4-line animate-spin mr-2" /> 加载中...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-red-400">
            <i className="ri-error-warning-line text-2xl mb-2" />
            <span className="text-sm">{error}</span>
            <button onClick={() => window.location.reload()} className="mt-2 text-xs underline">
              刷新重试
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-text-tertiary sticky top-0 bg-surface/80 backdrop-blur">
              <tr>
                <th className="py-2 text-left">基金名称</th>
                <th className="py-2 text-right">净值</th>
                <th className="py-2 text-right">日涨跌</th>
                <th className="py-2 text-right">近1月</th>
                <th className="py-2 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredFunds.map((fund, idx) => (
                <tr key={fund.code} className="group hover:bg-white/5 transition-colors">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-tertiary w-5">{idx + 1}</span>
                      <div>
                        <div className="font-medium text-text-primary">{fund.name}</div>
                        <div className="text-xs text-text-tertiary">{fund.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-right font-mono">{fund.nav.toFixed(4)}</td>
                  <td className={`py-3 text-right font-mono ${fund.dailyGrowth >= 0 ? 'text-up' : 'text-down'}`}>
                    {fund.dailyGrowth > 0 ? '+' : ''}{fund.dailyGrowth}%
                  </td>
                  <td className={`py-3 text-right font-mono ${fund.recent1Month >= 0 ? 'text-up' : 'text-down'}`}>
                    {fund.recent1Month > 0 ? '+' : ''}{fund.recent1Month}%
                  </td>
                  <td className="py-3 text-center">
                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => addToWatchlist(fund)}
                        className="p-1.5 rounded bg-neon-blue/10 text-neon-blue hover:bg-neon-blue/20"
                        title="加入自选"
                      >
                        <i className="ri-add-line" />
                      </button>
                      <button 
                        onClick={() => openFundModal(fund)}
                        className="p-1.5 rounded bg-neon-purple/10 text-neon-purple hover:bg-neon-purple/20"
                        title="AI诊断"
                      >
                        <i className="ri-robot-2-line" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
```


## 📋 参数详解

**表格**复制

| 参数     | 值             | 含义                                                                                                                         | 你的场景建议                                                  |
| :------- | :------------- | :--------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------ |
| `op`   | `ph`         | **operation** : performance history（业绩排行）                                                                        | 固定 `ph`                                                   |
| `dt`   | `kf`         | **data type** : 开放式基金（kaifang）                                                                                  | 固定 `kf`                                                   |
| `ft`   | `zs`         | **fund type** : 基金类型 ``• `all`=全部``• `gp`=股票型 ``• `hh`=混合型``• `zs`=指数型``• `zq`=债券型        | 看你需求：``• 想看全部热门用 `all`• 只看指数基金用 `zs` |
| `rs`   | 空             | **rating stars** : 晨星评级筛选 ``• `1`=一星``• `5`=五星``• 空=不限                                               | 首页推荐**留空** （不限评级）                           |
| `gs`   | `0`          | **gongsi** : 基金公司ID `0`=全部公司``其他数字=具体公司                                                              | 固定 `0`（看所有公司）                                      |
| `sc`   | `1nzf`       | **sort column** : 排序字段 ``• `1nzf`= **日涨幅** （1日净值增长）⭐``• `1y`=近1月 ``• `3y`=近3月``• `1n`=近1年 | **当日热门必须用 `1nzf`**                             |
| `st`   | `desc`       | **sort type** : 排序方式 ``• `desc`=降序（高→低）``• `asc`=升序                                                   | 热门排行用 `desc`                                           |
| `sd`   | `2025-02-01` | **start date** : 统计起始日期``（影响"近X月"等计算）                                                                   | 自动计算（1年前）                                             |
| `ed`   | `2026-02-01` | **end date** : 统计结束日期                                                                                            | 自动计算（今天）                                              |
| `qdii` | `\|`          | QDII基金标记 ``• `\|` 或 `1`=包含QDII``• 空=不包含                                                                          | 首页建议 `\|`（包含海外基金）                                |
| `pn`   | `50`         | **page number** : 每页条数                                                                                             | 固定 `50`（你要的50条）                                     |
| `pi`   | `1`          | **page index** : 页码                                                                                                  | 固定 `1`（第1页）                                           |
| `dx`   | `1`          | 未知参数（可能是data index）                                                                                                 | 固定 `1`                                                    |
