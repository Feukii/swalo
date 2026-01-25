import React, { useState, useEffect, useCallback } from 'react';
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
import { DollarSign, Plus, Minus } from '../components/icons/SimpleIcons';
import { ScreenHeader, KPICard, ListItem, SearchableSelect } from '../components/ui';
import { Colors, Spacing } from '../constants/theme-v2';
import { formatMoney, formatMoneyWithSign } from '../utils/money';
import { customersApi, suppliersApi, cashApi, receivablesApi, debtsApi } from '../lib/api';

// Interface pour les transactions de caisse (cash + crédit)
interface CashTransaction {
  id: string;
  type: 'IN' | 'OUT';
  category: string;
  amount: number;
  note?: string;
  created_at: string;
  customer_id?: string;
  customer?: { name: string; first_name?: string };
  supplier_id?: string;
  supplier?: { name: string; first_name?: string };
  cashier_id?: string;
  cashier?: { id: string; display_name: string };
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

export default function CashScreen({ navigation }: any) {
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
  const [customers, setCustomers] = useState<
    Array<{ id: string; name: string; first_name?: string }>
  >([]);

  // Exit categories and data
  const [exitCategory, setExitCategory] = useState<
    'achats_marchandises' | 'loyers' | 'reglement_fournisseur' | 'depenses_courantes' | 'divers'
  >('achats_marchandises');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [suppliers, setSuppliers] = useState<
    Array<{ id: string; name: string; first_name?: string }>
  >([]);

  // Payment mode states for sales/purchases
  const [entryPaymentMode, setEntryPaymentMode] = useState<'cash' | 'credit'>('cash');
  const [exitPaymentMode, setExitPaymentMode] = useState<'cash' | 'credit'>('cash');

  const loadCashData = async () => {
    try {
      // Calculer les dates pour aujourd'hui
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      // Récupérer les stats, transactions cash, créances et dettes du jour
      const [statsData, transactionsData, receivablesData, debtsData] = await Promise.all([
        cashApi.getStats({
          start_date: startOfDay.toISOString(),
          end_date: endOfDay.toISOString(),
        }),
        cashApi.getAll({
          start_date: startOfDay.toISOString(),
          end_date: endOfDay.toISOString(),
        }),
        receivablesApi.getAll(),
        debtsApi.getAll(),
      ]);

      const transactions: CashTransaction[] = [];

      // Ajouter les transactions cash
      if (Array.isArray(transactionsData)) {
        transactionsData.forEach((entry: any) => {
          const entryDate = new Date(entry.created_at);
          if (entryDate >= startOfDay && entryDate <= endOfDay) {
            transactions.push({ ...entry, isCredit: false });
          }
        });
      }

      // Ajouter les ventes à crédit (créances créées aujourd'hui)
      if (Array.isArray(receivablesData)) {
        receivablesData.forEach((receivable: any) => {
          const entryDate = new Date(receivable.created_at);
          if (entryDate >= startOfDay && entryDate <= endOfDay) {
            transactions.push({
              id: `receivable_${receivable.id}`,
              type: 'IN',
              category: 'vente_credit',
              amount: receivable.amount,
              note: receivable.description || 'Vente à crédit',
              created_at: receivable.created_at,
              customer_id: receivable.customer_id,
              customer: receivable.customer,
              isCredit: true,
            });
          }
        });
      }

      // Ajouter les achats à crédit (dettes créées aujourd'hui)
      if (Array.isArray(debtsData)) {
        debtsData.forEach((debt: any) => {
          const entryDate = new Date(debt.created_at);
          if (entryDate >= startOfDay && entryDate <= endOfDay) {
            transactions.push({
              id: `debt_${debt.id}`,
              type: 'OUT',
              category: 'achat_credit',
              amount: debt.amount,
              note: debt.description || 'Achat à crédit',
              created_at: debt.created_at,
              supplier_id: debt.supplier_id,
              supplier: debt.supplier,
              isCredit: true,
            });
          }
        });
      }

      // Trier par date décroissante (plus récent en premier)
      transactions.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setCashStats({
        balance: statsData?.balance || 0,
        entries: statsData?.todayEntries || 0,
        exits: statsData?.todayExits || 0,
        net: statsData?.todayNet || 0,
        // KPIs ventes par mode
        totalSales: statsData?.totalSales || 0,
        salesCash: statsData?.salesCash || 0,
        salesCredit: statsData?.salesCredit || 0,
        // KPIs achats par mode
        totalPurchases: statsData?.totalPurchases || 0,
        purchasesCash: statsData?.purchasesCash || 0,
        purchasesCredit: statsData?.purchasesCredit || 0,
      });

      setTodayTransactions(transactions);
    } catch (error) {
      console.error('Erreur chargement caisse:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await customersApi.getAll();
      setCustomers(data);
    } catch (error) {
      console.error('Erreur chargement clients:', error);
      setCustomers([]);
    }
  };

  const loadSuppliers = async () => {
    try {
      const data = await suppliersApi.getAll();
      setSuppliers(data);
    } catch (error) {
      console.error('Erreur chargement fournisseurs:', error);
      setSuppliers([]);
    }
  };

  useEffect(() => {
    loadCashData();
  }, []);

  // Recharger les données quand l'écran est focus (ex: retour depuis l'écran de vente)
  useFocusEffect(
    useCallback(() => {
      loadCashData();
    }, [])
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

  const getPaymentMethodLabel = (method?: string) => {
    const labels = {
      cash: 'Espèces',
      credit: 'À crédit',
    };
    return method ? labels[method as keyof typeof labels] || method : 'N/A';
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
        // Créer une créance client (receivable)
        await receivablesApi.create({
          customer_id: selectedCustomerId,
          amount: amountValue,
          description: note || 'Vente à crédit',
        });
        Alert.alert('Succès', 'Vente à crédit enregistrée');
      } else if (entryCategory === 'remboursement_client') {
        // Remboursement client : le client nous paye (réduit sa dette)
        // On crée une créance NÉGATIVE pour réduire le solde
        const customer = customers.find(c => c.id === selectedCustomerId);
        const customerName = customer
          ? `${customer.first_name || ''} ${customer.name}`.trim()
          : 'Client';

        // Récupérer le solde actuel
        const fullCustomer = await customersApi.getOne(selectedCustomerId);
        const currentBalance = fullCustomer.stats?.total_balance || 0;

        // Créer une créance négative (réduit le solde)
        // Le backend définira automatiquement status='PAID' pour les montants négatifs
        await receivablesApi.create({
          customer_id: selectedCustomerId,
          amount: -amountValue, // Montant négatif pour réduire le solde
          description: note || `Paiement reçu de ${customerName}`,
        });

        // Calculer le nouveau solde
        const newBalance = currentBalance - amountValue;

        // Message selon le résultat - clair sur qui doit quoi
        let message: string;
        if (newBalance > 0) {
          message = `Paiement de ${formatMoney(amountValue)} enregistré.\n\nNouveau solde: ${formatMoney(newBalance)}\n(Le client nous doit encore ${formatMoney(newBalance)})`;
        } else if (newBalance < 0) {
          message = `Paiement de ${formatMoney(amountValue)} enregistré.\n\n⚠️ REMBOURSEMENT DÛ AU CLIENT\nMontant à rendre: ${formatMoney(Math.abs(newBalance))}\n\nLe client a payé ${formatMoney(Math.abs(newBalance))} de plus que sa dette.`;
        } else {
          message = `Paiement de ${formatMoney(amountValue)} enregistré.\n\n✅ La dette est totalement soldée!`;
        }

        Alert.alert('Succès', message);

        // Créer l'entrée de caisse pour le suivi de trésorerie
        await cashApi.createEntry({
          type: 'IN',
          category: entryCategory,
          amount: amountValue,
          note: note || `Paiement reçu de ${customerName}`,
          customer_id: selectedCustomerId,
        });
      } else {
        // Entrée de caisse normale (cash)
        await cashApi.createEntry({
          type: 'IN',
          category: entryCategory,
          amount: amountValue,
          note: note || (entryCategory === 'ventes' ? 'Vente (Cash)' : 'Entrée divers'),
          customer_id: undefined,
        });
        Alert.alert('Succès', 'Entrée enregistrée avec succès');
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
      Alert.alert('Erreur', "Impossible d'enregistrer l'entrée");
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

    const exitAmount = parseFloat(amount);
    const currentBalance = cashStats.balance || 0;

    // Validation du solde: seulement si paiement en cash (pas pour crédit)
    if (exitPaymentMode === 'cash' && exitAmount > currentBalance) {
      Alert.alert(
        'Solde insuffisant',
        `Impossible de retirer ${formatMoney(exitAmount)}.\nSolde actuel de la caisse: ${formatMoney(currentBalance)}`
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
        // Créer une dette fournisseur (debt)
        await debtsApi.create({
          supplier_id: selectedSupplierId,
          amount: exitAmount,
          description: note || 'Achat à crédit',
        });
        Alert.alert('Succès', 'Achat à crédit enregistré');
      } else if (exitCategory === 'reglement_fournisseur') {
        // Règlement fournisseur : on paye le fournisseur (réduit notre dette)
        // On crée une dette NÉGATIVE pour réduire le solde
        const supplier = suppliers.find(s => s.id === selectedSupplierId);
        const supplierName = supplier
          ? `${supplier.first_name || ''} ${supplier.name}`.trim()
          : 'Fournisseur';

        // Récupérer le solde actuel
        const fullSupplier = await suppliersApi.getOne(selectedSupplierId);
        const currentBalance = fullSupplier.stats?.total_balance || 0;

        // Créer une dette négative (réduit le solde)
        await debtsApi.create({
          supplier_id: selectedSupplierId,
          amount: -exitAmount, // Montant négatif pour réduire le solde
          description: note || `Paiement à ${supplierName}`,
        });

        // Calculer le nouveau solde
        const newBalance = currentBalance - exitAmount;

        // Message selon le résultat
        const message =
          newBalance > 0
            ? `Règlement de ${formatMoney(exitAmount)} enregistré.\nNouveau solde: ${formatMoney(newBalance)}`
            : newBalance < 0
              ? `Règlement de ${formatMoney(exitAmount)} enregistré.\nNouveau solde: -${formatMoney(Math.abs(newBalance))}\n⚠️ Le fournisseur ${supplierName} doit vous rembourser ${formatMoney(Math.abs(newBalance))}.`
              : `Règlement de ${formatMoney(exitAmount)} enregistré.\nLa dette est totalement remboursée!`;

        Alert.alert('Succès', message);

        // Créer la sortie de caisse pour le suivi de trésorerie
        await cashApi.createEntry({
          type: 'OUT',
          category: exitCategory,
          amount: exitAmount,
          note: note || `Paiement à ${supplierName}`,
          supplier_id: selectedSupplierId,
        });
      } else {
        // Sortie de caisse normale (cash)
        await cashApi.createEntry({
          type: 'OUT',
          category: exitCategory,
          amount: exitAmount,
          note: note || getCategoryExitLabel(exitCategory),
          supplier_id: undefined,
        });
        Alert.alert('Succès', 'Sortie enregistrée avec succès');
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
      <ScreenHeader title="Caisse" />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Solde Header */}
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceLabel}>Solde de caisse</Text>
          <Text style={styles.balanceAmount}>{formatMoney(cashStats.balance)}</Text>
        </View>

        {/* Bloc Entrées/Sorties/Net du jour */}
        <View style={styles.dailySummaryCard}>
          <View style={styles.dailySummaryRow}>
            <View style={styles.dailySummaryItem}>
              <Text style={styles.dailySummaryLabel}>Entrées du jour</Text>
              <Text style={[styles.dailySummaryValue, { color: Colors.success.main }]}>
                +{formatMoney(cashStats.entries)}
              </Text>
            </View>
            <View style={styles.dailySummaryDivider} />
            <View style={styles.dailySummaryItem}>
              <Text style={styles.dailySummaryLabel}>Sorties du jour</Text>
              <Text style={[styles.dailySummaryValue, { color: Colors.danger.main }]}>
                -{formatMoney(cashStats.exits)}
              </Text>
            </View>
          </View>
          <View style={styles.dailySummaryNetRow}>
            <Text style={styles.dailySummaryNetLabel}>Net du jour</Text>
            <Text
              style={[
                styles.dailySummaryNetValue,
                { color: cashStats.net >= 0 ? Colors.success.main : Colors.danger.main },
              ]}
            >
              {cashStats.net >= 0 ? '+' : '-'}
              {formatMoney(Math.abs(cashStats.net))}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors.success.main }]}
            onPress={handleOpenEntryModal}
          >
            <Plus size={20} color={Colors.primary.foreground} />
            <Text style={styles.actionButtonText}>Entrée</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors.danger.main }]}
            onPress={handleOpenExitModal}
          >
            <Minus size={20} color={Colors.primary.foreground} />
            <Text style={styles.actionButtonText}>Sortie</Text>
          </TouchableOpacity>
        </View>

        {/* Journal du jour */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Journal du jour</Text>
          </View>
          <View>
            {todayTransactions.length === 0 ? (
              <View style={{ padding: Spacing['3xl'], alignItems: 'center' }}>
                <Text style={{ color: Colors.muted.foreground, fontSize: 14 }}>
                  Aucune transaction aujourd'hui
                </Text>
              </View>
            ) : (
              todayTransactions.map(transaction => {
                // Construire le nom du client/fournisseur
                const personName = transaction.customer
                  ? transaction.customer.first_name
                    ? `${transaction.customer.first_name} ${transaction.customer.name}`
                    : transaction.customer.name
                  : transaction.supplier
                    ? transaction.supplier.first_name
                      ? `${transaction.supplier.first_name} ${transaction.supplier.name}`
                      : transaction.supplier.name
                    : '';

                // Construire le sous-titre avec heure, personne et caissier
                const cashierName = transaction.cashier?.display_name;
                const subtitle = `${formatTransactionTime(transaction.created_at)}${personName ? ` - ${personName}` : ''}${cashierName ? ` (${cashierName})` : ''}${transaction.note ? ` - ${transaction.note}` : ''}`;

                // Couleur différente pour les transactions à crédit
                const amountColor = transaction.isCredit
                  ? 'warning'
                  : transaction.type === 'IN'
                    ? 'success'
                    : 'danger';

                return (
                  <ListItem
                    key={transaction.id}
                    icon={
                      <DollarSign
                        size={20}
                        color={transaction.isCredit ? Colors.warning.main : Colors.primary[900]}
                      />
                    }
                    title={getCategoryLabel(transaction.category, transaction.isCredit)}
                    subtitle={subtitle}
                    amount={
                      transaction.type === 'IN'
                        ? `+${formatMoney(transaction.amount)}`
                        : `-${formatMoney(transaction.amount)}`
                    }
                    amountColor={amountColor}
                    onClick={() => handleTransactionClick(transaction)}
                  />
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

                {selectedTransaction.customer && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Client</Text>
                    <Text style={styles.detailValue}>
                      {selectedTransaction.customer.first_name
                        ? `${selectedTransaction.customer.first_name} ${selectedTransaction.customer.name}`
                        : selectedTransaction.customer.name}
                    </Text>
                  </View>
                )}

                {selectedTransaction.supplier && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Fournisseur</Text>
                    <Text style={styles.detailValue}>
                      {selectedTransaction.supplier.first_name
                        ? `${selectedTransaction.supplier.first_name} ${selectedTransaction.supplier.name}`
                        : selectedTransaction.supplier.name}
                    </Text>
                  </View>
                )}

                {selectedTransaction.cashier && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Enregistré par</Text>
                    <Text style={styles.detailValue}>
                      {selectedTransaction.cashier.display_name}
                    </Text>
                  </View>
                )}

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

      {/* Entry Modal */}
      <Modal
        visible={showEntryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEntryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Entrée de caisse</Text>

              {/* Catégories */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Catégorie</Text>
                <View style={styles.categoryGrid}>
                  <TouchableOpacity
                    style={[
                      styles.categoryButton,
                      entryCategory === 'ventes' && styles.categoryButtonActive,
                    ]}
                    onPress={() => setEntryCategory('ventes')}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        entryCategory === 'ventes' && styles.categoryButtonTextActive,
                      ]}
                    >
                      Ventes
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.categoryButton,
                      entryCategory === 'remboursement_client' && styles.categoryButtonActive,
                    ]}
                    onPress={() => setEntryCategory('remboursement_client')}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        entryCategory === 'remboursement_client' && styles.categoryButtonTextActive,
                      ]}
                    >
                      Remb. client
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.categoryButton,
                      entryCategory === 'divers' && styles.categoryButtonActive,
                    ]}
                    onPress={() => setEntryCategory('divers')}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        entryCategory === 'divers' && styles.categoryButtonTextActive,
                      ]}
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
                  <View style={styles.categoryGrid}>
                    <TouchableOpacity
                      style={[
                        styles.categoryButton,
                        entryPaymentMode === 'cash' && styles.categoryButtonActive,
                      ]}
                      onPress={() => {
                        setEntryPaymentMode('cash');
                        setSelectedCustomerId('');
                      }}
                    >
                      <Text
                        style={[
                          styles.categoryButtonText,
                          entryPaymentMode === 'cash' && styles.categoryButtonTextActive,
                        ]}
                      >
                        Cash
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.categoryButton,
                        entryPaymentMode === 'credit' && styles.categoryButtonActive,
                      ]}
                      onPress={() => setEntryPaymentMode('credit')}
                    >
                      <Text
                        style={[
                          styles.categoryButtonText,
                          entryPaymentMode === 'credit' && styles.categoryButtonTextActive,
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
                <Text style={styles.formLabel}>Montant (FCFA) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={Colors.muted.foreground}
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

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowEntryModal(false)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.modalCancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitButton, { backgroundColor: Colors.success.main }]}
                  onPress={handleSubmitEntry}
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
          </ScrollView>
        </View>
      </Modal>

      {/* Exit Modal */}
      <Modal
        visible={showExitModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Sortie de caisse</Text>

              {/* Catégories */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Catégorie</Text>
                <View style={styles.categoryGrid}>
                  <TouchableOpacity
                    style={[
                      styles.categoryButton,
                      exitCategory === 'achats_marchandises' && styles.categoryButtonActive,
                    ]}
                    onPress={() => setExitCategory('achats_marchandises')}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        exitCategory === 'achats_marchandises' && styles.categoryButtonTextActive,
                      ]}
                    >
                      Achats
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.categoryButton,
                      exitCategory === 'loyers' && styles.categoryButtonActive,
                    ]}
                    onPress={() => setExitCategory('loyers')}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        exitCategory === 'loyers' && styles.categoryButtonTextActive,
                      ]}
                    >
                      Loyers
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.categoryButton,
                      exitCategory === 'reglement_fournisseur' && styles.categoryButtonActive,
                    ]}
                    onPress={() => setExitCategory('reglement_fournisseur')}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        exitCategory === 'reglement_fournisseur' && styles.categoryButtonTextActive,
                      ]}
                    >
                      Règl. fourn.
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.categoryButton,
                      exitCategory === 'depenses_courantes' && styles.categoryButtonActive,
                    ]}
                    onPress={() => setExitCategory('depenses_courantes')}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        exitCategory === 'depenses_courantes' && styles.categoryButtonTextActive,
                      ]}
                    >
                      Dépenses
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.categoryButton,
                      exitCategory === 'divers' && styles.categoryButtonActive,
                    ]}
                    onPress={() => setExitCategory('divers')}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        exitCategory === 'divers' && styles.categoryButtonTextActive,
                      ]}
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
                  <View style={styles.categoryGrid}>
                    <TouchableOpacity
                      style={[
                        styles.categoryButton,
                        exitPaymentMode === 'cash' && styles.categoryButtonActive,
                      ]}
                      onPress={() => {
                        setExitPaymentMode('cash');
                        setSelectedSupplierId('');
                      }}
                    >
                      <Text
                        style={[
                          styles.categoryButtonText,
                          exitPaymentMode === 'cash' && styles.categoryButtonTextActive,
                        ]}
                      >
                        Cash
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.categoryButton,
                        exitPaymentMode === 'credit' && styles.categoryButtonActive,
                      ]}
                      onPress={() => setExitPaymentMode('credit')}
                    >
                      <Text
                        style={[
                          styles.categoryButtonText,
                          exitPaymentMode === 'credit' && styles.categoryButtonTextActive,
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
                <Text style={styles.formLabel}>Montant (FCFA) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={Colors.muted.foreground}
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

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowExitModal(false)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.modalCancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitButton, { backgroundColor: Colors.danger.main }]}
                  onPress={handleSubmitExit}
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
          </ScrollView>
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
    gap: Spacing['2xl'],
  },
  balanceHeader: {
    backgroundColor: Colors.primary[900],
    padding: Spacing['3xl'],
    borderRadius: 18,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: Colors.primary.foreground,
    marginBottom: Spacing.sm,
    opacity: 0.9,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.primary.foreground,
    fontVariant: ['tabular-nums'],
  },
  dailySummaryCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    overflow: 'hidden',
  },
  dailySummaryRow: {
    flexDirection: 'row',
    padding: Spacing.lg,
  },
  dailySummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  dailySummaryDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
  },
  dailySummaryLabel: {
    fontSize: 12,
    color: Colors.muted.foreground,
    marginBottom: Spacing.xs,
  },
  dailySummaryValue: {
    fontSize: 18,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  dailySummaryNetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  dailySummaryNetLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  dailySummaryNetValue: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
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
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  quickAccessRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  quickAccessButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  quickAccessIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAccessText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
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
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
    color: Colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: Colors.muted.main,
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  modalSubmitButton: {
    flex: 1,
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  modalSubmitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary.foreground,
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
  cardSubtitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primary[900],
    marginTop: Spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  kpiBreakdownRow: {
    flexDirection: 'row',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  kpiBreakdownItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  kpiBreakdownLabel: {
    fontSize: 12,
    color: Colors.muted.foreground,
    marginBottom: Spacing.xs,
  },
  kpiBreakdownValue: {
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
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
  detailSection: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 12,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  saleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  saleItemName: {
    fontSize: 14,
    color: Colors.text,
  },
  saleItemQuantity: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.muted.foreground,
  },
  modalCloseButton: {
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.primary[900],
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary.foreground,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: Spacing['2xl'],
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  categoryButtonActive: {
    backgroundColor: Colors.primary[900],
    borderColor: Colors.primary[900],
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  categoryButtonTextActive: {
    color: Colors.primary.foreground,
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
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.muted.foreground,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary.main,
    borderColor: Colors.primary.main,
  },
  checkboxCheck: {
    color: Colors.primary.foreground,
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  helpText: {
    fontSize: 13,
    color: Colors.muted.foreground,
    marginLeft: 36,
    fontStyle: 'italic',
  },
});
