import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Linking,
  Switch,
} from 'react-native';
import {
  Edit,
  Smartphone,
  Mail,
  MapPin,
  ArrowUp,
  ArrowDown,
  X,
  Calendar,
  Bell,
  Send,
  Receipt,
} from '../components/icons/SimpleIcons';
import {
  ScreenHeader,
  StatusBadge,
  TransactionDetailModal,
  IconButton,
  SyncPill,
} from '../components/ui';
import { Colors, Spacing, Shadows, BorderRadius } from '../constants/theme-v2';
import { formatDate } from '../utils/date';
import { formatMoney } from '../utils/money';
import { formatPhoneOnInput, formatCameroonPhone, isValidCameroonPhone } from '../utils/phone';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { usePermissions } from '../hooks/usePermissions';
import {
  customerRepo,
  clientReceivableRepo,
  clientReceivablePaymentRepo,
  LocalClientReceivable,
  LocalClientReceivablePayment,
  LocalCashEntry,
} from '../db/repositories';
import { getDatabase } from '../db/schema';
import {
  updateCustomerOffline,
  createReceivableOffline,
  payReceivableOffline,
} from '../db/offlineWrite';
import { checkCreditLimit } from '../utils/creditCheck';
import { customersApi, sellerTasksApi, ReminderChannel } from '../lib/api';

interface CustomerDetailsNavigation {
  goBack: () => void;
  addListener: (type: 'focus', callback: () => void) => () => void;
}

interface CustomerDetailsScreenProps {
  navigation: CustomerDetailsNavigation;
  route: {
    params: {
      id: string;
    };
  };
}

interface SelectedTransaction {
  type: string;
  date: string;
  amount: number;
  note?: string;
  status?: string;
  isCredit?: boolean;
  category?: string;
  customerName?: string;
}

function getErrorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

// ─── Notifications (transparence dettes) ─────────────────────────────
type NotificationStatus = 'SENT' | 'QUEUED' | 'FAILED' | string;

interface NotificationEntry {
  channel: string;
  type: string;
  status: NotificationStatus;
  created_at?: string | null;
  error?: string | null;
}

interface NotificationsSummary {
  total: number;
  by_status?: Record<string, number>;
  by_channel?: Record<string, number>;
  recent?: NotificationEntry[];
}

function parseNotificationsSummary(raw: unknown): NotificationsSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const total = typeof obj.total === 'number' ? obj.total : 0;
  const recentRaw = Array.isArray(obj.recent) ? obj.recent : [];
  const recent: NotificationEntry[] = recentRaw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map(e => ({
      channel: typeof e.channel === 'string' ? e.channel : '—',
      type: typeof e.type === 'string' ? e.type : '—',
      status: typeof e.status === 'string' ? e.status : '—',
      // L'API renvoie `sent_at` ; on accepte aussi `created_at` par robustesse.
      created_at:
        typeof e.sent_at === 'string'
          ? e.sent_at
          : typeof e.created_at === 'string'
            ? e.created_at
            : null,
      error: typeof e.error === 'string' ? e.error : null,
    }));
  return {
    total,
    by_status:
      obj.by_status && typeof obj.by_status === 'object'
        ? (obj.by_status as Record<string, number>)
        : undefined,
    by_channel:
      obj.by_channel && typeof obj.by_channel === 'object'
        ? (obj.by_channel as Record<string, number>)
        : undefined,
    recent,
  };
}

// Étiquette courte d'un canal (badges "SMS Livré", "WA Livré"...)
const NOTIF_CHANNEL_SHORT: Record<string, string> = {
  EMAIL: 'E-mail',
  SMS: 'SMS',
  WHATSAPP: 'WA',
};

// Libellé lisible du type de notification (historique & transparence).
const NOTIF_TYPE_LABELS: Record<string, string> = {
  PAYMENT_REMINDER: 'Relance de paiement',
  PAYMENT_RECEIVED: 'Paiement reçu',
  DEBT_REMINDER: 'Relance de dette',
};

function getNotifTypeLabel(type: string): string {
  return NOTIF_TYPE_LABELS[type] ?? 'Notification';
}

// Libellé de livraison par statut (badge à côté du canal).
function getDeliveryLabel(status: string): string {
  switch (status) {
    case 'SENT':
      return 'Livré';
    case 'QUEUED':
    case 'PENDING':
      return 'En file';
    case 'FAILED':
      return 'Échec';
    default:
      return status;
  }
}

const NOTIF_STATUS_META: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }
> = {
  SENT: { label: 'Envoyé', variant: 'success' },
  QUEUED: { label: 'En file', variant: 'warning' },
  PENDING: { label: 'En file', variant: 'warning' },
  FAILED: { label: 'Échec', variant: 'danger' },
};

function getNotifStatusMeta(status: string): {
  label: string;
  variant: 'success' | 'warning' | 'danger' | 'default';
} {
  return NOTIF_STATUS_META[status] ?? { label: status, variant: 'default' };
}

// ─── Date d'échéance (sélecteur sans dépendance externe) ─────────────
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Échéance la plus proche parmi les créances en cours (PENDING/PARTIAL).
function nearestDueDate(receivables: ReceivableWithPayments[]): string | null {
  const dues = receivables
    .filter(r => (r.status === 'PENDING' || r.status === 'PARTIAL') && r.due_date)
    .map(r => r.due_date as string)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  return dues.length > 0 ? dues[0] : null;
}

