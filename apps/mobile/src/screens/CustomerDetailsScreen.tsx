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
} from 'react-native';
import {
  DollarSign,
  Edit,
  Trash,
  Plus,
  Smartphone,
  Mail,
  MapPin,
  ArrowUp,
  ArrowDown,
  X,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
} from '../components/icons/SimpleIcons';
import { ScreenHeader, StatusBadge, TransactionDetailModal, IconButton } from '../components/ui';
import { NotificationChannelsToggles } from './CustomersScreen';
import { Colors, Spacing, Shadows, BorderRadius } from '../constants/theme-v2';
import { formatDate } from '../utils/date';
import { formatMoney } from '../utils/money';
import { formatPhoneOnInput, formatCameroonPhone } from '../utils/phone';
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
  deleteCustomerOffline,
  createReceivableOffline,
  payReceivableOffline,
} from '../db/offlineWrite';
import { checkCreditLimit } from '../utils/creditCheck';
import { customersApi } from '../lib/api';

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
      created_at: typeof e.created_at === 'string' ? e.created_at : null,
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

const NOTIF_CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
};

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

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function endOfMonth(base: Date): string {
  const d = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return toISODate(d);
}

function formatDueDateLabel(iso: string): string {
  const [y, m, day] = iso.split('-').map(Number);
  if (!y || !m || !day) return iso;
  const d = new Date(y, m - 1, day);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Sépare le montant ("12 500 F") en valeur + suffixe "F" pour styliser le F en sky
function splitMoney(amount: number): { value: string; unit: string } {
  const formatted = formatMoney(Math.abs(amount));
  const idx = formatted.lastIndexOf(' F');
  if (idx === -1) {
    return { value: formatted, unit: '' };
  }
  return { value: formatted.slice(0, idx), unit: 'F' };
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
  const { user, shopId, userId } = useCurrentUser();
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
      name: customer.name,
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

    setIsSubmitting(true);
    try {
      await updateCustomerOffline(id, {
        name: editForm.name.trim(),
        firstName: editForm.first_name.trim() || undefined,
        phone: editForm.phone.trim() || undefined,
        email: editForm.email.trim() || undefined,
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

  const handleDelete = () => {
    if (!customer) return;
    Alert.alert(
      'Confirmer la suppression',
      `Voulez-vous vraiment supprimer le client ${getPersonName(customer)} ?`,
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCustomerOffline(id);
              Alert.alert('Succes', 'Client supprime avec succes');
              navigation.goBack();
            } catch (error: unknown) {
              console.error('Erreur lors de la suppression:', error);
              Alert.alert('Erreur', getErrorMessage(error) ?? 'Erreur lors de la suppression');
            }
          },
        },
      ]
    );
  };

  const getPersonName = (person: { name: string; first_name?: string | null }): string => {
    const firstName = person.first_name ? String(person.first_name).trim() : '';
    const lastName = person.name ? String(person.name).trim() : '';
    return firstName ? `${firstName} ${lastName}` : lastName;
  };

  const canEditOrDelete = () => {
    return (
      userRole === 'OWNER' ||
      userRole === 'BOSS' ||
      userRole === 'MANAGER' ||
      userRole === 'SUPERADMIN'
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Client"
          subtitle="Créances & paiements"
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
  const heroAmount = splitMoney(totalBalance);
  const heroLabel = shopOwes ? 'À rembourser au client' : 'Créances en cours';

  const creditLimit =
    customer.credit_limit && customer.credit_limit > 0 ? customer.credit_limit : 0;
  const usedCredit = Math.max(0, totalBalance);
  const creditPct =
    creditLimit > 0 ? Math.min(100, Math.round((usedCredit / creditLimit) * 100)) : 0;
  const creditBarColor = creditPct >= 80 ? Colors.danger.main : Colors.success.main;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={getPersonName(customer)}
        subtitle="Créances & paiements"
        showBack={true}
        onBack={() => navigation.goBack()}
        rightAction={
          <View style={styles.headerActions}>
            {canEditOrDelete() && (
              <>
                {can('customers', 'edit') && (
                  <IconButton onPress={handleOpenEditModal} style={styles.headerIconBtn}>
                    <Edit size={20} color={Colors.action} />
                  </IconButton>
                )}
                {can('customers', 'delete') && (
                  <IconButton onPress={handleDelete}>
                    <Trash size={20} color={Colors.danger.main} />
                  </IconButton>
                )}
              </>
            )}
          </View>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO MARINE — avatar + solde / créances */}
        <View style={styles.hero}>
          <View style={styles.heroHeaderRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getInitials(customer.first_name, customer.name)}
              </Text>
            </View>
            <View style={styles.heroHeaderText}>
              <Text style={styles.heroName} numberOfLines={1}>
                {getPersonName(customer)}
              </Text>
              <View style={styles.heroStatusRow}>
                <StatusBadge
                  text={customer.is_active ? 'Actif' : 'Inactif'}
                  variant={customer.is_active ? 'success' : 'danger'}
                />
              </View>
            </View>
          </View>

          <Text style={styles.heroLabel}>{heroLabel}</Text>
          <Text style={[styles.heroAmount, shopOwes && styles.heroAmountRefund]}>
            {heroAmount.value}
            {heroAmount.unit ? <Text style={styles.heroAmountUnit}> {heroAmount.unit}</Text> : null}
          </Text>

          {creditLimit > 0 && (
            <View style={styles.creditBlock}>
              <View style={styles.creditBarTrack}>
                <View
                  style={[
                    styles.creditBarFill,
                    { width: `${creditPct}%`, backgroundColor: creditBarColor },
                  ]}
                />
              </View>
              <View style={styles.creditMetaRow}>
                <Text style={styles.creditMetaLabel}>Limite de crédit</Text>
                <Text style={styles.creditMetaValue}>{formatMoney(creditLimit)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Infos client */}
        {!!(customer.phone || customer.email || customer.address) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coordonnées</Text>
            <View style={styles.infoCard}>
              {!!customer.phone && (
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <Smartphone size={18} color={Colors.action} />
                  </View>
                  <Text style={styles.infoText}>{formatCameroonPhone(String(customer.phone))}</Text>
                </View>
              )}
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

        {/* Action Buttons */}
        {(userRole === 'OWNER' ||
          userRole === 'BOSS' ||
          userRole === 'MANAGER' ||
          userRole === 'EMPLOYEE') &&
          (canRefundReceivable || canCreateReceivable) && (
            <View style={styles.actionButtons}>
              {canRefundReceivable && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: Colors.success.main }]}
                  onPress={handleOpenRefundModal}
                  activeOpacity={0.85}
                >
                  <DollarSign size={20} color={Colors.success.foreground} />
                  <Text style={styles.actionButtonText}>Recevoir paiement</Text>
                </TouchableOpacity>
              )}

              {canCreateReceivable && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: Colors.warning.main }]}
                  onPress={handleOpenCreateReceivableModal}
                  activeOpacity={0.85}
                >
                  <Plus size={20} color={Colors.warning.foreground} />
                  <Text style={styles.actionButtonText}>Créer créance</Text>
                </TouchableOpacity>
              )}

              {/* Show Refund button only when balance is negative */}
              {shopOwes && canRefundReceivable && (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.actionButtonFull,
                    { backgroundColor: Colors.danger.main },
                  ]}
                  onPress={handleOpenCustomerRefundModal}
                  activeOpacity={0.85}
                >
                  <DollarSign size={20} color={Colors.danger.foreground} />
                  <Text style={styles.actionButtonText}>Rembourser le client</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

        {/* Transactions History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historique des opérations</Text>
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
                    {customer ? getPersonName(customer) : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleCloseEditModal} style={styles.modalCloseButton}>
                  <X size={18} color={Colors.action} />
                </TouchableOpacity>
              </View>

              {/* Modal Form */}
              <View style={styles.modalBody}>
                {/* Name */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Nom *</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.name}
                    onChangeText={text => setEditForm({ ...editForm, name: text })}
                    placeholder="Nom du client"
                  />
                </View>

                {/* First Name */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Prénom</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.first_name}
                    onChangeText={text => setEditForm({ ...editForm, first_name: text })}
                    placeholder="Prénom du client"
                  />
                </View>

                {/* Phone */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Téléphone</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.phone}
                    onChangeText={text =>
                      setEditForm({ ...editForm, phone: formatPhoneOnInput(text) })
                    }
                    placeholder="+237 6XX XXX XXX"
                    keyboardType="phone-pad"
                  />
                </View>

                {/* Email */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Email</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.email}
                    onChangeText={text => setEditForm({ ...editForm, email: text })}
                    placeholder="email@exemple.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                {/* Address */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Adresse</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.address}
                    onChangeText={text => setEditForm({ ...editForm, address: text })}
                    placeholder="Adresse complète"
                  />
                </View>

                {/* Credit Limit */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Limite de crédit (FCFA)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.credit_limit}
                    onChangeText={text => setEditForm({ ...editForm, credit_limit: text })}
                    placeholder="0"
                    keyboardType="numeric"
                  />
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerIconBtn: {
    marginRight: Spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: Spacing.lg,
    paddingBottom: 96,
    gap: Spacing.xl,
  },

  // HERO MARINE
  hero: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.primary[900],
    borderRadius: 20,
    padding: Spacing.xl,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.onMarine,
    letterSpacing: 0.5,
  },
  heroHeaderText: {
    flex: 1,
    gap: Spacing.xs,
  },
  heroName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.onMarine,
  },
  heroStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.action,
  },
  heroAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.onMarine,
    marginTop: Spacing.xs,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  heroAmountRefund: {
    color: Colors.accent,
  },
  heroAmountUnit: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.action,
  },
  creditBlock: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  creditBarTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  creditBarFill: {
    height: 6,
    borderRadius: 999,
  },
  creditMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creditMetaLabel: {
    fontSize: 12.5,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  creditMetaValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.onMarine,
    fontVariant: ['tabular-nums'],
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
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 48,
    ...Shadows.sm,
  },
  actionButtonFull: {
    minWidth: '100%',
  },
  actionButtonText: {
    color: Colors.onMarine,
    fontSize: 15,
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
});
