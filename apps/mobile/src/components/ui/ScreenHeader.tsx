import React from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../../constants/theme-v2';
import { ArrowLeft } from '../icons/SimpleIcons';
import { useSyncFreshness } from '../../hooks/useOfflineReports';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  rightElement?: React.ReactNode; // Alias for rightAction
  /** Affiche la pastille "Synchronisé" à droite (si aucun rightAction). */
  showSync?: boolean;
  backIcon?: React.ReactNode;
}

function SyncPill() {
  const freshness = useSyncFreshness();
  const fresh = freshness.level === 'fresh';
  return (
    <View
      style={[
        styles.syncPill,
        { backgroundColor: fresh ? Colors.success.background : Colors.warning.background },
      ]}
    >
      <View
        style={[
          styles.syncDot,
          { backgroundColor: fresh ? Colors.success.main : Colors.warning.main },
        ]}
      />
      <Text style={[styles.syncText, { color: fresh ? Colors.success.text : Colors.warning.text }]}>
        {fresh ? 'Synchronisé' : 'Hors-ligne'}
      </Text>
    </View>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  rightElement,
  showSync = true,
  backIcon,
}: ScreenHeaderProps) {
  const explicitRight = rightElement ?? rightAction;
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        {showBack ? (
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            {backIcon || <ArrowLeft size={24} color={Colors.text} />}
          </Pressable>
        ) : (
          <View style={styles.logoSquare}>
            <Image
              source={require('../../../assets/swalo_mark_light.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        )}

        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.right}>{explicitRight ?? (showSync ? <SyncPill /> : null)}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    gap: Spacing.md,
    minHeight: 60,
  },
  backButton: {
    minWidth: 40,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  pressed: {
    opacity: 0.6,
  },
  logoSquare: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primary[900],
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 26,
    height: 26,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 12.5,
    color: Colors.textColors.tertiary,
    marginTop: 1,
  },
  right: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  syncDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  syncText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
