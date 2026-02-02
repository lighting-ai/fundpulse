这是与你们风格完全匹配的 **紫调热力板块列表** ：

## 🎨 风格适配要点

**表格**复制

| 元素       | 你们当前风格                    | 板块列表适配                    |
| :--------- | :------------------------------ | :------------------------------ |
| **背景**   | 深紫 `#0f0a1f` / 紫黑渐变       | 同色系玻璃态 `bg-purple-900/20` |
| **边框**   | 青色霓虹 `border-cyan-500/30`   | 同款青色发光边框                |
| **涨跌色** | 粉红 `#ff2d55` / 青绿 `#00d4ff` | 沿用，但与紫底对比更强烈        |
| **文字**   | 冷白 `#f8fafc` / 紫灰 `#a78bfa` | 同级字色                        |
| **发光**   | 青色阴影 `shadow-cyan-500/20`   | 大涨时添加紫色/青色光晕         |

---

## 💻 紫调风格板块组件

**tsx**复制

```tsx
// components/SectorListViolet.tsx
interface SectorListItem {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  leader?: {
    name: string;
    changePercent: number;
  };
}

export const SectorListViolet = ({
  sectors,
  type = "up",
}: {
  sectors: SectorListItem[];
  type?: "up" | "down";
}) => {
  // 紫调热力背景计算
  const getHeatStyle = (percent: number) => {
    const abs = Math.abs(percent);
    const isUp = percent >= 0;

    // 大涨：紫色发光背景 + 青色边框高亮
    if (abs >= 3) {
      return isUp
        ? "bg-gradient-to-r from-pink-500/20 via-purple-500/10 to-transparent border-l-2 border-pink-500 shadow-[inset_0_0_30px_rgba(255,45,85,0.1)]"
        : "bg-gradient-to-r from-cyan-500/20 via-purple-500/10 to-transparent border-l-2 border-cyan-500 shadow-[inset_0_0_30px_rgba(0,212,255,0.1)]";
    }
    // 中涨：浅紫背景
    else if (abs >= 1) {
      return "bg-purple-500/10";
    }
    // 微涨：几乎透明
    return "bg-purple-500/[0.02]";
  };

  const sortedSectors = [...sectors].sort((a, b) =>
    type === "up"
      ? b.changePercent - a.changePercent
      : a.changePercent - b.changePercent,
  );

  return (
    <div className="w-full h-full rounded-2xl bg-[#0a0514]/60 backdrop-blur-xl border border-purple-500/20 overflow-hidden shadow-[0_0_40px_rgba(139,92,246,0.1)]">
      {/* Header - 紫调风格 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-purple-500/20 bg-purple-950/30">
        <div className="flex items-center gap-2">
          <i className="ri-bar-chart-grouped-fill text-cyan-400 text-lg drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
          <h3 className="text-sm font-semibold text-purple-100 tracking-wide">
            热门板块
          </h3>
        </div>

        <div className="flex bg-black/40 rounded-lg p-0.5 border border-purple-500/30">
          <button
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              type === "up"
                ? "bg-pink-500/20 text-pink-400 border border-pink-500/30 shadow-[0_0_10px_rgba(255,45,85,0.2)]"
                : "text-purple-300/60 hover:text-purple-200"
            }`}
          >
            强势板块
          </button>
          <button
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              type === "down"
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                : "text-purple-300/60 hover:text-purple-200"
            }`}
          >
            调整板块
          </button>
        </div>
      </div>

      {/* 列表 */}
      <div className="divide-y divide-purple-500/10 overflow-y-auto max-h-[520px]">
        {sortedSectors.map((sector, index) => {
          const isUp = sector.changePercent >= 0;
          const rank = index + 1;

          return (
            <div
              key={sector.code}
              className={`
                group flex items-center justify-between px-5 py-3.5 
                transition-all duration-300 cursor-pointer
                hover:bg-purple-500/10
                ${getHeatStyle(sector.changePercent)}
              `}
            >
              {/* 左侧：排名 + 板块信息 */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* 排名 - 紫调风格 */}
                <div
                  className={`
                  w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono
                  ${
                    rank <= 3 && Math.abs(sector.changePercent) >= 2
                      ? isUp
                        ? "bg-pink-500/20 text-pink-400 border border-pink-500/40"
                        : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                      : "text-purple-400/50 bg-purple-500/10"
                  }
                `}
                >
                  {rank}
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="text-[15px] font-medium text-purple-50 truncate group-hover:text-white transition-colors">
                    {sector.name}
                  </div>

                  {sector.leader && (
                    <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
                      <span className="text-purple-400/60">▸</span>
                      <span className="text-purple-300/70 truncate max-w-[80px]">
                        {sector.leader.name}
                      </span>
                      <span
                        className={
                          isUp ? "text-pink-400/80" : "text-cyan-400/80"
                        }
                      >
                        {sector.leader.changePercent > 0 ? "+" : ""}
                        {sector.leader.changePercent.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 中间：价格信息 */}
              <div className="flex flex-col items-end mr-4 text-xs tabular-nums">
                <div className="text-purple-200/80 font-mono">
                  {sector.price.toFixed(2)}
                </div>
                <div
                  className={`font-mono text-[11px] ${isUp ? "text-pink-400/70" : "text-cyan-400/70"}`}
                >
                  {isUp ? "+" : ""}
                  {sector.change.toFixed(2)}
                </div>
              </div>

              {/* 右侧：涨跌幅 - 霓虹大字 */}
              <div
                className={`
                text-[18px] font-bold font-mono tracking-tight tabular-nums w-[80px] text-right
                ${
                  isUp
                    ? "text-pink-400 drop-shadow-[0_0_8px_rgba(255,45,85,0.4)]"
                    : "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]"
                }
              `}
              >
                {sector.changePercent > 0 ? "+" : ""}
                {sector.changePercent.toFixed(2)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

---

## 🎯 关键风格对齐

**表格**复制

| 截图元素                          | 适配方案                                  |
| :-------------------------------- | :---------------------------------------- |
| **深紫背景** `bg-[#0a0514]`       | 卡片容器同色，列表项 `bg-purple-500/10`   |
| **青色边框** `border-cyan-500/30` | Header 底边框 + Tab 选中态边框            |
| **粉红/青绿涨跌**                 | 沿用 `text-pink-400` / `text-cyan-400`    |
| **发光效果** `shadow-cyan`        | 大涨卡片添加 `shadow-[inset_0_0_30px...]` |
| **排名徽章**                      | Top3 用彩边徽章，其他用灰紫圆角           |

这样板块列表就和你们首页的指数条、基金榜完全统一成**紫调霓虹**风格了
