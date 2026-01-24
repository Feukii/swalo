import React from 'react';
import { Pressable, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors } from '../../constants/theme-v2';

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
  hoverColor: _hoverColor = Colors.primary[900],
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        style,
        pressed && !disabled && { opacity: 0.7 },
        disabled && styles.disabled,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
});
