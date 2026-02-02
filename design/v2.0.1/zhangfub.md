## **增强版：「热力层级」板块列表** —— 根据涨跌强度自动着色背景，一眼识别强势板块。

---

## 🎨 视觉规范：动态热力层级

**表格**复制

| 涨跌幅度    | 背景层级  | 视觉效果                                               |
| :---------- | :-------- | :----------------------------------------------------- |
| **≥ 3%**    | 深红/深绿 | `bg-gradient-to-r from-red-500/20 to-red-500/5` + 发光 |
| **1% - 3%** | 中红/中绿 | `bg-red-500/10`                                        |
| **0% - 1%** | 浅红/浅绿 | `bg-red-500/5`                                         |
| **≤ -3%**   | 深绿      | `bg-gradient-to-r from-green-500/20 to-green-500/5`    |

---

## 💻 完整实现代码

**tsx**复制

```tsx
// components/SectorListThermal.tsx

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

export const SectorListThermal = ({
  sectors,
  type = "up",
}: {
  sectors: SectorListItem[];
  type?: "up" | "down";
}) => {
  // 获取热力背景样式
  const getThermalStyle = (percent: number) => {
    const abs = Math.abs(percent);
    const isUp = percent >= 0;

    if (abs >= 3) {
      // 大涨：深渐变 + 发光
      return isUp
        ? "bg-gradient-to-r from-red-500/25 via-red-500/10 to-transparent shadow-[inset_0_0_20px_rgba(255,69,58,0.1)]"
        : "bg-gradient-to-r from-green-500/25 via-green-500/10 to-transparent shadow-[inset_0_0_20px_rgba(50,215,75,0.1)]";
    } else if (abs >= 1) {
      // 中涨：中等饱和度
      return isUp
        ? "bg-gradient-to-r from-red-500/12 to-transparent"
        : "bg-gradient-to-r from-green-500/12 to-transparent";
    } else {
      // 微涨：极浅
      return isUp ? "bg-red-500/[0.03]" : "bg-green-500/[0.03]";
    }
  };

  // 获取文字强调色（大涨用更亮的文字）
  const getTextStyle = (percent: number) => {
    const abs = Math.abs(percent);
    if (abs >= 3) return "text-white font-bold"; // 深背景下用白字
    if (abs >= 1) return "text-white/90";
    return "text-white/60"; // 微涨用灰色
  };

  const sortedSectors = [...sectors].sort((a, b) =>
    type === "up"
      ? b.changePercent - a.changePercent
      : a.changePercent - b.changePercent,
  );

  return (
    <div className="w-full bg-[#0b0b0f]/80 backdrop-blur-xl rounded-2xl border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-center py-3 border-b border-white/[0.06] bg-black/20">
        <div className="flex bg-black/40 rounded-lg p-0.5">
          <button
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
              type === "up" ? "bg-red-500/20 text-red-400" : "text-white/40"
            }`}
          >
            🔥 强势板块
          </button>
          <button
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
              type === "down"
                ? "bg-green-500/20 text-green-400"
                : "text-white/40"
            }`}
          >
            ❄️ 调整板块
          </button>
        </div>
      </div>

      {/* 列表 */}
      <div className="divide-y divide-white/[0.02]">
        {sortedSectors.map((sector, index) => {
          const isUp = sector.changePercent >= 0;
          const thermalClass = getThermalStyle(sector.changePercent);
          const textClass = getTextStyle(sector.changePercent);

          return (
            <div
              key={sector.code}
              className={`
                group relative flex items-center justify-between px-4 py-3.5 
                transition-all duration-300 cursor-pointer
                hover:brightness-110 active:scale-[0.995]
                ${thermalClass}
                ${index === 0 && Math.abs(sector.changePercent) >= 3 ? "border-l-2 border-red-500" : ""}
              `}
            >
              {/* 左侧：板块信息 */}
              <div className="flex flex-col gap-1 min-w-0 flex-1 z-10">
                <div
                  className={`text-[15px] tracking-tight truncate ${textClass}`}
                >
                  {sector.name}
                </div>

                {sector.leader && (
                  <div className="flex items-center gap-1.5 text-[11px] opacity-80">
                    <span className="text-white/30">▸</span>
                    <span className="text-white/50 truncate max-w-[100px]">
                      {sector.leader.name}
                    </span>
                    <span className={isUp ? "text-red-300" : "text-green-300"}>
                      {sector.leader.changePercent > 0 ? "+" : ""}
                      {sector.leader.changePercent.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>

              {/* 中间：价格信息（根据热度调整透明度） */}
              <div className="flex flex-col items-end mr-5 text-[11px] tabular-nums z-10">
                <div
                  className={
                    Math.abs(sector.changePercent) >= 3
                      ? "text-white/80"
                      : "text-white/40"
                  }
                >
                  {sector.price.toFixed(2)}
                </div>
                <div
                  className={`font-mono ${isUp ? "text-red-300/70" : "text-green-300/70"}`}
                >
                  {isUp ? "+" : ""}
                  {sector.change.toFixed(2)}
                </div>
              </div>

              {/* 右侧：涨跌幅（大字） */}
              <div
                className={`
                text-[20px] font-bold font-mono tracking-tight tabular-nums w-[80px] text-right z-10
                ${
                  Math.abs(sector.changePercent) >= 3
                    ? isUp
                      ? "text-white drop-shadow-[0_0_8px_rgba(255,69,58,0.5)]"
                      : "text-white drop-shadow-[0_0_8px_rgba(50,215,75,0.5)]"
                    : isUp
                      ? "text-red-400"
                      : "text-green-400"
                }
              `}
              >
                {sector.changePercent > 0 ? "+" : ""}
                {sector.changePercent.toFixed(2)}%
              </div>

              {/* 背景发光装饰（仅大涨） */}
              {Math.abs(sector.changePercent) >= 3 && (
                <div
                  className={`
                  absolute right-0 top-0 bottom-0 w-32 
                  bg-gradient-to-l ${isUp ? "from-red-500/20" : "from-green-500/20"} to-transparent 
                  pointer-events-none blur-xl
                `}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

---

## 🎯 关键特性说明

### 1. **自适应背景强度**

**TypeScript**复制

```typescript
// 大涨（>3%）：深红渐变 + 内发光
"bg-gradient-to-r from-red-500/25 via-red-500/10 to-transparent shadow-[inset_0_0_20px_rgba(255,69,58,0.1)]";

