/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'bg-universe': '#020617',
        'bg-deep': '#0b1220',
        'bg-elevated': 'rgba(30, 41, 59, 0.4)',
        'bg-floating': 'rgba(51, 65, 85, 0.6)',
        'border-subtle': 'rgba(148, 163, 184, 0.1)',
        'border-glow': 'rgba(59, 130, 246, 0.3)',
        'border-accent': 'rgba(99, 102, 241, 0.5)',
        'up-primary': '#ff6b6b',
        'up-glow': 'rgba(255, 107, 107, 0.4)',
        'down-primary': '#4ade80',
        'down-glow': 'rgba(74, 222, 128, 0.4)',
        'accent-blue': '#3b82f6',
        'accent-purple': '#8b5cf6',
        'accent-cyan': '#06b6d4',
        'text-primary': '#f8fafc',
        'text-secondary': '#94a3b8',
        'text-tertiary': '#64748b',
        'text-muted': '#475569',
        'chart-line': '#60a5fa',
        'chart-area-top': 'rgba(96, 165, 250, 0.3)',
        'chart-area-bottom': 'rgba(96, 165, 250, 0)',
        'chart-grid': 'rgba(148, 163, 184, 0.1)',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'monospace'],
        sans: ['Inter', 'SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        zh: ['PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
