import React, { useState, useEffect } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users, DollarSign, Receipt, Edit, Trash, Plus } from '../components/icons/SimpleIcons';
import {
  ScreenHeader,
  KPICard,
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
import { customersApi, cashApi, receivablesApi } from '../lib/api';
import { getCashTransactions } from '../utils/cashRegister';

interface CustomerDetailsScreenProps {
  navigation: any;
  route: {
    params: {
      id: string;
    };
  };
}

interface CustomerDetails {
  id: string;
  name: string;
  first_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  credit_limit?: number;
  current_balance?: number;
  is_active: boolean;
  receivables: Array<{
    id: string;
    amount: number;
    balance: number;
    paid_amount: number;
    status: string;
    created_at: string;
    description?: string;
    notes?: string;
    payments: Array<{
      id: string;
      amount: number;
      payment_date: string;
      note?: string;
      notes?: string;
      cash_entry_id?: string;
      created_at?: string;
    }>;
  }>;
  cash_entries: Array<{
    id: string;
    type?: string;
    amount: number;
    category: string;
    created_at: string;
    note?: string;
    cashier?: { id: string; display_name: string };
  }>;
  stats: {
    total_receivables: number;
    total_balance: number;
    total_paid: number;
    total_sales: number;
  };
}

export default function CustomerDetailsScreen({ navigation, route }: CustomerDetailsScreenProps) {
  const { id } = route.params;
  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);

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

  // Transaction detail modal state
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
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

  // Customer refund modal state (for refunding money TO customers)
  const [showCustomerRefundModal, setShowCustomerRefundModal] = useState(false);
  const [customerRefundAmount, setCustomerRefundAmount] = useState('');
  const [customerRefundNote, setCustomerRefundNote] = useState('');

  // User role for permissions
  const [userRole, setUserRole] = useState<string>('EMPLOYEE');

  useEffect(() => {
    loadCustomer();
    loadUserRole();
  }, [id]);

  // Auto-refresh when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('Customer screen focused, reloading data');
      loadCustomer();
    });
    return unsubscribe;
  }, [navigation, id]);

  const loadUserRole = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserRole(user.role || 'EMPLOYEE');
      }
    } catch (error) {
      console.error('Erreur lors du chargement du rôle:', error);
    }
  };

  const loadCustomer = async () => {
    setIsLoading(true);
    try {
      const data = await customersApi.getOne(id);
      setCustomer(data);

      // Load all transactions including sales
      const allTransactions = await loadAllTransactions(data);
      setTransactions(allTransactions);

      // Show alert if customer has negative balance (we owe them a refund)
      const balance = data.stats?.total_balance || 0;
      if (balance < 0) {
        Alert.alert(
          '⚠️ Remboursement dû au client',
          `Vous devez rembourser ${formatMoney(Math.abs(balance))} à ${getPersonName(data)}.\n\nUtilisez le bouton "Rembourser Client" pour enregistrer le remboursement.`,
          [{ text: 'Compris', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Erreur lors du chargement du client:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails du client');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllTransactions = async (customerData: CustomerDetails) => {
    const transactions: Array<{
      type: 'receivable' | 'payment' | 'cash' | 'sale';
      date: string;
      amount: number;
      note?: string;
      status?: string;
      items?: Array<{ productName: string; quantity: number }>;
      cashier?: { id: string; display_name: string };
      isRefund?: boolean; // true if this is a cash OUT (refund TO customer)
    }> = [];

    // Build a set of cash_entry_ids that are linked to receivable payments
    // These cash entries should NOT be shown separately (they're represented by the payment)
    const linkedCashEntryIds = new Set<string>();
    customerData.receivables.forEach(receivable => {
      receivable.payments.forEach((payment: any) => {
        if (payment.cash_entry_id) {
          linkedCashEntryIds.add(payment.cash_entry_id);
        }
      });
    });

    // Add receivables (credit sales)
    customerData.receivables.forEach(receivable => {
      // Skip receivables that are PAID status with description "Remboursement effectué"
      // These are created to offset negative balances during customer refunds
      const isRefundReceivable =
        receivable.status === 'PAID' &&
        (receivable.description?.includes('Remboursement') ||
          receivable.notes?.includes('Remboursement'));
      if (isRefundReceivable) {
        return;
      }

      transactions.push({
        type: 'receivable',
        date: receivable.created_at,
        amount: receivable.amount,
        note: receivable.description || receivable.notes,
        status: receivable.status,
      });

      // Add payments - show ALL payments as "Paiement reçu"
      // Whether they came through cash register or direct payment, user sees one entry
      receivable.payments.forEach((payment: any) => {
        transactions.push({
          type: 'payment',
          date: payment.payment_date || payment.created_at,
          amount: -payment.amount, // Negative because customer paid us
          note: payment.notes,
        });
      });
    });

    // Add cash entries that are NOT linked to receivable payments
    // This includes: customer refunds (OUT), and other cash entries
    customerData.cash_entries.forEach(entry => {
      // Skip if this cash entry is already represented by a receivable payment
      if (linkedCashEntryIds.has(entry.id)) {
        return;
      }

      transactions.push({
        type: 'cash',
        date: entry.created_at,
        amount: -entry.amount, // Negative for OUT (refund to customer)
        note: entry.note,
        cashier: entry.cashier,
        isRefund: entry.category?.toLowerCase().includes('remboursement'),
      });
    });

    // Add sales from AsyncStorage cash register
    // Skip credit sales as they're already represented by receivables
    try {
      const cashTransactions = await getCashTransactions();
      const customerSales = cashTransactions.filter(
        t => t.customerId === customerData.id && t.category === 'vente' && !t.isCredit
      );

      customerSales.forEach(sale => {
        transactions.push({
          type: 'sale',
          date: sale.timestamp,
          amount: sale.amount,
          note: sale.note,
          items: sale.saleItems,
        });
      });
    } catch (error) {
      console.error('Error loading sales from cash register:', error);
    }

    return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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

    const amountValue = Math.round(parseFloat(amount));

    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }

    // Calculate total debt
    const totalDebt = customer!.stats?.total_balance || 0;
    const overpayment = amountValue - totalDebt;

    // Find oldest pending receivable
    const pendingReceivables = customer!.receivables
      .filter(r => r.status === 'PENDING' || r.status === 'PARTIAL')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // If no pending receivables but payment > 0, we need to create a negative receivable
    if (pendingReceivables.length === 0) {
      if (totalDebt >= 0) {
        // No debt, payment will create negative balance
        Alert.alert(
          'Attention : Créer un solde négatif',
          `Le client n'a pas de dette. En recevant ${formatMoney(amountValue)}, vous devrez rendre cette somme au client.\n\n` +
            `Voulez-vous continuer ?`,
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Confirmer',
              onPress: () => createNegativeReceivable(amountValue),
            },
          ]
        );
      } else {
        // Already negative, adding more
        Alert.alert(
          'Attention : Augmenter le solde négatif',
          `Le client a déjà un solde de ${formatMoney(totalDebt)} (vous lui devez ${formatMoney(Math.abs(totalDebt))}).\n\n` +
            `En recevant ${formatMoney(amountValue)} de plus, vous lui devrez ${formatMoney(Math.abs(totalDebt) + amountValue)}.\n\n` +
            `Voulez-vous continuer ?`,
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Confirmer',
              onPress: () => createNegativeReceivable(amountValue),
            },
          ]
        );
      }
      return;
    }

    // Check for overpayment
    if (overpayment > 0) {
      Alert.alert(
        'Attention : Dépassement',
        `Le montant de ${formatMoney(amountValue)} dépasse la dette de ${formatMoney(totalDebt)}.\n\n` +
          `Vous devrez rendre ${formatMoney(overpayment)} au client.`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Confirmer quand même',
            onPress: () => processPayment(amountValue, pendingReceivables[0].id),
          },
        ]
      );
      return;
    }

    await processPayment(amountValue, pendingReceivables[0].id);
  };

  const createNegativeReceivable = async (amountValue: number) => {
    setIsSubmitting(true);
    try {
      // Create a negative receivable (customer paid when they had no debt)
      await receivablesApi.create({
        customer_id: customer!.id,
        amount: -amountValue, // Negative amount
        description: note || `Remboursement à effectuer à ${getPersonName(customer!)}`,
      });

      const totalDebt = customer!.stats?.total_balance || 0;
      const newBalance = totalDebt - amountValue;

      Alert.alert(
        'Paiement enregistré',
        `Paiement de ${formatMoney(amountValue)} enregistré.\n\n⚠️ Vous devez rendre ${formatMoney(Math.abs(newBalance))} au client.`
      );

      handleCloseRefundModal();
      loadCustomer();
    } catch (error: any) {
      console.error("Erreur lors de l'enregistrement:", error);
      Alert.alert('Erreur', error.message || "Erreur lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const processPayment = async (amountValue: number, receivableId: string) => {
    setIsSubmitting(true);
    try {
      await receivablesApi.addPayment(receivableId, {
        amount: amountValue,
        payment_method: 'Espèces',
        note: note || `Paiement de ${getPersonName(customer!)}`,
      });

      // Check if there's overpayment
      const totalDebt = customer!.stats?.total_balance || 0;
      const overpayment = amountValue - totalDebt;

      if (overpayment > 0) {
        Alert.alert(
          'Paiement enregistré',
          `Paiement de ${formatMoney(amountValue)} enregistré.\n\n⚠️ Vous devez rendre ${formatMoney(overpayment)} au client.`
        );
      } else {
        Alert.alert('Succès', 'Paiement enregistré');
      }

      handleCloseRefundModal();
      loadCustomer();
    } catch (error: any) {
      console.error("Erreur lors de l'enregistrement:", error);
      Alert.alert('Erreur', error.message || "Erreur lors de l'enregistrement");
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

    const amountValue = Math.round(parseFloat(customerRefundAmount)); // Already in FCFA

    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }

    const currentBalance = customer?.stats?.total_balance || 0;
    const refundOwed = Math.abs(currentBalance);

    // Validate amount doesn't exceed refund owed
    if (amountValue > refundOwed) {
      Alert.alert(
        'Erreur',
        `Le montant du remboursement (${formatMoney(amountValue)}) dépasse le montant dû (${formatMoney(refundOwed)})`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await customersApi.createRefund(id, {
        amount: amountValue,
        payment_method: 'CASH',
        note: customerRefundNote || undefined,
      });

      Alert.alert('Succès', 'Remboursement enregistré avec succès');
      handleCloseCustomerRefundModal();
      await loadCustomer(); // Reload customer data
    } catch (error: any) {
      console.error('Erreur lors du remboursement:', error);
      const errorMessage =
        error.response?.data?.message || "Impossible d'enregistrer le remboursement";
      Alert.alert('Erreur', errorMessage);
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
  };

  const handleCloseCreateReceivableModal = () => {
    setShowCreateReceivableModal(false);
    setReceivableAmount('');
    setReceivableDescription('');
    setReceivableNote('');
  };

  const handleSubmitCreateReceivable = async () => {
    if (!receivableAmount || !customer) {
      Alert.alert('Erreur', 'Veuillez entrer un montant');
      return;
    }

    const amountValue = Math.round(parseFloat(receivableAmount)); // Already in FCFA

    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }

    setIsSubmitting(true);
    try {
      await receivablesApi.create({
        customer_id: customer.id,
        amount: amountValue,
        description: receivableDescription || `Créance pour ${getPersonName(customer)}`,
        notes: receivableNote,
      });

      Alert.alert('Succès', 'Créance créée avec succès');
      handleCloseCreateReceivableModal();
      loadCustomer();
    } catch (error: any) {
      console.error('Erreur lors de la création de la créance:', error);
      Alert.alert('Erreur', error.message || 'Impossible de créer la créance');
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
      const updateData: any = {
        name: editForm.name.trim(),
      };

      if (editForm.first_name.trim()) {
        updateData.first_name = editForm.first_name.trim();
      }
      if (editForm.phone.trim()) {
        updateData.phone = editForm.phone.trim();
      }
      if (editForm.email.trim()) {
        updateData.email = editForm.email.trim();
      }
      if (editForm.address.trim()) {
        updateData.address = editForm.address.trim();
      }
      if (editForm.credit_limit.trim()) {
        const creditLimitValue = Math.round(parseFloat(editForm.credit_limit));
        if (!isNaN(creditLimitValue) && creditLimitValue >= 0) {
          updateData.credit_limit = creditLimitValue;
        }
      }

      await customersApi.update(id, updateData);
      Alert.alert('Succès', 'Client modifié avec succès');
      handleCloseEditModal();
      loadCustomer();
    } catch (error: any) {
      console.error('Erreur lors de la modification:', error);
      Alert.alert('Erreur', error.message || 'Erreur lors de la modification');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Confirmer la suppression',
      `Voulez-vous vraiment supprimer le client ${getPersonName(customer!)} ?`,
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
              await customersApi.delete(id);
              Alert.alert('Succès', 'Client supprimé avec succès');
              navigation.goBack();
            } catch (error: any) {
              console.error('Erreur lors de la suppression:', error);
              Alert.alert('Erreur', error.message || 'Erreur lors de la suppression');
            }
          },
        },
      ]
    );
  };

  const getPersonName = (person: { name: string; first_name?: string }): string => {
    const firstName = person.first_name ? String(person.first_name).trim() : '';
    const lastName = person.name ? String(person.name).trim() : '';
    return firstName ? `${firstName} ${lastName}` : lastName;
  };

  const canEditOrDelete = () => {
    return userRole === 'BOSS' || userRole === 'MANAGER' || userRole === 'SUPERADMIN';
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0F2A44" />
        </View>
      </SafeAreaView>
    );
  }

  if (!customer) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title={getPersonName(customer)}
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
              text={customer.is_active ? 'Actif' : 'Inactif'}
              variant={customer.is_active ? 'success' : 'danger'}
            />
          </View>
        }
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Contact Info */}
        {!!(
          customer.phone ||
          customer.email ||
          customer.address ||
          (customer.credit_limit && customer.credit_limit > 0)
        ) && (
          <View style={styles.infoCard}>
            {!!customer.phone && (
              <Text style={styles.infoText}>
                Tél: {formatCameroonPhone(String(customer.phone))}
              </Text>
            )}
            {!!customer.email && (
              <Text style={styles.infoText}>Email: {String(customer.email)}</Text>
            )}
            {!!customer.address && (
              <Text style={styles.infoText}>Adresse: {String(customer.address)}</Text>
            )}
            {!!(customer.credit_limit && customer.credit_limit > 0) && (
              <View>
                <Text style={styles.infoText}>
                  Limite crédit: {formatMoney(customer.credit_limit)}
                </Text>
                {(() => {
                  const used = customer.stats?.total_balance || 0;
                  const limit = customer.credit_limit!;
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
          balance={customer.stats?.total_balance || 0}
          type="customer"
          showAlert={true}
        />

        {/* Action Buttons */}
        {(userRole === 'BOSS' || userRole === 'MANAGER' || userRole === 'EMPLOYEE') && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: Colors.warning.main }]}
              onPress={handleOpenCreateReceivableModal}
            >
              <Plus size={20} color={Colors.primary.foreground} />
              <Text style={styles.actionButtonText}>Créer créance</Text>
            </TouchableOpacity>

            {/* Show Refund button only when balance is negative */}
            {(customer.stats?.total_balance || 0) < 0 && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: Colors.danger.main }]}
                onPress={handleOpenCustomerRefundModal}
              >
                <DollarSign size={20} color={Colors.primary.foreground} />
                <Text style={styles.actionButtonText}>Rembourser Client</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: Colors.success.main }]}
              onPress={handleOpenRefundModal}
            >
              <DollarSign size={20} color={Colors.primary.foreground} />
              <Text style={styles.actionButtonText}>Recevoir paiement</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Transactions History */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Historique des opérations</Text>
          </View>
          <View>
            {transactions.length === 0 ? (
              <View style={{ padding: Spacing.lg }}>
                <Text style={{ color: Colors.muted.foreground, textAlign: 'center' }}>
                  Aucune transaction
                </Text>
              </View>
            ) : (
              transactions.map((transaction, index) => {
                // Detect if this is a refund (negative receivable)
                const isRefund = transaction.type === 'receivable' && transaction.amount < 0;
                const isCredit = transaction.type === 'receivable' && !isRefund;

                const getIcon = () => {
                  if (isRefund) {
                    return <DollarSign size={20} color={Colors.danger.main} />;
                  }
                  switch (transaction.type) {
                    case 'receivable':
                      return <Receipt size={20} color={Colors.primary[900]} />;
                    case 'payment':
                      return <DollarSign size={20} color={Colors.primary[900]} />;
                    default:
                      return <Receipt size={20} color={Colors.primary[900]} />;
                  }
                };

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

                // Build subtitle with date and cashier if available
                const dateStr = transaction.date ? formatDate(transaction.date) : 'Date inconnue';
                const subtitleStr = transaction.cashier
                  ? `${dateStr} - Par: ${transaction.cashier.display_name}`
                  : dateStr;

                return (
                  <ListItem
                    key={index}
                    icon={getIcon()}
                    title={getTitle()}
                    subtitle={subtitleStr}
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
                        note: transaction.note || '',
                        status: transaction.status,
                        isCredit: isCredit,
                        category: isCredit ? 'ventes' : undefined,
                        customerName: customer ? getPersonName(customer) : '',
                        cashier: transaction.cashier,
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

      {/* Create Receivable Modal */}
      <Modal
        visible={showCreateReceivableModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseCreateReceivableModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeaderTitle}>Remboursement client</Text>
                <Text style={styles.modalHeaderSubtitle}>
                  {customer ? getPersonName(customer) : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={handleCloseRefundModal} style={styles.modalCloseButton}>
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
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalHeaderTitle}>Modifier le client</Text>
                  <Text style={styles.modalHeaderSubtitle}>
                    {customer ? getPersonName(customer) : ''}
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
    backgroundColor: '#10b981',
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
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    height: 60,
    textAlignVertical: 'top',
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
