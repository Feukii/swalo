import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DollarSign, Receipt, Filter } from '../components/icons/SimpleIcons';
import { ScreenHeader, ListItem, TransactionDetailModal } from '../components/ui';
import DateRangePicker from '../components/ui/DateRangePicker';
import { Colors, Spacing, Shadows } from '../constants/theme-v2';
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
import type { RootStackParamList } from '../../App';

interface Transaction {
  id: string;
  type: 'IN' | 'OUT';
  category: string;
  amount: number;
  note?: string;
  created_at: string;
  customer_id?: string;
  supplier_id?: string;
  isCredit?: boolean;
}

// Forme attendue par TransactionDetailModal
interface TransactionDetail {
  type: string;
  date: string;
  amount: number;
  note?: string;
  status?: string;
  paymentMethod?: string;
  isCredit?: boolean;
  category?: string;
  items?: Array<{ productName: string; quantity: number }>;
  customerName?: string;
  supplierName?: string;
}

type Period = 'today' | 'week' | 'month' | 'year' | 'all';
type TransactionType = 'all' | 'IN' | 'OUT';
type CategoryFilter =
  | 'all'
  | 'ventes'
  | 'achats_marchandises'
  | 'remboursement_client'
  | 'reglement_fournisseur'
  | 'loyers'
  | 'depenses_courantes'
  | 'divers';

const CATEGORY_LABELS: Record<string, string> = {
  all: 'Toutes',
  ventes: 'Ventes',
  vente_credit: 'Vente à crédit',
  achat_credit: 'Achat à crédit',
  achats_marchandises: 'Achats marchandises',
  remboursement_client: 'Remb. client',
  reglement_fournisseur: 'Règl. fournisseur',
  loyers: 'Loyers',
  depenses_courantes: 'Dépenses courantes',
  divers: 'Divers',
};

interface TransactionHistoryScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TransactionHistory'>;
}

