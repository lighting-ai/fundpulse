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
        'bg-void': '#030305',
        'bg-surface': 'rgba(15, 15, 25, 0.6)',
        'bg-elevated': 'rgba(25, 25, 40, 0.8)',
        'neon-red': '#ff2d55',
        'neon-red-glow': 'rgba(255, 45, 85, 0.4)',
        'neon-blue': '#00d4ff',
        'neon-blue-glow': 'rgba(0, 212, 255, 0.3)',
        'neon-purple': '#bf5af2',
        'neon-purple-glow': 'rgba(191, 90, 242, 0.4)',
        'neon-amber': '#ff9f0a',
        'up': '#ff453a',
        'down': '#32d74b',
        'neutral': '#8e8e93',
        'border-subtle': 'rgba(255, 255, 255, 0.08)',
        'border-glow': 'rgba(255, 45, 85, 0.3)',
        'text-primary': 'rgba(255, 255, 255, 0.95)',
        'text-secondary': 'rgba(255, 255, 255, 0.6)',
        'text-tertiary': 'rgba(255, 255, 255, 0.35)',
        'chart-line': '#60a5fa',
        'chart-area-top': 'rgba(96, 165, 250, 0.3)',
        'chart-area-bottom': 'rgba(96, 165, 250, 0)',
        'chart-grid': 'rgba(148, 163, 184, 0.1)',
      },
      fontFamily: {
        display: ['Space Grotesk', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
        body: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
