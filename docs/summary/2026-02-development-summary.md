# FundPulse 开发总结 - 2026 年 2 月

本文档总结了 FundPulse 项目在 2026 年 2 月期间的主要开发工作、遇到的问题以及解决方案。

## 📋 版本信息

- **当前版本**: 2.0.1
- **开发周期**: 2026 年 2 月
- **主要更新**: UI 优化、功能完善、问题修复

---

## ✅ 完成的主要工作

### 1. UI/UX 优化

#### 1.1 PC 端自选页面表格列宽优化

**问题**: PC 端自选基金列表表格列宽不均衡，有的列宽有的列窄。

**解决方案**:

- 为表格添加 `table-fixed` 类，使用固定列宽布局
- 为每列设置合理的宽度：
  - 基金名称: 200px → 220px
  - 最新净值: 130px
  - 持有金额: 150px
  - 今日盈亏: 130px
  - 累计收益: 130px
  - 操作: 100px
- 移除了"类型"列，将基金类型移到基金代码后面显示

**文件**: `src/components/PortfolioPage.tsx`

#### 1.2 移动端 AI 标识按钮位置调整

**问题**: 移动端基金卡片中，AI 标识按钮显示在底部操作栏，用户希望保持在卡片右上角。

**解决方案**:

- 将 AI 标识按钮从底部操作栏移除
- 使用绝对定位将按钮移到卡片右上角
- 调整基金名称区域的 padding，避免与按钮重叠

**文件**: `src/components/PortfolioPage.tsx`

#### 1.3 PC 端基金类型显示位置调整

**问题**: PC 端自选页面中，基金类型单独占用一列，占用空间。

**解决方案**:

- 移除"类型"列
- 将基金类型放在基金代码后面，使用 `·` 分隔
- 与移动端保持一致的设计风格

**文件**: `src/components/PortfolioPage.tsx`

### 2. 功能完善

#### 2.1 统一添加基金弹窗样式和功能

**问题**: 首页热门基金列表的添加自选弹窗与自选页面的弹窗样式不一致，且不支持按数量输入。

**解决方案**:

- 统一两个弹窗的样式和交互逻辑
- 添加输入模式切换功能（按金额输入 / 按数量输入）
- 金额模式：输入持仓金额 + 成本价（可选）
- 份额模式：输入持仓成本价 + 持仓数量
- 显示预计计算结果（金额模式显示份额，份额模式显示金额）

**文件**:

- `src/components/FundRankingSection.tsx`
- `src/components/HomePage.tsx`
- `src/components/PortfolioPage.tsx`

#### 2.2 默认填充当前净值到持仓成本

**问题**: 用户添加或修改持仓时，需要手动输入成本价，不够便捷。

**解决方案**:

- 在打开持仓弹窗时，自动获取当前净值
- 将当前净值填充到持仓成本输入框
- 用户可以直接使用默认值，也可以手动修改
- 支持所有添加/修改持仓的场景

**文件**:

- `src/components/FundRankingSection.tsx`
- `src/components/HomePage.tsx`
- `src/components/PortfolioPage.tsx`
- `src/components/FundList.tsx`

### 3. 问题修复

#### 3.1 ETF 基金过滤问题修复

**问题**:

- 控制台出现"未匹配的基金代码"警告
- ETF 基金（如 008163 南方红利低波 50ETF 联接 A）不应该发起实时估值请求，但仍然发起了请求
- 导致队列混乱和错误提示

**根本原因**:

- `fundStore.ts` 中的 `updateRealtimeData` 函数对所有基金都调用了 `fetchFundRealtime`
- 没有检查基金是否支持实时估值（ETF 基金不支持实时估值）

**解决方案**:

- 在 `fundStore.ts` 中导入 `supportsRealtimeEstimate` 函数
- 在 `updateRealtimeData` 中添加 ETF 基金过滤逻辑
- 在 `refreshFund` 中也添加过滤逻辑
- 在 `addFund` 中添加过滤逻辑，ETF 基金提示用户手动输入成本价

**文件**: `src/store/fundStore.ts`

**相关规则**:

