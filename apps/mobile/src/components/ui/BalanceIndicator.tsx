import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing } from '../../constants/theme-v2';
import { formatCurrency } from '../../utils/currency';

interface BalanceIndicatorProps {
  balance: number; // Balance in FCFA (integer, no centimes for FCFA currency)
  type: 'customer' | 'supplier';
  showAlert?: boolean;
}

/**
 * BalanceIndicator Component
 * Displays balance with color coding:
 * - Green badge: positive balance (debt to us)
 * - Red badge: negative balance (refund owed)
 * - Yellow badge: zero balance
 */
export function BalanceIndicator({ balance, type, showAlert = true }: BalanceIndicatorProps) {
  const isPositive = balance > 0;
  const isNegative = balance < 0;

  // Determine colors based on balance
  const badgeColor = isPositive
    ? Colors.success.main
    : isNegative
      ? Colors.danger.main
      : Colors.warning.main;

  const backgroundColor = isPositive
    ? Colors.success.background
    : isNegative
      ? Colors.danger.background
      : Colors.warning.background;

  const textColor = isPositive
    ? Colors.success.text
    : isNegative
      ? Colors.danger.text
      : Colors.warning.text;

  // Icon based on balance
  const iconName: React.ComponentProps<typeof Ionicons>['name'] = isPositive
    ? 'trending-up'
    : isNegative
      ? 'warning'
      : 'checkmark-circle';

  // Message based on type and balance
  let message = '';
  if (type === 'customer') {
    if (isPositive) {
      message = 'Client nous doit';
    } else if (isNegative) {
      message = 'Nous devons au client';
    } else {
      message = 'Solde équilibré';
    }
  } else {
    // supplier
    if (isPositive) {
      message = 'Nous devons au fournisseur';
    } else if (isNegative) {
      message = 'Fournisseur nous doit';
    } else {
      message = 'Solde équilibré';
    }
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <Ionicons name={iconName} size={24} color={badgeColor} />
        <Text style={[styles.label, { color: textColor }]}>{message}</Text>
      </View>
      <View style={styles.amountContainer}>
        <Text style={[styles.amount, { color: textColor }]}>
          {isNegative ? '-' : ''}
          {formatCurrency(Math.abs(balance))}
        </Text>
      </View>
      {showAlert && isNegative && (
        <View style={[styles.alert, { backgroundColor: Colors.danger.main }]}>
          <Ionicons name="alert-circle" size={16} color={Colors.surface} />
          <Text style={styles.alertText}>
            {type === 'customer'
              ? 'Remboursement dû au client !'
              : 'Remboursement dû par le fournisseur !'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: Spacing.lg,
    marginVertical: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  amountContainer: {
    marginTop: Spacing.xs,
  },
  amount: {
    fontSize: 28,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  alertText: {
    color: Colors.surface,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
    flex: 1,
  },
});
