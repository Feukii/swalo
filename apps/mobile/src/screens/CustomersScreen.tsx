import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Users,
  Plus,
  Eye,
  Search,
  Mail,
  Smartphone,
  Check,
  Calendar,
} from '../components/icons/SimpleIcons';
import { ScreenHeader, IconButton, SyncPill } from '../components/ui';
import { Colors, Spacing, Shadows } from '../constants/theme-v2';
import { formatDate } from '../utils/date';
import { formatPhoneOnInput } from '../utils/phone';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { usePermissions } from '../hooks/usePermissions';
import { useLocalCustomers, useLocalClientReceivables } from '../hooks/useLocalData';
import { createCustomerOffline, createReceivableOffline } from '../db/offlineWrite';

interface CustomersScreenNavigation {
  goBack: () => void;
  navigate: {
    (screen: 'CustomerBalancesSummary'): void;
    (screen: 'CustomerDetails', params: { id: string }): void;
  };
}

interface CustomersScreenProps {
  navigation: CustomersScreenNavigation;
}

// Teintes d'avatar stables dérivées du nom (tokens uniquement)
const AVATAR_PALETTE = [
  { bg: Colors.warning.background, fg: Colors.warning.text },
  { bg: Colors.danger.background, fg: Colors.danger.text },
  { bg: Colors.info.background, fg: Colors.info.text },
  { bg: Colors.muted.main, fg: Colors.muted.foreground },
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatFcfa(amount: number): string {
  // Normalise les espaces insécables/étroits (format fr-FR) en espace simple
  const grouped = Math.round(amount).toLocaleString('fr-FR').replace(/\s/g, ' ');
  return `${grouped} F`;
}

// Date courte « 29 juin » (sans année) pour la puce d'échéance.
function formatDueDate(isoDate: string): string {
  return formatDate(isoDate, 'fr-FR', { day: 'numeric', month: 'long' });
}

interface DueChipInfo {
  date: string;
  label: string;
  /** true = échéance dépassée ou aujourd'hui (accent rouge), false = future proche (accent sky) */
  urgent: boolean;
}

// Construit le libellé d'échéance affiché sous le montant : « Dans Xj » (future),
// « Échéance aujourd'hui » (jour J) ou « Retard Xj » (dépassée).
function buildDueChip(dueIso: string): DueChipInfo {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const due = new Date(dueIso);
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round((startOfDue.getTime() - startOfToday.getTime()) / MS_PER_DAY);

  if (diffDays > 0) {
    return { date: formatDueDate(dueIso), label: `Dans ${diffDays}j`, urgent: false };
  }
  if (diffDays === 0) {
    return { date: formatDueDate(dueIso), label: 'Échéance aujourd’hui', urgent: true };
  }
  return { date: formatDueDate(dueIso), label: `Retard ${Math.abs(diffDays)}j`, urgent: true };
}

interface NotificationChannelsValue {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
}

interface NotificationChannelsTogglesProps {
  value: NotificationChannelsValue;
  onChange: (next: NotificationChannelsValue) => void;
}

// Sélecteur des canaux de notification (créances/relances) — réutilisé en
// création et en édition de client. Email coché par défaut côté appelant.
export function NotificationChannelsToggles({ value, onChange }: NotificationChannelsTogglesProps) {
  const channels: Array<{
    key: keyof NotificationChannelsValue;
    label: string;
    icon: typeof Mail;
  }> = [
    { key: 'email', label: 'Email', icon: Mail },
    { key: 'sms', label: 'SMS', icon: Smartphone },
    { key: 'whatsapp', label: 'WhatsApp', icon: Smartphone },
  ];

  return (
    <View style={channelStyles.group}>
      {channels.map(channel => {
        const Icon = channel.icon;
        const active = value[channel.key];
        return (
          <TouchableOpacity
            key={channel.key}
            style={[channelStyles.chip, active && channelStyles.chipActive]}
            activeOpacity={0.7}
            onPress={() => onChange({ ...value, [channel.key]: !active })}
          >
            <Icon size={16} color={active ? Colors.action : Colors.muted.foreground} />
            <Text style={[channelStyles.chipText, active && channelStyles.chipTextActive]}>
              {channel.label}
            </Text>
            {active ? <Check size={14} color={Colors.action} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const channelStyles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
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
  chipActive: {
    borderColor: Colors.action,
    backgroundColor: Colors.info.background,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.muted.foreground,
  },
  chipTextActive: {
    color: Colors.action,
  },
});

export default function CustomersScreen({ navigation }: CustomersScreenProps) {
  const { shop } = useCurrentUser();
  const { can } = usePermissions();
  const canCreateCustomer = can('customers', 'create');
  const shopId = shop?.id || null;
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Local data hook - reads from SQLite
  const { data: customers, loading: isLoading, refresh } = useLocalCustomers(shopId);
  // Créances actives du shop (une seule requête) — agrégées par client en mémoire
  const { data: receivables } = useLocalClientReceivables(shopId);

  // Form state
  const [name, setName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [notifications, setNotifications] = useState<NotificationChannelsValue>({
    email: true,
    sms: false,
    whatsapp: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenModal = () => {
    setName('');
    setFirstName('');
    setPhone('');
    setCreditLimit('');
    setInitialBalance('');
    setNotifications({ email: true, sms: false, whatsapp: false });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setName('');
    setFirstName('');
    setPhone('');
    setCreditLimit('');
    setInitialBalance('');
    setNotifications({ email: true, sms: false, whatsapp: false });
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom est obligatoire');
      return;
    }

    // Vérifier les doublons (insensible à la casse)
    const newFullName = `${firstName.trim()} ${name.trim()}`.toLowerCase().trim();
    const isDuplicate = customers.some(customer => {
      const existingFullName = `${customer.first_name || ''} ${customer.name}`.toLowerCase().trim();
      return existingFullName === newFullName;
    });

    if (isDuplicate) {
      Alert.alert(
        'Client existant',
        `Un client avec le nom "${firstName.trim() ? `${firstName.trim()} ${name.trim()}` : name.trim()}" existe déjà.`
      );
      return;
    }

    // Valider la limite de crédit si fournie (0 ou vide = illimité)
    let creditLimitValue: number | undefined;
    if (creditLimit.trim()) {
      const limit = parseFloat(creditLimit);
      if (isNaN(limit) || limit < 0) {
        Alert.alert('Erreur', 'La limite de crédit doit être un nombre positif');
        return;
      }
      creditLimitValue = Math.round(limit);
    }

    // Valider la dette de départ si fournie
    let initialBalanceValue: number | undefined;
    if (initialBalance.trim()) {
      const balance = parseFloat(initialBalance);
      if (isNaN(balance) || balance < 0) {
        Alert.alert('Erreur', 'La dette de départ doit être un nombre positif');
        return;
      }
      initialBalanceValue = Math.round(balance);
    }

    if (!shopId) {
      Alert.alert('Erreur', 'Boutique non identifiée');
      return;
    }

    setIsSaving(true);
    try {
      const { customerId } = await createCustomerOffline({
        shopId,
        name: name.trim(),
        firstName: firstName.trim() || undefined,
        phone: phone.trim() || undefined,
        creditLimit: creditLimitValue,
        emailNotificationsEnabled: notifications.email,
        smsNotificationsEnabled: notifications.sms,
        whatsappNotificationsEnabled: notifications.whatsapp,
      });

      // If initial balance provided, create a receivable
      if (initialBalanceValue && initialBalanceValue > 0) {
        await createReceivableOffline({
          shopId,
          customerId,
          amount: initialBalanceValue,
          description: 'Solde initial',
        });
      }

      Alert.alert('Succes', 'Client cree avec succes');
      handleCloseModal();
      await refresh();
    } catch (error: unknown) {
      console.error('Erreur lors de la creation:', error);
      const message = error instanceof Error ? error.message : '';
      Alert.alert('Erreur', message || 'Erreur lors de la creation');
    } finally {
      setIsSaving(false);
    }
  };

  const getPersonName = (person: { name: string; first_name?: string | null }): string => {
    return person.first_name ? `${person.first_name} ${person.name}` : person.name;
  };

  // Solde par client (positif = doit / créance en cours)
  const balanceByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of receivables) {
      map.set(r.customer_id, (map.get(r.customer_id) ?? 0) + r.balance);
    }
    return map;
  }, [receivables]);

  // Échéance la plus proche par client (créance non soldée avec une due_date).
  const dueDateByCustomer = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of receivables) {
      if (r.balance <= 0 || !r.due_date) continue;
      const current = map.get(r.customer_id);
      if (!current || r.due_date < current) {
        map.set(r.customer_id, r.due_date);
      }
    }
    return map;
  }, [receivables]);

  // Total des créances + nombre de clients débiteurs (depuis les données déjà chargées)
  const { totalReceivable, debtorCount } = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const balance of balanceByCustomer.values()) {
      if (balance > 0) {
        total += balance;
        count += 1;
      }
    }
    return { totalReceivable: total, debtorCount: count };
  }, [balanceByCustomer]);

  const filteredCustomers = customers.filter(customer => {
    const fullName = `${customer.first_name || ''} ${customer.name}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    return (
      fullName.includes(query) ||
      customer.phone?.includes(query) ||
      customer.email?.toLowerCase().includes(query)
    );
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Clients"
        subtitle="Créances & paiements"
        showBack={true}
        onBack={() => navigation.goBack()}
        rightAction={
          <View style={styles.headerActions}>
            <SyncPill />
            <IconButton onPress={() => navigation.navigate('CustomerBalancesSummary')}>
              <Eye size={22} color={Colors.action} />
            </IconButton>
            {canCreateCustomer && (
              <IconButton onPress={handleOpenModal}>
                <Plus size={22} color={Colors.action} />
              </IconButton>
            )}
          </View>
        }
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Carte HERO — Créances en cours */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Créances en cours</Text>
          <Text style={styles.heroAmount}>{formatFcfa(totalReceivable)}</Text>
          <Text style={styles.heroSub}>
            {debtorCount} {debtorCount > 1 ? 'clients débiteurs' : 'client débiteur'}
          </Text>
        </View>

        {/* Barre de recherche */}
        <View style={styles.searchCard}>
          <Search size={18} color={Colors.action} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher un client…"
            placeholderTextColor={Colors.muted.foreground}
          />
        </View>

        {/* Liste clients */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.action} />
          </View>
        ) : filteredCustomers.length === 0 ? (
          <View style={styles.emptyState}>
            <Users size={48} color={Colors.muted.foreground} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'Aucun client trouvé' : 'Aucun client enregistré'}
            </Text>
          </View>
        ) : (
          filteredCustomers.map(customer => {
            const fullName = getPersonName(customer);
            const balance = balanceByCustomer.get(customer.id) ?? 0;
            const avatar = AVATAR_PALETTE[hashString(fullName) % AVATAR_PALETTE.length];
            const creditLimitValue = customer.credit_limit ?? 0;
            const hasLimit = creditLimitValue > 0 && balance > 0;
            const ratio = hasLimit ? Math.min(balance / creditLimitValue, 1) : 0;
            const nearLimit = ratio >= 0.8;
            const dueIso = dueDateByCustomer.get(customer.id);
            const dueChip = dueIso ? buildDueChip(dueIso) : null;

            return (
              <TouchableOpacity
                key={customer.id}
                style={styles.customerCard}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('CustomerDetails', { id: customer.id })}
              >
                <View style={styles.customerRow}>
                  <View style={[styles.avatar, { backgroundColor: avatar.bg }]}>
                    <Text style={[styles.avatarText, { color: avatar.fg }]}>
                      {getInitials(fullName)}
                    </Text>
                  </View>

                  <View style={styles.customerInfo}>
                    <Text style={styles.customerName} numberOfLines={1}>
                      {fullName}
                    </Text>
                    {customer.phone ? (
                      <Text style={styles.customerPhone} numberOfLines={1}>
                        {customer.phone}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.amountBlock}>
                    {balance > 0 ? (
                      <>
                        <Text style={styles.amountDue}>{formatFcfa(balance)}</Text>
                        <Text style={styles.statusDue}>Doit</Text>
                      </>
                    ) : balance < 0 ? (
                      <>
                        <Text style={styles.amountCredit}>{formatFcfa(-balance)}</Text>
                        <Text style={styles.statusCredit}>À rembourser</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.amountOk}>À jour</Text>
                        <Text style={styles.statusOk}>Soldé</Text>
                      </>
                    )}
                  </View>
                </View>

                {dueChip ? (
                  <View
                    style={[
                      styles.dueChip,
                      dueChip.urgent ? styles.dueChipUrgent : styles.dueChipSoon,
                    ]}
                  >
                    <Calendar
                      size={13}
                      color={dueChip.urgent ? Colors.danger.main : Colors.action}
                    />
                    <Text
                      style={[
                        styles.dueChipText,
                        dueChip.urgent ? styles.dueChipTextUrgent : styles.dueChipTextSoon,
                      ]}
                      numberOfLines={1}
                    >
                      Échéance {dueChip.date} · {dueChip.label}
                    </Text>
                  </View>
                ) : null}

                {hasLimit ? (
                  <View style={styles.limitBlock}>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${ratio * 100}%`,
                            backgroundColor: nearLimit ? Colors.danger.main : Colors.success.main,
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.limitLabels}>
                      <Text style={styles.limitText}>Limite de crédit</Text>
                      <Text style={styles.limitText}>{formatFcfa(creditLimitValue)}</Text>
                    </View>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Add Customer Modal */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={handleCloseModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nouveau Client</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Nom <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Nom du client"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Prénom</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Prénom (optionnel)"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Téléphone</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={text => setPhone(formatPhoneOnInput(text))}
                placeholder="+237 6XX XXX XXX"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Limite de crédit (FCFA)</Text>
              <TextInput
                style={styles.input}
                value={creditLimit}
                onChangeText={setCreditLimit}
                placeholder="0"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
              />
              <Text style={styles.hint}>
                Plafond de crédit autorisé pour ce client. 0 ou vide = illimité. Ne crée aucune
                créance.
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Dette de départ (optionnel)</Text>
              <TextInput
                style={styles.input}
                value={initialBalance}
                onChangeText={setInitialBalance}
                placeholder="0"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
              />
              <Text style={styles.hint}>Crée une créance de départ — laisser vide si aucune.</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Notifications (relances)</Text>
              <NotificationChannelsToggles value={notifications} onChange={setNotifications} />
              <Text style={styles.hint}>
                Canaux utilisés pour relancer ce client sur ses dettes.
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCloseModal}
                disabled={isSaving}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleSubmit}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Créer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  // Hero
  hero: {
    backgroundColor: Colors.primary[900],
    borderRadius: 20,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary[300],
    marginBottom: Spacing.xs,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.onMarine,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: Spacing.xs,
  },
  // Search
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    padding: 0,
  },
  // Customer card
  customerCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  customerPhone: {
    fontSize: 13,
    color: Colors.textColors.tertiary,
    marginTop: 1,
  },
  amountBlock: {
    alignItems: 'flex-end',
  },
  amountDue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.danger.main,
  },
  statusDue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.danger.main,
    marginTop: 1,
  },
  amountCredit: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.action,
  },
  statusCredit: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.action,
    marginTop: 1,
  },
  amountOk: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.success.main,
  },
  statusOk: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success.main,
    marginTop: 1,
  },
  // Due date chip
  dueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: 999,
  },
  dueChipSoon: {
    backgroundColor: Colors.info.background,
  },
  dueChipUrgent: {
    backgroundColor: Colors.danger.background,
  },
  dueChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dueChipTextSoon: {
    color: Colors.action,
  },
  dueChipTextUrgent: {
    color: Colors.danger.main,
  },
  // Credit limit progress
  limitBlock: {
    marginTop: Spacing.md,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: Colors.muted.main,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  limitLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  limitText: {
    fontSize: 12,
    color: Colors.textColors.tertiary,
  },
  loadingContainer: {
    paddingVertical: Spacing['3xl'],
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.muted.foreground,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing['2xl'],
    ...Shadows.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  required: {
    color: Colors.danger.main,
  },
  input: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
    color: Colors.text,
  },
  hint: {
    fontSize: 12,
    color: Colors.muted.foreground,
    marginTop: 4,
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: Colors.muted.main,
  },
  cancelButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: Colors.action,
  },
  submitButtonText: {
    color: Colors.primary.foreground,
    fontSize: 16,
    fontWeight: '600',
  },
});
