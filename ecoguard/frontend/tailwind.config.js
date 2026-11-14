// Design tokens. Documented in docs/style-guide.md.
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50: '#ecfdf5', 100: '#d1fae5', 500: '#10b981', 600: '#059669', 700: '#047857', 900: '#064e3b' },
        ink: { 900: '#0f172a', 700: '#334155', 500: '#64748b', 300: '#cbd5e1', 100: '#f1f5f9' },
        energy: '#d97706',
        water: '#0284c7',
        hidden: '#7c3aed',
        danger: '#dc2626',
      },
      borderRadius: { card: '14px' },
    },
  },
  plugins: [],
};
