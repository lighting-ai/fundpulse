# 问题解决指南

本文档记录了开发过程中遇到的常见问题及其解决方案。

---

## 🔍 常见问题

### 1. ETF 基金未匹配警告

#### 问题描述

控制台出现以下警告：

```
收到未匹配的基金代码: 161725，当前队列: ['008163', '018957', ...]
```

#### 原因

ETF 基金（如 008163 南方红利低波 50ETF 联接 A）不应该发起实时估值请求，但代码中对所有基金都发起了请求，导致队列混乱。

#### 解决方案

在 `fundStore.ts` 中添加 ETF 基金过滤逻辑：

```typescript
import { supportsRealtimeEstimate } from "../utils/fundDataManager";

// 在 updateRealtimeData 中添加检查
const shouldFetchRealtime = supportsRealtimeEstimate(
  fund.fundType,
  fund.ftype,
  fund.fundName
);

if (!shouldFetchRealtime) {
  // ETF基金直接跳过，不发起请求
  return { ...fund, isLoading: false };
}
```

#### 相关文件

- `src/store/fundStore.ts`
- `src/utils/fundDataManager.ts`

---

### 2. 用户看到旧版本页面

#### 问题描述

生产环境更新后，用户访问页面时看到的还是旧版本，需要手动刷新才能看到新版本。

#### 原因

- 浏览器缓存了旧的静态资源
- Service Worker 缓存了旧版本
- 没有版本检查机制

#### 解决方案

**方案 1: 版本检查机制（已实现）**

- 实现版本检查工具，自动检测更新
- 检测到更新时自动刷新页面
- 定期检查版本（每 10 分钟）

**方案 2: 手动清除缓存**

- 用户可以通过浏览器设置清除缓存
- 或者使用硬刷新（Ctrl+Shift+R / Cmd+Shift+R）

**方案 3: Service Worker 更新**

- Service Worker 会自动检测更新
- 新版本会自动激活并刷新页面

#### 相关文件

- `src/utils/versionCheck.ts`
- `src/main.tsx`
- `vite.config.ts`

---

### 3. TypeScript 编译错误

#### 问题描述

Docker 构建时出现 TypeScript 编译错误：

```
error TS2552: Cannot find name 'setIsValidating'
error TS2339: Property 'refreshFundTypes' does not exist
error TS2551: Property 'fundTypeCode' does not exist
```

#### 原因

- 变量未定义或类型定义不完整
- 接口缺少方法或属性声明

#### 解决方案

**错误 1: setIsValidating 未定义**

```typescript
// 重新添加状态变量
const [isValidating, setIsValidating] = useState(false);
// 或使用下划线前缀避免未使用警告
const [_isValidating, setIsValidating] = useState(false);
```

**错误 2: refreshFundTypes 方法不存在**

```typescript
// 在 FundStore 接口中添加方法声明
interface FundStore {
  // ...
  refreshFundTypes: () => Promise<{ success: number; failed: number }>;
}
```

**错误 3: fundTypeCode 属性不存在**

```typescript
// 在 FundSearchResult 接口中添加字段
export interface FundSearchResult {
  // ...
  fundTypeCode?: string; // FUNDTYPE，如"002"
}
```

#### 相关文件

- `src/components/HomePage.tsx`
- `src/store/fundStore.ts`
- `src/api/eastmoney.ts`

---

### 4. API 接口受限问题

#### 问题描述

某些 API 接口开始受限，出现 CORS 错误或 403 错误。

#### 原因

- API 服务商加强了安全策略
- 需要设置正确的 Referer 和 Host 头

#### 解决方案

**添加反向代理**
在 `Caddyfile` 中添加代理配置：

```caddy
handle /api/sector-list* {
    uri replace /api/sector-list /api/qt/clist/get
    reverse_proxy https://push2.eastmoney.com {
        header_up Referer "https://www.eastmoney.com/"
        header_up Host "push2.eastmoney.com"
    }
}
```

**更新代码使用代理**

```typescript
import { buildApiUrl } from "../utils/apiUtils";

const url = buildApiUrl(
  `https://push2.eastmoney.com/api/qt/clist/get`,
  `/api/sector-list`,
  params
);
```

#### 相关文件

- `Caddyfile`
- `src/api/sector.ts`
- `src/utils/apiUtils.ts`

---

### 5. 版本号维护困难

#### 问题描述

`index.html` 和 `package.json` 中的版本号需要分别维护，容易忘记更新。

#### 解决方案

**自动注入版本号**
在 `vite.config.ts` 中配置：

```typescript
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, 'package.json'), 'utf-8')
);
const appVersion = packageJson.version;

// 自定义插件
{
  name: 'inject-version',
  transformIndexHtml(html) {
    return html.replace(
      /<meta\s+name="version"\s+content="[^"]*"/i,
      `<meta name="version" content="${appVersion}"`
    );
  },
}
```

现在只需要在 `package.json` 中维护版本号即可。

#### 相关文件

- `vite.config.ts`
- `package.json`
- `index.html`

---

## 🛠️ 调试技巧

### 1. 查看版本信息

在浏览器控制台执行：

```javascript
localStorage.getItem("app_version");
localStorage.getItem("app_last_modified");
```

### 2. 检查 Service Worker 状态

在浏览器控制台执行：

```javascript
navigator.serviceWorker.getRegistrations().then((registrations) => {
  console.log("Service Workers:", registrations);
});
```

### 3. 清除缓存

```javascript
// 清除版本缓存
localStorage.removeItem("app_version");
localStorage.removeItem("app_last_modified");

// 清除Service Worker
navigator.serviceWorker.getRegistrations().then((registrations) => {
  registrations.forEach((registration) => registration.unregister());
});
```

### 4. 检查 API 代理

在 Network 标签中查看请求：

- 开发环境：直接请求原始 API
- 生产环境：请求 `/api/xxx` 代理路径

---

## 📝 最佳实践

### 1. 版本更新流程

1. 更新 `package.json` 中的版本号
2. 构建应用（版本号会自动注入）
3. 部署到生产环境
4. 用户访问时会自动检测更新并刷新

### 2. API 代理配置

- 开发环境：直接调用原始 API（绕过 CORS）
- 生产环境：使用代理路径（通过 Caddy 反向代理）

### 3. ETF 基金处理

- 在发起实时估值请求前，先检查基金是否支持
- ETF 基金直接跳过，不发起请求
- 提示用户手动输入成本价

### 4. 错误处理

- 版本检查失败不应该影响应用运行
- 使用 try-catch 包裹可能失败的操作
- 提供友好的错误提示

---

## 🔗 相关资源

- [开发总结](./2026-02-development-summary.md)
- [更新日志](./CHANGELOG.md)
- [部署文档](../DEPLOY.md)
- [Caddy 代理配置](../CADDY_PROXY.md)

---

**最后更新**: 2026 年 2 月 1 日
