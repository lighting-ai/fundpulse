## 🎯 数据获取方案（分两步）

图片中的数据需要组合两个接口：

**表格**复制

| 数据项                      | 来源接口                                  | 字段            |
| :-------------------------- | :---------------------------------------- | :-------------- |
| **股票名称** + **持仓占比** | `FundArchivesDatas.aspx?type=jjcc`        | `GPJC` + `JZBL` |
| **当日涨跌幅**              | `push2.eastmoney.com/api/qt/ulist.np/get` | `f3` (涨跌幅%)  |

---

## 1. 获取持仓基础信息（名称+占比）

**接口** ：

`http://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=022364&topline=10`

**返回示例** （需解析）：

**JavaScript**复制

```javascript
var apidata = {
  content: "<table>...</table>",
  Datas: {
    InverstPosition: {
      fundStocks: [
        {
          GPDM: "600183", // 股票代码
          GPJC: "生益科技", // 股票名称
          JZBL: "9.11", // 占净值比例 (%)
          PTS: "1234.56", // 持股数（万股）
          CCSZ: "56789.12", // 持仓市值（万元）
          // ... 其他字段
        },
      ],
      stockCodes: "600183,300308,002463...", // 逗号分隔的代码
      stockNames: "生益科技,中际旭创,沪电股份...", // 逗号分隔的名称
    },
  },
};
```

---

## 2. 获取股票实时涨跌幅

**接口** （支持批量查询，无跨域限制）：

`https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f2,f3,f12,f14,f9&secids=0.600183,0.300308,0.002463,0.300502,0.002916...`

**字段说明** ：

- `secids`: 股票代码列表，格式为 `市场.代码`（0=深市, 1=沪市）
- `f2`: 最新价
- `f3`: **涨跌幅%** （就是你要的当日涨跌）
- `f12`: 股票代码
- `f14`: 股票名称
- `f9`: 市盈率

  **返回示例** ：

**JSON**复制

```json
{
  "data": {
    "total": 10,
    "diff": [
      {
        "f2": 28.5, // 最新价
        "f3": -0.65, // 涨跌幅% (-0.65% 绿色)
        "f12": "600183", // 股票代码
        "f14": "生益科技", // 股票名称
        "f9": 25.3 // 市盈率
      }
    ]
  }
}
```

---

## 💻 完整实现代码

**TypeScript**复制

```typescript
// api/fundHoldings.ts

export interface HoldingStock {
  code: string; // 600183
  name: string; // 生益科技
  ratio: number; // 9.11 (%)
  price: number; // 28.50 (当前价)
  changePercent: number; // -0.65 (%)
  shares?: number; // 持股数(万股)
  marketValue?: number; // 持仓市值(万元)
}

/**
 * 格式化股票代码为 secids 格式 (0.代码=深市, 1.代码=沪市)
 */
const formatSecid = (code: string): string => {
  // 科创板(688开头)、沪市主板(600/601/603开头) -> 1.
  // 创业板(300/301开头)、深市主板(000/001/002开头) -> 0.
  // 北交所(8/4开头) -> 0.
  if (code.startsWith("6") || code.startsWith("68") || code.startsWith("5")) {
    return `1.${code}`; // 沪市
  }
  return `0.${code}`; // 深市
};

/**
 * 步骤1：获取基金持仓（名称+占比）
 */
const fetchHoldingsBasic = async (
  fundCode: string,
): Promise<Partial<HoldingStock>[]> => {
  return new Promise((resolve, reject) => {
    const callbackName = `holding_${Date.now()}`;
    const script = document.createElement("script");

    const cleanup = () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      delete (window as any)[callbackName];
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timeout"));
    }, 10000);

    (window as any)[callbackName] = (data: any) => {
      cleanup();
      clearTimeout(timeout);

      try {
        const stocks = data?.Datas?.InverstPosition?.fundStocks || [];
        const holdings = stocks.map((item: any) => ({
          code: item.GPDM,
          name: item.GPJC,
          ratio: parseFloat(item.JZBL) || 0,
          shares: parseFloat(item.PTS), // 万股
          marketValue: parseFloat(item.CCSZ), // 万元
        }));
        resolve(holdings);
      } catch (e) {
        reject(e);
      }
    };

    // 东方财富 F10 持仓接口
    script.src = `http://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=${fundCode}&topline=10&callback=${callbackName}`;
    script.onerror = () => {
      cleanup();
      reject(new Error("Failed to load"));
    };
    document.body.appendChild(script);
  });
};

