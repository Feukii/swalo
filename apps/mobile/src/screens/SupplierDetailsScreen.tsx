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
  DollarSign,
  Receipt,
  Edit,
  Trash,
  Plus,
  Smartphone,
  FileText,
  Building,
  CreditCard,
  Bell,
  Send,
} from '../components/icons/SimpleIcons';
import { ScreenHeader, StatusBadge, TransactionDetailModal, IconButton } from '../components/ui';
import { Colors, Spacing, Shadows, BorderRadius } from '../constants/theme-v2';
import { formatDate } from '../utils/date';
import { formatMoney } from '../utils/money';
import { formatPhoneOnInput, formatCameroonPhone, isValidCameroonPhone } from '../utils/phone';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { usePermissions } from '../hooks/usePermissions';
import {
  supplierRepo,
  supplierDebtRepo,
  supplierDebtPaymentRepo,
  LocalSupplierDebt,
  LocalSupplierDebtPayment,
  LocalCashEntry,
} from '../db/repositories';
import { getDatabase } from '../db/schema';
import {
  updateSupplierOffline,
  deleteSupplierOffline,
  createSupplierDebtOffline,
  paySupplierDebtOffline,
} from '../db/offlineWrite';
import { suppliersApi, ReminderChannel } from '../lib/api';

interface SupplierDetailsNavigation {
  goBack: () => void;
  addListener: (type: 'focus', callback: () => void) => () => void;
}

interface SupplierDetailsScreenProps {
  navigation: SupplierDetailsNavigation;
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
  supplierName?: string;
}

function getErrorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

// ─── Notifications (transparence dettes fournisseurs) ────────────────
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
      created_at:
        typeof e.sent_at === 'string'
          ? e.sent_at
          : typeof e.created_at === 'string'
            ? e.created_at
            : null,
      error: typeof e.error === 'string' ? e.error : null,
    }));
  return { total, recent };
}

// Étiquette courte d'un canal (badges "SMS Livré", "WA Livré"...)
const NOTIF_CHANNEL_SHORT: Record<string, string> = {
  EMAIL: 'E-mail',
  SMS: 'SMS',
  WHATSAPP: 'WA',
};

const NOTIF_TYPE_LABELS: Record<string, string> = {
  PAYMENT_REMINDER: 'Relance de règlement',
  DEBT_PAYMENT: 'Paiement effectué',
  DEBT_CREATED: 'Dette créée',
};

function getNotifTypeLabel(type: string): string {
  return NOTIF_TYPE_LABELS[type] ?? 'Notification';
}

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

// Évènement d'historique : un envoi de relance peut produire plusieurs lignes
// (une par canal). On regroupe par type + jour pour afficher une seule ligne.
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
        isReminder: n.type === 'PAYMENT_REMINDER',
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

// Initiales (max 2 lettres) pour l'avatar de la carte hero
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

// Sépare le montant (ex: "3 500 F") en valeur + suffixe "F" pour styliser le F en sky
function splitMoney(amount: number): { value: string; unit: string } {
  const formatted = formatMoney(amount);
  const idx = formatted.lastIndexOf(' F');
  if (idx === -1) {
    return { value: formatted, unit: '' };
  }
  return { value: formatted.slice(0, idx), unit: 'F' };
}

interface DebtWithPayments {
  id: string;
  amount: number;
  balance: number;
  paid_amount: number;
  status: string;
  created_at: string;
  description: string | null;
  notes: string | null;
  payments: LocalSupplierDebtPayment[];
}

interface SupplierDetails {
  id: string;
  name: string;
  first_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  borrowing_limit: number;
  is_active: number | boolean;
  sms_notifications_enabled: boolean;
  whatsapp_notifications_enabled: boolean;
  email_notifications_enabled: boolean;
  debts: DebtWithPayments[];
  cash_entries: LocalCashEntry[];
  stats: {
    total_debts: number;
    total_balance: number;
    total_paid: number;
    cash_payments_count: number;
    total_cash_payments: number;
  };
}

