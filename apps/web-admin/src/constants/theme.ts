/**
 * Swalo Admin Design System
 */

export const Colors = {
  primary: {
    900: '#102A43', // Marine (couleur reine)
    700: '#1B3A57', // Marine accent (hover)
    500: '#1E4D6E',
    300: '#6B9DBF',
    100: '#C8DFF0',
    50: '#EEF5FB',
    main: '#102A43',
    foreground: '#ffffff',
  },
  // Couleur d'action / interactive (boutons, liens) et accent logo
  action: '#0EA5E9', // Sky Blue (action)
  accent: '#38BDF8', // Sky Light (accent)
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
    background: '#EFF6FF',
    text: '#1E40AF',
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
