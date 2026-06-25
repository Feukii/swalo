import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius, Spacing } from '../../constants/theme-v2';

type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'default';

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
  },
  success: {
    backgroundColor: Colors.success.background,
  },
  danger: {
    backgroundColor: Colors.danger.background,
  },
  warning: {
    backgroundColor: Colors.warning.background,
  },
  info: {
    backgroundColor: Colors.info.background,
  },
  default: {
    backgroundColor: Colors.info.background,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
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
  infoText: {
    color: Colors.action,
  },
  defaultText: {
    color: Colors.action,
  },
});