- 支持实时估值的基金：股票型(001)、混合型(002)、指数型(003)，但排除名称或类型中包含"ETF"的基金
- 不支持实时估值的基金：债券型(004)、货币型(005)、QDII(006)、FOF(007)、ETF 相关基金

#### 3.2 TypeScript 编译错误修复

**问题**: Docker 构建时出现 TypeScript 编译错误

**错误列表**:

1. `HomePage.tsx`: `setIsValidating` 未定义
2. `PortfolioPage.tsx`: `refreshFundTypes` 方法不存在
3. `fundStore.ts`: `fundTypeCode` 属性不存在

**解决方案**:

1. 重新添加 `isValidating` 状态变量（使用 `_isValidating` 前缀避免未使用警告）
2. 在 `FundStore` 接口中添加 `refreshFundTypes` 方法声明
3. 在 `FundSearchResult` 接口中添加 `fundTypeCode` 字段

**文件**:

- `src/components/HomePage.tsx`
- `src/components/PortfolioPage.tsx`
- `src/store/fundStore.ts`
- `src/api/eastmoney.ts`

### 4. 基础设施改进

#### 4.1 热门板块接口反向代理

**问题**: 热门板块接口 `https://push2.eastmoney.com/api/qt/clist/get` 开始受限，需要添加反向代理。

**解决方案**:

- 在 `Caddyfile` 中添加热门板块接口的反向代理配置
- 路径映射：`/api/sector-list` → `/api/qt/clist/get`
- 更新 `sector.ts` 使用 `buildApiUrl` 工具函数
- 开发环境直接调用原始 API，生产环境使用代理路径

**文件**:

- `Caddyfile`
- `src/api/sector.ts`

#### 4.2 版本检查和强制刷新机制

**问题**: 生产环境更新后，用户访问页面时看到的还是旧版本，因为浏览器缓存了旧的静态资源。

**解决方案**:

- 创建版本检查工具 `src/utils/versionCheck.ts`
- 实现两种检查方式：
  1. 版本号检查：通过 HTML 中的 `<meta name="version">` 标签检查版本
  2. 时间戳检查：如果版本号不可用，回退到检查 `Last-Modified` 头
- 使用 `workbox-window` 监听 Service Worker 更新事件
- 检测到更新时自动刷新页面
- 定期检查版本（每 10 分钟）
- Service Worker 定期检查更新（每 5 分钟）

**文件**:

- `src/utils/versionCheck.ts`
- `src/main.tsx`
- `index.html`
- `vite.config.ts`

#### 4.3 版本号自动从 package.json 读取

**问题**: `index.html` 中的版本号需要手动维护，容易忘记更新。

**解决方案**:

- 在 `vite.config.ts` 中读取 `package.json` 的版本号
- 创建自定义 Vite 插件 `inject-version`
- 使用 `transformIndexHtml` hook 在构建时自动替换 HTML 中的版本号
- 现在只需要在 `package.json` 中维护版本号即可

**文件**:

- `vite.config.ts`
- `index.html`

---

## 🔧 技术细节

### ETF 基金过滤逻辑

```typescript
// src/utils/fundDataManager.ts
export const supportsRealtimeEstimate = (
  fundTypeCode?: string,
  fundType?: string,
  fundName?: string
): boolean => {
  // 必须是股票型(001)、混合型(002)、指数型(003)
  const supportedTypes = ["001", "002", "003"];
  if (fundTypeCode && !supportedTypes.includes(fundTypeCode)) {
    return false;
  }

  // 如果基金名称包含"ETF"，不支持实时估值
  if (name.includes("ETF")) {
    return false;
  }

  // 如果基金类型字符串包含"ETF"，也不支持
  if (type.includes("ETF")) {
    return false;
  }

  return true;
};
```

### 版本检查机制

版本检查采用双重策略：

1. **版本号检查**（主要方式）:

   - 从 HTML 的 `<meta name="version">` 标签读取版本号
   - 与 localStorage 中缓存的版本号对比
   - 如果不匹配，立即刷新页面

