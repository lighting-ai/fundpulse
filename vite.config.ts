import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
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
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
