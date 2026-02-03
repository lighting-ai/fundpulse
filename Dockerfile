# 多阶段构建 Dockerfile
# 阶段1: 构建阶段
FROM node:20-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production=false

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 阶段2: 生产阶段 - 使用 Caddy 提供静态文件服务和 API 代理
FROM caddy:2-alpine

# 复制构建产物到 Caddy 目录（支持子路径部署）
# 由于 vite.config.ts 中 base 设置为 '/fundpulse/'，需要将文件放在子目录中
RUN mkdir -p /usr/share/caddy/fundpulse
COPY --from=builder /app/dist /usr/share/caddy/fundpulse

# 验证文件是否正确复制（调试用）
RUN ls -la /usr/share/caddy/fundpulse/ || echo "目录为空或不存在"
RUN ls -la /usr/share/caddy/fundpulse/index.html || echo "index.html 不存在"

# 复制 Caddy 配置文件
COPY Caddyfile /etc/caddy/Caddyfile

# 暴露端口
EXPOSE 80

# 启动 Caddy
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
