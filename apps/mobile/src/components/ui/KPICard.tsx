import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius, Spacing } from '../../constants/theme-v2';

interface KPICardProps {
  label: string;
  value: string;
  change?: {
    value: string;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
}

export function KPICard({ label, value, change, icon }: KPICardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
      </View>
      <Text style={styles.value}>{value}</Text>
      {change && (
        <View style={styles.changeContainer}>
          <Text
            style={[
              styles.changeText,
              { color: change.isPositive ? Colors.success.main : Colors.danger.main },
            ]}
          >
            {change.value}
          </Text>
        </View>
      )}
    </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: 13,
    color: Colors.muted.foreground,
    flex: 1,
  },
  iconContainer: {
    marginLeft: Spacing.sm,
  },
  value: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
