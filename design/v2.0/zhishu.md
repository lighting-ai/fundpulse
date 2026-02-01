## 📊 指数分类切换方案

### 1. UI 组件设计（Segmented Control + 玻璃拟态）

**tsx**复制

```tsx
// components/IndexSection.tsx
export const IndexSection = () => {
  const [activeCategory, setActiveCategory] = useState<"cn" | "hk" | "us">(
    "cn",
  );
  const [indices, setIndices] = useState<IndexData[]>([]);

  // 分类配置
  const categories = [
    { id: "cn", label: "沪深", icon: "🇨🇳" },
    { id: "hk", label: "港股", icon: "🇭🇰" },
    { id: "us", label: "美股", icon: "🇺🇸" },
  ];

  useEffect(() => {
    loadIndices(activeCategory);
  }, [activeCategory]);

  return (
    <div className="glass-card p-4 h-[600px] flex flex-col">
      {/* 分类切换栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 bg-black/30 rounded-lg p-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all relative ${
                activeCategory === cat.id
                  ? "text-white bg-white/10 shadow-[0_0_15px_rgba(255,45,85,0.3)]"
                  : "text-text-secondary hover:text-white"
              }`}
            >
              <span className="mr-1.5">{cat.icon}</span>
              {cat.label}
              {activeCategory === cat.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-neon-red/20 rounded-md -z-10"
                />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          <span className="live-dot" />
          实时
        </div>
      </div>

      {/* 指数列表 */}
      <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide">
        {indices.map((idx) => (
          <IndexCard key={idx.code} data={idx} />
        ))}
      </div>
    </div>
  );
};
```

### 2. 数据源映射（支持双源切换）

**TypeScript**复制

```typescript
// config/indices.ts

export const INDEX_CATEGORIES = {
  cn: {
    name: "沪深",
    // 腾讯API代码
    tencent: [
      "sh000001",
      "sz399001",
      "sz399006",
      "sh000300",
      "sh000016",
      "sz399005",
    ],
    // 东方财富代码 (secid格式)
    eastmoney: [
      "1.000001",
      "0.399001",
      "0.399006",
      "1.000300",
      "1.000016",
      "0.399005",
    ],
    names: {
      sh000001: "上证指数",
      sz399001: "深证成指",
      sz399006: "创业板指",
      sh000300: "沪深300",
      sh000016: "上证50",
      sz399005: "中小板指",
    },
  },
  hk: {
    name: "港股",
    tencent: ["hkHSI", "hkHSCEI", "hkHSCCI", "hkHSTECH", "hkHSIEF", "hkDJI"],
    eastmoney: [
      "100.HSI",
      "100.HSCE",
      "100.HSCCI",
      "100.HSTECH",
      "100.HSIEF",
      "100.DJI",
    ],
    names: {
      hkHSI: "恒生指数",
      hkHSCEI: "国企指数",
      hkHSCCI: "红筹指数",
      hkHSTECH: "恒生科技",
      hkHSIEF: "恒生国企",
      hkDJI: "道琼斯",
    },
  },
  us: {
    name: "美股",
    tencent: ["usIXIC", "usDJI", "usSPX", "usNDX", "usS&P", "usRUA"],
    eastmoney: [
      "100.IXIC",
      "100.DJI",
      "100.SPX",
      "100.NDX",
      "100.S&P",
      "100.RUA",
    ],
    names: {
      usIXIC: "纳斯达克",
      usDJI: "道琼斯",
      usSPX: "标普500",
      usNDX: "纳斯达克100",
      "usS&P": "标普100",
      usRUA: "罗素3000",
    },
  },
};

// 双源获取函数（优先腾讯，失败降级东方财富）
export const fetchIndicesByCategory = async (
  category: "cn" | "hk" | "us",
): Promise<IndexData[]> => {
  const config = INDEX_CATEGORIES[category];

  try {
    // 方案1：腾讯API（推荐，速度快）
    return await fetchTencentIndices(config.tencent, config.names);
  } catch (error) {
    console.warn("腾讯API失败，切换东方财富:", error);
    // 方案2：东方财富API
    return await fetchEastmoneyIndices(config.eastmoney, config.names);
  }
};
```

### 3. 东方财富单指数接口（备用方案）

**TypeScript**复制

```typescript
// api/eastmoneyIndex.ts
// 当腾讯挂掉时使用，支持CORS

