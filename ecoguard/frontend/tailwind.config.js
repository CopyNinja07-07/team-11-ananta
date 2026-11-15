// Design tokens. One source of truth for the app, the design pack and the Figma styles
// (exported to docs/design/tokens.json by `npm run tokens`).
//
// Palette idea: a campus in the hills. Leaf green for the system itself, volt amber
// for electricity, river blue for water, ember for the hidden heat inside walls.
// The neutrals are warm stone, not cold grey, so the dashboard reads calm.
/** @type {import('tailwindcss').Config} */
const leaf = { 50: '#EEF5EE', 100: '#D6E9D8', 200: '#B5D8BF', 300: '#8EC29F', 400: '#6DB283', 500: '#3E8E5A', 600: '#2F7549', 700: '#245C3A', 800: '#1A452C', 900: '#143524' };
const volt = { 50: '#FBF4DF', 100: '#F7E7B5', 200: '#F2D27A', 300: '#EDBF48', 400: '#E3A91C', 500: '#C98A00', 600: '#A87100', 700: '#865A00', 800: '#664400', 900: '#4A3100' };
const river = { 50: '#E8F3F7', 100: '#CDE6EE', 200: '#A3D0DE', 300: '#72B5CA', 400: '#3F98B4', 500: '#1C8DB5', 600: '#147A9E', 700: '#0F5F7C', 800: '#0B4A60', 900: '#083546' };
const ember = { 50: '#F8ECE5', 100: '#F0D3C3', 200: '#E3AE92', 300: '#D48A63', 400: '#C56C40', 500: '#B4532A', 600: '#984221', 700: '#7A341A', 800: '#5C2713', 900: '#3F1B0D' };
const alarm = { 50: '#FBEBE8', 100: '#F6D3CE', 200: '#EBA79D', 300: '#DF7B6C', 400: '#D2574A', 500: '#C0392B', 600: '#A02E23', 700: '#80241B', 800: '#601B14', 900: '#40120D' };

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', '"IBM Plex Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: leaf,
        leaf,
        volt,
        river,
        ember,
        alarm,
        // older pages use Tailwind's names; point them at the same palette
        emerald: leaf, green: leaf, amber: volt, yellow: volt, sky: river, blue: river, violet: ember, purple: ember, red: alarm,
        ink: { 900: '#10231C', 800: '#1E332A', 700: '#34463E', 500: '#66756D', 400: '#8A958E', 300: '#C9CFC7', 200: '#DEE2DA', 100: '#ECEEE8', 50: '#F4F2EC' },
        night: { 950: '#0A1C15', 900: '#0F2A20', 800: '#163628', 700: '#21453A' },
        energy: '#B07800',
        water: '#147A9E',
        hidden: '#B4532A',
        danger: '#C0392B',
      },
      borderRadius: { card: '16px' },
      boxShadow: {
        card: '0 1px 0 rgba(16,35,28,0.04), 0 8px 24px -16px rgba(16,35,28,0.18)',
        lift: '0 2px 0 rgba(16,35,28,0.05), 0 18px 40px -20px rgba(16,35,28,0.35)',
      },
      keyframes: {
        flow: { to: { strokeDashoffset: '-24' } },
        pulseDot: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.35 } },
        rise: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
      },
      animation: {
        flow: 'flow 1.2s linear infinite',
        pulseDot: 'pulseDot 1.6s ease-in-out infinite',
        rise: 'rise .35s ease-out both',
      },
    },
  },
  plugins: [],
};
