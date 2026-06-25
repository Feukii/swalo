import React from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../../constants/theme-v2';
import { ArrowLeft } from '../icons/SimpleIcons';

export interface ScreenHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  rightElement?: React.ReactNode; // Alias for rightAction
  backIcon?: React.ReactNode;
}

export function ScreenHeader({
  title,
  showBack = false,
  onBack,
  rightAction,
  rightElement,
  backIcon,
}: ScreenHeaderProps) {
  const right = rightElement ?? rightAction;
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        {showBack ? (
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            {backIcon || <ArrowLeft size={24} color={Colors.onMarine} />}
          </Pressable>
        ) : (
          <View style={styles.logoContainer}>
            <Image
              source={require('../../../assets/swalo_mark_light.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        )}

        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        <View style={styles.rightAction}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.primary[900],
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary[800],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    height: 56,
  },
  backButton: {
    minWidth: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  logoContainer: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  logo: {
    width: 48,
    height: 48,
    backgroundColor: 'transparent',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.onMarine,
    textAlign: 'center',
  },
  rightAction: {
    minWidth: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
});
