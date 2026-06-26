/**
 * Swalo v2 Design System
 * Theme based on design specifications with "Marine" (#102A43) primary color
 */

// Palette "Marine + Sky vif" — source: @swalo/core/brand/tokens (échelles alignées)
export const Colors = {
  primary: {
    950: '#07203A',
    900: '#0B2A45', // Marine (couleur reine)
    800: '#103A5C',
    700: '#154B75', // Marine accent (hover/press)
    600: '#1B5E8F',
    500: '#2474AD',
    400: '#4E94C7',
    300: '#8FBEDD',
    200: '#C2DBEC',
    100: '#DCE9F4',
    50: '#EFF5FA', // Fonds bleutés discrets
    main: '#0B2A45', // Alias for primary.900
    foreground: '#FFFFFF',
  },
  // Couleur d'action / interactive (boutons, liens) et accent logo
  action: '#0EA5E9', // Sky Blue (action)
  accent: '#38BDF8', // Sky Light (accent)
  background: '#F5F8FC',
  surface: '#FFFFFF',
  surfaceAlt: '#F8FAFC',
  // Main text color (for backward compatibility)
  text: '#0F172A',
  // Text color hierarchy (slate — s'accorde au bleu)
  textColors: {
    primary: '#0F172A',
    secondary: '#475569',
    tertiary: '#64748B',
    disabled: '#94A3B8',
    inverse: '#FFFFFF',
  },
  muted: {
    main: '#E2E8F0',
    foreground: '#64748B',
  },
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  // Texte/icône sur fond marine
  onMarine: '#FFFFFF',
  success: {
    main: '#10B981', // Vert fonctionnel (brand)
    background: '#ECFDF5',
    text: '#065F46',
    foreground: '#ffffff',
  },
  warning: {
    main: '#F59E0B', // Ambre fonctionnel (brand)
    background: '#FFFBEB',
    text: '#92400E',
    foreground: '#ffffff',
  },
  danger: {
    main: '#EF4444', // Rouge fonctionnel (brand)
    background: '#FEF2F2',
    text: '#991B1B',
    foreground: '#ffffff',
  },
  info: {
    main: '#0EA5E9', // Sky (harmonisé avec l'action)
    background: '#F0F9FF',
    text: '#075985',
    foreground: '#ffffff',
  },
  // Additional color tokens
  tertiary: '#64748B',
};

// Système d'espacement (design tokens)
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
};

// Rayons de bordure
export const BorderRadius = {
  sm: 10,
  md: 14,
  lg: 18,
  sheet: 24,
};

// Ombres (sobre)
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },
};

// Typographie
export const Typography = {
  display: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 40,
  },
  h1: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 32,
  },
  h2: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  micro: {
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
};

// Touch targets
export const TouchTargets = {
  minimum: 44,
  button: 48,
  listItem: 56,
};

// Points de rupture responsive (largeur en px logiques)
// Téléphone < 768 ; tablette >= 768 ; grande tablette >= 1024
export const Breakpoints = {
  tablet: 768,
  large: 1024,
} as const;