// 中涨（1-3%）：中等红色
"bg-gradient-to-r from-red-500/12 to-transparent";

// 微涨（<1%）：几乎透明，只保留文字颜色
"bg-red-500/[0.03]";
```

### 2. **第一名的特殊处理**

- 如果第一名涨幅 ≥3%，添加**左侧红色边框**标识龙头
- 使用 `drop-shadow` 让数字发光，类似 Apple Music 的「正在播放」高亮效果

### 3. **文字对比度自适应**

- 深背景（大涨）→ 使用纯白文字 `text-white`
- 浅背景（微涨）→ 使用灰色文字 `text-white/60`
- 确保在任何背景下都可读

### 4. **领涨股视觉降级**

- 使用 `opacity-80` 和更小的字号 `11px`
- 确保不会抢主涨跌幅的风头，但提供上下文

---

## 📊 使用效果对比

**普通微涨板块** （+0.5%）：

- 背景：几乎透明（3% 透明度）
- 文字：灰色
- 视觉权重：低

  **中涨板块** （+1.8%）：

- 背景：浅红渐变（12% 透明度）
- 文字：白色 90%
- 视觉权重：中等

  **龙头股** （+5.2%）：

- 背景：深红渐变（25% 透明度）+ 右侧光晕
- 文字：纯白 + 发光阴影
- 左侧：3px 红色边框标识
- 视觉权重：极高，一眼锁定

这套设计的核心逻辑是： **背景的「热量」直接映射数据的「强度」** ，用户无需阅读数字就能感知市场热度。

## API 参考

### 跌幅榜

```bash
curl $'https://push2.eastmoney.com/api/qt/clist/get?np=1&fltt=1&invt=2&cb=jQuery37102603071596836004_1770001838906&fs=m%3A90%2Bt%3A2%2Bf%3A\u002150&fields=f12%2Cf13%2Cf14%2Cf1%2Cf2%2Cf4%2Cf3%2Cf152%2Cf20%2Cf8%2Cf104%2Cf105%2Cf128%2Cf140%2Cf141%2Cf207%2Cf208%2Cf209%2Cf136%2Cf222&fid=f3&pn=1&pz=20&po=0&dect=1&ut=fa5fd1943c7b386f172d6893dbfba10b&wbp2u=%7C0%7C0%7C0%7Cweb&_=1770001839166' \
  -H 'Accept: */*' \
  -H 'Accept-Language: zh-CN,zh;q=0.9,en;q=0.8' \
  -H 'Connection: keep-alive' \
  -b 'qgqp_b_id=95d60d9e8fddf74f67a20794c7134363; st_nvi=SfGQibe0b6bBXOlo7yj5Xcd77; nid18=0f38fc1a4d417dd2a32a0335f8de07eb; nid18_create_time=1768144384560; gviem=XBwZCgQ8hiF3qG2pZW4Cy2e93; gviem_create_time=1768144384560; st_si=93484655794735; st_asi=delete; websitepoptg_api_time=1769913887672; fullscreengg=1; fullscreengg2=1; EMFUND1=null; EMFUND2=null; EMFUND3=null; EMFUND4=null; EMFUND5=null; EMFUND6=null; EMFUND7=null; EMFUND0=null; EMFUND9=02-01%2023%3A21%3A45@%23%24%u8DEF%u535A%u8FC8%u8D44%u6E90%u7CBE%u9009%u80A1%u7968%u53D1%u8D77A@%23%24021875; EMFUND8=02-02 01:50:48@#$%u6C38%u8D62%u79D1%u6280%u667A%u9009%u6DF7%u5408%u53D1%u8D77A@%23%24022364; st_pvi=48757770434461; st_sp=2026-01-11%2023%3A13%3A03; st_inirUrl=https%3A%2F%2Fwww.baidu.com%2Flink; st_sn=125; st_psi=20260202111051298-113200313002-0315827709' \
  -H 'Referer: https://quote.eastmoney.com/center/gridlist.html' \
  -H 'Sec-Fetch-Dest: script' \
  -H 'Sec-Fetch-Mode: no-cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"'
