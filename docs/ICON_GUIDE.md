# 🎨 Electron 图标配置指南

## 问题说明

Electron 应用需要特定格式和尺寸的图标文件：

- **Windows**: 需要真正的 `.ico` 格式（不是 PNG 重命名为 .ico）
- **macOS**: 需要 `.icns` 格式，且至少 512x512 像素
- **Linux**: 可以使用 PNG 或 SVG

## 当前状态

目前 `public/favicon.ico` 实际上是 PNG 格式（256x256），不符合 Electron 构建要求。为了确保构建能够成功，我们暂时移除了图标配置。

## 如何添加正确的图标

### 方法 1: 使用在线工具生成

1. **准备源图片**：准备一个至少 512x512 的 PNG 图片（建议使用 SVG 或高分辨率 PNG）

2. **生成 Windows 图标 (.ico)**：
   - 访问 https://convertio.co/png-ico/ 或 https://cloudconvert.com/png-to-ico
   - 上传 PNG 图片
   - 下载生成的 `.ico` 文件
   - 保存为 `build/icon.ico`

3. **生成 macOS 图标 (.icns)**：
   - 访问 https://cloudconvert.com/png-to-icns
   - 上传至少 512x512 的 PNG 图片
   - 下载生成的 `.icns` 文件
   - 保存为 `build/icon.icns`

### 方法 2: 使用命令行工具（macOS）

```bash
# 安装 iconutil（macOS 自带）
# 创建 iconset 目录结构
mkdir icon.iconset

# 复制不同尺寸的 PNG 图片到 iconset
cp icon-16x16.png icon.iconset/icon_16x16.png
cp icon-32x32.png icon.iconset/icon_16x16@2x.png
cp icon-32x32.png icon.iconset/icon_32x32.png
cp icon-64x64.png icon.iconset/icon_32x32@2x.png
cp icon-128x128.png icon.iconset/icon_128x128.png
cp icon-256x256.png icon.iconset/icon_128x128@2x.png
cp icon-256x256.png icon.iconset/icon_256x256.png
cp icon-512x512.png icon.iconset/icon_256x256@2x.png
cp icon-512x512.png icon.iconset/icon_512x512.png
cp icon-1024x1024.png icon.iconset/icon_512x512@2x.png

# 生成 .icns 文件
iconutil -c icns icon.iconset
mv icon.icns build/
```

### 方法 3: 使用 ImageMagick（跨平台）

```bash
# 安装 ImageMagick
# macOS: brew install imagemagick
# Ubuntu: sudo apt-get install imagemagick
# Windows: 下载安装包

# 生成 Windows .ico（包含多个尺寸）
convert icon-16.png icon-32.png icon-48.png icon-64.png icon-128.png icon-256.png build/icon.ico

# 生成 macOS .icns（需要先创建 iconset）
# ... (参考方法 2)
```

## 配置 package.json

添加图标后，更新 `package.json` 的 `build` 配置：

```json
{
  "build": {
    "win": {
      "icon": "build/icon.ico"
    },
    "mac": {
      "icon": "build/icon.icns"
    },
    "linux": {
      "icon": "build/icon.png"  // 512x512 PNG
    }
  }
}
```

## 推荐的图标尺寸

### Windows (.ico)
- 16x16
- 32x32
- 48x48
- 64x64
- 128x128
- 256x256

### macOS (.icns)
- 16x16 (@1x 和 @2x)
- 32x32 (@1x 和 @2x)
- 128x128 (@1x 和 @2x)
- 256x256 (@1x 和 @2x)
- 512x512 (@1x 和 @2x)
- 1024x1024 (可选)

## 临时解决方案

如果暂时没有合适的图标文件，可以：

1. 使用默认 Electron 图标（当前配置）
2. 后续添加图标后更新配置

## 参考资源

- [Electron Builder 图标文档](https://www.electron.build/icons)
- [ICO 格式说明](https://en.wikipedia.org/wiki/ICO_(file_format))
- [ICNS 格式说明](https://en.wikipedia.org/wiki/Apple_Icon_Image_format)