export default function TransactionHistoryScreen({ navigation }: TransactionHistoryScreenProps) {
  const { shopId } = useCurrentUser();
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('month');
  const [selectedType, setSelectedType] = useState<TransactionType>('all');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Date range filter
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [datesWithData, setDatesWithData] = useState<string[]>([]);

  // Transaction detail
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionDetail | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Local lookup data
  const [customersMap, setCustomersMap] = useState<Map<string, LocalCustomer>>(new Map());
  const [suppliersMap, setSuppliersMap] = useState<Map<string, LocalSupplier>>(new Map());

  // Stats
  const [stats, setStats] = useState({
    totalIn: 0,
    totalOut: 0,
    count: 0,
  });

  const getPeriodDates = useCallback((): { start: Date; end: Date } => {
    // Si des dates personnalisées sont sélectionnées, les utiliser
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const start = new Date();

    switch (selectedPeriod) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case 'month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
      case 'year':
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        break;
      case 'all':
        start.setFullYear(2020, 0, 1);
        start.setHours(0, 0, 0, 0);
        break;
    }

    return { start, end };
  }, [startDate, endDate, selectedPeriod]);

  const loadTransactions = useCallback(async () => {
    if (!shopId) return;
    try {
      setIsLoading(true);
      const { start, end } = getPeriodDates();
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      // Load local data
      const allCashEntries = await cashEntryRepo.getAll(shopId, { orderBy: 'created_at DESC' });
      const allReceivables = await clientReceivableRepo.getAll(shopId);
      const allDebts = await supplierDebtRepo.getAll(shopId);

      // Load customer/supplier lookup maps
      const localCustomers = await customerRepo.getAll(shopId);
      const localSuppliers = await supplierRepo.getAll(shopId);
      const cMap = new Map<string, LocalCustomer>();
      localCustomers.forEach(c => cMap.set(c.id, c));
      setCustomersMap(cMap);
      const sMap = new Map<string, LocalSupplier>();
      localSuppliers.forEach(s => sMap.set(s.id, s));
      setSuppliersMap(sMap);

      const allTransactions: Transaction[] = [];

      // Filter cash entries by date range
      allCashEntries.forEach(entry => {
        if (entry.created_at >= startISO && entry.created_at <= endISO) {
          allTransactions.push({
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
        }
      });

      // Ajouter les ventes à crédit (créances)
      allReceivables.forEach(receivable => {
        if (
          receivable.amount > 0 &&
          receivable.created_at >= startISO &&
          receivable.created_at <= endISO
        ) {
          allTransactions.push({
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

      // Ajouter les achats à crédit (dettes)
      allDebts.forEach(debt => {
        if (debt.amount > 0 && debt.created_at >= startISO && debt.created_at <= endISO) {
          allTransactions.push({
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

      // Trier par date décroissante
      allTransactions.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setTransactions(allTransactions);

      // Extraire les dates uniques avec données pour le calendrier
      const uniqueDates = new Set<string>();
      allTransactions.forEach(t => {
        const date = new Date(t.created_at);
        const dateKey = date.toISOString().split('T')[0];
        uniqueDates.add(dateKey);
      });
      setDatesWithData(Array.from(uniqueDates));
    } catch (error) {
      console.error('Erreur chargement transactions:', error);
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [shopId, getPeriodDates]);

  // Filtrer les transactions selon les critères sélectionnés
  useEffect(() => {
    let filtered = [...transactions];

    // Filtre par type
    if (selectedType !== 'all') {
      filtered = filtered.filter(t => t.type === selectedType);
    }

    // Filtre par catégorie
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => {
        // Gérer les catégories crédit
        if (selectedCategory === 'ventes') {
          return t.category === 'ventes' || t.category === 'vente_credit';
        }
        if (selectedCategory === 'achats_marchandises') {
          return t.category === 'achats_marchandises' || t.category === 'achat_credit';
        }
        return t.category === selectedCategory;
      });
    }

    setFilteredTransactions(filtered);

    // Calculer les stats
    const totalIn = filtered.filter(t => t.type === 'IN').reduce((sum, t) => sum + t.amount, 0);
    const totalOut = filtered.filter(t => t.type === 'OUT').reduce((sum, t) => sum + t.amount, 0);
    setStats({
      totalIn,
      totalOut,
      count: filtered.length,
    });
  }, [transactions, selectedType, selectedCategory]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [loadTransactions])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  const getCategoryLabel = (category: string, isCredit?: boolean): string => {
    if (isCredit && !category.includes('credit')) {
      return `${CATEGORY_LABELS[category] || category} (Crédit)`;
    }
    return CATEGORY_LABELS[category] || category;
  };

  const formatDate = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPeriodLabel = (period: Period) => {
    switch (period) {
      case 'today':
        return 'Jour';
      case 'week':
        return 'Semaine';
      case 'month':
        return 'Mois';
      case 'year':
        return 'Année';
      case 'all':
        return 'Tout';
    }
  };

  const getPersonName = (id?: string, type?: 'customer' | 'supplier'): string | undefined => {
    if (!id) return undefined;
    if (type === 'customer') {
      const c = customersMap.get(id);
      return c ? `${c.first_name || ''} ${c.name}`.trim() : undefined;
    }
    const s = suppliersMap.get(id);
    return s ? `${s.first_name || ''} ${s.name}`.trim() : undefined;
  };

  const handleTransactionClick = (transaction: Transaction) => {
    const customerName = getPersonName(transaction.customer_id, 'customer');
    const supplierName = getPersonName(transaction.supplier_id, 'supplier');

    setSelectedTransaction({
      type: transaction.type === 'IN' ? 'entry' : 'exit',
      date: transaction.created_at,
      amount: transaction.type === 'IN' ? transaction.amount : -transaction.amount,
      note: transaction.note,
      isCredit: transaction.isCredit,
      category: transaction.category,
      customerName,
      supplierName,
    });
    setShowDetailModal(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Historique" showBack onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Date Range Picker */}
        <View style={styles.datePickerContainer}>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onDateChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
              // Réinitialiser le filtre de période prédéfini
              if (start || end) {
                setSelectedPeriod('all');
              }
            }}
            datesWithData={datesWithData}
          />
        </View>

        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {(['today', 'week', 'month', 'year', 'all'] as Period[]).map(period => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodButton,
                selectedPeriod === period && !startDate && !endDate && styles.periodButtonActive,
              ]}
              onPress={() => {
                setSelectedPeriod(period);
                setStartDate(null);
                setEndDate(null);
              }}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  selectedPeriod === period &&
                    !startDate &&
                    !endDate &&
                    styles.periodButtonTextActive,
                ]}
              >
                {getPeriodLabel(period)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Filters */}
        <View style={styles.quickFilters}>
          <TouchableOpacity
            style={[styles.typeButton, selectedType === 'all' && styles.typeButtonActive]}
            onPress={() => setSelectedType('all')}
          >
            <Text
              style={[styles.typeButtonText, selectedType === 'all' && styles.typeButtonTextActive]}
            >
              Tout
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, selectedType === 'IN' && styles.typeButtonActiveGreen]}
            onPress={() => setSelectedType('IN')}
          >
            <Text
              style={[styles.typeButtonText, selectedType === 'IN' && styles.typeButtonTextActive]}
            >
              Entrées
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, selectedType === 'OUT' && styles.typeButtonActiveRed]}
            onPress={() => setSelectedType('OUT')}
          >
            <Text
              style={[styles.typeButtonText, selectedType === 'OUT' && styles.typeButtonTextActive]}
            >
              Sorties
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilterModal(true)}>
            <Filter size={20} color={Colors.action} />
          </TouchableOpacity>
        </View>

        {/* Stats Summary */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Entrées</Text>
            <Text style={[styles.statValue, { color: Colors.success.main }]}>
              +{formatMoney(stats.totalIn)}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Sorties</Text>
            <Text style={[styles.statValue, { color: Colors.danger.main }]}>
              -{formatMoney(stats.totalOut)}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Transactions</Text>
            <Text style={styles.statValue}>{stats.count}</Text>
          </View>
        </View>

        {/* Active category filter badge */}
        {selectedCategory !== 'all' && (
          <View style={styles.activeFilterBadge}>
            <Text style={styles.activeFilterText}>
              Catégorie: {CATEGORY_LABELS[selectedCategory]}
            </Text>
            <TouchableOpacity onPress={() => setSelectedCategory('all')}>
              <Text style={styles.clearFilterText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Transaction List */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Transactions ({filteredTransactions.length})</Text>
          </View>
          <View>
            {filteredTransactions.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {isLoading ? 'Chargement...' : 'Aucune transaction trouvée'}
                </Text>
              </View>
            ) : (
              filteredTransactions.map(transaction => {
                const personName =
                  getPersonName(transaction.customer_id, 'customer') ||
                  getPersonName(transaction.supplier_id, 'supplier') ||
                  '';

                const amountColor = transaction.isCredit
                  ? 'warning'
                  : transaction.type === 'IN'
                    ? 'success'
                    : 'danger';

                return (
                  <ListItem
                    key={transaction.id}
                    icon={
                      transaction.type === 'IN' ? (
                        <Receipt
                          size={20}
                          color={transaction.isCredit ? Colors.warning.main : Colors.success.main}
                        />
                      ) : (
                        <DollarSign
                          size={20}
                          color={transaction.isCredit ? Colors.warning.main : Colors.danger.main}
                        />
                      )
                    }
                    title={getCategoryLabel(transaction.category, transaction.isCredit)}
                    subtitle={`${formatDate(transaction.created_at)}${personName ? ` - ${personName}` : ''}`}
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

      {/* Category Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filtrer par catégorie</Text>

            <View style={styles.categoryList}>
              {(
                [
                  'all',
                  'ventes',
                  'achats_marchandises',
                  'remboursement_client',
                  'reglement_fournisseur',
                  'loyers',
                  'depenses_courantes',
                  'divers',
                ] as CategoryFilter[]
              ).map(category => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryOption,
                    selectedCategory === category && styles.categoryOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedCategory(category);
                    setShowFilterModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.categoryOptionText,
                      selectedCategory === category && styles.categoryOptionTextActive,
                    ]}
                  >
                    {CATEGORY_LABELS[category]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowFilterModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Fermer</Text>
            </TouchableOpacity>
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
  content: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  datePickerContainer: {
    marginBottom: Spacing.md,
  },
  periodSelector: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  periodButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: Colors.action,
    borderColor: Colors.action,
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  periodButtonTextActive: {
    color: Colors.onMarine,
  },
  quickFilters: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  typeButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: Colors.action,
    borderColor: Colors.action,
  },
  typeButtonActiveGreen: {
    backgroundColor: Colors.success.main,
    borderColor: Colors.success.main,
  },
  typeButtonActiveRed: {
    backgroundColor: Colors.danger.main,
    borderColor: Colors.danger.main,
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  typeButtonTextActive: {
    color: Colors.onMarine,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.sm,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.muted.foreground,
    marginBottom: Spacing.xs,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  activeFilterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.info.background,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  activeFilterText: {
    fontSize: 13,
    color: Colors.action,
    fontWeight: '600',
  },
  clearFilterText: {
    fontSize: 16,
    color: Colors.action,
    fontWeight: '600',
    paddingLeft: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  cardHeader: {
    padding: Spacing.lg,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyState: {
    padding: Spacing['3xl'],
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.muted.foreground,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing['2xl'],
    width: '90%',
    maxWidth: 400,
    ...Shadows.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  categoryList: {
    gap: Spacing.sm,
  },
  categoryOption: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
  },
  categoryOptionActive: {
    backgroundColor: Colors.action,
    borderColor: Colors.action,
  },
  categoryOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    textAlign: 'center',
  },
  categoryOptionTextActive: {
    color: Colors.onMarine,
  },
  modalCloseButton: {
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.muted.main,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
});
