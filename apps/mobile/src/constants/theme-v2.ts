/**
 * SWALO v2 Design System
 * Theme based on design specifications with "Bleu pétrole" (#0F2A44) primary color
 */

// Nouvelle palette de couleurs (SWALO v2)
export const Colors = {
  primary: {
    900: '#0F2A44', // Bleu pétrole (nouveau)
    700: '#183B5A', // Bleu accent (hover/press)
    50: '#EEF5FB', // Fonds bleutés discrets
    main: '#0F2A44', // Alias for primary.900
    foreground: '#ffffff',
  },
  background: '#F8FAFC',
  surface: '#FFFFFF',
  // Main text color (for backward compatibility)
  text: '#0B1220',
  // Text color hierarchy (for detailed usage)
  textColors: {
    primary: '#0B1220',
    secondary: '#374151',
    tertiary: '#6B7280',
    disabled: '#9CA3AF',
    inverse: '#FFFFFF',
  },
  muted: {
    main: '#E5E7EB',
    foreground: '#6B7280',
  },
  border: '#E5E7EB',
  success: {
    main: '#1EB980',
    background: '#ECFDF5',
    text: '#065F46',
    foreground: '#ffffff',
  },
  warning: {
    main: '#F59E0B',
    background: '#FFFBEB',
    text: '#92400E',
    foreground: '#ffffff',
  },
  danger: {
    main: '#DC2626',
    background: '#FEF2F2',
    text: '#991B1B',
    foreground: '#ffffff',
  },
  info: {
    main: '#2563EB',
    background: '#EFF6FF',
    text: '#1E40AF',
    foreground: '#ffffff',
  },
  // Additional color tokens
  tertiary: '#6B7280',
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
