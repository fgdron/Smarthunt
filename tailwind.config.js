/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg:       '#0A0A0F',
        surface:  '#141420',
        card:     '#1C1C2E',
        border:   '#2A2A3E',
        neon:     '#00FF88',
        'neon-d': '#00CC6A',
        elec:     '#00B4FF',
        gold:     '#FFD700',
        orange:   '#FF6B35',
        muted:    '#8A8A9A',
        faint:    '#4A4A5A',
      },
    },
  },
  plugins: [],
};
