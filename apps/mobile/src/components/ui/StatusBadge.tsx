import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius, Spacing } from '../../constants/theme-v2';

type BadgeVariant = 'success' | 'danger' | 'warning' | 'default';

interface StatusBadgeProps {
  text: string;
  variant: BadgeVariant;
}

export function StatusBadge({ text, variant }: StatusBadgeProps) {
  return (
    <View style={[styles.badge, styles[variant]]}>
      <Text style={[styles.text, styles[`${variant}Text` as keyof typeof styles]]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  success: {
    backgroundColor: Colors.success.main + '1A', // 10% opacity
    borderColor: Colors.success.main,
  },
  danger: {
    backgroundColor: Colors.danger.main + '1A',
    borderColor: Colors.danger.main,
  },
  warning: {
    backgroundColor: Colors.warning.main + '1A',
    borderColor: Colors.warning.main,
  },
  default: {
    backgroundColor: Colors.muted.main + '1A',
    borderColor: Colors.muted.main,
  },
  text: {
    fontSize: 11,
    fontWeight: '500',
  },
  successText: {
    color: Colors.success.main,
  },
  dangerText: {
    color: Colors.danger.main,
  },
  warningText: {
    color: Colors.warning.main,
  },
  defaultText: {
    color: Colors.muted.foreground,
  },
});
