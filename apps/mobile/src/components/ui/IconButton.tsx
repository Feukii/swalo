import React from 'react';
import { Pressable, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors, BorderRadius, TouchTargets } from '../../constants/theme-v2';

interface IconButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  hoverColor?: string;
}

export function IconButton({
  onPress,
  children,
  style,
  disabled = false,
  hoverColor: _hoverColor = Colors.action,
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        style,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: TouchTargets.minimum,
    minHeight: TouchTargets.minimum,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    backgroundColor: Colors.primary[50],
  },
  disabled: {
    opacity: 0.4,
  },
});
