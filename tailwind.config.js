/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Warm, Cursor-inspired palette — modern + calm.
        canvas: '#f2f1ed',
        ink: '#26251e',
        accent: { DEFAULT: '#f54e00', soft: '#ff7a3c' },
        crimson: '#cf2d56',
        surface: {
          100: '#f7f7f4',
          200: '#f2f1ed',
          300: '#ebeae5',
          400: '#e6e5e0',
          500: '#e1e0db',
        },
        // Gender accents for nodes
        male: '#4f86c6',
        female: '#cf6d8a',
      },
      borderRadius: {
        brand: '12px',
      },
      boxShadow: {
        card: '0 10px 30px -12px rgba(38,37,30,0.25), 0 0 0 1px rgba(38,37,30,0.06)',
        float: '0 8px 24px -8px rgba(38,37,30,0.35)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
