**修正后的排版** （PE 放右上角弱化显示，涨跌数据底部强化）：

复制

```
┌─────────────────────────┐
│ 上证指数     PE: 15.2   │  ← 名称（左）+ PE（右上，小字灰色）
│ 000001                  │  ← 代码（灰色小字）
│                         │
│      3345.67           │  ← 最新价（超大，绝对主角）
│                         │
│  ↑28.34    +0.85%      │  ← 底部：涨跌额（左，箭头+数字）+ 涨跌幅（右，红绿pill）
└─────────────────────────┘
```

---

## 💻 修正版组件代码

**tsx**复制

```tsx
// components/IndexCard.tsx
interface IndexCardProps {
  name: string; // 上证指数
  code: string; // 000001
  price: number; // 3345.67
  change: number; // 28.34
  changePercent: number; // 0.85
  pe?: number; // 15.2（可选，有些指数无PE）
}

export const IndexCard = ({
  name,
  code,
  price,
  change,
  changePercent,
  pe,
}: IndexCardProps) => {
  const isUp = change >= 0;

  return (
    <div className="relative w-[200px] h-[140px] p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:border-white/20 transition-all group overflow-hidden flex flex-col">
      {/* 顶部行：名称（左） + PE（右） */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text-primary tracking-wide truncate">
            {name}
          </div>
          <div className="text-[11px] text-text-tertiary font-mono mt-0.5 tracking-wider opacity-70">
            {code}
          </div>
        </div>

        {/* PE 放右上角，弱化显示（灰色小字） */}
        {pe && (
          <div className="text-[11px] text-text-tertiary font-mono flex items-center gap-0.5 opacity-60">
            <span className="text-[10px]">PE</span>
            <span>{pe.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* 中部：最新价（绝对主角，垂直居中偏上） */}
      <div className="flex-1 flex items-center justify-center my-1">
        <div className="text-[32px] font-mono font-bold text-white tracking-tighter tabular-nums leading-none group-hover:scale-[1.02] transition-transform">
          <FlipNumber value={price} decimals={2} />
        </div>
      </div>

      {/* 底部行：涨跌额（左） + 涨跌幅（右 pill） */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-auto">
        {/* 涨跌额：符号 ↑↓ 直接暗示含义，无需label */}
        <div
          className={`flex items-center gap-0.5 text-sm font-mono font-medium ${
            isUp ? "text-red-400" : "text-green-400"
          }`}
        >
          <span className="text-xs opacity-80">{isUp ? "↑" : "↓"}</span>
          <FlipNumber value={Math.abs(change)} decimals={2} />
        </div>

        {/* 涨跌幅：红绿pill，最显眼的颜色标识 */}
        <div
          className={`px-2 py-0.5 rounded-md text-xs font-bold font-mono ${
            isUp
              ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : "bg-green-500/20 text-green-400 border border-green-500/30"
          }`}
        >
          {isUp ? "+" : ""}
          {changePercent.toFixed(2)}%
        </div>
      </div>

      {/* 背景光晕（根据涨跌） */}
      <div
        className={`absolute -bottom-6 -right-6 w-28 h-28 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none ${
          isUp ? "bg-red-500" : "bg-green-500"
        }`}
      />
    </div>
  );
};
```

---

## 🎨 关键设计调整点

**表格**复制

| 位置       | 原设计            | 新设计          | 理由                               |
| :--------- | :---------------- | :-------------- | :--------------------------------- |
| **右上角** | 涨跌幅 pill（强） | PE（弱）        | PE是参考指标，不应抢视觉焦点       |
| **底部**   | 涨跌额 + PE       | 涨跌额 + 涨跌幅 | 涨跌数据放一起，对比更直观         |
| **涨跌幅** | 右上角 pill       | 底部 pill       | 与涨跌额左右对称，平衡构图         |
| **PE**     | 右下角灰色        | 右上角灰色      | 利用右上角空闲区，底部留给核心数据 |

---

## ✅ 无 Label 设计的暗示逻辑

- **"↑28.34"** → 正数+向上箭头 = **涨了28.34点** （不需要写"涨跌额"）
- **"+0.85%"** → 红绿pill = **涨幅百分比** （不需要写"涨跌幅"）
- **"PE 15.2"** → 右上角小字 = **市盈率参考** （字母P暗示）
- **大数字 3345.67** → 居中最大 = **当前价格** （位置暗示重要性）
