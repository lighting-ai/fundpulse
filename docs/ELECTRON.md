# 📦 Electron 桌面应用打包指南

本指南介绍如何将 FundPulse 打包成 Windows、macOS 和 Linux 桌面应用。

## 🤖 GitHub Actions 自动构建

项目已配置 GitHub Actions 自动构建和发布流程：

### 自动发布到 Releases

当您推送一个以 `v` 开头的标签时（如 `v1.0.0`），GitHub Actions 会自动：

1. 在 Windows、macOS 和 Linux 上构建应用
2. 创建 GitHub Release
3. 上传构建好的安装包

### 使用方法

```bash
# 1. 提交所有更改
git add .
git commit -m "准备发布 v1.0.0"

# 2. 创建并推送标签
git tag v1.0.0
git push origin v1.0.0

# 3. GitHub Actions 会自动开始构建
# 4. 构建完成后，在 GitHub Releases 页面可以看到发布
```

### 手动触发构建

1. 前往 GitHub 仓库的 Actions 页面
2. 选择 "Build Electron App" 工作流
3. 点击 "Run workflow"
4. 输入版本号（如 1.0.0）
5. 点击 "Run workflow" 按钮

### 查看构建状态

- 前往 GitHub 仓库的 Actions 页面查看构建进度
- 构建完成后，前往 Releases 页面下载安装包

## 🚀 本地构建

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式运行

```bash
# 启动 Vite 开发服务器（在一个终端）
npm run dev

# 启动 Electron（在另一个终端）
npm run electron:dev
```

### 3. 构建桌面应用

#### Windows

```bash
npm run electron:build:win
```

构建完成后，exe 安装程序会在 `release/` 目录下。

#### macOS

```bash
npm run electron:build:mac
```

#### Linux

```bash
npm run electron:build:linux
```

## 📋 构建配置说明

### Windows 配置

- **安装程序类型**: NSIS（支持自定义安装路径）
- **架构**: x64
- **功能**:
  - 创建桌面快捷方式
  - 创建开始菜单快捷方式
  - 允许用户选择安装目录

### 自定义配置

编辑 `package.json` 中的 `build` 字段来自定义：

```json
{
  "build": {
    "appId": "com.fundpulse.app",
    "productName": "FundPulse",
    "win": {
      "target": "nsis",
      "icon": "public/favicon.svg"
    }
  }
}
```

## 🎨 图标配置

### Windows 图标

Windows 需要 `.ico` 格式的图标。建议创建以下尺寸：

- `public/icon.ico` (256x256 或更大)

可以使用在线工具将 SVG 转换为 ICO：
- https://convertio.co/svg-ico/
- https://cloudconvert.com/svg-to-ico

### macOS 图标

macOS 需要 `.icns` 格式。可以使用：
- https://cloudconvert.com/svg-to-icns

### Linux 图标

Linux 可以使用 PNG 或 SVG。

## 🔧 高级配置

### 修改窗口大小

编辑 `electron/main.js`：

```javascript
const win = new BrowserWindow({
  width: 1400,  // 修改宽度
  height: 900,  // 修改高度
  minWidth: 1200,
  minHeight: 700,
});
```

### 禁用开发者工具（生产环境）

编辑 `electron/main.js`，移除或注释掉：

```javascript
// win.webContents.openDevTools();
```

### 自定义应用菜单

可以在 `electron/main.js` 中添加菜单：

```javascript
const { Menu } = require('electron');

const template = [
  {
    label: '文件',
    submenu: [
      { role: 'quit' }
    ]
  },
  {
    label: '编辑',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' }
    ]
  }
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
```

## 📦 打包优化

### 减小应用体积

1. **排除不必要的文件**：在 `package.json` 的 `build.files` 中精确指定需要打包的文件
2. **使用 asar 打包**：Electron Builder 默认使用 asar 打包，可以减小体积
3. **移除开发依赖**：确保 `devDependencies` 中的包不会被包含

### 代码签名（可选）

对于 Windows，可以配置代码签名：

```json
{
  "build": {
    "win": {
      "sign": "path/to/sign.exe",
      "signingHashAlgorithms": ["sha256"]
    }
  }
}
```

## 🐛 常见问题

### 1. 构建失败：找不到 electron

```bash
npm install electron electron-builder --save-dev
```

### 2. Windows 构建需要管理员权限

某些情况下，Windows 构建可能需要管理员权限。

### 3. 图标不显示

确保图标文件存在且路径正确。Windows 需要使用 `.ico` 格式。

### 4. 应用无法启动

检查 `electron/main.js` 中的路径是否正确，特别是生产环境的 `loadFile` 路径。

## 📚 相关资源

- [Electron 官方文档](https://www.electronjs.org/docs)
- [Electron Builder 文档](https://www.electron.build/)
- [Vite + Electron 集成指南](https://vitejs.dev/guide/)

## 🔄 替代方案

如果 Electron 打包体积太大，可以考虑：

1. **Tauri** - 使用 Rust，体积更小
2. **PWA Builder** - 将 PWA 打包成桌面应用
3. **Nativefier** - 简单的命令行工具

## 📝 注意事项

- Electron 应用体积较大（通常 100MB+），因为包含了 Chromium 浏览器
- 首次启动可能较慢
- 建议在 Windows 上测试构建的 exe 文件
- 考虑使用代码签名以提升用户信任度
