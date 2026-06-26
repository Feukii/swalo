import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, Minus, ArrowDown, ArrowUp } from '../components/icons/SimpleIcons';
import { ScreenHeader, SearchableSelect } from '../components/ui';
import { Colors, Spacing, Shadows, BorderRadius } from '../constants/theme-v2';
import { formatMoney } from '../utils/money';
import { useCurrentUser } from '../hooks/useCurrentUser';
import {
  cashEntryRepo,
  clientReceivableRepo,
  supplierDebtRepo,
  customerRepo,
  supplierRepo,
  LocalCustomer,
  LocalSupplier,
} from '../db/repositories';
import {
  createCashEntryOffline,
  createReceivableOffline,
  createSupplierDebtOffline,
} from '../db/offlineWrite';
import { checkCreditLimit } from '../utils/creditCheck';
import { checkBorrowingLimit } from '../utils/borrowingCheck';

// Interface pour les transactions de caisse (cash + crédit)
interface CashTransaction {
  id: string;
  type: 'IN' | 'OUT';
  category: string;
  amount: number;
  note?: string;
  created_at: string;
  customer_id?: string;
  supplier_id?: string;
  isCredit?: boolean; // Pour distinguer les transactions à crédit
}

// Fonction pour formater l'heure
const formatTransactionTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

// Labels des catégories
const getCategoryLabel = (category: string, isCredit?: boolean): string => {
  const labels: { [key: string]: string } = {
    ventes: 'Vente',
    vente: 'Vente',
    vente_credit: 'Vente à crédit',
    achat_credit: 'Achat à crédit',
    entree: 'Entrée',
    sortie: 'Sortie',
    remboursement_client: 'Remb. client',
    achats_marchandises: 'Achat marchandises',
    loyers: 'Loyer',
    reglement_fournisseur: 'Règlement fournisseur',
    depenses_courantes: 'Dépenses courantes',
    divers: 'Divers',
  };
  const baseLabel = labels[category] || category;
  if (isCredit && !category.includes('credit')) {
    return `${baseLabel} (Crédit)`;
  }
  return baseLabel;
};

