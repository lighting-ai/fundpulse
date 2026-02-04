import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// 获取当前文件目录（ES modules 兼容）
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 读取 package.json 获取版本号
const packageJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
const appVersion = packageJson.version

// https://vitejs.dev/config/
export default defineConfig({
  // 设置基础路径，用于 GitHub Pages 子路径部署
  // 如果部署在根路径，设置为 '/'
  // 如果部署在子路径（如 /fundpulse/），设置为 '/fundpulse/'
  base: process.env.VITE_BASE_PATH || (process.env.ELECTRON ? './' : '/fundpulse/'),
  plugins: [
    react(),
    // 自定义插件：注入版本号到 HTML
    {
      name: 'inject-version',
      transformIndexHtml(html) {
        return html.replace(
          /<meta\s+name="version"\s+content="[^"]*"/i,
          `<meta name="version" content="${appVersion}"`
        )
      },
    },
    VitePWA({
      registerType: 'autoUpdate', // 自动更新，但我们会监听更新事件并强制刷新
      // 明确指定 Service Worker 文件名和路径
      filename: 'sw.js',
      strategies: 'generateSW',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // 清理旧的 Service Worker
        cleanupOutdatedCaches: true,
        skipWaiting: true, // 新版本立即激活
        clientsClaim: true, // 立即控制所有客户端
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fundgz\.1234567\.com\.cn/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'fund-api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 5 },
            },
          },
          {
            urlPattern: /^https:\/\/fund\.eastmoney\.com/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'fund-detail-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
      manifest: {
        name: 'FundPulse 基金看板',
        short_name: 'FundPulse',
        description: '本地隐私优先的基金净值追踪工具',
        theme_color: '#0b0f19',
        background_color: '#0b0f19',
        display: 'standalone',
        start_url: '/fundpulse/',
        icons: [
          { src: 'favicon.png', sizes: '192x192', type: 'image/png' },
          { src: 'favicon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
