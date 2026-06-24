// Swalo — Design tokens (TypeScript / JavaScript)
// Source de vérité : swalo_tokens.json. Utilisable en React, React Native, Node.
export const SwaloColors = {
  // Marque
  marine: '#102A43', // Couleur reine
  skyBlue: '#0EA5E9', // Action
  skyLight: '#38BDF8', // Accent logo
  // Fonctionnel (sens strict)
  green: '#10B981', // Entrées, payé
  red: '#EF4444', // Sorties, dettes
  amber: '#F59E0B', // Crédit, alerte
  // Neutres
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  sectionBg: '#F3F4F6',
  border: '#E5E7EB',
  surface: '#FFFFFF',
} as const;

export const SwaloFonts = {
  app: 'system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif',
  docs: 'Arial, Helvetica, sans-serif',
} as const;

export const SwaloRadius = {
  card: 12,
  button: 8,
} as const;
