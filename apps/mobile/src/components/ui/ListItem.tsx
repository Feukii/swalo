import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { StatusBadge } from './StatusBadge';
import { Colors, Spacing, BorderRadius } from '../../constants/theme-v2';

interface ListItemProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  amount?: string;
  amountColor?: 'success' | 'danger' | 'warning' | 'default';
  badge?: {
    text: string;
    variant: 'success' | 'danger' | 'warning' | 'default';
  };
  onClick?: () => void;
}

export function ListItem({
  icon,
  title,
  subtitle,
  amount,
  amountColor = 'default',
  badge,
  onClick,
}: ListItemProps) {
  const content = (
    <View style={styles.container}>
      {icon && <View style={styles.iconBox}>{icon}</View>}

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      <View style={styles.trailing}>
        {amount && (
          <Text style={[styles.amount, styles[`${amountColor}Amount` as keyof typeof styles]]}>
            {amount}
          </Text>
        )}
        {badge && <StatusBadge text={badge.text} variant={badge.variant} />}
      </View>
    </View>
  );

  if (onClick) {
    return (
      <Pressable
        onPress={onClick}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.pressable}>{content}</View>;
}

const styles = StyleSheet.create({
  pressable: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  pressed: {
    backgroundColor: Colors.primary[50],
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    minHeight: 56,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textColors.tertiary,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
  },
  successAmount: {
    color: Colors.success.main,
  },
  dangerAmount: {
    color: Colors.danger.main,
  },
  warningAmount: {
    color: Colors.warning.main,
  },
  defaultAmount: {
    color: Colors.text,
  },
});
