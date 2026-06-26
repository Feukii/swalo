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
  Receipt,
  Edit,
  Trash,
  Plus,
  Smartphone,
  FileText,
  Building,
  CreditCard,
} from '../components/icons/SimpleIcons';
import { ScreenHeader, StatusBadge, TransactionDetailModal, IconButton } from '../components/ui';
import { Colors, Spacing, Shadows, BorderRadius } from '../constants/theme-v2';
import { formatDate } from '../utils/date';
import { formatMoney } from '../utils/money';
import { formatPhoneOnInput, formatCameroonPhone } from '../utils/phone';
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
  const { user, shopId, userId } = useCurrentUser();
  const userRole = user?.role || 'EMPLOYEE';
  const { can } = usePermissions();

  const [supplier, setSupplier] = useState<SupplierDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
});