```

### 涨幅榜

```bash
curl $'https://push2.eastmoney.com/api/qt/clist/get?np=1&fltt=1&invt=2&cb=jQuery37102603071596836004_1770001838902&fs=m%3A90%2Bt%3A2%2Bf%3A\u002150&fields=f12%2Cf13%2Cf14%2Cf1%2Cf2%2Cf4%2Cf3%2Cf152%2Cf20%2Cf8%2Cf104%2Cf105%2Cf128%2Cf140%2Cf141%2Cf207%2Cf208%2Cf209%2Cf136%2Cf222&fid=f3&pn=1&pz=20&po=1&dect=1&ut=fa5fd1943c7b386f172d6893dbfba10b&wbp2u=%7C0%7C0%7C0%7Cweb&_=1770001839169' \
  -H 'Accept: */*' \
  -H 'Accept-Language: zh-CN,zh;q=0.9,en;q=0.8' \
  -H 'Connection: keep-alive' \
  -b 'qgqp_b_id=95d60d9e8fddf74f67a20794c7134363; st_nvi=SfGQibe0b6bBXOlo7yj5Xcd77; nid18=0f38fc1a4d417dd2a32a0335f8de07eb; nid18_create_time=1768144384560; gviem=XBwZCgQ8hiF3qG2pZW4Cy2e93; gviem_create_time=1768144384560; st_si=93484655794735; st_asi=delete; websitepoptg_api_time=1769913887672; fullscreengg=1; fullscreengg2=1; EMFUND1=null; EMFUND2=null; EMFUND3=null; EMFUND4=null; EMFUND5=null; EMFUND6=null; EMFUND7=null; EMFUND0=null; EMFUND9=02-01%2023%3A21%3A45@%23%24%u8DEF%u535A%u8FC8%u8D44%u6E90%u7CBE%u9009%u80A1%u7968%u53D1%u8D77A@%23%24021875; EMFUND8=02-02 01:50:48@#$%u6C38%u8D62%u79D1%u6280%u667A%u9009%u6DF7%u5408%u53D1%u8D77A@%23%24022364; st_pvi=48757770434461; st_sp=2026-01-11%2023%3A13%3A03; st_inirUrl=https%3A%2F%2Fwww.baidu.com%2Flink; st_sn=125; st_psi=20260202111051298-113200313002-0315827709' \
  -H 'Referer: https://quote.eastmoney.com/center/gridlist.html' \
  -H 'Sec-Fetch-Dest: script' \
  -H 'Sec-Fetch-Mode: no-cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"'
```

### 响应字段含义对照

```json
# 接口返回的第一条数据
{
    "f1": 2,
    "f2": 4052874,
    "f3": 323,
    "f4": 126740,
    "f8": 526,
    "f12": "BK0457",
    "f13": 90,
    "f14": "电网设备",
    "f20": 1915631664000,
    "f104": 118,
    "f105": 21,
    "f128": "顺钠股份",
    "f140": "000533",
    "f141": 0,
    "f136": 1002,
    "f152": 2,
    "f207": "华通线缆",
    "f208": "605196",
    "f209": 1,
    "f222": -963
}

# 官方网站显示的第一条数据
排名	板块名称	相关链接	最新价	涨跌额	涨跌幅	总市值	换手率	上涨家数	下跌家数	领涨股票	涨跌幅
1	电网设备
股吧资金流研报
40528.74	1267.40	3.23%	1.916万亿	5.26%	118	21	顺钠股份	10.02%
```
