import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell } from '../components/icons/SimpleIcons';
import { ScreenHeader } from '../components/ui';
import { Colors, Spacing, BorderRadius, Shadows } from '../constants/theme-v2';
import type { RootStackParamList } from '../../App';
import { reminderSettingsApi, type ReminderSettings } from '../lib/api';

interface ReminderSettingsScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ReminderSettings'>;
}

/** Couleur violette pour le badge E-mail (absente du thème). */
const EMAIL_VIOLET = '#8B5CF6';

/**
 * Paliers du planificateur automatique. Chaque palier correspond à un décalage
 * (en jours) avant l'échéance ; ils sont câblés sur le tableau `offsets`.
 * Le backend expose ces décalages en lecture seule ([7, 3, 0]).
 */
const PALIERS: { offset: number; badge: string; title: string; subtitle: string }[] = [
  { offset: 7, badge: 'J-7', title: 'Relance J-7', subtitle: '7 jours avant échéance' },
  { offset: 3, badge: 'J-3', title: 'Relance J-3', subtitle: '3 jours avant échéance' },
  { offset: 0, badge: 'J-0', title: 'Relance J-0', subtitle: "Le jour de l'échéance" },
];

interface ToggleRowProps {
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  trackOnColor?: string;
}

/** Ligne réglage : badge carré coloré + titre + sous-titre + Switch. */
function ToggleRow({
  badge,
  badgeColor,
  title,
  subtitle,
  value,
  onValueChange,
  trackOnColor = Colors.action,
}: ToggleRowProps) {
  return (
    <View style={styles.toggleRow}>
      <View style={[styles.badge, { backgroundColor: `${badgeColor}1A` }]}>
        <Text style={[styles.badgeText, { color: badgeColor }]}>{badge}</Text>
      </View>
      <View style={styles.toggleTextWrap}>
        <Text style={styles.toggleLabel}>{title}</Text>
        <Text style={styles.toggleHint}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Colors.muted.main, true: trackOnColor }}
        thumbColor={Colors.surface}
      />
    </View>
  );
}

export default function ReminderSettingsScreen({ navigation }: ReminderSettingsScreenProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Canaux de la boutique — état local (l'API n'expose pas encore ces champs).
  const [channels, setChannels] = useState({ sms: true, whatsapp: true, email: false });

  // Planificateur automatique — décalages (en jours) avant l'échéance.
  const [offsets, setOffsets] = useState<number[]>([7, 3, 0]);

  const applySettings = useCallback((settings: ReminderSettings) => {
    if (Array.isArray(settings.offsets) && settings.offsets.length > 0) {
      setOffsets(settings.offsets);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const settings = await reminderSettingsApi.get();
      applySettings(settings);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      setLoadError(message || 'Impossible de charger les réglages.');
    } finally {
      setLoading(false);
    }
  }, [applySettings]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  /**
   * Persiste l'état des paliers. L'API ne stocke pas les décalages eux-mêmes
   * (lecture seule) ni les canaux ; on enregistre donc l'activation globale
   * des relances, dérivée de la présence d'au moins un palier actif.
   */
  const persistOffsets = useCallback(async (nextOffsets: number[]) => {
    setSaveError(null);
    try {
      await reminderSettingsApi.update({
        payment_reminders_enabled: nextOffsets.length > 0,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      setSaveError(message || 'Impossible d’enregistrer les réglages.');
    }
  }, []);

  const toggleOffset = useCallback(
    (offset: number) => {
      setOffsets(prev => {
        const next = prev.includes(offset)
          ? prev.filter(o => o !== offset)
          : [...prev, offset].sort((a, b) => b - a);
        void persistOffsets(next);
        return next;
      });
    },
    [persistOffsets]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader
          title="Réglages relances"
          subtitle="Canaux & préférences"
          showBack
          onBack={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.action} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Réglages relances"
        subtitle="Canaux & préférences"
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {loadError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => void load()}>
              <Text style={styles.retryButtonText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Section 1 — Canaux de la boutique */}
        <Text style={styles.sectionHeader}>CANAUX DE LA BOUTIQUE</Text>
        <View style={styles.card}>
          <ToggleRow
            badge="SMS"
            badgeColor={Colors.action}
            title="SMS"
            subtitle="Message texte standard"
            value={channels.sms}
            onValueChange={v => setChannels(c => ({ ...c, sms: v }))}
          />
          <View style={styles.divider} />
          <ToggleRow
            badge="WA"
            badgeColor={Colors.success.main}
            title="WhatsApp"
            subtitle="Via WhatsApp Business"
            value={channels.whatsapp}
            onValueChange={v => setChannels(c => ({ ...c, whatsapp: v }))}
            trackOnColor={Colors.success.main}
          />
          <View style={styles.divider} />
          <ToggleRow
            badge="@"
            badgeColor={EMAIL_VIOLET}
            title="E-mail"
            subtitle="Avec accusé de lecture"
            value={channels.email}
            onValueChange={v => setChannels(c => ({ ...c, email: v }))}
          />
        </View>

        {/* Section 2 — Planificateur automatique */}
        <Text style={styles.sectionHeader}>PLANIFICATEUR AUTOMATIQUE</Text>
        <View style={styles.card}>
          {PALIERS.map((palier, index) => (
            <React.Fragment key={palier.offset}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <ToggleRow
                badge={palier.badge}
                badgeColor={Colors.action}
                title={palier.title}
                subtitle={palier.subtitle}
                value={offsets.includes(palier.offset)}
                onValueChange={() => toggleOffset(palier.offset)}
              />
            </React.Fragment>
          ))}
        </View>

        {saveError ? <Text style={styles.saveErrorText}>{saveError}</Text> : null}

        {/* Note anti-doublon */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconSquare}>
            <Bell size={18} color={Colors.info.main} />
          </View>
          <Text style={styles.infoText}>
            Une seule relance est envoyée par échéance et par palier (anti-doublon). Les préférences
            par client priment sur ces réglages.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  errorCard: {
    backgroundColor: Colors.danger.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.md,
  },
  errorText: {
    color: Colors.danger.text,
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: Colors.action,
    borderRadius: 8,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  retryButtonText: {
    color: Colors.primary.foreground,
    fontWeight: '600',
    fontSize: 14,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: Colors.textColors.tertiary,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    ...Shadows.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  toggleTextWrap: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  toggleHint: {
    fontSize: 12,
    color: Colors.muted.foreground,
    marginTop: 2,
  },
  saveErrorText: {
    fontSize: 14,
    color: Colors.danger.main,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.info.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  infoIconSquare: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: `${Colors.info.main}1A`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.info.text,
    lineHeight: 18,
  },
});
