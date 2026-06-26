// Swalo — Design tokens (source unique de la charte graphique)
// Direction: "Marine + Sky vif" — SaaS moderne, contrasté, qui inspire confiance.
// Consommé par: mobile (theme-v2), web & web-admin (tailwind-preset.cjs).
// Règle: aucune couleur en dur dans les apps — tout vient d'ici.

// ─── Échelles de couleur (analogues bleu → harmonie naturelle) ───
export const palette = {
  // Marine — primaire: navigation, en-têtes, marque
  marine: {
    950: '#07203A',
    900: '#0B2A45', // base
    800: '#103A5C',
    700: '#154B75',
    600: '#1B5E8F',
    500: '#2474AD',
    400: '#4E94C7',
    300: '#8FBEDD',
    200: '#C2DBEC',
    100: '#DCE9F4',
    50: '#EFF5FA',
  },
  // Sky — action: boutons, liens, focus, états interactifs
  sky: {
    700: '#0369A1',
    600: '#0284C7',
    500: '#0EA5E9', // base action
    400: '#38BDF8', // accent
    300: '#7DD3FC',
    200: '#BAE6FD',
    100: '#E0F2FE',
    50: '#F0F9FF',
  },
  // Slate — neutres froids (s'accordent au bleu)
  slate: {
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
  },
} as const;

// ─── Couleurs sémantiques ───
export const semantic = {
  success: { main: '#10B981', bg: '#ECFDF5', text: '#065F46' },
  warning: { main: '#F59E0B', bg: '#FFFBEB', text: '#92400E' },
  danger: { main: '#EF4444', bg: '#FEF2F2', text: '#991B1B' },
  info: { main: palette.sky[500], bg: palette.sky[50], text: '#075985' },
} as const;

// ─── Tokens applicatifs (rôles) ───
export const tokens = {
  color: {
    primary: palette.marine[900],
    primaryScale: palette.marine,
    action: palette.sky[500],
    actionScale: palette.sky,
    accent: palette.sky[400],
    bg: '#F5F8FC',
    surface: '#FFFFFF',
    surfaceAlt: palette.slate[50],
    border: palette.slate[200],
    borderStrong: palette.slate[300],
    text: palette.slate[900],
    textSecondary: palette.slate[600],
    textTertiary: palette.slate[500],
    textDisabled: palette.slate[400],
    onMarine: '#FFFFFF',
    onMarineMuted: palette.marine[200],
    success: semantic.success,
    warning: semantic.warning,
    danger: semantic.danger,
    info: semantic.info,
  },
  radius: { input: 10, button: 10, card: 14, sheet: 20, pill: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  motion: { fast: 150, base: 250 },
} as const;

// ─── Typographie ───
export const SwaloFonts = {
  app: 'system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif',
  docs: 'Arial, Helvetica, sans-serif',
} as const;

export const SwaloType = {
  display: { size: 32, weight: 700, line: 40 },
  h1: { size: 28, weight: 700, line: 36 },
  h2: { size: 22, weight: 600, line: 30 },
  h3: { size: 18, weight: 600, line: 24 },
  body: { size: 15, weight: 400, line: 22 },
  bodyStrong: { size: 15, weight: 600, line: 22 },
  small: { size: 13, weight: 400, line: 18 },
  caption: { size: 12, weight: 500, line: 16 },
} as const;

export const SwaloRadius = { card: 14, button: 10 } as const;

// ─── Rétro-compat (anciens imports) — dérivés des échelles ───
export const SwaloColors = {
  marine: palette.marine[900],
  skyBlue: palette.sky[500],
  skyLight: palette.sky[400],
  green: semantic.success.main,
  red: semantic.danger.main,
  amber: semantic.warning.main,
  textPrimary: palette.slate[900],
  textSecondary: palette.slate[600],
  sectionBg: tokens.color.bg,
  border: palette.slate[200],
  surface: '#FFFFFF',
} as const;
