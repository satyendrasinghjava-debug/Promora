/** Promora design tokens. Colours, type and elevation are defined once here and used through Tailwind classes. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#F6F3FF', 100: '#F1EDFF', 200: '#DDD3FF', 300: '#BFACFF', 400: '#9A7FFA', 500: '#6C4CF1', 600: '#5B3BE0', 700: '#4A2DC2', 800: '#3A2499', 900: '#2A1B6E' },
        sky: { 500: '#3B82F6', 600: '#2563EB' },
        ink: { 900: '#111827', 800: '#172033', 700: '#2B3550', 600: '#4B5575', 500: '#6B7491', 400: '#98A0B8', 300: '#C9CEDD', 200: '#E4E7F0', 100: '#EFF1F7', 50: '#F8FAFC' },
        success: { 50: '#ECFDF3', 600: '#079455', 700: '#067647' },
        warning: { 50: '#FFFAEB', 600: '#DC6803', 700: '#B54708' },
        danger: { 50: '#FEF3F2', 600: '#D92D20', 700: '#B42318' },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans Variable"', '"Inter Variable"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(17,24,39,.04), 0 1px 3px rgba(17,24,39,.06)',
        lift: '0 12px 32px -12px rgba(58,36,153,.22), 0 2px 6px rgba(17,24,39,.05)',
        pop: '0 24px 48px -16px rgba(17,24,39,.28)',
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem' },
      maxWidth: { content: '76rem' },
    },
  },
  plugins: [],
};
