# 🚀 FundPulse 部署指南

本文档介绍 FundPulse 项目的多种部署方式。

## 📋 目录

- [GitHub Pages 部署](#github-pages-部署)
- [Docker 容器部署](#docker-容器部署)
- [Vercel 部署](#vercel-部署)
- [Netlify 部署](#netlify-部署)
- [手动部署](#手动部署)

---

## GitHub Pages 部署

### 前置条件

1. 确保代码已推送到 GitHub 仓库
2. 仓库设置为 Public（免费版）或已启用 GitHub Pages（私有仓库需要 GitHub Pro）

### 部署步骤

#### 方法一：使用 GitHub Actions（推荐）

1. **启用 GitHub Pages**
   - 进入仓库 Settings → Pages
   - Source 选择 "GitHub Actions"

2. **推送代码**
   - 工作流文件已配置在 `.github/workflows/deploy.yml`
   - 推送到 `main` 或 `master` 分支会自动触发构建和部署

3. **访问应用**
   - 部署完成后，访问：`https://<你的用户名>.github.io/<仓库名>/`
   - 首次部署可能需要几分钟

#### 方法二：手动部署

```bash
# 1. 安装依赖
npm install

# 2. 构建项目
npm run build

# 3. 使用 gh-pages 工具部署
npm install -g gh-pages
gh-pages -d dist
```

### 配置自定义域名

1. 在仓库根目录创建 `CNAME` 文件，内容为你的域名：
   ```
   example.com
   ```

2. 在 DNS 提供商添加 CNAME 记录：
   - 类型：CNAME
   - 名称：@ 或 www
   - 值：`<你的用户名>.github.io`

---

## Docker 容器部署

### 前置条件

- 已安装 Docker 和 Docker Compose（可选）

### 快速开始

#### 使用 Docker Compose（推荐）

```bash
# 1. 构建并启动容器
docker-compose up -d

# 2. 查看日志
docker-compose logs -f

# 3. 访问应用
# http://localhost:8080

# 4. 停止容器
docker-compose down
```

#### 使用 Docker 命令

```bash
# 1. 构建镜像
docker build -t fundpulse:latest .

# 2. 运行容器
docker run -d \
  --name fundpulse \
  -p 8080:80 \
  --restart unless-stopped \
  fundpulse:latest

# 3. 查看日志
docker logs -f fundpulse

# 4. 停止容器
docker stop fundpulse
docker rm fundpulse
```

### 生产环境部署

#### 使用 Nginx 反向代理

1. **创建 Nginx 配置** (`nginx.conf`):

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    root /usr/share/nginx/html;
    index index.html;
    
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

2. **更新 Dockerfile**，取消注释 Nginx 配置复制行：

```dockerfile
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

3. **重新构建并部署**：

```bash
docker-compose build
docker-compose up -d
```

#### 使用 HTTPS（Let's Encrypt）

```bash
# 使用 docker-compose 配合 certbot
# 参考：https://github.com/nginx-proxy/nginx-proxy
```

---

## Vercel 部署

### 前置条件

- 拥有 Vercel 账号（可使用 GitHub 账号登录）

### 部署步骤

#### 方法一：通过 Vercel Dashboard

1. 访问 [vercel.com](https://vercel.com)
2. 点击 "New Project"
3. 导入 GitHub 仓库
4. 配置：
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. 点击 "Deploy"

#### 方法二：使用 Vercel CLI

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 登录
vercel login

# 3. 部署
vercel

# 4. 生产环境部署
vercel --prod
```

### 配置文件 (`vercel.json`)

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

## Netlify 部署

### 前置条件

- 拥有 Netlify 账号（可使用 GitHub 账号登录）

### 部署步骤

1. 访问 [netlify.com](https://netlify.com)
2. 点击 "Add new site" → "Import an existing project"
3. 连接 GitHub 仓库
4. 配置：
   - Build command: `npm run build`
   - Publish directory: `dist`
5. 点击 "Deploy site"

### 配置文件 (`netlify.toml`)

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## 手动部署

### 构建步骤

```bash
# 1. 克隆仓库
git clone <your-repo-url>
cd fundpulse

# 2. 安装依赖
npm install

# 3. 构建项目
npm run build

# 4. dist 目录即为构建产物
# 可以将 dist 目录内容上传到任何静态文件服务器
```

### 部署到服务器

#### 使用 Nginx

```bash
# 1. 将 dist 目录内容复制到 Nginx 目录
sudo cp -r dist/* /var/www/html/

# 2. 配置 Nginx（参考上面的 nginx.conf）
sudo nano /etc/nginx/sites-available/fundpulse

# 3. 启用站点
sudo ln -s /etc/nginx/sites-available/fundpulse /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 使用 Apache

```bash
# 1. 将 dist 目录内容复制到 Apache 目录
sudo cp -r dist/* /var/www/html/

# 2. 启用 mod_rewrite
sudo a2enmod rewrite

# 3. 配置 .htaccess（在 dist 目录创建）
# RewriteEngine On
# RewriteBase /
# RewriteRule ^index\.html$ - [L]
# RewriteCond %{REQUEST_FILENAME} !-f
# RewriteCond %{REQUEST_FILENAME} !-d
# RewriteRule . /index.html [L]

# 4. 重启 Apache
sudo systemctl restart apache2
```

---

## 🔧 环境变量配置

如果需要配置环境变量，创建 `.env.production` 文件：

```env
VITE_API_BASE_URL=https://api.example.com
VITE_APP_TITLE=FundPulse
```

构建时会自动注入这些变量。

---

## 📝 常见问题

### 1. GitHub Pages 404 错误

**问题**：访问页面显示 404

**解决**：
- 检查 `vite.config.ts` 中的 `base` 配置：
  ```typescript
  export default defineConfig({
    base: '/<仓库名>/', // 如果部署在子路径
    // ...
  })
  ```

### 2. 路由刷新 404

**问题**：刷新页面后显示 404

**解决**：
- 确保服务器配置了 SPA 路由重写（参考上面的 Nginx/Apache 配置）

### 3. Docker 容器无法访问

**问题**：容器运行但无法访问

**解决**：
```bash
# 检查容器状态
docker ps

# 检查端口映射
docker port fundpulse

# 检查防火墙
sudo ufw allow 8080
```

### 4. 构建失败

**问题**：GitHub Actions 构建失败

**解决**：
- 检查 Node.js 版本是否兼容
- 检查依赖是否正确安装
- 查看 Actions 日志获取详细错误信息

---

## 🔐 安全建议

1. **HTTPS**：生产环境务必使用 HTTPS
2. **CSP 头**：配置内容安全策略
3. **CORS**：如果使用 API，正确配置 CORS
4. **环境变量**：敏感信息不要提交到代码仓库

---

## 📚 相关资源

- [Vite 部署指南](https://vitejs.dev/guide/static-deploy.html)
- [GitHub Pages 文档](https://docs.github.com/en/pages)
- [Docker 文档](https://docs.docker.com/)
- [Vercel 文档](https://vercel.com/docs)
- [Netlify 文档](https://docs.netlify.com/)

---

## 📞 支持

如有问题，请提交 Issue 或 Pull Request。
