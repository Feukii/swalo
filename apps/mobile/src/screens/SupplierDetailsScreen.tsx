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
import { SafeAreaView } from 'react-native-safe-area-context';
import { DollarSign, Receipt, Edit, Trash, Plus } from '../components/icons/SimpleIcons';
import {
  ScreenHeader,
  ListItem,
  StatusBadge,
  TransactionDetailModal,
  IconButton,
} from '../components/ui';
import { BalanceIndicator } from '../components/ui/BalanceIndicator';
import { Colors, Spacing } from '../constants/theme-v2';
import { formatDate } from '../utils/date';
import { formatMoney } from '../utils/money';
import { formatPhoneOnInput, formatCameroonPhone } from '../utils/phone';
import { useCurrentUser } from '../hooks/useCurrentUser';
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
    return userRole === 'OWNER' || userRole === 'MANAGER' || userRole === 'SUPERADMIN';
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
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#102A43" />
        </View>
      </SafeAreaView>
    );
  }

  if (!supplier) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title={getPersonName(supplier)}
        showBack={true}
        onBack={() => navigation.goBack()}
        rightAction={
          <View style={styles.headerActions}>
            {canEditOrDelete() && (
              <>
                <IconButton onPress={handleOpenEditModal}>
                  <Edit size={20} color={Colors.primary[900]} />
                </IconButton>
                <IconButton onPress={handleDelete}>
                  <Trash size={20} color={Colors.danger.main} />
                </IconButton>
              </>
            )}
            <StatusBadge
              text={supplier.is_active ? 'Actif' : 'Inactif'}
              variant={supplier.is_active ? 'success' : 'danger'}
            />
          </View>
        }
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Contact Info */}
        {!!(
          supplier.phone ||
          supplier.email ||
          supplier.address ||
          (supplier.borrowing_limit && supplier.borrowing_limit > 0)
        ) && (
          <View style={styles.infoCard}>
            {supplier.phone && (
              <Text style={styles.infoText}>
                <Text>📱 </Text>
                <Text>{formatCameroonPhone(String(supplier.phone))}</Text>
              </Text>
            )}
            {supplier.email && (
              <Text style={styles.infoText}>
                <Text>✉️ </Text>
                <Text>{String(supplier.email)}</Text>
              </Text>
            )}
            {supplier.address && (
              <Text style={styles.infoText}>
                <Text>📍 </Text>
                <Text>{String(supplier.address)}</Text>
              </Text>
            )}
            {!!(supplier.borrowing_limit && supplier.borrowing_limit > 0) && (
              <View>
                <Text style={styles.infoText}>
                  Limite emprunt: {formatMoney(supplier.borrowing_limit)}
                </Text>
                {(() => {
                  const used = supplier.stats?.total_balance ?? 0;
                  const limit = supplier.borrowing_limit;
                  const pct = Math.min(100, Math.round((used / limit) * 100));
                  const barColor = pct >= 90 ? '#dc2626' : pct >= 70 ? '#f59e0b' : '#16a34a';
                  return (
                    <View style={{ marginTop: 4 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          marginBottom: 4,
                        }}
                      >
                        <Text style={{ fontSize: 12, color: Colors.muted.foreground }}>
                          Utilisé: {formatMoney(used)}
                        </Text>
                        <Text style={{ fontSize: 12, color: barColor, fontWeight: '600' }}>
                          {pct}%
                        </Text>
                      </View>
                      <View style={{ height: 6, backgroundColor: '#e5e7eb', borderRadius: 3 }}>
                        <View
                          style={{
                            height: 6,
                            backgroundColor: barColor,
                            borderRadius: 3,
                            width: `${pct}%`,
                          }}
                        />
                      </View>
                    </View>
                  );
                })()}
              </View>
            )}
          </View>
        )}

        {/* Balance Indicator */}
        <BalanceIndicator
          balance={supplier.stats?.total_balance || 0}
          type="supplier"
          showAlert={true}
        />

        {/* Action Buttons */}
        {(userRole === 'OWNER' || userRole === 'MANAGER') && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: Colors.warning.main }]}
              onPress={handleOpenCreateDebtModal}
            >
              <Plus size={20} color={Colors.primary.foreground} />
              <Text style={styles.actionButtonText}>Créer dette</Text>
            </TouchableOpacity>

            {/* Show Refund Claim button only when balance is negative (supplier owes us) */}
            {(supplier.stats?.total_balance || 0) < 0 && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: Colors.danger.main }]}
                onPress={handleOpenSupplierRefundModal}
              >
                <DollarSign size={20} color={Colors.primary.foreground} />
                <Text style={styles.actionButtonText}>Réclamer Remboursement</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: Colors.success.main }]}
              onPress={handleOpenPaymentModal}
            >
              <DollarSign size={20} color={Colors.primary.foreground} />
              <Text style={styles.actionButtonText}>Payer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Transactions History */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Historique des opérations</Text>
          </View>
          <View>
            {getAllTransactions().length === 0 ? (
              <View style={{ padding: Spacing.lg }}>
                <Text style={{ color: Colors.muted.foreground, textAlign: 'center' }}>
                  Aucune transaction
                </Text>
              </View>
            ) : (
              getAllTransactions().map((transaction, index) => {
                // Detect if this is a refund claim (negative debt)
                const isRefund = transaction.type === 'debt' && transaction.amount < 0;
                const isCredit = transaction.type === 'debt' && !isRefund;

                const getIcon = () => {
                  if (isRefund) {
                    return <DollarSign size={20} color={Colors.danger.main} />;
                  }
                  switch (transaction.type) {
                    case 'debt':
                      return <Receipt size={20} color={Colors.primary[900]} />;
                    case 'payment':
                      return <DollarSign size={20} color={Colors.primary[900]} />;
                    default:
                      return <Receipt size={20} color={Colors.primary[900]} />;
                  }
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

                const getBadge = () => {
                  // Show "Remboursement" badge for refunds
                  if (isRefund) {
                    return { text: 'Remboursement', variant: 'danger' as const };
                  }
                  if (!transaction.status) return undefined;
                  const statusMap: Record<
                    string,
                    { text: string; variant: 'success' | 'warning' | 'default' | 'danger' }
                  > = {
                    PAID: { text: 'Payé', variant: 'success' as const },
                    PARTIAL: { text: 'Partiel', variant: 'warning' as const },
                    PENDING: { text: 'En attente', variant: 'default' as const },
                  };
                  return statusMap[transaction.status] || undefined;
                };

                const dateStr = transaction.date ? formatDate(transaction.date) : 'Date inconnue';

                return (
                  <ListItem
                    key={index}
                    icon={getIcon()}
                    title={getTitle()}
                    subtitle={dateStr}
                    amount={`${transaction.amount > 0 ? '+' : ''}${formatMoney(Math.abs(transaction.amount))}`}
                    amountColor={
                      isCredit ? 'warning' : transaction.amount > 0 ? 'success' : 'danger'
                    }
                    badge={getBadge()}
                    onClick={() => {
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
                  />
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
    alignItems: 'center',
    gap: Spacing.sm,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    marginTop: Spacing.md,
  },
  actionButton: {
    flex: 1,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 56,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    overflow: 'hidden',
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardHeader: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backText: {
    fontSize: 24,
    color: '#374151',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonText: {
    fontSize: 20,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeActive: {
    backgroundColor: '#dcfce7',
  },
  statusBadgeInactive: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#16a34a',
  },
  statusTextInactive: {
    color: '#dc2626',
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  infoText: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: Spacing.sm,
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionGradient: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    fontSize: 32,
  },
  actionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  actionSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  balanceCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  balanceCardDebt: {
    backgroundColor: '#dc2626',
  },
  balanceCardPaid: {
    backgroundColor: '#10b981',
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
    fontWeight: '500',
  },
  balanceValue: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  balanceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
  balanceDetailItem: {
    alignItems: 'center',
  },
  balanceDetailLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  balanceDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  balanceDetailSeparator: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  transactionsList: {
    gap: 12,
  },
  transactionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  transactionLeft: {
    flex: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  transactionType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  statusBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusBadgeSuccess: {
    backgroundColor: '#dcfce7',
  },
  statusBadgeWarning: {
    backgroundColor: '#fef3c7',
  },
  statusBadgePending: {
    backgroundColor: '#dbeafe',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#111827',
  },
  transactionDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 2,
  },
  transactionNote: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  transactionAmountPositive: {
    color: '#dc2626',
  },
  transactionAmountNegative: {
    color: '#16a34a',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.lg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: Colors.primary[900],
  },
  modalHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary.foreground,
    marginBottom: 4,
  },
  modalHeaderSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseButtonText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#111827',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    paddingVertical: 12,
  },
  amountCurrency: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    height: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalSubmitButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalSubmitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // New balance display styles
  balanceDisplayButton: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  balanceDisplayGradient: {
    padding: 24,
    alignItems: 'center',
  },
  balanceDisplayLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
    fontWeight: '500',
  },
  balanceDisplayAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  balanceDisplayDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
  balanceDisplayDetailItem: {
    alignItems: 'center',
  },
  balanceDisplayDetailLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  balanceDisplayDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  balanceDisplayDetailSeparator: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  // New action buttons row styles
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionButtonHalf: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionGradientHalf: {
    padding: 20,
    alignItems: 'center',
    gap: 6,
    minHeight: 120,
    justifyContent: 'center',
  },
  actionIconLarge: {
    fontSize: 36,
    marginBottom: 4,
  },
  actionTextMedium: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  actionSubtextSmall: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
  },
  overpaymentWarning: {
    backgroundColor: Colors.warning.main + '20',
    borderWidth: 1,
    borderColor: Colors.warning.main,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  overpaymentWarningText: {
    color: Colors.warning.main,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  paymentMethodContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentMethodButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.muted.foreground,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentMethodButtonActive: {
    backgroundColor: Colors.primary.main,
    borderColor: Colors.primary.main,
  },
  paymentMethodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.muted.foreground,
  },
  paymentMethodButtonTextActive: {
    color: Colors.primary.foreground,
  },
});
