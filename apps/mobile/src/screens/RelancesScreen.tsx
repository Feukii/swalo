import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Linking,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Bell, Smartphone, Check, Send, X } from '../components/icons/SimpleIcons';
import { ScreenHeader, StatusBadge } from '../components/ui';
import { Colors, Spacing, Shadows, BorderRadius } from '../constants/theme-v2';
import { sellerTasksApi, SellerTask, ReminderChannel } from '../lib/api';
import { formatDate } from '../utils/date';
import { formatMoney } from '../utils/money';

interface RelancesScreenProps {
  navigation: { goBack: () => void };
}

type FilterKey = 'all' | 'overdue' | 'today';

/** Étiquette courte d'un canal (puce). */
const CHANNEL_LABEL: Record<ReminderChannel, string> = {
  SMS: 'SMS',
  WHATSAPP: 'WA',
  EMAIL: 'E-mail',
};

/** Statut d'échéance d'une tâche calculé depuis sa due_date. */
interface DueStatus {
  /** Différence en jours (négatif = en retard). */
  deltaDays: number | null;
  overdue: boolean;
  /** Libellé badge : "Retard Xj" / "Relance J-0" / "Relance J-3". */
  badge: string;
  variant: 'danger' | 'warning' | 'info';
}

/** Différence en jours calendaires entre due_date et aujourd'hui. */
function diffInDays(due?: string | null): number | null {
  if (!due) return null;
  const d = new Date(due);
  if (isNaN(d.getTime())) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function computeDueStatus(due?: string | null): DueStatus {
  const delta = diffInDays(due);
  if (delta === null) {
    return { deltaDays: null, overdue: false, badge: 'À suivre', variant: 'info' };
  }
  if (delta < 0) {
    return {
      deltaDays: delta,
      overdue: true,
      badge: `Retard ${Math.abs(delta)}j`,
      variant: 'danger',
    };
  }
  if (delta === 0) {
    return { deltaDays: 0, overdue: false, badge: 'Relance J-0', variant: 'warning' };
  }
  return { deltaDays: delta, overdue: false, badge: `Relance J-${delta}`, variant: 'info' };
}

export default function RelancesScreen({ navigation }: RelancesScreenProps) {
  const [tasks, setTasks] = useState<SellerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  /** Tâches dont l'appel "terminer" est en cours (id -> true). */
  const [completing, setCompleting] = useState<Record<string, boolean>>({});

  // Bottom-sheet de relance
  const [sheetTask, setSheetTask] = useState<SellerTask | null>(null);
  const [sheetChannel, setSheetChannel] = useState<ReminderChannel | undefined>(undefined);
  const [sheetMessage, setSheetMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await sellerTasksApi.getTasks();
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      // Hors-ligne ou serveur indisponible : liste vide propre
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Comptes pour les chips (calculés depuis due_date)
  const counts = useMemo(() => {
    let overdue = 0;
    let today = 0;
    for (const t of tasks) {
      const delta = diffInDays(t.due_date);
      if (delta === null) continue;
      if (delta < 0) overdue += 1;
      else if (delta === 0) today += 1;
    }
    return { all: tasks.length, overdue, today };
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    if (filter === 'all') return tasks;
    return tasks.filter(t => {
      const delta = diffInDays(t.due_date);
      if (delta === null) return false;
      if (filter === 'overdue') return delta < 0;
      return delta === 0; // today
    });
  }, [tasks, filter]);

  const handleCall = (phone?: string | null) => {
    if (!phone) {
      Alert.alert('Aucun numéro', "Ce client n'a pas de téléphone enregistré.");
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => undefined);
  };

  /**
   * Marque une tâche comme terminée : retrait optimiste de la liste,
   * puis restauration si l'appel API échoue.
   */
  const markDone = useCallback(
    async (task: SellerTask) => {
      if (completing[task.id]) return;
      setCompleting(prev => ({ ...prev, [task.id]: true }));
      setTasks(prev => prev.filter(t => t.id !== task.id));
      try {
        await sellerTasksApi.markDone(task.id);
      } catch {
        // Échec : on remet la tâche dans la liste et on prévient.
        setTasks(prev => (prev.some(t => t.id === task.id) ? prev : [...prev, task]));
        Alert.alert(
          'Action impossible',
          "La tâche n'a pas pu être marquée comme terminée. Réessayez plus tard."
        );
      } finally {
        setCompleting(prev => {
          const { [task.id]: _removed, ...rest } = prev;
          return rest;
        });
      }
    },
    [completing]
  );

  const openSheet = (task: SellerTask) => {
    setSheetTask(task);
    // Pré-sélection du premier canal disponible
    setSheetChannel(task.channels && task.channels.length > 0 ? task.channels[0] : undefined);
    setSheetMessage(task.preview_message ?? '');
  };

  const closeSheet = () => {
    setSheetTask(null);
    setSheetChannel(undefined);
    setSheetMessage('');
  };

  const handleSend = async () => {
    if (!sheetTask) return;
    const task = sheetTask;
    setSending(true);
    try {
      const result = await sellerTasksApi.remind(task.id, sheetChannel);
      if (result.ok) {
        const sent = result.channelsSent?.length
          ? result.channelsSent.map(c => CHANNEL_LABEL[c]).join(', ')
          : null;
        closeSheet();
        // Propose de clôturer la tâche maintenant que la relance est partie.
        Alert.alert(
          'Relance envoyée',
          (sent ? `Envoyée sur : ${sent}.` : 'La relance a été envoyée.') +
            '\n\nMarquer cette tâche comme terminée ?',
          [
            { text: 'Plus tard', style: 'cancel' },
            { text: 'Terminer', onPress: () => markDone(task) },
          ]
        );
      } else {
        Alert.alert('Envoi impossible', result.error ?? "La relance n'a pas pu être envoyée.");
      }
    } catch {
      Alert.alert('Erreur', "Impossible d'envoyer la relance. Réessayez plus tard.");
    } finally {
      setSending(false);
    }
  };

  const sheetStatus = sheetTask ? computeDueStatus(sheetTask.due_date) : null;
  const sheetTitle = sheetStatus?.overdue ? 'Échéance dépassée' : 'À venir';

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Relances & tâches"
        subtitle={`${counts.all} à relancer`}
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.action} />
        }
      >
        {/* HERO MARINE */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Bell size={26} color={Colors.accent} />
          </View>
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroNumber}>{counts.all}</Text>
            <Text style={styles.heroLabel}>clients à relancer</Text>
          </View>
        </View>

        {/* CHIPS FILTRES */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {[
            { key: 'all' as const, label: 'Tous', count: counts.all },
            { key: 'overdue' as const, label: 'En retard', count: counts.overdue },
            { key: 'today' as const, label: "Aujourd'hui", count: counts.today },
          ].map(chip => {
            const active = filter === chip.key;
            return (
              <Pressable
                key={chip.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(chip.key)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip.label}</Text>
                <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                  <Text style={[styles.chipBadgeText, active && styles.chipBadgeTextActive]}>
                    {chip.count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.action} />
          </View>
        ) : visibleTasks.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Check size={28} color={Colors.success.main} />
            </View>
            <Text style={styles.emptyTitle}>Aucune relance</Text>
            <Text style={styles.emptyText}>
              {filter === 'all'
                ? 'Tous les clients sont à jour pour le moment.'
                : 'Aucun client dans ce filtre.'}
            </Text>
          </View>
        ) : (
          visibleTasks.map(task => {
            const status = computeDueStatus(task.due_date);
            const name = task.customer?.name ?? task.title;
            const isCompleting = !!completing[task.id];
            const channels = task.channels ?? [];
            return (
              <View key={task.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Pressable
                    onPress={() => markDone(task)}
                    disabled={isCompleting}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Marquer comme terminée"
                    style={styles.checkbox}
                  >
                    {isCompleting ? (
                      <ActivityIndicator size="small" color={Colors.action} />
                    ) : (
                      <Check size={14} color={Colors.borderStrong} />
                    )}
                  </Pressable>

                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {name}
                    </Text>
                    {task.due_date ? (
                      <Text style={styles.cardDue} numberOfLines={1}>
                        Échéance {formatDate(task.due_date)}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.cardRight}>
                    {task.amount != null ? (
                      <Text style={styles.cardAmount}>{formatMoney(task.amount)}</Text>
                    ) : null}
                    <StatusBadge text={status.badge} variant={status.variant} />
                  </View>
                </View>

                <View style={styles.cardBottom}>
                  <View style={styles.channelsRow}>
                    {channels.map(ch => (
                      <View key={ch} style={styles.channelPill}>
                        <Text style={styles.channelPillText}>{CHANNEL_LABEL[ch]}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.actions}>
                    <Pressable
                      style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}
                      onPress={() => handleCall(task.customer?.phone)}
                    >
                      <Smartphone size={18} color={Colors.action} />
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.remindBtn, pressed && styles.pressed]}
                      onPress={() => openSheet(task)}
                    >
                      <Bell size={16} color="#FFFFFF" />
                      <Text style={styles.remindBtnText}>Relancer</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* BOTTOM-SHEET RELANCE */}
      <Modal visible={!!sheetTask} animationType="slide" transparent onRequestClose={closeSheet}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            {sheetTask && sheetStatus ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>{sheetTitle}</Text>
                  <View style={styles.toneChip}>
                    <Text style={styles.toneChipText}>Courtois</Text>
                  </View>
                </View>

                <View style={styles.sheetClientRow}>
                  <Text style={styles.sheetClientName}>
                    {sheetTask.customer?.name ?? sheetTask.title}
                    {sheetTask.amount != null ? (
                      <Text style={styles.sheetAmount}> · {formatMoney(sheetTask.amount)}</Text>
                    ) : null}
                  </Text>
                </View>
                {sheetTask.due_date ? (
                  <Text style={styles.sheetMeta}>
                    Échéance le {formatDate(sheetTask.due_date)} · {sheetStatus.badge}
                  </Text>
                ) : (
                  <Text style={styles.sheetMeta}>{sheetStatus.badge}</Text>
                )}

                <Text style={styles.sheetSectionLabel}>Envoyer sur</Text>
                <View style={styles.sheetChannels}>
                  {(sheetTask.channels ?? []).length === 0 ? (
                    <Text style={styles.sheetEmptyChannels}>
                      Aucun canal activé pour ce client.
                    </Text>
                  ) : (
                    (sheetTask.channels ?? []).map(ch => {
                      const active = sheetChannel === ch;
                      return (
                        <Pressable
                          key={ch}
                          style={[styles.sheetChannelChip, active && styles.sheetChannelChipActive]}
                          onPress={() => setSheetChannel(ch)}
                        >
                          <Text
                            style={[
                              styles.sheetChannelText,
                              active && styles.sheetChannelTextActive,
                            ]}
                          >
                            {CHANNEL_LABEL[ch]}
                          </Text>
                          {active ? <Check size={14} color={Colors.action} /> : null}
                        </Pressable>
                      );
                    })
                  )}
                </View>

                <Text style={styles.sheetSectionLabel}>Aperçu du message</Text>
                <TextInput
                  style={styles.previewInput}
                  value={sheetMessage}
                  onChangeText={setSheetMessage}
                  multiline
                  editable={!sending}
                  placeholder="Message de relance…"
                  placeholderTextColor={Colors.textColors.disabled}
                />

                <View style={styles.sheetActions}>
                  <Pressable style={styles.sheetCancelBtn} onPress={closeSheet} disabled={sending}>
                    <Text style={styles.sheetCancelText}>Annuler</Text>
                  </Pressable>
                  <Pressable
                    style={styles.sheetSendBtn}
                    onPress={handleSend}
                    disabled={sending || (sheetTask.channels ?? []).length === 0}
                  >
                    {sending ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Send size={16} color="#FFFFFF" />
                        <Text style={styles.sheetSendText}>Envoyer la relance</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            ) : null}

            <Pressable style={styles.sheetClose} onPress={closeSheet} hitSlop={8}>
              <X size={18} color={Colors.textColors.tertiary} />
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 96 },
  center: { paddingVertical: 64, alignItems: 'center' },

  // HERO MARINE
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    backgroundColor: Colors.primary[900],
    borderRadius: 20,
    padding: Spacing.xl,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextBlock: { flex: 1 },
  heroNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.onMarine,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 2,
  },

  // CHIPS
  chipsRow: { gap: Spacing.sm, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary[900],
    borderColor: Colors.primary[900],
  },
  chipText: { fontSize: 13.5, fontWeight: '600', color: Colors.textColors.secondary },
  chipTextActive: { color: Colors.onMarine },
  chipBadge: {
    minWidth: 20,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 999,
    backgroundColor: Colors.muted.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipBadgeActive: { backgroundColor: 'rgba(255, 255, 255, 0.20)' },
  chipBadgeText: { fontSize: 11.5, fontWeight: '700', color: Colors.textColors.secondary },
  chipBadgeTextActive: { color: Colors.onMarine },

  // CARTES TÂCHES
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  cardTop: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cardInfo: { flex: 1, gap: 2 },
  cardName: { fontSize: 15.5, fontWeight: '700', color: Colors.text },
  cardDue: { fontSize: 13, color: Colors.textColors.tertiary, fontWeight: '500' },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  cardAmount: {
    fontSize: 15.5,
    fontWeight: '800',
    color: Colors.danger.main,
    fontVariant: ['tabular-nums'],
  },

  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  channelsRow: { flexDirection: 'row', gap: 6, flexShrink: 1, flexWrap: 'wrap' },
  channelPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  channelPillText: { fontSize: 11, fontWeight: '700', color: Colors.textColors.tertiary },

  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.info.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remindBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: Spacing.lg,
    borderRadius: 10,
    backgroundColor: Colors.action,
  },
  remindBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  pressed: { opacity: 0.7 },

  // EMPTY
  empty: { paddingVertical: 48, alignItems: 'center', gap: Spacing.sm },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.success.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 14, color: Colors.textColors.tertiary, textAlign: 'center' },

  // BOTTOM-SHEET
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.sheet,
    borderTopRightRadius: BorderRadius.sheet,
    maxHeight: '88%',
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.borderStrong,
    marginBottom: Spacing.lg,
  },
  sheetClose: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, flexShrink: 1 },
  toneChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.info.background,
  },
  toneChipText: { fontSize: 12.5, fontWeight: '700', color: Colors.action },
  sheetClientRow: { marginTop: 2 },
  sheetClientName: { fontSize: 15, fontWeight: '700', color: Colors.danger.main },
  sheetAmount: { fontSize: 15, fontWeight: '800', color: Colors.danger.main },
  sheetMeta: {
    fontSize: 13,
    color: Colors.textColors.tertiary,
    marginTop: 2,
    fontWeight: '500',
  },
  sheetSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textColors.secondary,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  sheetChannels: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  sheetEmptyChannels: { fontSize: 13, color: Colors.textColors.tertiary },
  sheetChannelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
  },
  sheetChannelChipActive: {
    borderColor: Colors.action,
    backgroundColor: Colors.info.background,
  },
  sheetChannelText: { fontSize: 13, fontWeight: '600', color: Colors.textColors.secondary },
  sheetChannelTextActive: { color: Colors.action },
  previewInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.md,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  sheetActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  sheetCancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.muted.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelText: { fontSize: 15, fontWeight: '600', color: Colors.textColors.secondary },
  sheetSendBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.action,
  },
  sheetSendText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
