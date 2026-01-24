import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, BorderRadius, Spacing } from '../../constants/theme-v2';

interface ProductCardProps {
  name: string;
  price: number;
  stock: number;
  formatMoney: (amount: number) => string;
  iconComponent?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export function ProductCard({
  name,
  price,
  stock,
  formatMoney,
  iconComponent,
  onClick,
  disabled = false,
}: ProductCardProps) {
  return (
    <Pressable
      onPress={onClick}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {iconComponent && <View style={styles.iconContainer}>{iconComponent}</View>}

      <Text style={styles.name} numberOfLines={2}>
        {name}
      </Text>

      <Text style={styles.price}>{formatMoney(price)}</Text>

      <Text
        style={[
          styles.stock,
          stock === 0 && styles.stockZero,
          stock < 10 && stock > 0 && styles.stockLow,
        ]}
      >
        {stock === 0 ? 'Rupture de stock' : `${stock} en stock`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    backgroundColor: Colors.muted.main + '33', // 20% opacity
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.muted.main,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  price: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary[900],
    marginBottom: Spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  stock: {
    fontSize: 13,
    color: Colors.success.main,
  },
  stockZero: {
    color: Colors.danger.main,
  },
  stockLow: {
    color: Colors.warning.main,
  },
});