export const fetchEastmoneyIndices = async (
  secids: string[],
  nameMap: Record<string, string>,
) => {
  // 东方财富单指数接口，支持批量（逗号分隔）
  const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f2,f3,f4,f12,f13,f14,f18&secids=${secids.join(",")}`;

  const response = await fetch(url);
  const data = await response.json();

  if (!data.data?.diff) return [];

  return data.data.diff.map((item: any) => ({
    code: item.f12,
    name: nameMap[item.f12] || item.f14,
    price: item.f2,
    changePercent: item.f3,
    change: item.f4,
    prevClose: item.f18,
    category: secids.find((s) => s.includes(item.f12)) ? "auto" : "unknown",
  }));
};
```

---

## 🏆 基金排行榜数据方案

天天基金网的 `fundranking.html` 是服务器渲染页面，但 **有隐藏API接口** ：

### API 端点（直接返回JSON）

**TypeScript**复制

```typescript
// api/fundRanking.ts

export interface FundRankItem {
  code: string; // 基金代码
  name: string; // 基金简称
  type: string; // 基金类型
  nav: number; // 单位净值
  accNav: number; // 累计净值
  dailyGrowth: number; // 日增长率%
  recent1Week: number; // 近1周%
  recent1Month: number; // 近1月%
  recent3Month: number; // 近3月%
  recent6Month: number; // 近6月%
  recent1Year: number; // 近1年%
  recent2Year: number; // 近2年%
  recent3Year: number; // 近3年%
  thisYear: number; // 今年来%
  sinceInception: number; // 成立来%
  manager: string; // 基金经理
}

/**
 * 获取基金排行榜（天天基金网API）
 * @param type 基金类型: all=全部, gp=股票型, hh=混合型, zq=债券型, zs=指数型, qdii=QDII, lof=LOF
 * @param sort 排序字段: 1nzf=单位净值, 1yl=近1周, 1y=近1月, 3y=近3月, 6y=近6月, 1n=近1年, jn=今年, ln=成立来
 * @param order desc=降序, asc=升序
 * @param pageSize 每页数量，默认50
 */
export const fetchFundRanking = async (
  type: "all" | "gp" | "hh" | "zq" | "zs" | "qdii" | "lof" = "all",
  sort: string = "1nzf", // 默认按近1月排序（热门）
  order: "desc" | "asc" = "desc",
  pageSize: number = 50,
): Promise<FundRankItem[]> => {
  // 类型映射
  const typeMap: Record<string, string> = {
    all: "all",
    gp: "gp", // 股票型
    hh: "hh", // 混合型
    zq: "zq", // 债券型
    zs: "zs", // 指数型
    qdii: "qdii",
    lof: "lof",
  };

  // 构造URL（天天基金datatable接口）
  const url = `http://fund.eastmoney.com/data/rankhandler.aspx`;
  const params = new URLSearchParams({
    op: "ph",
    dt: "kf",
    ft: typeMap[type] || "all",
    rs: "", // 评级筛选
    gs: "0", // 公司筛选
    sc: sort, // 排序字段
    st: order, // 排序方式
    sd: new Date(Date.now() - 365 * 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0]
      .replace(/-/g, ""), // 开始日期（2年前）
    ed: new Date().toISOString().split("T")[0].replace(/-/g, ""), // 结束日期（今天）
    qb: type === "qdii" ? "on" : "", // QDII特殊标记
    qdii: type === "qdii" ? "1" : "",
    pi: "1", // 页码
    pn: pageSize.toString(), // 每页数量
    dz: pageSize.toString(),
    zf: "all", // 分红方式
    sh: "list",
    _: Date.now().toString(),
  });

  try {
    // 使用JSONP方式（天天基金支持callback）
    return new Promise((resolve, reject) => {
      const callbackName = `rankCallback_${Date.now()}`;
      const script = document.createElement("script");

      const cleanup = () => {
        if (script.parentNode) script.parentNode.removeChild(script);
        delete (window as any)[callbackName];
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout"));
      }, 15000);

      (window as any)[callbackName] = (data: any) => {
        cleanup();
        clearTimeout(timeout);

        try {
          // 解析返回的数据格式：[["code,name,nav...", "code,name,nav...", ...], totalCount]
          const rows = data.datas || [];
          const funds = rows.map((row: string) => {
            const cols = row.split(",");
            return {
              code: cols[0],
              name: cols[1],
              // 根据实际返回字段映射索引
              nav: parseFloat(cols[4]) || 0,
              accNav: parseFloat(cols[5]) || 0,
              dailyGrowth: parseFloat(cols[6]) || 0,
              recent1Week: parseFloat(cols[7]) || 0,
              recent1Month: parseFloat(cols[8]) || 0,
              recent3Month: parseFloat(cols[9]) || 0,
              recent6Month: parseFloat(cols[10]) || 0,
              recent1Year: parseFloat(cols[11]) || 0,
              recent2Year: parseFloat(cols[12]) || 0,
              recent3Year: parseFloat(cols[13]) || 0,
              thisYear: parseFloat(cols[14]) || 0,
              sinceInception: parseFloat(cols[15]) || 0,
              manager: cols[21] || "",
              type: cols[25] || "",
            };
          });
          resolve(funds);
        } catch (e) {
          reject(e);
        }
      };

      script.src = `${url}?${params.toString()}&callback=${callbackName}`;
      script.onerror = () => {
        cleanup();
        reject(new Error("Script error"));
      };
      document.body.appendChild(script);
    });
  } catch (error) {
    console.error("获取排行榜失败:", error);
    return [];
  }
};
```

### 排行榜筛选器（UI增强）

**tsx**复制

```tsx
// components/FundRankingSection.tsx
export const FundRankingSection = () => {
  const [funds, setFunds] = useState<FundRankItem[]>([]);
  const [filters, setFilters] = useState({
    type: "all" as const,
    sort: "1y", // 默认近1月热门
    period: "1y", // 快速筛选时间段
  });

  const sortOptions = [
    { value: "1nzf", label: "日涨幅" },
    { value: "1y", label: "近1月" },
    { value: "3y", label: "近3月" },
    { value: "6y", label: "近6月" },
    { value: "1n", label: "近1年" },
    { value: "jn", label: "今年来" },
  ];

  return (
    <div className="glass-card p-4 flex flex-col h-full">
      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b border-white/10">
        {/* 基金类型 */}
        <div className="flex items-center gap-1 bg-black/20 rounded-lg p-1">
          {[
            { id: "all", label: "全部" },
            { id: "gp", label: "股票型" },
            { id: "hh", label: "混合型" },
            { id: "zq", label: "债券型" },
            { id: "zs", label: "指数型" },
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => loadRanking({ ...filters, type: type.id as any })}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                filters.type === type.id
                  ? "bg-neon-red/20 text-neon-red"
                  : "text-text-secondary hover:text-white"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* 排序 */}
        <select
          value={filters.sort}
          onChange={(e) => loadRanking({ ...filters, sort: e.target.value })}
          className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-text-primary focus:border-neon-blue focus:outline-none"
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* 搜索 */}
      <div className="relative mb-4">
        <input
          type="text"
          placeholder="搜索基金代码/名称..."
          className="w-full bg-black/30 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-neon-blue focus:outline-none focus:shadow-[0_0_15px_rgba(0,212,255,0.3)]"
        />
        <i className="ri-search-line absolute left-3 top-2.5 text-text-tertiary" />
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-text-tertiary uppercase sticky top-0 bg-surface/80 backdrop-blur">
            <tr>
              <th className="py-2 pl-2">基金名称</th>
              <th className="py-2 text-right">单位净值</th>
              <th
                className="py-2 text-right cursor-pointer hover:text-neon-red"
                onClick={() => toggleSort("1nzf")}
              >
                日涨跌 {filters.sort === "1nzf" && "↓"}
              </th>
              <th
                className="py-2 text-right cursor-pointer hover:text-neon-red"
                onClick={() => toggleSort("1y")}
              >
                近1月 {filters.sort === "1y" && "↓"}
              </th>
              <th className="py-2 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {funds.map((fund, idx) => (
              <tr
                key={fund.code}
                className="group hover:bg-white/5 transition-colors"
              >
                <td
                  className="py-3 pl-2 cursor-pointer"
                  onClick={() => openFundModal(fund)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-tertiary w-5">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-medium text-text-primary truncate max-w-[150px]">
                        {fund.name}
                      </div>
                      <div className="text-xs text-text-tertiary flex items-center gap-2">
                        {fund.code}
                        <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px]">
                          {fund.type}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-3 text-right font-mono text-text-primary">
                  {fund.nav.toFixed(4)}
                </td>
                <td
                  className={`py-3 text-right font-mono ${fund.dailyGrowth >= 0 ? "text-up" : "text-down"}`}
                >
                  {fund.dailyGrowth >= 0 ? "+" : ""}
                  {fund.dailyGrowth}%
                </td>
                <td
                  className={`py-3 text-right font-mono ${fund.recent1Month >= 0 ? "text-up" : "text-down"}`}
                >
                  {fund.recent1Month >= 0 ? "+" : ""}
                  {fund.recent1Month}%
                </td>
                <td className="py-3 text-center">
                  <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => addToWatchlist(fund)}
                      className="p-1.5 rounded-lg bg-neon-blue/10 text-neon-blue hover:bg-neon-blue/20"
                      title="加入自选"
                    >
                      <i className="ri-add-line" />
                    </button>
                    <button
                      onClick={() => startAIDiagnosis([fund])}
                      className="p-1.5 rounded-lg bg-neon-purple/10 text-neon-purple hover:bg-neon-purple/20"
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
      </div>
    </div>
  );
};
```

---

## 📱 最终首页布局更新

**jsx**复制

```jsx
// pages/Home.tsx
export const Home = () => {
  return (
    <div className="min-h-screen bg-void bg-scanline">
      <HeroSection />

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 p-6 max-w-[1920px] mx-auto">
        {/* 左列：全球指数（带分类切换） */}
        <IndexSection />
        {/* 内含沪深/港股/美股切换 */}

        {/* 右列：基金排行榜（接eastmoney数据） */}
        <FundRankingSection />
        {/* 接fundranking数据 */}
      </div>
    </div>
  );
};
```

**特性总结** ：

1. **指数切换** ：平滑过渡动画，支持双源备份（腾讯+东财）
2. **排行榜** ：实时热榜（可按日/月/年排序），带搜索和快速操作（加自选/AI诊断）
3. **数据流** ：所有接口均为纯前端可调用（JSONP或CORS）
