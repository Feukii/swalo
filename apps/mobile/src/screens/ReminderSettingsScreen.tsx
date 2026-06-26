import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, Mail, Calendar, Check } from '../components/icons/SimpleIcons';
import { ScreenHeader } from '../components/ui';
import { Colors, Spacing, BorderRadius, Shadows } from '../constants/theme-v2';
import type { RootStackParamList } from '../../App';
import { reminderSettingsApi, type ReminderSettings } from '../lib/api';

interface ReminderSettingsScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ReminderSettings'>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_CADENCE = 1;
const MAX_CADENCE = 90;

/** Formate les offsets (ex: [-7, -3, 0]) en libellés lisibles (J-7, J-3, jour J). */
function formatOffset(offset: number): string {
  if (offset === 0) return 'le jour J';
  if (offset < 0) return `J${offset}`;
  return `J+${offset}`;
}

export default function ReminderSettingsScreen({ navigation }: ReminderSettingsScreenProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [email, setEmail] = useState('');
  const [cadence, setCadence] = useState('30');
  const [offsets, setOffsets] = useState<number[]>([-7, -3, 0]);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const applySettings = useCallback((settings: ReminderSettings) => {
    setEnabled(settings.payment_reminders_enabled);
    setEmail(settings.notification_email ?? '');
    setCadence(String(settings.payment_reminder_cadence_days));
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

  const handleSave = async () => {
    setSaveError(null);
    setSuccess(false);

    const trimmedEmail = email.trim();
    if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) {
      setSaveError('Adresse e-mail invalide.');
      return;
    }

    const cadenceValue = parseInt(cadence, 10);
    if (Number.isNaN(cadenceValue) || cadenceValue < MIN_CADENCE || cadenceValue > MAX_CADENCE) {
      setSaveError(`La cadence doit être comprise entre ${MIN_CADENCE} et ${MAX_CADENCE} jours.`);
      return;
    }

    setSaving(true);
    try {
      const updated = await reminderSettingsApi.update({
        payment_reminders_enabled: enabled,
        notification_email: trimmedEmail || null,
        payment_reminder_cadence_days: cadenceValue,
      });
      applySettings(updated);
      setSuccess(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      setSaveError(message || 'Impossible d’enregistrer les réglages.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader
          title="Réglages relances"
          subtitle="Relances automatiques des créances"
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
        subtitle="Relances automatiques des créances"
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {loadError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => void load()}>
              <Text style={styles.retryButtonText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Carte info : calendrier des relances */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconSquare}>
            <Calendar size={20} color={Colors.info.main} />
          </View>
          <View style={styles.infoTextWrap}>
            <Text style={styles.infoTitle}>Calendrier des relances</Text>
            <Text style={styles.infoText}>
              Les relances sont envoyées {offsets.map(formatOffset).join(', ')}.
            </Text>
          </View>
        </View>

        {/* Toggle activation */}
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleIconSquare}>
              <Bell size={20} color={Colors.warning.main} />
            </View>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleLabel}>Activer les relances automatiques</Text>
              <Text style={styles.toggleHint}>
                Envoie automatiquement les rappels d’échéance aux clients concernés.
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: Colors.muted.main, true: Colors.action }}
              thumbColor={Colors.surface}
            />
          </View>
        </View>

        {/* Champs */}
        <View style={styles.card}>
          <View style={styles.formGroup}>
            <View style={styles.formLabelRow}>
              <Mail size={14} color={Colors.textColors.secondary} />
              <Text style={styles.formLabelInline}>E-mail de notification</Text>
            </View>
            <TextInput
              style={[styles.input, focusedInput === 'email' && styles.inputFocused]}
              value={email}
              onChangeText={text => {
                setEmail(text);
                setSuccess(false);
              }}
              onFocus={() => setFocusedInput('email')}
              onBlur={() => setFocusedInput(null)}
              placeholder="exemple@boutique.com"
              placeholderTextColor={Colors.muted.foreground}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={[styles.formGroup, styles.formGroupLast]}>
            <Text style={styles.formLabel}>Cadence de rappel (jours)</Text>
            <TextInput
              style={[styles.input, focusedInput === 'cadence' && styles.inputFocused]}
              value={cadence}
              onChangeText={text => {
                setCadence(text.replace(/[^0-9]/g, ''));
                setSuccess(false);
              }}
              onFocus={() => setFocusedInput('cadence')}
              onBlur={() => setFocusedInput(null)}
              placeholder="30"
              placeholderTextColor={Colors.muted.foreground}
              keyboardType="numeric"
              maxLength={2}
            />
            <Text style={styles.formHint}>
              Entre {MIN_CADENCE} et {MAX_CADENCE} jours.
            </Text>
          </View>
        </View>

        {/* Note canaux */}
        <Text style={styles.note}>
          Les canaux (SMS / WhatsApp / E-mail) se configurent par client sur sa fiche.
        </Text>

        {saveError ? <Text style={styles.saveErrorText}>{saveError}</Text> : null}
        {success ? (
          <View style={styles.successBanner}>
            <Check size={16} color={Colors.success.text} />
            <Text style={styles.successText}>Réglages enregistrés.</Text>
          </View>
        ) : null}

        {/* Bouton enregistrer */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={() => void handleSave()}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.primary.foreground} />
          ) : (
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          )}
        </TouchableOpacity>
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.info.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  infoIconSquare: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: `${Colors.info.main}1A`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoTextWrap: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.info.text,
    marginBottom: 2,
  },
  infoText: {
    fontSize: 13,
    color: Colors.info.text,
    lineHeight: 18,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  toggleIconSquare: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: `${Colors.warning.main}1A`,
    justifyContent: 'center',
    alignItems: 'center',
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
  formGroup: {
    marginBottom: Spacing.lg,
  },
  formGroupLast: {
    marginBottom: 0,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textColors.secondary,
    marginBottom: Spacing.sm,
  },
  formLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  formLabelInline: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textColors.secondary,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
    color: Colors.text,
  },
  inputFocused: {
    borderColor: Colors.action,
    backgroundColor: Colors.surface,
  },
  formHint: {
    fontSize: 12,
    color: Colors.muted.foreground,
    marginTop: Spacing.xs,
  },
  note: {
    fontSize: 13,
    color: Colors.textColors.tertiary,
    lineHeight: 18,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  saveErrorText: {
    fontSize: 14,
    color: Colors.danger.main,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.success.background,
    borderRadius: 10,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  successText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.success.text,
  },
  saveButton: {
    backgroundColor: Colors.action,
    borderRadius: 12,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary.foreground,
  },
});