// Différence en jours calendaires entre une échéance et aujourd'hui.
function diffInDays(due: string): number | null {
  const d = new Date(due);
  if (isNaN(d.getTime())) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

// Libellé court de la puce échéance : "Dans Xj" / "Aujourd'hui" / "Retard Xj".
function dueRelativeLabel(due: string): { text: string; overdue: boolean } {
  const delta = diffInDays(due);
  if (delta === null) return { text: '', overdue: false };
  if (delta < 0) return { text: `Retard ${Math.abs(delta)}j`, overdue: true };
  if (delta === 0) return { text: "Aujourd'hui", overdue: true };
  return { text: `Dans ${delta}j`, overdue: false };
}

// Palier de relance (J-7 / J-3 / J-0) à partir du nombre de jours avant
// échéance. En retard ou aujourd'hui -> J-0.
function reminderPalier(delta: number | null): string {
  if (delta === null) return 'J-7';
  if (delta <= 0) return 'J-0';
  if (delta <= 3) return 'J-3';
  return 'J-7';
}

// Palier reconstruit pour un évènement passé : on compare la date d'envoi à
// l'échéance la plus proche (approximation, faute d'historique d'échéance par
// notification).
function reminderPalierForDate(sent: string | null, due: string | null): string {
  if (sent && due) {
    const d = Math.round(
      (new Date(due).getTime() - new Date(sent).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (!isNaN(d)) return reminderPalier(d);
  }
  return 'J-7';
}

// Évènement d'historique : un envoi de relance peut produire plusieurs lignes
// (une par canal). On regroupe par type + jour pour afficher une seule ligne
// avec plusieurs badges de canal.
interface ReminderEvent {
  key: string;
  type: string;
  date: string | null;
  isReminder: boolean;
  channels: Array<{
    short: string;
    label: string;
    variant: 'success' | 'warning' | 'danger' | 'default';
  }>;
}

function groupNotifications(recent: NotificationEntry[]): ReminderEvent[] {
  const groups = new Map<string, ReminderEvent>();
  for (const n of recent) {
    const day = n.created_at ? n.created_at.slice(0, 10) : 'na';
    const key = `${n.type}|${day}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        type: n.type,
        date: n.created_at ?? null,
        isReminder: n.type === 'PAYMENT_REMINDER' || n.type === 'DEBT_REMINDER',
        channels: [],
      };
      groups.set(key, group);
    }
    const meta = getNotifStatusMeta(n.status);
    group.channels.push({
      short: NOTIF_CHANNEL_SHORT[n.channel] ?? n.channel,
      label: getDeliveryLabel(n.status),
      variant: meta.variant,
    });
  }
  return Array.from(groups.values());
}

// Initiales (max 2 lettres) à partir du prénom + nom
function getInitials(firstName: string | null, name: string): string {
  const a = (firstName || '').trim();
  const b = (name || '').trim();
  if (a && b) return `${a[0]}${b[0]}`.toUpperCase();
  const single = (b || a).trim();
  if (!single) return '?';
  const parts = single.split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return single.slice(0, 2).toUpperCase();
}

interface ReceivableWithPayments {
  id: string;
  amount: number;
  balance: number;
  paid_amount: number;
  status: string;
  created_at: string;
  due_date: string | null;
  description: string | null;
  notes: string | null;
  payments: LocalClientReceivablePayment[];
}

interface CustomerDetails {
  id: string;
  name: string;
  first_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  credit_limit: number;
  is_active: number | boolean;
  receivables: ReceivableWithPayments[];
  cash_entries: LocalCashEntry[];
  email_notifications_enabled: boolean;
  sms_notifications_enabled: boolean;
  whatsapp_notifications_enabled: boolean;
  notifications_summary: NotificationsSummary | null;
  stats: {
    total_receivables: number;
    total_balance: number;
    total_paid: number;
    total_sales: number;
  };
}

// Lecture défensive des préférences de notification du client local (les
// champs peuvent ne pas exister selon l'état du schéma offline).
function readNotificationPrefs(record: Record<string, unknown>): {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
} {
  const truthy = (v: unknown, fallback: boolean): boolean => {
    if (v === undefined || v === null) return fallback;
    return v === true || v === 1 || v === '1';
  };
  return {
    email: truthy(record.email_notifications_enabled, true),
    sms: truthy(record.sms_notifications_enabled, false),
    whatsapp: truthy(record.whatsapp_notifications_enabled, false),
  };
}

export default function CustomerDetailsScreen({ navigation, route }: CustomerDetailsScreenProps) {
  const { id } = route.params;
  const { user, shop, shopId, userId } = useCurrentUser();
  const userRole = user?.role || 'EMPLOYEE';
  const { can } = usePermissions();
  const canCreateReceivable = can('receivables', 'create');
  const canRefundReceivable = can('receivables', 'refund');

  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<
    Array<{
      type: 'receivable' | 'payment' | 'cash' | 'sale';
      date: string;
      amount: number;
      note?: string;
      status?: string;
      isRefund?: boolean;
    }>
  >([]);

  // Modal state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create receivable modal state
  const [showCreateReceivableModal, setShowCreateReceivableModal] = useState(false);
  const [receivableAmount, setReceivableAmount] = useState('');
  const [receivableDescription, setReceivableDescription] = useState('');
  const [receivableNote, setReceivableNote] = useState('');
  // Date d'échéance obligatoire (format ISO YYYY-MM-DD)
  const [receivableDueDate, setReceivableDueDate] = useState('');

  // Transaction detail modal state
  const [selectedTransaction, setSelectedTransaction] = useState<SelectedTransaction | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    first_name: '',
    phone: '',
    email: '',
    address: '',
    credit_limit: '',
    notes: '',
  });
  const [editNotifications, setEditNotifications] = useState({
    email: true,
    sms: false,
    whatsapp: false,
  });

  // Customer refund modal state (for refunding money TO customers)
  const [showCustomerRefundModal, setShowCustomerRefundModal] = useState(false);
  const [customerRefundAmount, setCustomerRefundAmount] = useState('');
  const [customerRefundNote, setCustomerRefundNote] = useState('');

  // Relance manuelle (depuis la fiche client)
  const [isReminding, setIsReminding] = useState(false);
  // Bottom sheet "Relancer maintenant"
  const [showRemindSheet, setShowRemindSheet] = useState(false);
  const [remindChannels, setRemindChannels] = useState<{ SMS: boolean; WHATSAPP: boolean }>({
    SMS: true,
    WHATSAPP: false,
  });
  // Bascule d'un canal de notification (préférence client) en cours
  const [togglingChannel, setTogglingChannel] = useState<ReminderChannel | null>(null);

  const loadCustomer = useCallback(async () => {
    if (!shopId) return;
    setIsLoading(true);
    try {
      const cust = await customerRepo.getById(id);
      if (!cust) {
        Alert.alert('Erreur', 'Client introuvable');
        navigation.goBack();
        return;
      }

      // Load receivables with payments
      const receivables = await clientReceivableRepo.getByCustomer(shopId, id);
      const receivablesWithPayments: ReceivableWithPayments[] = await Promise.all(
        receivables.map(async (r: LocalClientReceivable) => {
          const payments = await clientReceivablePaymentRepo.getByReceivable(r.id);
          return {
            id: r.id,
            amount: r.amount,
            balance: r.balance,
            paid_amount: r.paid_amount,
            status: r.status,
            created_at: r.created_at,
            due_date: r.due_date,
            description: r.description,
            notes: r.notes,
            payments,
          };
        })
      );

      // Load cash entries related to this customer
      const db = await getDatabase();
      const cashEntries = await db.getAllAsync<LocalCashEntry>(
        `SELECT * FROM cash_entries WHERE customer_id = ? AND deleted = 0 ORDER BY created_at DESC`,
        [id]
      );

      // Compute stats
      const totalReceivables = receivablesWithPayments.reduce(
        (s, r) => s + Math.max(0, r.amount),
        0
      );
      const totalBalance = receivablesWithPayments.reduce((s, r) => s + r.balance, 0);
      const totalPaid = receivablesWithPayments.reduce((s, r) => s + r.paid_amount, 0);

      // Préférences de notification (lecture défensive du record local)
      const prefs = readNotificationPrefs(cust as unknown as Record<string, unknown>);

      // Résumé des notifications de dettes — best-effort en ligne, n'empêche
      // jamais l'affichage offline-first.
      let notificationsSummary: NotificationsSummary | null = null;
      try {
        const remote = await customersApi.getOne(id);
        notificationsSummary = parseNotificationsSummary(
          (remote as Record<string, unknown>).notifications_summary
        );
      } catch {
        // Hors ligne ou serveur indisponible : section masquée proprement.
      }

      const customerDetails: CustomerDetails = {
        id: cust.id,
        name: cust.name,
        first_name: cust.first_name,
        phone: cust.phone,
        email: cust.email,
        address: cust.address,
        credit_limit: cust.credit_limit ?? 0,
        is_active: cust.is_active,
        receivables: receivablesWithPayments,
        cash_entries: cashEntries,
        email_notifications_enabled: prefs.email,
        sms_notifications_enabled: prefs.sms,
        whatsapp_notifications_enabled: prefs.whatsapp,
        notifications_summary: notificationsSummary,
        stats: {
          total_receivables: totalReceivables,
          total_balance: totalBalance,
          total_paid: totalPaid,
          total_sales: 0,
        },
      };

      setCustomer(customerDetails);

      // Build transactions list
      const txns = buildTransactions(customerDetails);
      setTransactions(txns);

      if (totalBalance < 0) {
        Alert.alert(
          'Remboursement du au client',
          `Vous devez rembourser ${formatMoney(Math.abs(totalBalance))} a ${getPersonName(cust)}.\n\nUtilisez le bouton "Rembourser Client" pour enregistrer le remboursement.`,
          [{ text: 'Compris', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Erreur lors du chargement du client:', error);
      Alert.alert('Erreur', 'Impossible de charger les details du client');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  }, [id, shopId, navigation]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadCustomer();
    });
    return unsubscribe;
  }, [navigation, loadCustomer]);

  const buildTransactions = (customerData: CustomerDetails) => {
    const txns: Array<{
      type: 'receivable' | 'payment' | 'cash';
      date: string;
      amount: number;
      note?: string;
      status?: string;
      isRefund?: boolean;
    }> = [];

    const linkedCashEntryIds = new Set<string>();
    customerData.receivables.forEach(receivable => {
      receivable.payments.forEach(payment => {
        if (payment.cash_entry_id) {
          linkedCashEntryIds.add(payment.cash_entry_id);
        }
      });
    });

    customerData.receivables.forEach(receivable => {
      const isRefundReceivable =
        receivable.status === 'PAID' &&
        (receivable.description?.includes('Remboursement') ||
          receivable.notes?.includes('Remboursement'));
      if (isRefundReceivable) return;

      txns.push({
        type: 'receivable',
        date: receivable.created_at,
        amount: receivable.amount,
        note: receivable.description || receivable.notes || undefined,
        status: receivable.status,
      });

      receivable.payments.forEach(payment => {
        txns.push({
          type: 'payment',
          date: payment.payment_date || payment.created_at,
          amount: -payment.amount,
          note: payment.notes || undefined,
        });
      });
    });

    customerData.cash_entries.forEach(entry => {
      if (linkedCashEntryIds.has(entry.id)) return;
      txns.push({
        type: 'cash',
        date: entry.created_at,
        amount: -entry.amount,
        note: entry.note || undefined,
        isRefund: entry.category?.toLowerCase().includes('remboursement'),
      });
    });

    return txns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const handleOpenRefundModal = () => {
    setShowRefundModal(true);
    setAmount('');
    setNote('');
  };

  const handleCloseRefundModal = () => {
    setShowRefundModal(false);
    setAmount('');
    setNote('');
  };

  const handleSubmitRefund = async () => {
    if (!amount) {
      Alert.alert('Erreur', 'Veuillez entrer un montant');
      return;
    }
    if (!shopId || !userId || !customer) return;

    const amountValue = Math.round(parseFloat(amount));

    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }

    const totalDebt = customer.stats?.total_balance ?? 0;
    const overpayment = amountValue - totalDebt;

    const pendingReceivables = customer.receivables
      .filter(r => r.status === 'PENDING' || r.status === 'PARTIAL')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (pendingReceivables.length === 0) {
      if (totalDebt >= 0) {
        Alert.alert(
          'Attention : Creer un solde negatif',
          `Le client n'a pas de dette. En recevant ${formatMoney(amountValue)}, vous devrez rendre cette somme au client.\n\nVoulez-vous continuer ?`,
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Confirmer', onPress: () => createNegativeReceivable(amountValue) },
          ]
        );
      } else {
        Alert.alert(
          'Attention : Augmenter le solde negatif',
          `Le client a deja un solde de ${formatMoney(totalDebt)} (vous lui devez ${formatMoney(Math.abs(totalDebt))}).\n\nEn recevant ${formatMoney(amountValue)} de plus, vous lui devrez ${formatMoney(Math.abs(totalDebt) + amountValue)}.\n\nVoulez-vous continuer ?`,
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Confirmer', onPress: () => createNegativeReceivable(amountValue) },
          ]
        );
      }
      return;
    }

    if (overpayment > 0) {
      Alert.alert(
        'Attention : Depassement',
        `Le montant de ${formatMoney(amountValue)} depasse la dette de ${formatMoney(totalDebt)}.\n\nVous devrez rendre ${formatMoney(overpayment)} au client.`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Confirmer quand meme',
            onPress: () => processPayment(amountValue, pendingReceivables[0].id),
          },
        ]
      );
      return;
    }

    await processPayment(amountValue, pendingReceivables[0].id);
  };

  const createNegativeReceivable = async (amountValue: number) => {
    if (!shopId || !customer) return;
    setIsSubmitting(true);
    try {
      await createReceivableOffline({
        shopId,
        customerId: customer.id,
        amount: -amountValue,
        description: note || `Remboursement a effectuer a ${getPersonName(customer)}`,
      });

      const totalDebt = customer.stats?.total_balance ?? 0;
      const newBalance = totalDebt - amountValue;

      Alert.alert(
        'Paiement enregistre',
        `Paiement de ${formatMoney(amountValue)} enregistre.\n\nVous devez rendre ${formatMoney(Math.abs(newBalance))} au client.`
      );

      handleCloseRefundModal();
      loadCustomer();
    } catch (error: unknown) {
      console.error("Erreur lors de l'enregistrement:", error);
      Alert.alert('Erreur', getErrorMessage(error) ?? "Erreur lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const processPayment = async (amountValue: number, receivableId: string) => {
    if (!userId || !customer) return;
    setIsSubmitting(true);
    try {
      await payReceivableOffline({
        receivableId,
        amount: amountValue,
        cashierId: userId,
        notes: note || `Paiement de ${getPersonName(customer)}`,
      });

      const totalDebt = customer.stats?.total_balance ?? 0;
      const overpayment = amountValue - totalDebt;

      if (overpayment > 0) {
        Alert.alert(
          'Paiement enregistre',
          `Paiement de ${formatMoney(amountValue)} enregistre.\n\nVous devez rendre ${formatMoney(overpayment)} au client.`
        );
      } else {
        Alert.alert('Succes', 'Paiement enregistre');
      }

      handleCloseRefundModal();
      loadCustomer();
    } catch (error: unknown) {
      console.error("Erreur lors de l'enregistrement:", error);
      Alert.alert('Erreur', getErrorMessage(error) ?? "Erreur lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Customer Refund handlers (refunding money TO customer)
  const handleOpenCustomerRefundModal = () => {
    const balance = customer?.stats?.total_balance || 0;
    if (balance >= 0) {
      Alert.alert(
        'Impossible',
        "Ce client n'a pas de remboursement dû. Le solde doit être négatif pour effectuer un remboursement."
      );
      return;
    }
    setShowCustomerRefundModal(true);
    setCustomerRefundAmount('');
    setCustomerRefundNote('');
  };

  const handleCloseCustomerRefundModal = () => {
    setShowCustomerRefundModal(false);
    setCustomerRefundAmount('');
    setCustomerRefundNote('');
  };

  const handleSubmitCustomerRefund = async () => {
    if (!customerRefundAmount) {
      Alert.alert('Erreur', 'Veuillez entrer un montant');
      return;
    }
    if (!shopId || !customer) return;

    const amountValue = Math.round(parseFloat(customerRefundAmount));

    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }

    const currentBalance = customer.stats?.total_balance ?? 0;
    const refundOwed = Math.abs(currentBalance);

    if (amountValue > refundOwed) {
      Alert.alert(
        'Erreur',
        `Le montant du remboursement (${formatMoney(amountValue)}) depasse le montant du (${formatMoney(refundOwed)})`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await createReceivableOffline({
        shopId,
        customerId: id,
        amount: amountValue,
        description: customerRefundNote || `Remboursement effectue a ${getPersonName(customer)}`,
      });

      Alert.alert('Succes', 'Remboursement enregistre avec succes');
      handleCloseCustomerRefundModal();
      await loadCustomer();
    } catch (error: unknown) {
      console.error('Erreur lors du remboursement:', error);
      Alert.alert('Erreur', getErrorMessage(error) ?? "Impossible d'enregistrer le remboursement");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create Receivable handlers
  const handleOpenCreateReceivableModal = () => {
    setShowCreateReceivableModal(true);
    setReceivableAmount('');
    setReceivableDescription('');
    setReceivableNote('');
    setReceivableDueDate('');
  };

  const handleCloseCreateReceivableModal = () => {
    setShowCreateReceivableModal(false);
    setReceivableAmount('');
    setReceivableDescription('');
    setReceivableNote('');
    setReceivableDueDate('');
  };

  const handleSubmitCreateReceivable = async () => {
    if (!receivableAmount || !customer) {
      Alert.alert('Erreur', 'Veuillez entrer un montant');
      return;
    }
    if (!shopId) return;

    const amountValue = Math.round(parseFloat(receivableAmount));

    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }

    // Vérifier le plafond de crédit
    const creditError = await checkCreditLimit(
      shopId,
      customer.id,
      customer.credit_limit || 0,
      amountValue
    );
    if (creditError) {
      Alert.alert('Plafond de credit atteint', creditError);
      return;
    }

    setIsSubmitting(true);
    try {
      await createReceivableOffline({
        shopId,
        customerId: customer.id,
        amount: amountValue,
        description: receivableDescription || `Creance pour ${getPersonName(customer)}`,
        notes: receivableNote || undefined,
      });

      Alert.alert('Succes', 'Creance creee avec succes');
      handleCloseCreateReceivableModal();
      loadCustomer();
    } catch (error: unknown) {
      console.error('Erreur lors de la creation de la creance:', error);
      Alert.alert('Erreur', getErrorMessage(error) ?? 'Impossible de creer la creance');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditModal = () => {
    if (!customer) return;
    setEditForm({
      // "Nom complet" : on stocke le nom affiché (prénom + nom) dans `name`.
      name: getPersonName(customer),
      first_name: customer.first_name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      credit_limit: customer.credit_limit ? customer.credit_limit.toString() : '',
      notes: '',
    });
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
  };

  const handleSubmitEdit = async () => {
    if (!editForm.name.trim()) {
      Alert.alert('Erreur', 'Le nom est requis');
      return;
    }

    if (editForm.phone.trim() && !isValidCameroonPhone(editForm.phone)) {
      Alert.alert(
        'Téléphone invalide',
        'Entrez un numéro camerounais valide au format +237 6XX XXX XXX.'
      );
      return;
    }

    // "Nom complet" -> on scinde en prénom + nom (inverse de getPersonName) :
    // premier mot = prénom, le reste = nom. Un seul mot -> tout dans le nom.
    const fullName = editForm.name.trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    const firstName = parts.length > 1 ? parts[0] : '';
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : fullName;

    setIsSubmitting(true);
    try {
      await updateCustomerOffline(id, {
        name: lastName,
        firstName: firstName || undefined,
        phone: editForm.phone.trim() || undefined,
        address: editForm.address.trim() || undefined,
        creditLimit: editForm.credit_limit.trim()
          ? Math.round(parseFloat(editForm.credit_limit))
          : undefined,
      });
      Alert.alert('Succes', 'Client modifie avec succes');
      handleCloseEditModal();
      loadCustomer();
    } catch (error: unknown) {
      console.error('Erreur lors de la modification:', error);
      Alert.alert('Erreur', getErrorMessage(error) ?? 'Erreur lors de la modification');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPersonName = (person: { name: string; first_name?: string | null }): string => {
    const firstName = person.first_name ? String(person.first_name).trim() : '';
    const lastName = person.name ? String(person.name).trim() : '';
    return firstName ? `${firstName} ${lastName}` : lastName;
  };

  // Appel téléphonique direct au client.
  const handleCall = () => {
    if (!customer?.phone) {
      Alert.alert('Aucun numéro', "Ce client n'a pas de téléphone enregistré.");
      return;
    }
    Linking.openURL(`tel:${customer.phone}`).catch(() => undefined);
  };

  // Ouvre le bottom sheet de relance en pré-cochant les canaux pertinents.
  const handleOpenRemindSheet = () => {
    if (!customer) return;
    const phoneOk = !!customer.phone;
    let sms = customer.sms_notifications_enabled && phoneOk;
    let wa = customer.whatsapp_notifications_enabled && phoneOk;
    // Aucun canal activé : on propose ceux disponibles côté boutique.
    if (!sms && !wa) {
      sms = phoneOk;
      wa = phoneOk;
    }
    setRemindChannels({ SMS: sms, WHATSAPP: wa });
    setShowRemindSheet(true);
  };

  // Relance manuelle : envoie la relance sur les canaux sélectionnés dans le
  // sheet, sans dépendre d'une tâche vendeur. Le message + le solde dû sont
  // construits côté API à partir des créances en cours du client.
  const handleSendReminder = async () => {
    if (!customer) return;
    const channels = (Object.keys(remindChannels) as Array<'SMS' | 'WHATSAPP'>).filter(
      c => remindChannels[c]
    );
    if (channels.length === 0) {
      Alert.alert('Aucun canal', "Sélectionnez au moins un canal d'envoi.");
      return;
    }
    setIsReminding(true);
    try {
      const result = await sellerTasksApi.manualRemind(customer.id, channels as ReminderChannel[]);
      if (result.ok) {
        setShowRemindSheet(false);
        Alert.alert('Relance envoyée', 'La relance a été envoyée au client.');
        loadCustomer();
      } else {
        Alert.alert('Envoi impossible', result.error ?? "La relance n'a pas pu être envoyée.");
      }
    } catch {
      Alert.alert('Erreur', "Impossible d'envoyer la relance. Réessayez plus tard.");
    } finally {
      setIsReminding(false);
    }
  };

  // Bascule la préférence d'un canal de notification du client (offline-first).
  const handleToggleChannel = async (channel: ReminderChannel) => {
    if (!customer) return;
    setTogglingChannel(channel);
    const next = {
      SMS: !customer.sms_notifications_enabled,
      WHATSAPP: !customer.whatsapp_notifications_enabled,
      EMAIL: !customer.email_notifications_enabled,
    }[channel];
    try {
      await updateCustomerOffline(id, {
        smsNotificationsEnabled: channel === 'SMS' ? next : undefined,
        whatsappNotificationsEnabled: channel === 'WHATSAPP' ? next : undefined,
        emailNotificationsEnabled: channel === 'EMAIL' ? next : undefined,
      });
      // Mise à jour optimiste de l'état local (évite un rechargement complet).
      setCustomer(prev =>
        prev
          ? {
              ...prev,
              sms_notifications_enabled: channel === 'SMS' ? next : prev.sms_notifications_enabled,
              whatsapp_notifications_enabled:
                channel === 'WHATSAPP' ? next : prev.whatsapp_notifications_enabled,
              email_notifications_enabled:
                channel === 'EMAIL' ? next : prev.email_notifications_enabled,
            }
          : prev
      );
    } catch (error: unknown) {
      Alert.alert('Erreur', getErrorMessage(error) ?? 'Impossible de modifier le canal');
    } finally {
      setTogglingChannel(null);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Client"
          subtitle="Fiche & historique"
          showBack
          onBack={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.action} />
        </View>
      </View>
    );
  }

  if (!customer) {
    return null;
  }

  const totalBalance = customer.stats?.total_balance ?? 0;
  const shopOwes = totalBalance < 0; // la boutique doit rembourser le client
  const balanceLabel = shopOwes ? 'À rembourser au client' : 'Solde dû';

  // Échéance la plus proche (pour la puce d'échéance de la carte client).
  const dueDate = nearestDueDate(customer.receivables);
  const dueInfo = dueDate ? dueRelativeLabel(dueDate) : null;

  const canRemind =
    userRole === 'OWNER' ||
    userRole === 'BOSS' ||
    userRole === 'MANAGER' ||
    userRole === 'EMPLOYEE' ||
    userRole === 'SUPERADMIN';

  // Canaux de notification (préférence client + disponibilité côté boutique).
  // Un canal est "disponible boutique" si la coordonnée requise existe :
  // SMS/WhatsApp -> téléphone, E-mail -> email.
  const channelRows: Array<{
    key: ReminderChannel;
    short: 'SMS' | 'WA' | '@';
    label: string;
    enabled: boolean;
    shopAvailable: boolean;
  }> = [
    {
      key: 'SMS',
      short: 'SMS',
      label: 'SMS',
      enabled: customer.sms_notifications_enabled,
      shopAvailable: !!customer.phone,
    },
    {
      key: 'WHATSAPP',
      short: 'WA',
      label: 'WhatsApp',
      enabled: customer.whatsapp_notifications_enabled,
      shopAvailable: !!customer.phone,
    },
    {
      key: 'EMAIL',
      short: '@',
      label: 'E-mail',
      enabled: customer.email_notifications_enabled,
      shopAvailable: !!customer.email,
    },
  ];

  const recentNotifications = customer.notifications_summary?.recent ?? [];
  // Historique regroupé (une ligne par évènement de relance, badges par canal).
  const reminderEvents = groupNotifications(recentNotifications);

  // Données pour le bottom sheet de relance.
  const dueDelta = dueDate ? diffInDays(dueDate) : null;
  const remindPalier = reminderPalier(dueDelta);
  const reminderFirstName =
    (customer.first_name && customer.first_name.trim()) || customer.name.split(/\s+/)[0] || '';
  const shopName = shop?.name || 'la boutique';
  const dueDateLabel = dueDate
    ? formatDate(dueDate, 'fr-FR', { day: 'numeric', month: 'long' })
    : '';
  const reminderMessage = `Bonjour ${reminderFirstName}, nous vous rappelons courtoisement que votre solde de ${formatMoney(
    Math.abs(totalBalance)
  )} arrive à échéance le ${dueDateLabel}. Merci de votre confiance. — ${shopName}`;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={getPersonName(customer)}
        subtitle="Fiche & historique"
        showBack={true}
        onBack={() => navigation.goBack()}
        rightAction={<SyncPill />}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* CARTE CLIENT — avatar + nom + tél + solde + échéance + actions */}
        <View style={styles.clientCard}>
          <View style={styles.clientHeaderRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getInitials(customer.first_name, customer.name)}
              </Text>
            </View>
            <View style={styles.clientHeaderText}>
              <Text style={styles.clientName} numberOfLines={1}>
                {getPersonName(customer)}
              </Text>
              {!!customer.phone && (
                <Text style={styles.clientPhone} numberOfLines={1}>
                  {formatCameroonPhone(String(customer.phone))}
                </Text>
              )}
            </View>
            {can('customers', 'edit') && (
              <IconButton
                onPress={handleOpenEditModal}
                style={styles.cardEditButton}
                hoverColor={Colors.action}
              >
                <Edit size={18} color={Colors.action} />
              </IconButton>
            )}
          </View>

          <View style={styles.balanceRow}>
            <View style={styles.balanceBlock}>
              <Text style={styles.balanceLabel}>{balanceLabel}</Text>
              <Text style={[styles.balanceAmount, shopOwes && styles.balanceAmountRefund]}>
                {formatMoney(totalBalance)}
              </Text>
            </View>
            {dueInfo ? (
              <View
                style={[
                  styles.duePill,
                  {
                    backgroundColor: dueInfo.overdue
                      ? Colors.danger.background
                      : Colors.warning.background,
                  },
                ]}
              >
                <Calendar
                  size={14}
                  color={dueInfo.overdue ? Colors.danger.main : Colors.warning.main}
                />
                <Text
                  style={[
                    styles.duePillText,
                    { color: dueInfo.overdue ? Colors.danger.main : Colors.warning.text },
                  ]}
                >
                  {formatDate(dueDate as string, 'fr-FR', { day: 'numeric', month: 'long' })} ·{' '}
                  {dueInfo.text}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.clientActions}>
            <TouchableOpacity style={styles.callButton} onPress={handleCall} activeOpacity={0.85}>
              <Smartphone size={18} color={Colors.action} />
              <Text style={styles.callButtonText}>Appeler</Text>
            </TouchableOpacity>
            {canRemind && (
              <TouchableOpacity
                style={styles.remindButton}
                onPress={handleOpenRemindSheet}
                activeOpacity={0.85}
              >
                <Bell size={18} color="#FFFFFF" />
                <Text style={styles.remindButtonText}>Relancer maintenant</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* CANAUX DE NOTIFICATION */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CANAUX DE NOTIFICATION</Text>
          <View style={styles.listCard}>
            {channelRows.map((row, idx) => (
              <View
                key={row.key}
                style={[
                  styles.channelRow,
                  idx < channelRows.length - 1 && styles.channelRowBordered,
                ]}
              >
                <View style={styles.channelBadge}>
                  <Text style={styles.channelBadgeText}>{row.short}</Text>
                </View>
                <View style={styles.channelInfo}>
                  <Text style={styles.channelLabel}>{row.label}</Text>
                  {!row.shopAvailable ? (
                    <Text style={styles.channelDisabled}>Désactivé pour la boutique</Text>
                  ) : null}
                </View>
                <Switch
                  value={row.enabled && row.shopAvailable}
                  disabled={!row.shopAvailable || togglingChannel === row.key}
                  onValueChange={() => handleToggleChannel(row.key)}
                  trackColor={{ false: Colors.muted.main, true: Colors.accent }}
                  thumbColor={Colors.surface}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Coordonnées complémentaires (email / adresse) */}
        {!!(customer.email || customer.address) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coordonnées</Text>
            <View style={styles.infoCard}>
              {!!customer.email && (
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <Mail size={18} color={Colors.action} />
                  </View>
                  <Text style={styles.infoText}>{String(customer.email)}</Text>
                </View>
              )}
              {!!customer.address && (
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <MapPin size={18} color={Colors.action} />
                  </View>
                  <Text style={styles.infoText}>{String(customer.address)}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Action Buttons (paiement / créance / remboursement) */}
        {(userRole === 'OWNER' ||
          userRole === 'BOSS' ||
          userRole === 'MANAGER' ||
          userRole === 'EMPLOYEE') &&
          (canRefundReceivable || canCreateReceivable) && (
            <View style={styles.actionButtons}>
              {canRefundReceivable && (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor: Colors.success.background,
                      borderColor: Colors.success.main,
                    },
                  ]}
                  onPress={handleOpenRefundModal}
                  activeOpacity={0.85}
                >
                  <View style={[styles.actionIcon, { backgroundColor: Colors.success.main }]}>
                    <ArrowDown size={18} color={Colors.success.foreground} />
                  </View>
                  <Text style={[styles.actionButtonText, { color: Colors.success.text }]}>
                    Recevoir un paiement
                  </Text>
                </TouchableOpacity>
              )}

              {canCreateReceivable && (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    { backgroundColor: Colors.info.background, borderColor: Colors.action },
                  ]}
                  onPress={handleOpenCreateReceivableModal}
                  activeOpacity={0.85}
                >
                  <View style={[styles.actionIcon, { backgroundColor: Colors.action }]}>
                    <Receipt size={18} color={Colors.onMarine} />
                  </View>
                  <Text style={[styles.actionButtonText, { color: Colors.info.text }]}>
                    Créer une créance
                  </Text>
                </TouchableOpacity>
              )}

              {/* Show Refund button only when balance is negative */}
              {shopOwes && canRefundReceivable && (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.actionButtonFull,
                    { backgroundColor: Colors.danger.background, borderColor: Colors.danger.main },
                  ]}
                  onPress={handleOpenCustomerRefundModal}
                  activeOpacity={0.85}
                >
                  <View style={[styles.actionIcon, { backgroundColor: Colors.danger.main }]}>
                    <ArrowUp size={18} color={Colors.danger.foreground} />
                  </View>
                  <Text style={[styles.actionButtonText, { color: Colors.danger.text }]}>
                    Rembourser le client
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

        {/* HISTORIQUE & TRANSPARENCE — statuts de notification */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>HISTORIQUE & TRANSPARENCE</Text>

          {reminderEvents.length > 0 && (
            <View style={styles.listCard}>
              {reminderEvents.slice(0, 8).map((evt, idx) => {
                const visibleCount = Math.min(reminderEvents.length, 8);
                const isLast = idx >= visibleCount - 1;
                const title = evt.isReminder
                  ? `Relance ${reminderPalierForDate(evt.date, dueDate)} envoyée`
                  : getNotifTypeLabel(evt.type);
                return (
                  <View key={evt.key} style={[styles.notifRow, !isLast && styles.notifRowBordered]}>
                    <View style={styles.notifIconCol}>
                      <View style={styles.notifIcon}>
                        <Bell size={16} color={Colors.action} />
                      </View>
                      {!isLast && <View style={styles.notifConnector} />}
                    </View>
                    <View style={styles.notifBody}>
                      <Text style={styles.notifTitle} numberOfLines={1}>
                        {title}
                      </Text>
                      {evt.date ? (
                        <Text style={styles.notifDate}>{formatDate(evt.date)}</Text>
                      ) : null}
                      <View style={styles.notifBadges}>
                        {evt.channels.map((c, ci) => (
                          <StatusBadge
                            key={`${evt.key}-${ci}`}
                            text={`${c.short} ${c.label}`}
                            variant={c.variant}
                          />
                        ))}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.listCard}>
            {transactions.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Aucune transaction</Text>
              </View>
            ) : (
              transactions.map((transaction, index) => {
                // Detect if this is a refund (negative receivable)
                const isRefund = transaction.type === 'receivable' && transaction.amount < 0;
                const isCredit = transaction.type === 'receivable' && !isRefund;
                const isPositive = transaction.amount > 0;

                const getTitle = () => {
                  if (isRefund) {
                    return 'Remboursement au client';
                  }
                  switch (transaction.type) {
                    case 'receivable':
                      return 'Vente à crédit';
                    case 'payment':
                      return 'Paiement reçu';
                    case 'sale':
                      return 'Vente cash';
                    default:
                      return 'Remboursement caisse';
                  }
                };

                const getBadge = () => {
                  // Show "Remboursement" badge for refunds
                  if (isRefund) {
                    return { text: 'Remboursement', variant: 'danger' as const };
                  }
                  if (!transaction.status) return undefined;
                  const statusMap = {
                    PAID: { text: 'Payé', variant: 'success' as const },
                    PARTIAL: { text: 'Partiel', variant: 'warning' as const },
                    PENDING: { text: 'En attente', variant: 'default' as const },
                  };
                  return statusMap[transaction.status] || undefined;
                };

                const badge = getBadge();
                const dateStr = transaction.date ? formatDate(transaction.date) : 'Date inconnue';
                const amountColor = isCredit
                  ? Colors.warning.main
                  : isPositive
                    ? Colors.success.main
                    : Colors.danger.main;
                const iconTint = isCredit
                  ? Colors.warning.main
                  : isPositive
                    ? Colors.success.main
                    : Colors.danger.main;
                const iconBg = isCredit
                  ? Colors.warning.background
                  : isPositive
                    ? Colors.success.background
                    : Colors.danger.background;

                return (
                  <TouchableOpacity
                    key={index}
                    activeOpacity={0.7}
                    style={[styles.txRow, index < transactions.length - 1 && styles.txRowBordered]}
                    onPress={() => {
                      setSelectedTransaction({
                        type: transaction.type,
                        date: transaction.date,
                        amount: transaction.amount,
                        note: transaction.note || '',
                        status: transaction.status,
                        isCredit: isCredit,
                        category: isCredit ? 'ventes' : undefined,
                        customerName: customer ? getPersonName(customer) : '',
                      });
                      setShowDetailModal(true);
                    }}
                  >
                    <View style={[styles.txIcon, { backgroundColor: iconBg }]}>
                      {isPositive ? (
                        <ArrowDown size={18} color={iconTint} />
                      ) : (
                        <ArrowUp size={18} color={iconTint} />
                      )}
                    </View>
                    <View style={styles.txBody}>
                      <View style={styles.txTitleRow}>
                        <Text style={styles.txTitle} numberOfLines={1}>
                          {getTitle()}
                        </Text>
                        {badge ? <StatusBadge text={badge.text} variant={badge.variant} /> : null}
                      </View>
                      <Text style={styles.txSubtitle} numberOfLines={1}>
                        {dateStr}
                      </Text>
                    </View>
                    <Text style={[styles.txAmount, { color: amountColor }]}>
                      {isPositive ? '+' : '-'}
                      {formatMoney(Math.abs(transaction.amount))}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Create Receivable Modal */}
      <Modal
        visible={showCreateReceivableModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseCreateReceivableModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeaderTitle}>Créer une créance</Text>
                <Text style={styles.modalHeaderSubtitle}>
                  {customer ? getPersonName(customer) : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCloseCreateReceivableModal}
                style={styles.modalCloseButton}
              >
                <X size={18} color={Colors.action} />
              </TouchableOpacity>
            </View>

            {/* Modal Form */}
            <View style={styles.modalBody}>
              {/* Amount Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Montant (FCFA) *</Text>
                <View style={styles.amountInputContainer}>
                  <TextInput
                    style={styles.amountInput}
                    value={receivableAmount}
                    onChangeText={setReceivableAmount}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                  <Text style={styles.amountCurrency}>FCFA</Text>
                </View>
              </View>

              {/* Description Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={styles.textInput}
                  value={receivableDescription}
                  onChangeText={setReceivableDescription}
                  placeholder="Ex: Achat à crédit"
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Note Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Note (optionnel)</Text>
                <TextInput
                  style={styles.textInput}
                  value={receivableNote}
                  onChangeText={setReceivableNote}
                  placeholder="Note interne..."
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={handleCloseCreateReceivableModal}
                  disabled={isSubmitting}
                >
                  <Text style={styles.modalCancelButtonText}>Annuler</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSubmitButton}
                  onPress={handleSubmitCreateReceivable}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSubmitButtonText}>Valider</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Refund Modal */}
      <Modal
        visible={showRefundModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseRefundModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeaderTitle}>Remboursement client</Text>
                <Text style={styles.modalHeaderSubtitle}>
                  {customer ? getPersonName(customer) : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={handleCloseRefundModal} style={styles.modalCloseButton}>
                <X size={18} color={Colors.action} />
              </TouchableOpacity>
            </View>

            {/* Modal Form */}
            <View style={styles.modalBody}>
              {/* Amount Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Montant (FCFA)</Text>
                <View style={styles.amountInputContainer}>
                  <TextInput
                    style={styles.amountInput}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                  <Text style={styles.amountCurrency}>FCFA</Text>
                </View>
              </View>

              {/* Note Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Note (optionnelle)</Text>
                <TextInput
                  style={styles.noteInput}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Ajouter une note ou description..."
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelButton} onPress={handleCloseRefundModal}>
                  <Text style={styles.modalCancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSubmitButton}
                  onPress={handleSubmitRefund}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSubmitButtonText}>Valider</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Customer Refund Modal (refund money TO customer) */}
      <Modal
        visible={showCustomerRefundModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseCustomerRefundModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeaderTitle}>Rembourser le client</Text>
                <Text style={styles.modalHeaderSubtitle}>
                  {customer ? getPersonName(customer) : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCloseCustomerRefundModal}
                style={styles.modalCloseButton}
              >
                <X size={18} color={Colors.action} />
              </TouchableOpacity>
            </View>

            {/* Modal Form */}
            <View style={styles.modalBody}>
              {/* Info message */}
              <View
                style={[
                  styles.formGroup,
                  { backgroundColor: Colors.danger.background, padding: 12, borderRadius: 8 },
                ]}
              >
                <Text style={{ color: Colors.danger.text, fontSize: 13 }}>
                  Montant maximum à rembourser:{' '}
                  {formatMoney(Math.abs(customer?.stats?.total_balance || 0))}
                </Text>
              </View>

              {/* Amount Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Montant (FCFA)</Text>
                <View style={styles.amountInputContainer}>
                  <TextInput
                    style={styles.amountInput}
                    value={customerRefundAmount}
                    onChangeText={setCustomerRefundAmount}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                  <Text style={styles.amountCurrency}>FCFA</Text>
                </View>
              </View>

              {/* Note Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Note (optionnelle)</Text>
                <TextInput
                  style={styles.noteInput}
                  value={customerRefundNote}
                  onChangeText={setCustomerRefundNote}
                  placeholder="Ajouter une note ou description..."
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={handleCloseCustomerRefundModal}
                >
                  <Text style={styles.modalCancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitButton, { backgroundColor: Colors.danger.main }]}
                  onPress={handleSubmitCustomerRefund}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSubmitButtonText}>Rembourser</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseEditModal}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalHeaderTitle}>Modifier le client</Text>
                  <Text style={styles.modalHeaderSubtitle}>
                    Mettez à jour les coordonnées et la limite de crédit
                  </Text>
                </View>
                <TouchableOpacity onPress={handleCloseEditModal} style={styles.modalCloseButton}>
                  <X size={18} color={Colors.action} />
                </TouchableOpacity>
              </View>

              {/* Modal Form */}
              <View style={styles.modalBody}>
                {/* Full name */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Nom complet</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.name}
                    onChangeText={text => setEditForm({ ...editForm, name: text })}
                    placeholder="Nom et prénom du client"
                  />
                </View>

                {/* Phone */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Téléphone</Text>
                  <View style={styles.inputWithIcon}>
                    <Smartphone size={18} color={Colors.textColors.tertiary} />
                    <TextInput
                      style={styles.inputWithIconField}
                      value={editForm.phone}
                      onChangeText={text =>
                        setEditForm({ ...editForm, phone: formatPhoneOnInput(text) })
                      }
                      placeholder="+237 6XX XXX XXX"
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                {/* Address */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Adresse</Text>
                  <View style={styles.inputWithIcon}>
                    <MapPin size={18} color={Colors.textColors.tertiary} />
                    <TextInput
                      style={styles.inputWithIconField}
                      value={editForm.address}
                      onChangeText={text => setEditForm({ ...editForm, address: text })}
                      placeholder="Quartier, ville…"
                    />
                  </View>
                </View>

                {/* Credit Limit */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Limite de crédit (FCFA)</Text>
                  <View style={styles.inputWithIcon}>
                    <TextInput
                      style={styles.inputWithIconField}
                      value={editForm.credit_limit}
                      onChangeText={text => setEditForm({ ...editForm, credit_limit: text })}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                    <Text style={styles.inputSuffix}>F</Text>
                  </View>
                  <Text style={styles.inputHelper}>
                    {formatMoney(Math.round(parseFloat(editForm.credit_limit)) || 0)} · laissez à 0
                    pour un crédit illimité
                  </Text>
                </View>

                {/* Actions */}
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalCancelButton} onPress={handleCloseEditModal}>
                    <Text style={styles.modalCancelButtonText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalSubmitButton}
                    onPress={handleSubmitEdit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.modalSubmitButtonText}>Enregistrer</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Relance bottom sheet ("Relancer maintenant") */}
      <Modal
        visible={showRemindSheet}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRemindSheet(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalBody}>
              {/* Titre + ton */}
              <View style={styles.remindTitleRow}>
                <Text style={styles.modalHeaderTitle}>Relance {remindPalier}</Text>
                <View style={styles.tonePill}>
                  <Text style={styles.tonePillText}>Courtois</Text>
                </View>
              </View>

              {/* Ligne client */}
              <Text style={styles.remindClientLine}>
                {getPersonName(customer)} ·{' '}
                <Text style={styles.remindAmount}>{formatMoney(Math.abs(totalBalance))}</Text>
              </Text>

              {/* Échéance */}
              {dueDate ? (
                <Text style={styles.remindDueLine}>
                  Échéance le {dueDateLabel}
                  {dueInfo ? ` · ${dueInfo.text}` : ''}
                </Text>
              ) : null}

              {/* Canaux */}
              <Text style={styles.remindSectionLabel}>Envoyer sur</Text>
              <View style={styles.chipRow}>
                {(
                  [
                    ['SMS', 'SMS', Colors.info.main],
                    ['WHATSAPP', 'WhatsApp', Colors.success.main],
                  ] as Array<['SMS' | 'WHATSAPP', string, string]>
                ).map(([key, label, dot]) => {
                  const active = remindChannels[key];
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.channelChip, active && styles.channelChipActive]}
                      onPress={() => setRemindChannels(prev => ({ ...prev, [key]: !prev[key] }))}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.chipDot, { backgroundColor: dot }]} />
                      <Text
                        style={[styles.channelChipText, active && styles.channelChipTextActive]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Aperçu du message */}
              <Text style={styles.remindSectionLabel}>Aperçu du message</Text>
              <View style={styles.previewBox}>
                <Text style={styles.previewText}>{reminderMessage}</Text>
              </View>

              {/* Footer */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowRemindSheet(false)}
                  disabled={isReminding}
                >
                  <Text style={styles.modalCancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitButton, styles.remindSubmitButton]}
                  onPress={handleSendReminder}
                  disabled={isReminding}
                >
                  {isReminding ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Send size={18} color={Colors.onMarine} />
                      <Text style={styles.modalSubmitButtonText}>Envoyer la relance</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        transaction={selectedTransaction}
      />
    </View>
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: Spacing.lg,
    paddingBottom: 96,
    gap: Spacing.xl,
  },

  // CARTE CLIENT (blanche)
  clientCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: Spacing.xl,
    gap: Spacing.lg,
    ...Shadows.sm,
  },
  clientHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.warning.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEditButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.info.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.warning.main,
    letterSpacing: 0.5,
  },
  clientHeaderText: {
    flex: 1,
    gap: 2,
  },
  clientName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  clientPhone: {
    fontSize: 13.5,
    color: Colors.action,
    fontWeight: '500',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  balanceBlock: {
    flexShrink: 1,
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textColors.tertiary,
  },
  balanceAmount: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.danger.main,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  balanceAmountRefund: {
    color: Colors.success.main,
  },
  duePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: 999,
  },
  duePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  clientActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  callButtonText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.action,
  },
  remindButton: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.action,
  },
  remindButtonText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // CANAUX DE NOTIFICATION
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  channelRowBordered: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  channelBadge: {
    minWidth: 36,
    height: 28,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: Colors.info.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.action,
  },
  channelInfo: { flex: 1, gap: 1 },
  channelLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  channelDisabled: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.warning.main,
  },

  // NOTIFICATIONS (historique & transparence)
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  notifRowBordered: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  notifIconCol: {
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: Colors.info.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifConnector: {
    width: 2,
    flex: 1,
    minHeight: 8,
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: Colors.border,
  },
  notifBody: { flex: 1, gap: 4 },
  notifTitle: {
    fontSize: 14.5,
    fontWeight: '600',
    color: Colors.text,
  },
  notifDate: {
    fontSize: 12.5,
    color: Colors.textColors.tertiary,
  },
  notifBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },

  // SECTIONS
  section: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textColors.tertiary,
    letterSpacing: 0.6,
  },

  // INFOS CLIENT
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: Colors.info.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 14.5,
    color: Colors.text,
    lineHeight: 20,
  },

  // ACTION BUTTONS
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 52,
    ...Shadows.sm,
  },
  actionButtonFull: {
    minWidth: '100%',
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 14.5,
    fontWeight: '700',
  },

  // LISTE TRANSACTIONS
  listCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  emptyState: {
    padding: Spacing['2xl'],
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textColors.tertiary,
    fontSize: 14,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  txRowBordered: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txBody: {
    flex: 1,
    gap: 2,
  },
  txTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  txTitle: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  txSubtitle: {
    fontSize: 12.5,
    color: Colors.textColors.tertiary,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // MODALES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.sheet,
    borderTopRightRadius: BorderRadius.sheet,
    maxHeight: '85%',
    paddingTop: Spacing.sm,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.borderStrong,
    marginVertical: Spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  modalHeaderSubtitle: {
    fontSize: 14,
    color: Colors.textColors.tertiary,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: Colors.info.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: Spacing.xl,
  },
  formGroup: {
    marginBottom: Spacing.xl,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textColors.secondary,
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.surfaceAlt,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
  },
  inputWithIconField: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: 14,
    color: Colors.text,
  },
  inputSuffix: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textColors.tertiary,
  },
  inputHelper: {
    marginTop: Spacing.xs,
    fontSize: 12,
    color: Colors.textColors.tertiary,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surfaceAlt,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    paddingVertical: Spacing.md,
    fontVariant: ['tabular-nums'],
  },
  amountCurrency: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.action,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    fontSize: 14,
    color: Colors.text,
    height: 80,
    textAlignVertical: 'top',
    backgroundColor: Colors.surfaceAlt,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    fontSize: 14,
    color: Colors.text,
    height: 60,
    textAlignVertical: 'top',
    backgroundColor: Colors.surfaceAlt,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: Colors.muted.main,
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textColors.secondary,
  },
  modalSubmitButton: {
    flex: 1,
    backgroundColor: Colors.action,
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  modalSubmitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.onMarine,
  },

  // RELANCE BOTTOM SHEET
  remindTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  tonePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Colors.info.background,
  },
  tonePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.action,
  },
  remindClientLine: {
    marginTop: Spacing.sm,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  remindAmount: {
    color: Colors.danger.main,
    fontWeight: '800',
  },
  remindDueLine: {
    marginTop: 2,
    fontSize: 13,
    color: Colors.textColors.tertiary,
  },
  remindSectionLabel: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textColors.secondary,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  channelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
  },
  channelChipActive: {
    borderColor: Colors.action,
    backgroundColor: Colors.info.background,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  channelChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textColors.secondary,
  },
  channelChipTextActive: {
    color: Colors.action,
  },
  previewBox: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.md,
  },
  previewText: {
    fontSize: 13.5,
    lineHeight: 20,
    color: Colors.text,
  },
  remindSubmitButton: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
});