2. **时间戳检查**（备用方式）:

   - 如果版本号检查失败，检查 `Last-Modified` 头
   - 对比服务器时间和缓存时间
   - 如果服务器时间更新，刷新页面

3. **Service Worker 监听**:
   - 使用 `workbox-window` 监听 Service Worker 更新
   - 监听 `waiting` 事件，自动激活新版本
   - 监听 `controlling` 事件，自动刷新页面

### 版本号自动注入

```typescript
// vite.config.ts
const packageJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
const appVersion = packageJson.version

{
  name: 'inject-version',
  transformIndexHtml(html) {
    return html.replace(
      /<meta\s+name="version"\s+content="[^"]*"/i,
      `<meta name="version" content="${appVersion}"`
    )
  },
}
```

---

## 📊 统计数据

### 代码变更统计

- **新增文件**: 1 个 (`src/utils/versionCheck.ts`)
- **修改文件**: 约 10 个
- **新增功能**: 3 个主要功能
- **问题修复**: 3 个关键问题

### 功能改进

- ✅ UI/UX 优化: 3 项
- ✅ 功能完善: 2 项
- ✅ 问题修复: 2 项
- ✅ 基础设施: 3 项

---

## 🐛 遇到的问题及解决方案

### 问题 1: ETF 基金未匹配警告

**现象**:

```
收到未匹配的基金代码: 161725，当前队列: ['008163', '018957', '018956', '022364', '018957']
```

**原因分析**:

- ETF 基金（如 008163）不应该发起实时估值请求
- 但 `fundStore.ts` 中的 `updateRealtimeData` 对所有基金都发起了请求
- 导致队列混乱和未匹配警告

**解决方案**:

- 添加 ETF 基金过滤逻辑
- 在发起请求前检查基金是否支持实时估值
- ETF 基金直接跳过，不发起请求

### 问题 2: 用户看到旧版本页面

**现象**:

- 生产环境更新后，用户访问页面时看到的还是旧版本
- 需要手动刷新才能看到新版本

**原因分析**:

- 浏览器缓存了旧的静态资源
- Service Worker 缓存了旧版本
- 没有版本检查机制

**解决方案**:

- 实现版本检查机制
- 自动检测更新并强制刷新
- 定期检查版本和 Service Worker 更新

### 问题 3: 版本号维护困难

**现象**:

- `index.html` 和 `package.json` 中的版本号需要分别维护
- 容易忘记更新，导致版本不一致

**解决方案**:

- 配置构建时自动从 `package.json` 读取版本号
- 自动注入到 `index.html` 中
- 只需在一个地方维护版本号

---

## 📝 最佳实践总结

### 1. 代码组织

- 将版本检查逻辑独立成工具文件，便于维护和测试
- 使用工具函数统一处理 API 代理路径

### 2. 错误处理

- 版本检查失败不应该影响应用运行
- 使用 try-catch 包裹可能失败的操作
- 提供友好的错误提示

### 3. 用户体验

- 自动填充默认值，减少用户输入
- 统一 UI 样式和交互逻辑
- 提供清晰的视觉反馈

### 4. 性能优化

- 定期检查更新，但不要过于频繁
- 使用 Service Worker 缓存策略
- 合理设置缓存时间

---

## 🔮 后续计划

### 短期计划

- [ ] 优化版本检查频率，避免过于频繁的检查
- [ ] 添加版本更新提示，让用户知道有新版本
- [ ] 完善错误处理和日志记录

### 中期计划

- [ ] 实现更智能的缓存策略
- [ ] 添加离线数据同步机制
- [ ] 优化移动端性能

### 长期计划

- [ ] 实现数据导出/导入功能
- [ ] 添加基金对比功能
- [ ] 实现收益计算器

---

## 📚 相关文档

- [部署文档](./DEPLOY.md)
- [Caddy 代理配置](./CADDY_PROXY.md)
- [实现总结](./IMPLEMENTATION.md)
- [算法说明](./ALGORITHM.md)

---

## 👥 贡献者

- 开发团队

---

**最后更新**: 2026 年 2 月 1 日
**文档版本**: 1.0
