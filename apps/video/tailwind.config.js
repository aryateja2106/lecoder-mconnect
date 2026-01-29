/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // LeCoder Monochrome Color Palette
        'bg-primary': '#191919',
        'bg-secondary': '#202020',
        'bg-elevated': '#252525',
        'bg-card': '#1f1f1f',
        'bg-hover': '#2a2a2a',
        'text-primary': '#e9e9e7',
        'text-secondary': '#9b9b9b',
        'text-muted': '#6b6b6b',
        'text-dim': '#4a4a4a',
        'border-subtle': '#2a2a2a',
        'border-default': '#373737',
        'border-hover': '#525252',
        'accent-green': '#4ade80',
        'accent-red': '#ef4444',
        'accent-yellow': '#fbbf24',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Consolas', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
      },
    },
  },
  plugins: [],
};