export default function SupplierDetailsScreen({ navigation, route }: SupplierDetailsScreenProps) {
  const { id } = route.params;
  const { user, shop, shopId, userId } = useCurrentUser();
  const userRole = user?.role || 'EMPLOYEE';
  const { can } = usePermissions();

  const [supplier, setSupplier] = useState<SupplierDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Relance manuelle (depuis la fiche fournisseur)
  const [isReminding, setIsReminding] = useState(false);
  const [showRemindSheet, setShowRemindSheet] = useState(false);
  const [remindChannels, setRemindChannels] = useState<{ SMS: boolean; WHATSAPP: boolean }>({
    SMS: true,
    WHATSAPP: false,
  });
  // Préférences de canaux, initialisées depuis le fournisseur chargé puis
  // persistées (colonnes sms/whatsapp/email_notifications_enabled).
  const [notifPrefs, setNotifPrefs] = useState<{ sms: boolean; whatsapp: boolean; email: boolean }>(
    { sms: true, whatsapp: true, email: true }
  );
  const [togglingChannel, setTogglingChannel] = useState<ReminderChannel | null>(null);
  // Résumé des notifications (best-effort en ligne ; absent si l'API ne l'expose
  // pas encore pour les fournisseurs).
  const [notificationsSummary, setNotificationsSummary] = useState<NotificationsSummary | null>(
    null
  );

  // Modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    borrowing_limit: '',
    notes: '',
  });

  // Create debt modal state
  const [showCreateDebtModal, setShowCreateDebtModal] = useState(false);
  const [debtAmount, setDebtAmount] = useState('');
  const [debtDescription, setDebtDescription] = useState('');
  const [debtNote, setDebtNote] = useState('');

  // Supplier refund claim modal state (for claiming refund FROM supplier)
  const [showSupplierRefundModal, setShowSupplierRefundModal] = useState(false);
  const [supplierRefundAmount, setSupplierRefundAmount] = useState('');
  const [supplierRefundNote, setSupplierRefundNote] = useState('');

  const loadSupplier = useCallback(async () => {
    if (!shopId) return;
    setIsLoading(true);
    try {
      const sup = await supplierRepo.getById(id);
      if (!sup) {
        Alert.alert('Erreur', 'Fournisseur introuvable');
        navigation.goBack();
        return;
      }

      // Load debts with payments
      const debts = await supplierDebtRepo.getBySupplier(shopId, id);
      const debtsWithPayments: DebtWithPayments[] = await Promise.all(
        debts.map(async (d: LocalSupplierDebt) => {
          const payments = await supplierDebtPaymentRepo.getByDebt(d.id);
          return {
            id: d.id,
            amount: d.amount,
            balance: d.balance,
            paid_amount: d.paid_amount,
            status: d.status,
            created_at: d.created_at,
            description: d.description,
            notes: d.notes,
            payments,
          };
        })
      );

      // Load cash entries related to this supplier
      const db = await getDatabase();
      const cashEntries = await db.getAllAsync<LocalCashEntry>(
        `SELECT * FROM cash_entries WHERE supplier_id = ? AND deleted = 0 ORDER BY created_at DESC`,
        [id]
      );

      // Compute stats
      const totalDebts = debtsWithPayments.reduce((s, d) => s + Math.max(0, d.amount), 0);
      const totalBalance = debtsWithPayments.reduce((s, d) => s + d.balance, 0);
      const totalPaid = debtsWithPayments.reduce((s, d) => s + d.paid_amount, 0);
      const cashPaymentsCount = cashEntries.length;
      const totalCashPayments = cashEntries.reduce((s, e) => s + e.amount, 0);

      const supplierDetails: SupplierDetails = {
        id: sup.id,
        name: sup.name,
        first_name: sup.first_name,
        phone: sup.phone,
        email: sup.email,
        address: sup.address,
        borrowing_limit: sup.borrowing_limit ?? 0,
        is_active: sup.is_active,
        sms_notifications_enabled: (sup.sms_notifications_enabled ?? 1) === 1,
        whatsapp_notifications_enabled: (sup.whatsapp_notifications_enabled ?? 1) === 1,
        email_notifications_enabled: (sup.email_notifications_enabled ?? 1) === 1,
        debts: debtsWithPayments,
        cash_entries: cashEntries,
        stats: {
          total_debts: totalDebts,
          total_balance: totalBalance,
          total_paid: totalPaid,
          cash_payments_count: cashPaymentsCount,
          total_cash_payments: totalCashPayments,
        },
      };

      setSupplier(supplierDetails);

      // Initialiser les préférences de canaux depuis les colonnes persistées.
      setNotifPrefs({
        sms: supplierDetails.sms_notifications_enabled,
        whatsapp: supplierDetails.whatsapp_notifications_enabled,
        email: supplierDetails.email_notifications_enabled,
      });

      // Résumé des notifications de dettes — best-effort en ligne, n'empêche
      // jamais l'affichage offline-first. Masqué proprement si indisponible.
      try {
        const remote = await suppliersApi.getOne(id);
        setNotificationsSummary(
          parseNotificationsSummary((remote as Record<string, unknown>).notifications_summary)
        );
      } catch {
        // Hors ligne ou serveur indisponible / non exposé : section masquée.
      }

      // Show alert if supplier has negative balance (supplier owes us money)
      if (totalBalance < 0) {
        Alert.alert(
          'Remboursement du par le fournisseur',
          `Le fournisseur vous doit ${formatMoney(Math.abs(totalBalance))}.\n\nUtilisez le bouton "Reclamer Remboursement" pour enregistrer le remboursement recu.`,
          [{ text: 'Compris', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Erreur lors du chargement du fournisseur:', error);
      Alert.alert('Erreur', 'Impossible de charger les details du fournisseur');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  }, [id, shopId, navigation]);

  useEffect(() => {
    loadSupplier();
  }, [loadSupplier]);

  // Auto-refresh when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadSupplier();
    });
    return unsubscribe;
  }, [navigation, loadSupplier]);

  const handleOpenPaymentModal = () => {
    setShowPaymentModal(true);
    setAmount('');
    setNote('');
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setAmount('');
    setNote('');
  };

  const _handleOpenDebtModal = () => {
    setShowDebtModal(true);
    setAmount('');
    setNote('');
  };

  const handleCloseDebtModal = () => {
    setShowDebtModal(false);
    setAmount('');
    setNote('');
  };

  const handleSubmitDebt = async () => {
    if (!amount) {
      Alert.alert('Erreur', 'Veuillez entrer un montant');
      return;
    }
    if (!shopId || !supplier) return;

    const amountValue = Math.round(parseFloat(amount));

    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }

    setIsSubmitting(true);
    try {
      await createSupplierDebtOffline({
        shopId,
        supplierId: id,
        amount: amountValue,
        description: note || `Dette contractee aupres de ${getPersonName(supplier)}`,
      });

      Alert.alert('Succes', 'Dette enregistree');
      handleCloseDebtModal();
      loadSupplier();
    } catch (error: unknown) {
      console.error("Erreur lors de l'enregistrement:", error);
      Alert.alert('Erreur', getErrorMessage(error) ?? "Erreur lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitPayment = async () => {
    if (!amount) {
      Alert.alert('Erreur', 'Veuillez entrer un montant');
      return;
    }
    if (!shopId || !userId || !supplier) return;

    const amountValue = Math.round(parseFloat(amount));

    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }

    // Calculate total debt
    const totalDebt = supplier.stats?.total_balance ?? 0;
    const overpayment = amountValue - totalDebt;

    // Find oldest pending debt
    const pendingDebts = supplier.debts
      .filter(d => d.status === 'PENDING' || d.status === 'PARTIAL')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // If no pending debts but payment > 0, we need to create a negative debt
    if (pendingDebts.length === 0) {
      if (totalDebt >= 0) {
        Alert.alert(
          'Attention : Creer un solde negatif',
          `Le fournisseur n'a pas de dette. En payant ${formatMoney(amountValue)}, il devra vous rembourser cette somme.\n\nVoulez-vous continuer ?`,
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Confirmer',
              onPress: () => createNegativeDebt(amountValue),
            },
          ]
        );
      } else {
        Alert.alert(
          'Attention : Augmenter le solde negatif',
          `Le fournisseur a deja un solde de ${formatMoney(totalDebt)} (il vous doit ${formatMoney(Math.abs(totalDebt))}).\n\nEn payant ${formatMoney(amountValue)} de plus, il vous devra ${formatMoney(Math.abs(totalDebt) + amountValue)}.\n\nVoulez-vous continuer ?`,
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Confirmer',
              onPress: () => createNegativeDebt(amountValue),
            },
          ]
        );
      }
      return;
    }

    // Check for overpayment
    if (overpayment > 0) {
      Alert.alert(
        'Attention : Depassement',
        `Le montant de ${formatMoney(amountValue)} depasse la dette de ${formatMoney(totalDebt)}.\n\nCe fournisseur doit vous rendre ${formatMoney(overpayment)}.`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Confirmer quand meme',
            onPress: () => processSupplierPayment(amountValue, pendingDebts[0].id),
          },
        ]
      );
      return;
    }

    await processSupplierPayment(amountValue, pendingDebts[0].id);
  };

  const createNegativeDebt = async (amountValue: number) => {
    if (!shopId || !supplier) return;
    setIsSubmitting(true);
    try {
      await createSupplierDebtOffline({
        shopId,
        supplierId: supplier.id,
        amount: -amountValue,
        description: note || `Remboursement a recevoir de ${getPersonName(supplier)}`,
      });

      const totalDebt = supplier.stats?.total_balance ?? 0;
      const newBalance = totalDebt - amountValue;

      Alert.alert(
        'Paiement enregistre',
        `Paiement de ${formatMoney(amountValue)} enregistre.\n\nCe fournisseur doit vous rendre ${formatMoney(Math.abs(newBalance))}.`
      );

      handleClosePaymentModal();
      loadSupplier();
    } catch (error: unknown) {
      console.error("Erreur lors de l'enregistrement:", error);
      Alert.alert('Erreur', getErrorMessage(error) ?? "Erreur lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const processSupplierPayment = async (amountValue: number, debtId: string) => {
    if (!userId || !supplier) return;
    setIsSubmitting(true);
    try {
      await paySupplierDebtOffline({
        debtId,
        amount: amountValue,
        cashierId: userId,
        notes: note || `Paiement a ${getPersonName(supplier)}`,
      });

      // Check if there's overpayment
      const totalDebt = supplier.stats?.total_balance ?? 0;
      const overpayment = amountValue - totalDebt;

      if (overpayment > 0) {
        Alert.alert(
          'Paiement enregistre',
          `Paiement de ${formatMoney(amountValue)} enregistre.\n\nCe fournisseur doit vous rendre ${formatMoney(overpayment)}.`
        );
      } else {
        Alert.alert('Succes', 'Paiement enregistre');
      }

      handleClosePaymentModal();
      loadSupplier();
    } catch (error: unknown) {
      console.error("Erreur lors de l'enregistrement:", error);
      Alert.alert('Erreur', getErrorMessage(error) ?? "Erreur lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditModal = () => {
    if (!supplier) return;
    setEditForm({
      name: supplier.name,
      first_name: supplier.first_name || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      borrowing_limit: supplier.borrowing_limit ? supplier.borrowing_limit.toString() : '',
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

    setIsSubmitting(true);
    try {
      await updateSupplierOffline(id, {
        name: editForm.name.trim(),
        firstName: editForm.first_name.trim() || undefined,
        phone: editForm.phone.trim() || undefined,
        email: editForm.email.trim() || undefined,
        address: editForm.address.trim() || undefined,
        borrowingLimit: editForm.borrowing_limit.trim()
          ? Math.round(parseFloat(editForm.borrowing_limit))
          : undefined,
      });
      Alert.alert('Succes', 'Fournisseur modifie avec succes');
      handleCloseEditModal();
      loadSupplier();
    } catch (error: unknown) {
      console.error('Erreur lors de la modification:', error);
      Alert.alert('Erreur', getErrorMessage(error) ?? 'Erreur lors de la modification');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!supplier) return;
    Alert.alert(
      'Confirmer la suppression',
      `Voulez-vous vraiment supprimer le fournisseur ${getPersonName(supplier)} ?`,
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
              await deleteSupplierOffline(id);
              Alert.alert('Succes', 'Fournisseur supprime avec succes');
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

  // Supplier Refund Claim handlers (claiming refund FROM supplier)
  const handleOpenSupplierRefundModal = () => {
    const balance = supplier?.stats?.total_balance || 0;
    if (balance >= 0) {
      Alert.alert(
        'Impossible',
        'Le fournisseur ne vous doit pas de remboursement. Le solde doit être négatif pour réclamer un remboursement.'
      );
      return;
    }
    setShowSupplierRefundModal(true);
    setSupplierRefundAmount('');
    setSupplierRefundNote('');
  };

  const handleCloseSupplierRefundModal = () => {
    setShowSupplierRefundModal(false);
    setSupplierRefundAmount('');
    setSupplierRefundNote('');
  };

  const handleSubmitSupplierRefund = async () => {
    if (!supplierRefundAmount) {
      Alert.alert('Erreur', 'Veuillez entrer un montant');
      return;
    }
    if (!shopId || !supplier) return;

    const amountValue = Math.round(parseFloat(supplierRefundAmount));

    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }

    const currentBalance = supplier.stats?.total_balance ?? 0;
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
      // Create a positive debt to cancel out the negative balance
      await createSupplierDebtOffline({
        shopId,
        supplierId: id,
        amount: amountValue,
        description: supplierRefundNote || `Remboursement recu de ${getPersonName(supplier)}`,
      });

      Alert.alert('Succes', 'Remboursement reclame et enregistre avec succes');
      handleCloseSupplierRefundModal();
      await loadSupplier();
    } catch (error: unknown) {
      console.error('Erreur lors de la reclamation du remboursement:', error);
      Alert.alert('Erreur', getErrorMessage(error) ?? 'Impossible de reclamer le remboursement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenCreateDebtModal = () => {
    setShowCreateDebtModal(true);
    setDebtAmount('');
    setDebtDescription('');
    setDebtNote('');
  };

  const handleCloseCreateDebtModal = () => {
    setShowCreateDebtModal(false);
    setDebtAmount('');
    setDebtDescription('');
    setDebtNote('');
  };

  const handleSubmitCreateDebt = async () => {
    if (!debtAmount || !supplier) {
      Alert.alert('Erreur', 'Veuillez entrer un montant');
      return;
    }
    if (!shopId) return;

    const amountValue = Math.round(parseFloat(debtAmount));

    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }

    setIsSubmitting(true);
    try {
      await createSupplierDebtOffline({
        shopId,
        supplierId: supplier.id,
        amount: amountValue,
        description: debtDescription || `Dette envers ${supplier.name}`,
        notes: debtNote || undefined,
      });

      Alert.alert('Succes', 'Dette creee avec succes');
      handleCloseCreateDebtModal();
      loadSupplier();
    } catch (error: unknown) {
      console.error('Erreur lors de la creation de la dette:', error);
      Alert.alert('Erreur', getErrorMessage(error) ?? 'Impossible de creer la dette');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPersonName = (person: { name: string; first_name?: string | null }): string => {
    const firstName = person.first_name ? String(person.first_name).trim() : '';
    const lastName = person.name ? String(person.name).trim() : '';
    return firstName ? `${firstName} ${lastName}` : lastName;
  };

  const canEditOrDelete = () => {
    return (
      userRole === 'BOSS' ||
      userRole === 'OWNER' ||
      userRole === 'MANAGER' ||
      userRole === 'SUPERADMIN'
    );
  };

  // Appel téléphonique direct au fournisseur.
  const handleCall = () => {
    if (!supplier?.phone) {
      Alert.alert('Aucun numéro', "Ce fournisseur n'a pas de téléphone enregistré.");
      return;
    }
    Linking.openURL(`tel:${supplier.phone}`).catch(() => undefined);
  };

  // Ouvre le bottom sheet de relance en pré-cochant les canaux disponibles.
  const handleOpenRemindSheet = () => {
    if (!supplier) return;
    const phoneOk = !!supplier.phone;
    let sms = notifPrefs.sms && phoneOk;
    let wa = notifPrefs.whatsapp && phoneOk;
    if (!sms && !wa) {
      sms = phoneOk;
      wa = phoneOk;
    }
    setRemindChannels({ SMS: sms, WHATSAPP: wa });
    setShowRemindSheet(true);
  };

  // Relance manuelle : envoie sur les canaux sélectionnés. Le message + le solde
  // dû sont construits côté API à partir des dettes en cours du fournisseur.
  const handleSendReminder = async () => {
    if (!supplier) return;
    const channels = (Object.keys(remindChannels) as Array<'SMS' | 'WHATSAPP'>).filter(
      c => remindChannels[c]
    );
    if (channels.length === 0) {
      Alert.alert('Aucun canal', "Sélectionnez au moins un canal d'envoi.");
      return;
    }
    setIsReminding(true);
    try {
      const result = await suppliersApi.manualRemind(supplier.id, channels as ReminderChannel[]);
      if (result.ok) {
        setShowRemindSheet(false);
        Alert.alert('Relance envoyée', 'La relance a été envoyée au fournisseur.');
        loadSupplier();
      } else {
        Alert.alert('Envoi impossible', result.error ?? "La relance n'a pas pu être envoyée.");
      }
    } catch {
      Alert.alert('Erreur', "Impossible d'envoyer la relance. Réessayez plus tard.");
    } finally {
      setIsReminding(false);
    }
  };

  // Bascule la préférence d'un canal et la persiste (table locale `suppliers` +
  // payload de synchro vers le serveur). En cas d'échec, on restaure l'état.
  const handleToggleChannel = async (channel: ReminderChannel) => {
    const previous = notifPrefs;
    const next = {
      sms: channel === 'SMS' ? !previous.sms : previous.sms,
      whatsapp: channel === 'WHATSAPP' ? !previous.whatsapp : previous.whatsapp,
      email: channel === 'EMAIL' ? !previous.email : previous.email,
    };

    setTogglingChannel(channel);
    setNotifPrefs(next);
    try {
      await updateSupplierOffline(id, {
        smsNotificationsEnabled: next.sms,
        whatsappNotificationsEnabled: next.whatsapp,
        emailNotificationsEnabled: next.email,
      });
      setSupplier(prev =>
        prev
          ? {
              ...prev,
              sms_notifications_enabled: next.sms,
              whatsapp_notifications_enabled: next.whatsapp,
              email_notifications_enabled: next.email,
            }
          : prev
      );
    } catch (error: unknown) {
      console.error('Erreur lors de la mise à jour des canaux:', error);
      setNotifPrefs(previous);
      Alert.alert('Erreur', getErrorMessage(error) ?? 'Impossible de mettre à jour les canaux');
    } finally {
      setTogglingChannel(null);
    }
  };

  const getAllTransactions = () => {
    if (!supplier) return [];

    const transactions: Array<{
      type: 'debt' | 'payment' | 'cash';
      date: string;
      amount: number;
      note?: string;
      status?: string;
      debtAmount?: number;
    }> = [];

    // Add debts
    supplier.debts.forEach(debt => {
      // Skip debts that are negative amounts with "Remboursement" in description
      const isRefundDebt =
        debt.amount < 0 &&
        (debt.description?.includes('Remboursement') || debt.notes?.includes('Remboursement'));
      if (isRefundDebt) {
        return;
      }

      transactions.push({
        type: 'debt',
        date: debt.created_at,
        amount: debt.amount,
        note: debt.description || debt.notes || undefined,
        status: debt.status,
        debtAmount: debt.amount,
      });

      // Add payments that are NOT linked to a cash exit (to avoid duplicates)
      debt.payments.forEach(payment => {
        if (!payment.cash_exit_id) {
          transactions.push({
            type: 'payment',
            date: payment.payment_date,
            amount: -payment.amount,
            note: payment.notes || undefined,
          });
        }
      });
    });

    // Add cash entries
    supplier.cash_entries.forEach(entry => {
      transactions.push({
        type: 'cash',
        date: entry.created_at,
        amount: -entry.amount,
        note: entry.note || undefined,
      });
    });

    return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.action} />
        </View>
      </View>
    );
  }

  if (!supplier) {
    return null;
  }

  const supplierName = getPersonName(supplier);
  const currentDebt = supplier.stats?.total_balance ?? 0;
  const debtDisplay = splitMoney(Math.abs(currentDebt));
  const hasLimit = !!(supplier.borrowing_limit && supplier.borrowing_limit > 0);
  const limitPct = hasLimit
    ? Math.min(100, Math.round((Math.max(0, currentDebt) / supplier.borrowing_limit) * 100))
    : 0;
  const limitBarColor = limitPct >= 80 ? Colors.danger.main : Colors.success.main;

  // Relance autorisée pour les rôles de gestion (l'API restreint à BOSS/MANAGER).
  const canRemind = canEditOrDelete();

  // Canaux de notification (préférence locale + disponibilité côté boutique).
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
      enabled: notifPrefs.sms,
      shopAvailable: !!supplier.phone,
    },
    {
      key: 'WHATSAPP',
      short: 'WA',
      label: 'WhatsApp',
      enabled: notifPrefs.whatsapp,
      shopAvailable: !!supplier.phone,
    },
    {
      key: 'EMAIL',
      short: '@',
      label: 'E-mail',
      enabled: notifPrefs.email,
      shopAvailable: !!supplier.email,
    },
  ];

  const recentNotifications = notificationsSummary?.recent ?? [];
  const reminderEvents = groupNotifications(recentNotifications);

  // Aperçu du message de relance (sémantique inversée : la boutique doit au
  // fournisseur). Le solde affiché est le solde dû en cours.
  const reminderName = (supplier.first_name && supplier.first_name.trim()) || supplier.name;
  const shopName = shop?.name || 'la boutique';
  const reminderMessage = `Bonjour ${reminderName}, nous vous confirmons que notre solde à régler envers vous s'élève à ${formatMoney(
    Math.abs(currentDebt)
  )} que nous réglerons dans les meilleurs délais. Merci de votre confiance. — ${shopName}`;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={supplierName}
        subtitle="Dettes & règlements"
        showBack={true}
        onBack={() => navigation.goBack()}
        rightAction={
          <View style={styles.headerActions}>
            {canEditOrDelete() && (
              <>
                {can('suppliers', 'edit') && (
                  <IconButton onPress={handleOpenEditModal}>
                    <Edit size={20} color={Colors.action} />
                  </IconButton>
                )}
                {can('suppliers', 'delete') && (
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
        {/* HERO MARINE — Dette en cours */}
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(supplierName)}</Text>
            </View>
            <View style={styles.heroIdentity}>
              <Text style={styles.heroName} numberOfLines={1}>
                {supplierName}
              </Text>
              <StatusBadge
                text={supplier.is_active ? 'Actif' : 'Inactif'}
                variant={supplier.is_active ? 'success' : 'danger'}
              />
            </View>
          </View>

          <Text style={styles.heroLabel}>
            {currentDebt < 0 ? 'Vous devez recevoir' : 'Dette en cours'}
          </Text>
          <Text style={styles.heroAmount}>
            {debtDisplay.value}
            {debtDisplay.unit ? (
              <Text style={styles.heroAmountUnit}> {debtDisplay.unit}</Text>
            ) : null}
          </Text>

          {hasLimit && (
            <View style={styles.heroLimitBlock}>
              <View style={styles.heroLimitTrack}>
                <View
                  style={[
                    styles.heroLimitFill,
                    { width: `${limitPct}%`, backgroundColor: limitBarColor },
                  ]}
                />
              </View>
              <Text style={styles.heroLimitText}>
                Limite d&apos;endettement · {formatMoney(supplier.borrowing_limit)}
              </Text>
            </View>
          )}
        </View>

        {/* Infos fournisseur */}
        {!!(supplier.phone || supplier.email || supplier.address || hasLimit) && (
          <View style={styles.infoCard}>
            {!!supplier.phone && (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Smartphone size={18} color={Colors.action} />
                </View>
                <Text style={styles.infoText}>{formatCameroonPhone(String(supplier.phone))}</Text>
              </View>
            )}
            {!!supplier.email && (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <FileText size={18} color={Colors.action} />
                </View>
                <Text style={styles.infoText}>{String(supplier.email)}</Text>
              </View>
            )}
            {!!supplier.address && (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Building size={18} color={Colors.action} />
                </View>
                <Text style={styles.infoText}>{String(supplier.address)}</Text>
              </View>
            )}
            {hasLimit && (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <CreditCard size={18} color={Colors.action} />
                </View>
                <Text style={styles.infoText}>
                  Limite d&apos;endettement : {formatMoney(supplier.borrowing_limit)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Appeler + Relancer maintenant */}
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
                    <Text style={styles.channelDisabled}>Indisponible (coordonnée manquante)</Text>
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

        {/* HISTORIQUE & TRANSPARENCE — statuts de notification */}
        {reminderEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>HISTORIQUE & TRANSPARENCE</Text>
            <View style={styles.listCard}>
              {reminderEvents.slice(0, 8).map((evt, idx) => {
                const visibleCount = Math.min(reminderEvents.length, 8);
                const isLast = idx >= visibleCount - 1;
                const title = evt.isReminder ? 'Relance envoyée' : getNotifTypeLabel(evt.type);
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
          </View>
        )}

        {/* Action Buttons */}
        {(userRole === 'BOSS' || userRole === 'OWNER' || userRole === 'MANAGER') && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: Colors.warning.main }]}
              onPress={handleOpenCreateDebtModal}
            >
              <Plus size={20} color={Colors.primary.foreground} />
              <Text style={styles.actionButtonText}>Créer dette</Text>
            </TouchableOpacity>

            {/* Show Refund Claim button only when balance is negative (supplier owes us) */}
            {currentDebt < 0 && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: Colors.danger.main }]}
                onPress={handleOpenSupplierRefundModal}
              >
                <DollarSign size={20} color={Colors.primary.foreground} />
                <Text style={styles.actionButtonText}>Réclamer</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: Colors.success.main }]}
              onPress={handleOpenPaymentModal}
            >
              <DollarSign size={20} color={Colors.primary.foreground} />
              <Text style={styles.actionButtonText}>Régler</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Transactions History */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Dettes & règlements</Text>
          </View>
          <View>
            {getAllTransactions().length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Aucune opération</Text>
              </View>
            ) : (
              getAllTransactions().map((transaction, index) => {
                // Detect if this is a refund claim (negative debt)
                const isRefund = transaction.type === 'debt' && transaction.amount < 0;
                const isCredit = transaction.type === 'debt' && !isRefund;
                const isLast = index === getAllTransactions().length - 1;

                const getIcon = () => {
                  if (isRefund) {
                    return <DollarSign size={18} color={Colors.danger.main} />;
                  }
                  switch (transaction.type) {
                    case 'debt':
                      return <Receipt size={18} color={Colors.warning.main} />;
                    case 'payment':
                      return <DollarSign size={18} color={Colors.success.main} />;
                    default:
                      return <DollarSign size={18} color={Colors.success.main} />;
                  }
                };

                const getIconBg = () => {
                  if (isRefund) return Colors.danger.background;
                  if (transaction.type === 'debt') return Colors.warning.background;
                  return Colors.success.background;
                };

                const getTitle = () => {
                  if (isRefund) {
                    return 'Remboursement du fournisseur';
                  }
                  switch (transaction.type) {
                    case 'debt':
                      return 'Achat à crédit';
                    case 'payment':
                      return 'Paiement effectué';
                    default:
                      return 'Paiement caisse';
                  }
                };

                const getBadge = ():
                  | { text: string; variant: 'success' | 'warning' | 'default' | 'danger' }
                  | undefined => {
                  // Show "Remboursement" badge for refunds
                  if (isRefund) {
                    return { text: 'Remboursement', variant: 'danger' };
                  }
                  if (!transaction.status) return undefined;
                  const statusMap: Record<
                    string,
                    { text: string; variant: 'success' | 'warning' | 'default' | 'danger' }
                  > = {
                    PAID: { text: 'Payé', variant: 'success' },
                    PARTIAL: { text: 'Partiel', variant: 'warning' },
                    PENDING: { text: 'Dû', variant: 'default' },
                  };
                  return statusMap[transaction.status] || undefined;
                };

                const dateStr = transaction.date ? formatDate(transaction.date) : 'Date inconnue';
                const badge = getBadge();
                const amountColor = isCredit
                  ? Colors.danger.main
                  : transaction.amount > 0
                    ? Colors.danger.main
                    : Colors.success.main;

                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.txRow, !isLast && styles.txRowBordered]}
                    onPress={() => {
                      setSelectedTransaction({
                        type: transaction.type,
                        date: transaction.date,
                        amount: transaction.amount,
                        note: transaction.note,
                        status: transaction.status,
                        isCredit: isCredit,
                        category: isCredit ? 'achats_marchandises' : undefined,
                        supplierName: supplier ? getPersonName(supplier) : '',
                      });
                      setShowDetailModal(true);
                    }}
                  >
                    <View style={[styles.txIcon, { backgroundColor: getIconBg() }]}>
                      {getIcon()}
                    </View>
                    <View style={styles.txBody}>
                      <Text style={styles.txTitle} numberOfLines={1}>
                        {getTitle()}
                      </Text>
                      <Text style={styles.txSubtitle} numberOfLines={1}>
                        {dateStr}
                      </Text>
                    </View>
                    <View style={styles.txTrailing}>
                      <Text style={[styles.txAmount, { color: amountColor }]}>
                        {transaction.amount > 0 ? '+' : '-'}
                        {formatMoney(Math.abs(transaction.amount))}
                      </Text>
                      {badge && <StatusBadge text={badge.text} variant={badge.variant} />}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Debt Modal - Contracter une dette */}
      <Modal
        visible={showDebtModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseDebtModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeaderTitle}>Nouvelle dette</Text>
                <Text style={styles.modalHeaderSubtitle}>{getPersonName(supplier)}</Text>
              </View>
              <TouchableOpacity onPress={handleCloseDebtModal} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseButtonText}>✕</Text>
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
                <Text style={styles.formLabel}>Description (optionnelle)</Text>
                <TextInput
                  style={styles.noteInput}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Description de la dette..."
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelButton} onPress={handleCloseDebtModal}>
                  <Text style={styles.modalCancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSubmitButton}
                  onPress={handleSubmitDebt}
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

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleClosePaymentModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeaderTitle}>Paiement fournisseur</Text>
                <Text style={styles.modalHeaderSubtitle}>
                  {supplier ? getPersonName(supplier) : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={handleClosePaymentModal} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseButtonText}>✕</Text>
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
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={handleClosePaymentModal}
                >
                  <Text style={styles.modalCancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSubmitButton}
                  onPress={handleSubmitPayment}
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

      {/* Supplier Refund Claim Modal (claim refund FROM supplier) */}
      <Modal
        visible={showSupplierRefundModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseSupplierRefundModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeaderTitle}>Réclamer remboursement</Text>
                <Text style={styles.modalHeaderSubtitle}>{supplier ? supplier.name : ''}</Text>
              </View>
              <TouchableOpacity
                onPress={handleCloseSupplierRefundModal}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseButtonText}>✕</Text>
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
                  Montant maximum à réclamer:{' '}
                  {formatMoney(Math.abs(supplier?.stats?.total_balance || 0))}
                </Text>
              </View>

              {/* Amount Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Montant (FCFA)</Text>
                <View style={styles.amountInputContainer}>
                  <TextInput
                    style={styles.amountInput}
                    value={supplierRefundAmount}
                    onChangeText={setSupplierRefundAmount}
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
                  value={supplierRefundNote}
                  onChangeText={setSupplierRefundNote}
                  placeholder="Ajouter une note ou description..."
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={handleCloseSupplierRefundModal}
                >
                  <Text style={styles.modalCancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitButton, { backgroundColor: Colors.danger.main }]}
                  onPress={handleSubmitSupplierRefund}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSubmitButtonText}>Réclamer</Text>
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
                  <Text style={styles.modalHeaderTitle}>Modifier le fournisseur</Text>
                  <Text style={styles.modalHeaderSubtitle}>
                    {supplier ? getPersonName(supplier) : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleCloseEditModal} style={styles.modalCloseButton}>
                  <Text style={styles.modalCloseButtonText}>✕</Text>
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
                    placeholder="Nom du fournisseur"
                  />
                </View>

                {/* First Name */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Prénom</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.first_name}
                    onChangeText={text => setEditForm({ ...editForm, first_name: text })}
                    placeholder="Prénom du fournisseur"
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

                {/* Borrowing Limit */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Limite d'emprunt (FCFA)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.borrowing_limit}
                    onChangeText={text => setEditForm({ ...editForm, borrowing_limit: text })}
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

      {/* Create Debt Modal */}
      <Modal
        visible={showCreateDebtModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseCreateDebtModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeaderTitle}>Créer une dette</Text>
                <Text style={styles.modalHeaderSubtitle}>{supplier ? supplier.name : ''}</Text>
              </View>
              <TouchableOpacity
                onPress={handleCloseCreateDebtModal}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseButtonText}>✕</Text>
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
                    value={debtAmount}
                    onChangeText={setDebtAmount}
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
                  style={styles.noteInput}
                  value={debtDescription}
                  onChangeText={setDebtDescription}
                  placeholder="Ex: Achat de marchandises"
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Note Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Note (optionnel)</Text>
                <TextInput
                  style={styles.noteInput}
                  value={debtNote}
                  onChangeText={setDebtNote}
                  placeholder="Note interne..."
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={handleCloseCreateDebtModal}
                  disabled={isSubmitting}
                >
                  <Text style={styles.modalCancelButtonText}>Annuler</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSubmitButton}
                  onPress={handleSubmitCreateDebt}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalSubmitButtonText}>Créer la dette</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
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
                <Text style={styles.modalHeaderTitle}>Relance fournisseur</Text>
                <View style={styles.tonePill}>
                  <Text style={styles.tonePillText}>Courtois</Text>
                </View>
              </View>

              {/* Ligne fournisseur */}
              <Text style={styles.remindClientLine}>
                {getPersonName(supplier)} ·{' '}
                <Text style={styles.remindAmount}>{formatMoney(Math.abs(currentDebt))}</Text>
              </Text>

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
                      <Send size={18} color={Colors.primary.foreground} />
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['3xl'],
    gap: Spacing.lg,
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
  // HERO MARINE
  hero: {
    backgroundColor: Colors.primary[900],
    borderRadius: 20,
    padding: Spacing.xl,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: Colors.primary[700],
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.onMarine,
  },
  heroIdentity: {
    flex: 1,
    gap: Spacing.xs,
    alignItems: 'flex-start',
  },
  heroName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.onMarine,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.action,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.onMarine,
    marginTop: Spacing.xs,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  heroAmountUnit: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.action,
  },
  heroLimitBlock: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  heroLimitTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    overflow: 'hidden',
  },
  heroLimitFill: {
    height: 6,
    borderRadius: 3,
  },
  heroLimitText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  // INFOS
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
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.info.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  // APPELER + RELANCER
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
  // SECTIONS
  section: {
    gap: Spacing.md,
  },
  sectionLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textColors.tertiary,
    letterSpacing: 0.6,
  },
  listCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    ...Shadows.sm,
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
  // ACTION BUTTONS
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 48,
  },
  actionButtonText: {
    color: Colors.primary.foreground,
    fontSize: 15,
    fontWeight: '700',
  },
  // CARD
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  cardHeader: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyState: {
    padding: Spacing['2xl'],
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textColors.tertiary,
    fontSize: 14,
  },
  // TX ROWS
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  txBody: {
    flex: 1,
    gap: 2,
  },
  txTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  txSubtitle: {
    fontSize: 12.5,
    color: Colors.textColors.tertiary,
  },
  txTrailing: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  // MODALS
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.sheet,
    borderTopRightRadius: BorderRadius.sheet,
    maxHeight: '85%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.muted.main,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  modalHeaderSubtitle: {
    fontSize: 14,
    color: Colors.textColors.tertiary,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.info.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseButtonText: {
    fontSize: 20,
    color: Colors.action,
    fontWeight: 'bold',
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
    padding: 12,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.surfaceAlt,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.action,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.info.background,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    paddingVertical: 12,
  },
  amountCurrency: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.action,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    padding: 12,
    fontSize: 14,
    color: Colors.text,
    height: 80,
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
    color: Colors.primary.foreground,
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
