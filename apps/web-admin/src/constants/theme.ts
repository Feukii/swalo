/**
 * Swalo Admin Design System
 */

export const Colors = {
  primary: {
    900: '#0B2A45', // Marine (couleur reine)
    700: '#154B75', // Marine accent (hover)
    500: '#2474AD',
    300: '#8FBEDD',
    100: '#DCE9F4',
    50: '#EFF5FA',
    main: '#0B2A45',
    foreground: '#ffffff',
  },
  // Couleur d'action / interactive (boutons, liens) et accent logo
  action: '#0EA5E9', // Sky Blue (action)
  accent: '#38BDF8', // Sky Light (accent)
  background: '#F5F8FC',
  surface: '#FFFFFF',
  text: '#0F172A',
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
  success: {
    main: '#10B981', // Vert fonctionnel (brand)
    background: '#ECFDF5',
    text: '#065F46',
  },
  warning: {
    main: '#F59E0B', // Ambre fonctionnel (brand)
    background: '#FFFBEB',
    text: '#92400E',
  },
  danger: {
    main: '#EF4444', // Rouge fonctionnel (brand)
    background: '#FEF2F2',
    text: '#991B1B',
  },
  info: {
    main: '#0EA5E9', // Sky Blue (action)
    background: '#F0F9FF',
    text: '#075985',
  },
  roles: {
    SUPERADMIN: { bg: '#F5F3FF', text: '#5B21B6', badge: '#7C3AED' },
    BOSS: { bg: '#FEF2F2', text: '#991B1B', badge: '#DC2626' },
    MANAGER: { bg: '#FFF7ED', text: '#9A3412', badge: '#EA580C' },
    EMPLOYEE: { bg: '#ECFDF5', text: '#065F46', badge: '#059669' },
  },
  status: {
    active: { bg: '#ECFDF5', text: '#065F46' },
    inactive: { bg: '#F3F4F6', text: '#6B7280' },
    blocked: { bg: '#FEF2F2', text: '#991B1B' },
    pending: { bg: '#FFFBEB', text: '#92400E' },
  },
};
