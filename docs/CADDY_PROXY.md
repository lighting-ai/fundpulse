# Caddy 反向代理配置说明

## 📋 概述

使用 Caddy 替代 Nginx，同时提供：

1. **静态文件服务**：提供前端应用
2. **API 反向代理**：代理基金排行榜 API，设置正确的 Referer 绕过防盗链

## 🔧 配置说明

### Caddyfile 配置

```caddy
# API 代理：基金排行榜接口
handle /api/fund-ranking* {
    uri strip_prefix /api/fund-ranking
    reverse_proxy https://fund.eastmoney.com/data/rankhandler.aspx {
        header_up Referer "https://fund.eastmoney.com/"
        header_up Host "fund.eastmoney.com"
    }
}
```

### 工作原理

1. **前端请求**：`/api/fund-ranking?op=ph&dt=kf&...`
2. **Caddy 处理**：
   - `uri strip_prefix /api/fund-ranking` 移除前缀
   - 保留查询参数：`?op=ph&dt=kf&...`
   - 代理到：`https://fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&...`
3. **设置 Headers**：
   - `Referer: https://fund.eastmoney.com/` - 绕过防盗链
   - `Host: fund.eastmoney.com` - 确保服务器识别正确的域名

### 前端代码修改

`src/api/fundRanking.ts` 中的 `getApiUrl()` 函数：

```typescript
const getApiUrl = () => {
  const isProduction =
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";

  if (isProduction) {
    // 使用相对路径，通过 Caddy 代理
    return `/api/fund-ranking?${params.toString()}`;
  } else {
    // 开发环境直接调用原始 API
    return `https://fund.eastmoney.com/data/rankhandler.aspx?${params.toString()}`;
  }
};
```

## 🚀 部署

### Dockerfile 变更

```dockerfile
FROM caddy:2-alpine

RUN mkdir -p /usr/share/caddy/fundpulse
COPY --from=builder /app/dist /usr/share/caddy/fundpulse
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
```

### 构建和运行

```bash
# 构建镜像
docker build -t fundpulse:latest .

# 运行容器
docker run -d \
  --name fundpulse \
  -p 8080:80 \
  --restart unless-stopped \
  fundpulse:latest
```

## ✅ 优势

1. **简单配置**：Caddy 配置比 Nginx 更简洁
2. **自动 HTTPS**：Caddy 支持自动 HTTPS（如果配置域名）
3. **统一服务**：静态文件和 API 代理在同一服务中
4. **绕过限制**：通过设置正确的 Referer 绕过防盗链

## 🔍 测试

### 本地测试

```bash
# 启动容器
docker-compose up -d

# 查看日志
docker-compose logs -f

# 测试 API 代理
curl "http://localhost:8080/api/fund-ranking?op=ph&dt=kf&ft=all&sc=1nzf&st=desc&pi=1&pn=10"
```

### 生产环境测试

1. 访问应用：`https://your-domain.com/fundpulse/`
2. 打开浏览器开发者工具 → Network
3. 查看排行榜请求是否通过 `/api/fund-ranking` 代理
4. 检查响应是否成功（不再返回 "无访问权限"）

## 📝 注意事项

1. **开发环境**：仍然直接调用原始 API，避免本地开发时的代理复杂性
2. **生产环境**：自动使用代理，设置正确的 Referer
3. **JSONP 支持**：Caddy 透明代理 JSONP 响应，无需特殊处理
4. **缓存策略**：API 响应不缓存，确保数据实时性

## 🐛 故障排查

### 问题：API 仍然返回 404

**检查**：

1. Caddyfile 中的路径匹配是否正确
2. `uri strip_prefix` 是否正确移除前缀
3. 查询参数是否正确传递

**调试**：

```bash
# 进入容器
docker exec -it fundpulse sh

# 查看 Caddy 日志
cat /var/log/caddy/access.log
```

### 问题：仍然返回 "无访问权限"

**检查**：

1. `header_up Referer` 是否正确设置
2. `header_up Host` 是否正确设置
3. 服务器端是否还有其他验证机制

**解决方案**：

- 检查 Caddyfile 配置
- 查看浏览器 Network 面板中的请求 Headers
- 确认代理是否正常工作
