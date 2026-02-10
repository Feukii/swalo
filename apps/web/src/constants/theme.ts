/**
 * SWALO Web Design System
 * Miroir du thème mobile (theme-v2.ts) pour cohérence cross-platform
 */

export const Colors = {
  primary: {
    900: '#0F2A44', // Bleu pétrole
    700: '#183B5A', // Bleu accent (hover)
    500: '#1E4D6E',
    300: '#6B9DBF',
    100: '#C8DFF0',
    50: '#EEF5FB', // Fonds bleutés discrets
    main: '#0F2A44',
    foreground: '#ffffff',
  },
  background: '#F8FAFC',
  surface: '#FFFFFF',
  text: '#0B1220',
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
  },
  warning: {
    main: '#F59E0B',
    background: '#FFFBEB',
    text: '#92400E',
  },
  danger: {
    main: '#DC2626',
    background: '#FEF2F2',
    text: '#991B1B',
  },
  info: {
    main: '#2563EB',
    background: '#EFF6FF',
    text: '#1E40AF',
  },

  // Couleurs contextuelles
  context: {
    customers: {
      main: '#F59E0B', // Amber
      light: '#FFFBEB',
      dark: '#92400E',
      gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    },
    suppliers: {
      main: '#DC2626', // Red
      light: '#FEF2F2',
      dark: '#991B1B',
      gradient: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
    },
    cash: {
      main: '#7C3AED', // Purple
      light: '#F5F3FF',
      dark: '#5B21B6',
      gradient: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
    },
    products: {
      main: '#0F2A44', // Bleu pétrole
      light: '#EEF5FB',
      dark: '#0B1220',
      gradient: 'linear-gradient(135deg, #0F2A44 0%, #183B5A 100%)',
    },
    sales: {
      main: '#1EB980', // Green
      light: '#ECFDF5',
      dark: '#065F46',
      gradient: 'linear-gradient(135deg, #1EB980 0%, #059669 100%)',
    },
  },

  // Couleurs par rôle
  roles: {
    SUPERADMIN: { bg: '#F5F3FF', text: '#5B21B6', badge: '#7C3AED' },
    BOSS: { bg: '#FEF2F2', text: '#991B1B', badge: '#DC2626' },
    MANAGER: { bg: '#F0F9FF', text: '#075985', badge: '#0284C7' },
    EMPLOYEE: { bg: '#EFF6FF', text: '#1E40AF', badge: '#2563EB' },
  },

  // Status badges
  status: {
    active: { bg: '#ECFDF5', text: '#065F46' },
    inactive: { bg: '#F3F4F6', text: '#6B7280' },
    blocked: { bg: '#FEF2F2', text: '#991B1B' },
    pending: { bg: '#FFFBEB', text: '#92400E' },
    paid: { bg: '#ECFDF5', text: '#065F46' },
    partial: { bg: '#EFF6FF', text: '#1E40AF' },
    cancelled: { bg: '#F3F4F6', text: '#6B7280' },
  },
};

export const Gradients = {
  primary: 'linear-gradient(135deg, #0F2A44 0%, #183B5A 100%)',
  customers: Colors.context.customers.gradient,
  suppliers: Colors.context.suppliers.gradient,
  cash: Colors.context.cash.gradient,
  products: Colors.context.products.gradient,
  sales: Colors.context.sales.gradient,
};
