/**
 * SWALO Mobile App - Theme & Color Palette
 *
 * Centralized color definitions for consistent UI across the application.
 * All colors follow the Tailwind CSS color palette for maintainability.
 */

export const Colors = {
  // PRIMARY COLORS - Brand Identity
  primary: {
    main: '#0ea5e9', // Sky Blue 500 - Main brand color
    dark: '#0284c7', // Sky Blue 600 - Darker variant
    light: '#38bdf8', // Sky Blue 400 - Lighter variant
    gradient: ['#0ea5e9', '#0284c7'] as const, // Primary gradient
  },

  // SECONDARY COLORS - Purple accent
  secondary: {
    main: '#8b5cf6', // Violet 500
    dark: '#7c3aed', // Violet 600
    light: '#a78bfa', // Violet 400
    gradient: ['#8b5cf6', '#7c3aed'] as const, // Secondary gradient
  },

  // SEMANTIC COLORS - Functional meanings
  success: {
    main: '#10b981', // Emerald 500 - Success, positive actions
    dark: '#059669', // Emerald 600
    light: '#34d399', // Emerald 400
    gradient: ['#10b981', '#059669'] as const,
    background: '#dcfce7', // Emerald 100 - Light background
    text: '#16a34a', // Green 600 - Text on light bg
  },

  danger: {
    main: '#ef4444', // Red 500 - Errors, debts, deletions
    dark: '#dc2626', // Red 600
    darker: '#b91c1c', // Red 700
    light: '#f87171', // Red 400
    gradient: ['#ef4444', '#dc2626'] as const,
    background: '#fee2e2', // Red 100 - Light background
    text: '#dc2626', // Red 600 - Text on light bg
  },

  warning: {
    main: '#f59e0b', // Amber 500 - Warnings, pending actions
    dark: '#d97706', // Amber 600
    light: '#fbbf24', // Amber 400
    gradient: ['#f59e0b', '#d97706'] as const,
    background: '#fef3c7', // Amber 100 - Light background
    text: '#92400e', // Amber 800 - Text on light bg
  },

  info: {
    main: '#3b82f6', // Blue 500 - Information
    dark: '#2563eb', // Blue 600
    light: '#60a5fa', // Blue 400
    gradient: ['#3b82f6', '#2563eb'] as const,
    background: '#dbeafe', // Blue 100 - Light background
    text: '#1e40af', // Blue 800 - Text on light bg
  },

  // NEUTRALS - Backgrounds, borders, text
  neutral: {
    white: '#ffffff',
    bg: '#f9fafb', // Gray 50 - Main background
    bgDark: '#f3f4f6', // Gray 100 - Darker background
    border: '#e5e7eb', // Gray 200 - Borders
    borderDark: '#d1d5db', // Gray 300 - Darker borders
    disabled: '#9ca3af', // Gray 400 - Disabled elements
  },

  // TEXT COLORS - Typography hierarchy
  text: {
    primary: '#111827', // Gray 900 - Main headings
    secondary: '#374151', // Gray 700 - Subheadings, labels
    tertiary: '#6b7280', // Gray 500 - Helper text
    disabled: '#9ca3af', // Gray 400 - Disabled text
    inverse: '#ffffff', // White - Text on dark backgrounds
  },

  // CONTEXT-SPECIFIC COLORS

  // Customer (Receivables) - Orange/Amber theme
  customer: {
    balance: {
      debt: ['#f59e0b', '#d97706'] as const, // Amber gradient - Customer owes money
      paid: ['#10b981', '#059669'] as const, // Green gradient - Customer paid
    },
    create: ['#f59e0b', '#d97706'] as const, // Create receivable
    payment: ['#10b981', '#059669'] as const, // Receive payment
  },

  // Supplier (Debts) - Red theme
  supplier: {
    balance: {
      debt: ['#ef4444', '#dc2626'] as const, // Red gradient - We owe money
      paid: ['#10b981', '#059669'] as const, // Green gradient - We paid
    },
    create: ['#ef4444', '#dc2626'] as const, // Create debt
    payment: ['#10b981', '#059669'] as const, // Pay supplier
  },

  // Cash Management - Purple/Green/Red
  cash: {
    header: ['#8b5cf6', '#7c3aed'] as const, // Purple gradient
    entry: ['#10b981', '#059669'] as const, // Green - Money in
    exit: ['#ef4444', '#dc2626'] as const, // Red - Money out
    balance: ['#8b5cf6', '#7c3aed'] as const, // Purple - Current balance
  },

  // User Roles - Role-specific colors
  roles: {
    SUPERADMIN: '#9333ea', // Purple 600
    BOSS: '#dc2626', // Red 600
    MANAGER: '#ea580c', // Orange 600
    EMPLOYEE: '#2563eb', // Blue 600
  },

  // Role Badges (light backgrounds)
  roleBadges: {
    SUPERADMIN: { bg: '#f3e8ff', text: '#6b21a8' }, // Purple
    BOSS: { bg: '#dcfce7', text: '#16a34a' }, // Green
    MANAGER: { bg: '#fef3c7', text: '#92400e' }, // Amber
    EMPLOYEE: { bg: '#dbeafe', text: '#1e40af' }, // Blue
  },

  // Transaction Types
  transactions: {
    sale: '#10b981', // Green - Sale completed
    debt: '#ef4444', // Red - Debt created
    payment: '#0ea5e9', // Blue - Payment made/received
    refund: '#f59e0b', // Amber - Refund issued
  },

  // Status Colors
  status: {
    active: {
      bg: '#dcfce7',
      text: '#16a34a',
    },
    inactive: {
      bg: '#fee2e2',
      text: '#dc2626',
    },
    pending: {
      bg: '#dbeafe',
      text: '#1e40af',
    },
    partial: {
      bg: '#fef3c7',
      text: '#92400e',
    },
    paid: {
      bg: '#dcfce7',
      text: '#16a34a',
    },
    cancelled: {
      bg: '#f3f4f6',
      text: '#6b7280',
    },
  },
};

// TYPOGRAPHY
export const Typography = {
  sizes: {
    xs: 10,
    sm: 12,
    base: 14,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 32,
    '5xl': 48,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

// SPACING
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
};

// BORDER RADIUS
export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
};

// SHADOWS
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  base: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
};

// COMMON STYLES - Reusable style objects
export const CommonStyles = {
  // Card styles
  card: {
    backgroundColor: Colors.neutral.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    ...Shadows.base,
  },

  // Input styles
  input: {
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
  },

  // Button styles
  button: {
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...Shadows.sm,
  },
};

export default {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  CommonStyles,
};
