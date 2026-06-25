// Swalo — Tailwind preset (dérivé des design tokens)
// Source: packages/core/src/brand/tokens.ts (mêmes valeurs).
// Usage: tailwind.config.js -> presets: [require('@swalo/core/tailwind-preset')]
// CJS autonome (pas de dépendance au build) pour rester robuste en dev.

const marine = {
  950: '#07203A',
  900: '#0B2A45',
  800: '#103A5C',
  700: '#154B75',
  600: '#1B5E8F',
  500: '#2474AD',
  400: '#4E94C7',
  300: '#8FBEDD',
  200: '#C2DBEC',
  100: '#DCE9F4',
  50: '#EFF5FA',
};
const sky = {
  700: '#0369A1',
  600: '#0284C7',
  500: '#0EA5E9',
  400: '#38BDF8',
  300: '#7DD3FC',
  200: '#BAE6FD',
  100: '#E0F2FE',
  50: '#F0F9FF',
};
const slate = {
  900: '#0F172A',
  800: '#1E293B',
  700: '#334155',
  600: '#475569',
  500: '#64748B',
  400: '#94A3B8',
  300: '#CBD5E1',
  200: '#E2E8F0',
  100: '#F1F5F9',
  50: '#F8FAFC',
};

module.exports = {
  theme: {
    extend: {
      colors: {
        primary: marine, // nav, en-têtes, marque
        secondary: marine, // rétro-compat (ex-secondary)
        action: sky, // boutons, liens, focus
        accent: { DEFAULT: sky[400], ...sky },
        marine,
        sky,
        slate,
        canvas: '#F5F8FC', // fond d'application
        surface: '#FFFFFF',
        // Sémantiques avec échelle numérique complète (utilisées en utilities: bg-success-600, text-danger-800…)
        // + alias bg/fg pour les helpers existants.
        success: {
          DEFAULT: '#10B981',
          bg: '#ECFDF5',
          fg: '#065F46',
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        warning: {
          DEFAULT: '#F59E0B',
          bg: '#FFFBEB',
          fg: '#92400E',
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
        danger: {
          DEFAULT: '#EF4444',
          bg: '#FEF2F2',
          fg: '#991B1B',
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
        },
        info: { DEFAULT: sky[500], bg: sky[50], fg: '#075985', ...sky },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      borderRadius: { card: '14px', btn: '10px', sheet: '20px' },
      boxShadow: {
        card: '0 2px 8px rgba(11,42,69,0.06)',
        elevated: '0 8px 24px rgba(11,42,69,0.10)',
      },
    },
  },
};
