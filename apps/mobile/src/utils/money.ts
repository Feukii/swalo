/**
 * Money formatting utilities for XAF (FCFA) currency
 * Format: "12 500 F" with space separator, no decimals
 */

import { Colors } from '../constants/theme-v2';

export function formatMoney(amount: number): string {
  // Handle undefined, null, or NaN
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '0 F';
  }

  // Format with space separator and no decimals
  const formatted = Math.abs(amount)
    .toFixed(0)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  return `${formatted} F`;
}

export function formatMoneyWithSign(amount: number): string {
  const sign = amount >= 0 ? '+' : '-';
  const formatted = formatMoney(Math.abs(amount));

  return `${sign}${formatted}`;
}

export function parseMoney(value: string): number {
  // Remove spaces and 'F' suffix, parse as integer
  return parseInt(value.replace(/\s/g, '').replace('F', ''), 10) || 0;
}

/**
 * Get color based on amount value
 */
export function getAmountColor(amount: number): string {
  if (amount > 0) return Colors.success.main;
  if (amount < 0) return Colors.danger.main;
  return Colors.text;
}