export default function CashScreen() {
  const { shopId, userId } = useCurrentUser();
  const [refreshing, setRefreshing] = useState(false);
  const [cashStats, setCashStats] = useState({
    balance: 0,
    entries: 0,
    exits: 0,
    net: 0,
    // KPIs ventes par mode
    totalSales: 0,
    salesCash: 0,
    salesCredit: 0,
    // KPIs achats par mode
    totalPurchases: 0,
    purchasesCash: 0,
    purchasesCredit: 0,
  });
  const [todayTransactions, setTodayTransactions] = useState<CashTransaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<CashTransaction | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Entry/Exit modal states
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Entry categories and data
  const [entryCategory, setEntryCategory] = useState<'ventes' | 'remboursement_client' | 'divers'>(
    'ventes'
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customers, setCustomers] = useState<LocalCustomer[]>([]);

  // Exit categories and data
  const [exitCategory, setExitCategory] = useState<
    'achats_marchandises' | 'loyers' | 'reglement_fournisseur' | 'depenses_courantes' | 'divers'
  >('achats_marchandises');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [suppliers, setSuppliers] = useState<LocalSupplier[]>([]);

  // Payment mode states for sales/purchases
  const [entryPaymentMode, setEntryPaymentMode] = useState<'cash' | 'credit'>('cash');
  const [exitPaymentMode, setExitPaymentMode] = useState<'cash' | 'credit'>('cash');

  const loadCashData = useCallback(async () => {
    if (!shopId) return;
    try {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const startISO = startOfDay.toISOString();

      // Fetch today's data from local SQLite
      const todayCashEntries = await cashEntryRepo.getToday(shopId);
      const allReceivables = await clientReceivableRepo.getAll(shopId);
      const todayReceivables = allReceivables.filter(r => r.created_at >= startISO);
      const allDebts = await supplierDebtRepo.getAll(shopId);
      const todayDebts = allDebts.filter(d => d.created_at >= startISO);

      const transactions: CashTransaction[] = [];

      // Ajouter les transactions cash
      todayCashEntries.forEach(entry => {
        transactions.push({
          id: entry.id,
          type: entry.type as 'IN' | 'OUT',
          category: entry.category || (entry.type === 'IN' ? 'entree' : 'sortie'),
          amount: entry.amount,
          note: entry.note || undefined,
          created_at: entry.created_at,
          customer_id: entry.customer_id || undefined,
          supplier_id: entry.supplier_id || undefined,
          isCredit: false,
        });
      });

      // Ajouter les ventes à crédit (créances créées aujourd'hui)
      todayReceivables.forEach(receivable => {
        if (receivable.amount > 0) {
          transactions.push({
            id: `receivable_${receivable.id}`,
            type: 'IN',
            category: 'vente_credit',
            amount: receivable.amount,
            note: receivable.description || 'Vente à crédit',
            created_at: receivable.created_at,
            customer_id: receivable.customer_id,
            isCredit: true,
          });
        }
      });

      // Ajouter les achats à crédit (dettes créées aujourd'hui)
      todayDebts.forEach(debt => {
        if (debt.amount > 0) {
          transactions.push({
            id: `debt_${debt.id}`,
            type: 'OUT',
            category: 'achat_credit',
            amount: debt.amount,
            note: debt.description || 'Achat à crédit',
            created_at: debt.created_at,
            supplier_id: debt.supplier_id,
            isCredit: true,
          });
        }
      });

      // Trier par date décroissante (plus récent en premier)
      transactions.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Compute stats from local data
      const totalIn = todayCashEntries
        .filter(e => e.type === 'IN')
        .reduce((s, e) => s + e.amount, 0);
      const totalOut = todayCashEntries
        .filter(e => e.type === 'OUT')
        .reduce((s, e) => s + e.amount, 0);

      const salesCashEntries = todayCashEntries.filter(
        e => e.type === 'IN' && (e.category === 'ventes' || e.category === 'vente')
      );
      const salesCash = salesCashEntries.reduce((s, e) => s + e.amount, 0);
      const salesCredit = todayReceivables.reduce((s, r) => s + Math.max(0, r.amount), 0);

      const purchaseCashEntries = todayCashEntries.filter(
        e => e.type === 'OUT' && e.category === 'achats_marchandises'
      );
      const purchasesCash = purchaseCashEntries.reduce((s, e) => s + e.amount, 0);
      const purchasesCredit = todayDebts.reduce((s, d) => s + Math.max(0, d.amount), 0);

      setCashStats({
        balance: totalIn - totalOut,
        entries: totalIn,
        exits: totalOut,
        net: totalIn - totalOut,
        totalSales: salesCash + salesCredit,
        salesCash,
        salesCredit,
        totalPurchases: purchasesCash + purchasesCredit,
        purchasesCash,
        purchasesCredit,
      });

      setTodayTransactions(transactions);
    } catch (error) {
      console.error('Erreur chargement caisse:', error);
    }
  }, [shopId]);

  const loadCustomers = useCallback(async () => {
    if (!shopId) return;
    try {
      const data = await customerRepo.getAll(shopId);
      setCustomers(data);
    } catch (error) {
      console.error('Erreur chargement clients:', error);
      setCustomers([]);
    }
  }, [shopId]);

  const loadSuppliers = useCallback(async () => {
    if (!shopId) return;
    try {
      const data = await supplierRepo.getAll(shopId);
      setSuppliers(data);
    } catch (error) {
      console.error('Erreur chargement fournisseurs:', error);
      setSuppliers([]);
    }
  }, [shopId]);

  // Recharger les données quand l'écran est focus
  useFocusEffect(
    useCallback(() => {
      loadCashData();
      loadCustomers();
      loadSuppliers();
    }, [loadCashData, loadCustomers, loadSuppliers])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCashData();
    setRefreshing(false);
  };

  const handleTransactionClick = (transaction: CashTransaction) => {
    setSelectedTransaction(transaction);
    setShowDetailModal(true);
  };

  const handleOpenEntryModal = async () => {
    setShowEntryModal(true);
    setAmount('');
    setNote('');
    setEntryCategory('ventes');
    setSelectedCustomerId('');
    setEntryPaymentMode('cash');
    await loadCustomers();
  };

  const handleOpenExitModal = async () => {
    setShowExitModal(true);
    setAmount('');
    setNote('');
    setExitCategory('achats_marchandises');
    setSelectedSupplierId('');
    setExitPaymentMode('cash');
    await loadSuppliers();
  };

  const handleSubmitEntry = async () => {
    // Validation du montant
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un montant valide');
      return;
    }
    if (!shopId || !userId) {
      Alert.alert('Erreur', 'Session non identifiee');
      return;
    }

    // Validation pour remboursement client : client requis
    if (entryCategory === 'remboursement_client' && !selectedCustomerId) {
      Alert.alert('Erreur', 'Veuillez sélectionner un client pour le remboursement');
      return;
    }

    // Validation pour vente à crédit : client requis
    if (entryCategory === 'ventes' && entryPaymentMode === 'credit' && !selectedCustomerId) {
      Alert.alert('Erreur', 'Veuillez sélectionner un client pour une vente à crédit');
      return;
    }

    // Validation pour divers : commentaire requis
    if (entryCategory === 'divers' && !note.trim()) {
      Alert.alert('Erreur', 'Veuillez ajouter un commentaire pour la catégorie "Divers"');
      return;
    }

    setIsSubmitting(true);
    try {
      const amountValue = parseFloat(amount);

      // Si vente à crédit, créer une créance client au lieu d'une entrée de caisse
      if (entryCategory === 'ventes' && entryPaymentMode === 'credit') {
        // Vérifier le plafond de crédit
        const creditCustomer = customers.find(c => c.id === selectedCustomerId);
        const creditError = await checkCreditLimit(
          shopId,
          selectedCustomerId,
          creditCustomer?.credit_limit || 0,
          amountValue
        );
        if (creditError) {
          Alert.alert('Plafond de credit atteint', creditError);
          setIsSubmitting(false);
          return;
        }

        await createReceivableOffline({
          shopId,
          customerId: selectedCustomerId,
          amount: amountValue,
          description: note || 'Vente à crédit',
        });
        Alert.alert('Succes', 'Vente à crédit enregistrée');
      } else if (entryCategory === 'remboursement_client') {
        const customer = customers.find(c => c.id === selectedCustomerId);
        const customerName = customer
          ? `${customer.first_name || ''} ${customer.name}`.trim()
          : 'Client';

        // Compute current balance from local receivables
        const customerReceivables = await clientReceivableRepo.getByCustomer(
          shopId,
          selectedCustomerId
        );
        const currentBalance = customerReceivables.reduce((s, r) => s + r.balance, 0);

        // Créer une créance NÉGATIVE pour diminuer le solde client
        await createReceivableOffline({
          shopId,
          customerId: selectedCustomerId,
          amount: -amountValue,
          description: note || `Remboursement de ${customerName}`,
        });

        const newBalance = currentBalance - amountValue;

        let message: string;
        if (newBalance > 0) {
          message = `Remboursement de ${formatMoney(amountValue)} recu.\n\nNouveau solde: ${formatMoney(newBalance)}\n(Le client nous doit encore ${formatMoney(newBalance)})`;
        } else if (newBalance < 0) {
          message = `Remboursement de ${formatMoney(amountValue)} recu.\n\nNouveau solde: ${formatMoney(newBalance)}\n(Nous devons ${formatMoney(Math.abs(newBalance))} au client)`;
        } else {
          message = `Remboursement de ${formatMoney(amountValue)} recu.\n\nLe compte client est solde!`;
        }

        Alert.alert('Succes', message);

        // Créer l'entrée de caisse (l'argent entre dans notre caisse)
        await createCashEntryOffline({
          shopId,
          cashierId: userId,
          type: 'IN',
          category: entryCategory,
          amount: amountValue,
          note: note || `Remboursement de ${customerName}`,
          customerId: selectedCustomerId,
        });
      } else {
        // Entrée de caisse normale (cash)
        await createCashEntryOffline({
          shopId,
          cashierId: userId,
          type: 'IN',
          category: entryCategory,
          amount: amountValue,
          note: note || (entryCategory === 'ventes' ? 'Vente (Cash)' : 'Entree divers'),
        });
        Alert.alert('Succes', 'Entree enregistree avec succes');
      }

      setShowEntryModal(false);
      setAmount('');
      setNote('');
      setEntryCategory('ventes');
      setSelectedCustomerId('');
      setEntryPaymentMode('cash');
      await loadCashData();
    } catch (error) {
      console.error('Erreur entrée:', error);
      Alert.alert('Erreur', "Impossible d'enregistrer l'entree");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitExit = async () => {
    // Validation du montant
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un montant valide');
      return;
    }
    if (!shopId || !userId) {
      Alert.alert('Erreur', 'Session non identifiee');
      return;
    }

    const exitAmount = parseFloat(amount);
    const currentBal = cashStats.balance || 0;

    // Validation du solde: seulement si paiement en cash (pas pour crédit)
    if (exitPaymentMode === 'cash' && exitAmount > currentBal) {
      Alert.alert(
        'Solde insuffisant',
        `Impossible de retirer ${formatMoney(exitAmount)}.\nSolde actuel de la caisse: ${formatMoney(currentBal)}`
      );
      return;
    }

    // Validation pour règlement fournisseur : fournisseur requis
    if (exitCategory === 'reglement_fournisseur' && !selectedSupplierId) {
      Alert.alert('Erreur', 'Veuillez sélectionner un fournisseur pour le règlement');
      return;
    }

    // Validation pour achat à crédit : fournisseur requis
    if (
      exitCategory === 'achats_marchandises' &&
      exitPaymentMode === 'credit' &&
      !selectedSupplierId
    ) {
      Alert.alert('Erreur', 'Veuillez sélectionner un fournisseur pour un achat à crédit');
      return;
    }

    // Validation pour divers : commentaire requis
    if (exitCategory === 'divers' && !note.trim()) {
      Alert.alert('Erreur', 'Veuillez ajouter un commentaire pour la catégorie "Divers"');
      return;
    }

    setIsSubmitting(true);
    try {
      // Si achat à crédit, créer une dette fournisseur au lieu d'une sortie de caisse
      if (exitCategory === 'achats_marchandises' && exitPaymentMode === 'credit') {
        // Vérifier le plafond d'endettement du fournisseur
        const creditSupplier = suppliers.find(s => s.id === selectedSupplierId);
        const borrowingError = await checkBorrowingLimit(
          shopId,
          selectedSupplierId,
          creditSupplier?.borrowing_limit || 0,
          exitAmount
        );
        if (borrowingError) {
          Alert.alert('Plafond d endettement atteint', borrowingError);
          setIsSubmitting(false);
          return;
        }

        await createSupplierDebtOffline({
          shopId,
          supplierId: selectedSupplierId,
          amount: exitAmount,
          description: note || 'Achat à crédit',
        });
        Alert.alert('Succes', 'Achat à crédit enregistre');
      } else if (exitCategory === 'reglement_fournisseur') {
        const supplier = suppliers.find(s => s.id === selectedSupplierId);
        const supplierName = supplier
          ? `${supplier.first_name || ''} ${supplier.name}`.trim()
          : 'Fournisseur';

        // Compute current balance from local debts
        const supplierDebts = await supplierDebtRepo.getBySupplier(shopId, selectedSupplierId);
        const currentDebtBalance = supplierDebts.reduce((s, d) => s + d.balance, 0);

        // Créer une dette NÉGATIVE pour diminuer le solde fournisseur
        await createSupplierDebtOffline({
          shopId,
          supplierId: selectedSupplierId,
          amount: -exitAmount,
          description: note || `Reglement a ${supplierName}`,
        });

        const newBalance = currentDebtBalance - exitAmount;

        let message: string;
        if (newBalance > 0) {
          message = `Reglement de ${formatMoney(exitAmount)} effectue.\n\nNouveau solde: ${formatMoney(newBalance)}\n(Nous devons encore ${formatMoney(newBalance)} au fournisseur)`;
        } else if (newBalance < 0) {
          message = `Reglement de ${formatMoney(exitAmount)} effectue.\n\nNouveau solde: ${formatMoney(newBalance)}\n(Le fournisseur nous doit ${formatMoney(Math.abs(newBalance))})`;
        } else {
          message = `Reglement de ${formatMoney(exitAmount)} effectue.\n\nLe compte fournisseur est solde!`;
        }

        Alert.alert('Succes', message);

        // Créer la sortie de caisse (l'argent sort de notre caisse)
        await createCashEntryOffline({
          shopId,
          cashierId: userId,
          type: 'OUT',
          category: exitCategory,
          amount: exitAmount,
          note: note || `Reglement a ${supplierName}`,
          supplierId: selectedSupplierId,
        });
      } else {
        // Sortie de caisse normale (cash)
        await createCashEntryOffline({
          shopId,
          cashierId: userId,
          type: 'OUT',
          category: exitCategory,
          amount: exitAmount,
          note: note || getCategoryExitLabel(exitCategory),
        });
        Alert.alert('Succes', 'Sortie enregistree avec succes');
      }

      setShowExitModal(false);
      setAmount('');
      setNote('');
      setExitCategory('achats_marchandises');
      setSelectedSupplierId('');
      setExitPaymentMode('cash');
      await loadCashData();
    } catch (error) {
      console.error('Erreur sortie:', error);
      Alert.alert('Erreur', "Impossible d'enregistrer la sortie");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryExitLabel = (category: string) => {
    const labels = {
      achats_marchandises: 'Achat de marchandises',
      loyers: 'Loyer',
      depenses_courantes: 'Dépense courante',
      divers: 'Sortie divers',
    };
    return labels[category as keyof typeof labels] || 'Sortie de caisse';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Caisse" subtitle="Mouvements du jour" />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Carte HERO marine — solde de caisse */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Solde de caisse</Text>
          <Text style={styles.heroAmount}>
            {formatMoney(cashStats.balance)
              .replace(/\s?F(CFA)?$/i, '')
              .trim()}
            <Text style={styles.heroAmountUnit}> F</Text>
          </Text>

          <View style={styles.heroSummaryRow}>
            <View style={styles.heroSummaryItem}>
              <Text style={styles.heroSummaryLabel}>Entrées du jour</Text>
              <Text style={[styles.heroSummaryValue, { color: Colors.success.main }]}>
                +{formatMoney(cashStats.entries)}
              </Text>
            </View>
            <View style={styles.heroSummaryItem}>
              <Text style={styles.heroSummaryLabel}>Sorties du jour</Text>
              <Text style={[styles.heroSummaryValue, { color: Colors.danger.main }]}>
                {formatMoney(cashStats.exits)}
              </Text>
            </View>
          </View>
        </View>

        {/* Boutons Entrée / Sortie */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonIn]}
            onPress={handleOpenEntryModal}
            activeOpacity={0.85}
          >
            <View style={[styles.actionIconBadge, { backgroundColor: Colors.success.main }]}>
              <Plus size={16} color="#FFFFFF" />
            </View>
            <Text style={[styles.actionButtonText, { color: Colors.success.main }]}>Entrée</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonOut]}
            onPress={handleOpenExitModal}
            activeOpacity={0.85}
          >
            <View style={[styles.actionIconBadge, { backgroundColor: Colors.danger.main }]}>
              <Minus size={16} color="#FFFFFF" />
            </View>
            <Text style={[styles.actionButtonText, { color: Colors.danger.main }]}>Sortie</Text>
          </TouchableOpacity>
        </View>

        {/* Journal du jour */}
        <View>
          <Text style={styles.sectionTitle}>Journal du jour</Text>
          <View style={styles.journalCard}>
            {todayTransactions.length === 0 ? (
              <View style={styles.journalEmpty}>
                <Text style={styles.journalEmptyText}>Aucune transaction aujourd'hui</Text>
              </View>
            ) : (
              todayTransactions.map((transaction, index) => {
                // Look up customer/supplier name from local state
                const customerMatch = transaction.customer_id
                  ? customers.find(c => c.id === transaction.customer_id)
                  : null;
                const supplierMatch = transaction.supplier_id
                  ? suppliers.find(s => s.id === transaction.supplier_id)
                  : null;
                const personName = customerMatch
                  ? `${customerMatch.first_name || ''} ${customerMatch.name}`.trim()
                  : supplierMatch
                    ? `${supplierMatch.first_name || ''} ${supplierMatch.name}`.trim()
                    : '';

                const isIn = transaction.type === 'IN';
                const tint = isIn ? Colors.success : Colors.danger;
                const time = formatTransactionTime(transaction.created_at);
                const modeLabel = transaction.isCredit ? 'Crédit' : 'Cash';
                const title = personName
                  ? `${getCategoryLabel(transaction.category, transaction.isCredit)} — ${personName}`
                  : getCategoryLabel(transaction.category, transaction.isCredit);

                return (
                  <TouchableOpacity
                    key={transaction.id}
                    style={[
                      styles.journalRow,
                      index === todayTransactions.length - 1 && styles.journalRowLast,
                    ]}
                    onPress={() => handleTransactionClick(transaction)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.journalIcon, { backgroundColor: tint.background }]}>
                      {isIn ? (
                        <ArrowDown size={18} color={tint.main} />
                      ) : (
                        <ArrowUp size={18} color={tint.main} />
                      )}
                    </View>
                    <View style={styles.journalInfo}>
                      <Text style={styles.journalTitle} numberOfLines={1}>
                        {title}
                      </Text>
                      <Text style={styles.journalSubtitle} numberOfLines={1}>
                        {time} · {modeLabel}
                      </Text>
                    </View>
                    <Text style={[styles.journalAmount, { color: tint.main }]}>
                      {isIn ? '+' : '-'}
                      {formatMoney(transaction.amount)}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Transaction Detail Modal */}
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Détails de la transaction</Text>

            {selectedTransaction && (
              <View style={styles.detailsContainer}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type</Text>
                  <Text style={styles.detailValue}>
                    {selectedTransaction.type === 'IN' ? 'Entrée' : 'Sortie'}
                    {selectedTransaction.isCredit ? ' (À crédit)' : ''}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Catégorie</Text>
                  <Text style={styles.detailValue}>
                    {getCategoryLabel(selectedTransaction.category, selectedTransaction.isCredit)}
                  </Text>
                </View>

                {selectedTransaction.isCredit && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Mode</Text>
                    <Text
                      style={[
                        styles.detailValue,
                        { color: Colors.warning.main, fontWeight: '600' },
                      ]}
                    >
                      À crédit
                    </Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Montant</Text>
                  <Text
                    style={[
                      styles.detailValue,
                      styles.detailAmount,
                      {
                        color: selectedTransaction.isCredit
                          ? Colors.warning.main
                          : selectedTransaction.type === 'IN'
                            ? Colors.success.main
                            : Colors.danger.main,
                      },
                    ]}
                  >
                    {selectedTransaction.type === 'IN' ? '+' : '-'}
                    {formatMoney(selectedTransaction.amount)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date & Heure</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedTransaction.created_at).toLocaleString('fr-FR')}
                  </Text>
                </View>

                {selectedTransaction.customer_id &&
                  (() => {
                    const c = customers.find(x => x.id === selectedTransaction.customer_id);
                    return c ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Client</Text>
                        <Text style={styles.detailValue}>
                          {c.first_name ? `${c.first_name} ${c.name}` : c.name}
                        </Text>
                      </View>
                    ) : null;
                  })()}

                {selectedTransaction.supplier_id &&
                  (() => {
                    const s = suppliers.find(x => x.id === selectedTransaction.supplier_id);
                    return s ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Fournisseur</Text>
                        <Text style={styles.detailValue}>
                          {s.first_name ? `${s.first_name} ${s.name}` : s.name}
                        </Text>
                      </View>
                    ) : null;
                  })()}

                {selectedTransaction.note && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Note</Text>
                    <Text style={styles.detailValue}>{selectedTransaction.note}</Text>
                  </View>
                )}

                {selectedTransaction.isCredit && (
                  <View
                    style={[
                      styles.detailRow,
                      {
                        backgroundColor: Colors.warning.main + '15',
                        marginTop: Spacing.sm,
                        padding: Spacing.md,
                        borderRadius: 8,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.detailValue,
                        { color: Colors.warning.main, flex: 1, textAlign: 'center' },
                      ]}
                    >
                      ⚠️ Transaction à crédit - Pas d'impact sur la caisse
                    </Text>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowDetailModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Entry Modal — sheet "Entrée de caisse" */}
      <Modal
        visible={showEntryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEntryModal(false)}
      >
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <ScrollView
              contentContainerStyle={styles.sheetScroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.sheetTitle}>Entrée de caisse</Text>

              {/* Catégories */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Catégorie</Text>
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    style={[styles.chip, entryCategory === 'ventes' && styles.chipActive]}
                    onPress={() => setEntryCategory('ventes')}
                  >
                    <Text
                      style={[styles.chipText, entryCategory === 'ventes' && styles.chipTextActive]}
                    >
                      Ventes
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.chip,
                      entryCategory === 'remboursement_client' && styles.chipActive,
                    ]}
                    onPress={() => setEntryCategory('remboursement_client')}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        entryCategory === 'remboursement_client' && styles.chipTextActive,
                      ]}
                    >
                      Remb. client
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.chip, entryCategory === 'divers' && styles.chipActive]}
                    onPress={() => setEntryCategory('divers')}
                  >
                    <Text
                      style={[styles.chipText, entryCategory === 'divers' && styles.chipTextActive]}
                    >
                      Divers
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Payment mode selection for ventes */}
              {entryCategory === 'ventes' && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Mode de paiement</Text>
                  <View style={styles.chipRow}>
                    <TouchableOpacity
                      style={[styles.chip, entryPaymentMode === 'cash' && styles.chipActive]}
                      onPress={() => {
                        setEntryPaymentMode('cash');
                        setSelectedCustomerId('');
                      }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          entryPaymentMode === 'cash' && styles.chipTextActive,
                        ]}
                      >
                        Cash
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.chip, entryPaymentMode === 'credit' && styles.chipActive]}
                      onPress={() => setEntryPaymentMode('credit')}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          entryPaymentMode === 'credit' && styles.chipTextActive,
                        ]}
                      >
                        Crédit
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Client selection for vente à crédit */}
              {entryCategory === 'ventes' && entryPaymentMode === 'credit' && (
                <View style={styles.formGroup}>
                  <SearchableSelect
                    label="Client *"
                    value={selectedCustomerId}
                    onValueChange={setSelectedCustomerId}
                    options={customers}
                    placeholder="Sélectionner un client (obligatoire pour vente à crédit)"
                  />
                </View>
              )}

              {/* Client selection for remboursement */}
              {entryCategory === 'remboursement_client' && (
                <View style={styles.formGroup}>
                  <SearchableSelect
                    label="Client *"
                    value={selectedCustomerId}
                    onValueChange={setSelectedCustomerId}
                    options={customers}
                    placeholder="Sélectionner un client"
                  />
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Montant (FCFA)</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor={Colors.textColors.disabled}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Note {entryCategory === 'divers' ? '*' : '(optionnelle)'}
                </Text>
                <TextInput
                  style={[styles.input, { height: 80 }]}
                  placeholder={
                    entryCategory === 'divers' ? 'Commentaire obligatoire...' : 'Description...'
                  }
                  placeholderTextColor={Colors.muted.foreground}
                  value={note}
                  onChangeText={setNote}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={styles.sheetCancelButton}
                  onPress={() => setShowEntryModal(false)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.sheetCancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sheetSubmitButton, { backgroundColor: Colors.success.main }]}
                  onPress={handleSubmitEntry}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.sheetSubmitButtonText}>Valider</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Exit Modal — sheet "Sortie de caisse" */}
      <Modal
        visible={showExitModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExitModal(false)}
      >
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <ScrollView
              contentContainerStyle={styles.sheetScroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.sheetTitle}>Sortie de caisse</Text>

              {/* Catégories */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Catégorie</Text>
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    style={[
                      styles.chip,
                      exitCategory === 'achats_marchandises' && styles.chipActive,
                    ]}
                    onPress={() => setExitCategory('achats_marchandises')}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        exitCategory === 'achats_marchandises' && styles.chipTextActive,
                      ]}
                    >
                      Achats
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.chip, exitCategory === 'loyers' && styles.chipActive]}
                    onPress={() => setExitCategory('loyers')}
                  >
                    <Text
                      style={[styles.chipText, exitCategory === 'loyers' && styles.chipTextActive]}
                    >
                      Loyers
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.chip,
                      exitCategory === 'reglement_fournisseur' && styles.chipActive,
                    ]}
                    onPress={() => setExitCategory('reglement_fournisseur')}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        exitCategory === 'reglement_fournisseur' && styles.chipTextActive,
                      ]}
                    >
                      Règl. fourn.
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.chip,
                      exitCategory === 'depenses_courantes' && styles.chipActive,
                    ]}
                    onPress={() => setExitCategory('depenses_courantes')}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        exitCategory === 'depenses_courantes' && styles.chipTextActive,
                      ]}
                    >
                      Dépenses
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.chip, exitCategory === 'divers' && styles.chipActive]}
                    onPress={() => setExitCategory('divers')}
                  >
                    <Text
                      style={[styles.chipText, exitCategory === 'divers' && styles.chipTextActive]}
                    >
                      Divers
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Payment mode selection for achats */}
              {exitCategory === 'achats_marchandises' && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Mode de paiement</Text>
                  <View style={styles.chipRow}>
                    <TouchableOpacity
                      style={[styles.chip, exitPaymentMode === 'cash' && styles.chipActive]}
                      onPress={() => {
                        setExitPaymentMode('cash');
                        setSelectedSupplierId('');
                      }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          exitPaymentMode === 'cash' && styles.chipTextActive,
                        ]}
                      >
                        Cash
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.chip, exitPaymentMode === 'credit' && styles.chipActive]}
                      onPress={() => setExitPaymentMode('credit')}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          exitPaymentMode === 'credit' && styles.chipTextActive,
                        ]}
                      >
                        Crédit
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Supplier selection for achat à crédit */}
              {exitCategory === 'achats_marchandises' && exitPaymentMode === 'credit' && (
                <View style={styles.formGroup}>
                  <SearchableSelect
                    label="Fournisseur *"
                    value={selectedSupplierId}
                    onValueChange={setSelectedSupplierId}
                    options={suppliers}
                    placeholder="Sélectionner un fournisseur (obligatoire pour achat à crédit)"
                  />
                </View>
              )}

              {/* Supplier selection for règlement fournisseur */}
              {exitCategory === 'reglement_fournisseur' && (
                <View style={styles.formGroup}>
                  <SearchableSelect
                    label="Fournisseur *"
                    value={selectedSupplierId}
                    onValueChange={setSelectedSupplierId}
                    options={suppliers}
                    placeholder="Sélectionner un fournisseur"
                  />
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Montant (FCFA)</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor={Colors.textColors.disabled}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Note {exitCategory === 'divers' ? '*' : '(optionnelle)'}
                </Text>
                <TextInput
                  style={[styles.input, { height: 80 }]}
                  placeholder={
                    exitCategory === 'divers' ? 'Commentaire obligatoire...' : 'Description...'
                  }
                  placeholderTextColor={Colors.muted.foreground}
                  value={note}
                  onChangeText={setNote}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={styles.sheetCancelButton}
                  onPress={() => setShowExitModal(false)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.sheetCancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sheetSubmitButton, { backgroundColor: Colors.danger.main }]}
                  onPress={handleSubmitExit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.sheetSubmitButtonText}>Valider</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  content: {
    padding: Spacing.lg,
    paddingBottom: 80,
    gap: Spacing.xl,
  },
  // --- Carte HERO marine ---
  heroCard: {
    backgroundColor: Colors.primary[900],
    borderRadius: 20,
    padding: Spacing.xl,
    ...Shadows.md,
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.accent,
    marginBottom: Spacing.xs,
  },
  heroAmount: {
    fontSize: 38,
    fontWeight: '800',
    color: Colors.onMarine,
    fontVariant: ['tabular-nums'],
  },
  heroAmountUnit: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.accent,
  },
  heroSummaryRow: {
    flexDirection: 'row',
    marginTop: Spacing.xl,
  },
  heroSummaryItem: {
    flex: 1,
  },
  heroSummaryLabel: {
    fontSize: 12,
    color: Colors.primary[300],
    marginBottom: Spacing.xs,
  },
  heroSummaryValue: {
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  // --- Boutons Entrée / Sortie ---
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  actionButtonIn: {
    backgroundColor: Colors.success.background,
  },
  actionButtonOut: {
    backgroundColor: Colors.danger.background,
  },
  actionIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  // --- Journal du jour ---
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  journalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  journalEmpty: {
    padding: Spacing['3xl'],
    alignItems: 'center',
  },
  journalEmptyText: {
    color: Colors.muted.foreground,
    fontSize: 14,
  },
  journalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  journalRowLast: {
    borderBottomWidth: 0,
  },
  journalIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journalInfo: {
    flex: 1,
  },
  journalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  journalSubtitle: {
    fontSize: 13,
    color: Colors.textColors.tertiary,
    marginTop: 2,
  },
  journalAmount: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  // --- Champs de formulaire (sheets) ---
  formGroup: {
    marginBottom: Spacing.lg,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
    color: Colors.text,
  },
  amountInput: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  // --- Bottom sheet ---
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.sheet,
    borderTopRightRadius: BorderRadius.sheet,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing.xl,
    maxHeight: '88%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderStrong,
    marginBottom: Spacing.lg,
  },
  sheetScroll: {
    paddingBottom: Spacing.sm,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  sheetCancelButton: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  sheetCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textColors.secondary,
  },
  sheetSubmitButton: {
    flex: 1.4,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSubmitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // --- Chips catégories ---
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.muted.main,
  },
  chipActive: {
    backgroundColor: Colors.action,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textColors.secondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  // --- Modal détail transaction ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: Spacing['2xl'],
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  detailsContainer: {
    gap: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.muted.foreground,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    flex: 2,
    textAlign: 'right',
  },
  detailAmount: {
    fontSize: 18,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  modalCloseButton: {
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.action,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary.foreground,
  },
});
