import { useWindowDimensions } from 'react-native';
import { Breakpoints } from '../constants/theme-v2';

/**
 * Informations de mise en page responsive dérivées de la taille de fenêtre.
 *
 * Note: l'app reste verrouillée en `portrait` (cf. app.config.ts), donc
 * `isLandscape` ne se déclenche en pratique que sur tablettes/écrans larges
 * ou en split-screen. On se base sur la LARGEUR pour décider du mode tablette :
 * une tablette est plus large qu'un téléphone même en portrait.
 */
export interface ResponsiveInfo {
  /** Largeur logique de la fenêtre (px). */
  width: number;
  /** Hauteur logique de la fenêtre (px). */
  height: number;
  /** Vrai si la largeur >= Breakpoints.tablet (768). */
  isTablet: boolean;
  /** Vrai si la largeur >= Breakpoints.large (1024). */
  isLarge: boolean;
  /** Vrai si la fenêtre est plus large que haute. */
  isLandscape: boolean;
  /** Nombre de colonnes conseillé pour une grille de produits. */
  columns: number;
}

/**
 * Hook responsive basé sur `useWindowDimensions()`.
 * Recalcule automatiquement quand la fenêtre change de taille.
 */
export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();

  const isTablet = width >= Breakpoints.tablet;
  const isLarge = width >= Breakpoints.large;
  const isLandscape = width > height;

  // Grille produits : téléphone 4, tablette 5, grande tablette 6.
  const columns = isLarge ? 6 : isTablet ? 5 : 4;

  return { width, height, isTablet, isLarge, isLandscape, columns };
}