/**
 * 步骤2：批量获取股票实时行情（涨跌+价格）
 */
const fetchStocksRealtime = async (
  stocks: Partial<HoldingStock>[],
): Promise<HoldingStock[]> => {
  const secids = stocks.map((s) => formatSecid(s.code!)).join(",");

  // 东方财富股票行情接口（支持跨域）
  const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f2,f3,f12,f14,f9&secids=${secids}&_=${Date.now()}`;

  const response = await fetch(url);
  const data = await response.json();

  const realtimeMap = new Map();
  if (data.data?.diff) {
    data.data.diff.forEach((item: any) => {
      realtimeMap.set(item.f12, {
        price: item.f2,
        changePercent: item.f3, // 关键字段：涨跌幅%
        pe: item.f9,
      });
    });
  }

  // 合并数据
  return stocks.map((stock) => {
    const realtime = realtimeMap.get(stock.code) || {
      price: 0,
      changePercent: 0,
    };
    return {
      ...stock,
      price: realtime.price,
      changePercent: realtime.changePercent,
    } as HoldingStock;
  });
};

/**
 * 获取基金完整持仓（带涨跌幅）
 */
export const fetchFundHoldingsWithQuote = async (
  fundCode: string,
): Promise<HoldingStock[]> => {
  try {
    // 1. 先获取持仓基础信息（代码、名称、占比）
    const basicHoldings = await fetchHoldingsBasic(fundCode);

    if (basicHoldings.length === 0) {
      return [];
    }

    // 2. 再获取实时行情（价格、涨跌幅）
    const fullHoldings = await fetchStocksRealtime(basicHoldings);

    // 3. 按持仓占比排序（降序）
    return fullHoldings.sort((a, b) => b.ratio - a.ratio);
  } catch (error) {
    console.error("获取持仓失败:", error);
    return [];
  }
};
```

---

## 🎨 UI 展示组件（配合图片样式）

**tsx**复制

```tsx
// components/HoldingsTable.tsx
import { HoldingStock } from "../api/fundHoldings";
import { formatNumber } from "../utils/format";

export const HoldingsTable = ({ holdings }: { holdings: HoldingStock[] }) => {
  return (
    <div className="glass-card p-4 mt-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white/90 flex items-center gap-2">
          <i className="ri-stack-line text-blue-400"></i>
          前十大重仓股
        </h3>
        <span className="text-xs text-white/40">
          持仓合计: {holdings.reduce((sum, h) => sum + h.ratio, 0).toFixed(2)}%
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/40 border-b border-white/10">
              <th className="text-left py-2 font-normal">股票名称</th>
              <th className="text-right py-2 font-normal">持仓占比</th>
              <th className="text-right py-2 font-normal">涨跌幅</th>
              <th className="text-right py-2 font-normal hidden sm:table-cell">
                持仓市值
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {holdings.map((stock) => (
              <tr
                key={stock.code}
                className="hover:bg-white/5 transition-colors"
              >
                <td className="py-3">
                  <div className="flex flex-col">
                    <span className="text-white font-medium">{stock.name}</span>
                    <span className="text-xs text-white/40">{stock.code}</span>
                  </div>
                </td>
                <td className="text-right py-3">
                  <span className="text-white font-mono font-semibold">
                    {stock.ratio.toFixed(2)}%
                  </span>
                </td>
                <td className="text-right py-3">
                  <span
                    className={`font-mono font-medium ${
                      stock.changePercent > 0
                        ? "text-red-400"
                        : stock.changePercent < 0
                          ? "text-green-400"
                          : "text-white/60"
                    }`}
                  >
                    {stock.changePercent > 0 ? "+" : ""}
                    {stock.changePercent.toFixed(2)}%
                  </span>
                </td>
                <td className="text-right py-3 text-white/60 hidden sm:table-cell">
                  {stock.marketValue
                    ? `${(stock.marketValue / 10000).toFixed(2)}亿`
                    : "-"}
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

## ⚠️ 重要提示

1. **持仓频率** ：`FundArchivesDatas` 接口返回的是 **季报数据** （非实时），通常每个季度更新一次（1月、4月、7月、10月披露），所以持仓占比是截止上个季度的数据，不是实时的。
2. **涨跌幅是实时的** ：`push2.eastmoney.com` 接口返回的是**当日实时**涨跌幅，每3-15秒刷新一次。
3. **数据延迟** ：持仓占比（季度报告）+ 当日涨跌（实时）的组合，能帮你判断"今天基金为什么涨/跌"（比如前10大重仓里有8只涨，那基金今天大概率估值上涨）。
