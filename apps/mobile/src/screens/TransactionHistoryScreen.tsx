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
import { DollarSign, Receipt, Filter } from '../components/icons/SimpleIcons';
import { ScreenHeader, ListItem, TransactionDetailModal } from '../components/ui';
import DateRangePicker from '../components/ui/DateRangePicker';
import { Colors, Spacing } from '../constants/theme-v2';
import { formatMoney } from '../utils/money';
import { cashApi, receivablesApi, debtsApi } from '../lib/api';

interface Transaction {
  id: string;
  type: 'IN' | 'OUT';
  category: string;
  amount: number;
  note?: string;
  created_at: string;
  customer?: { name: string; first_name?: string };
  supplier?: { name: string; first_name?: string };
  isCredit?: boolean;
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

export default function TransactionHistoryScreen({ navigation }: any) {
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
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    totalIn: 0,
    totalOut: 0,
    count: 0,
  });

  const getPeriodDates = (): { start: Date; end: Date } => {
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
  };

  const loadTransactions = async () => {
    try {
      setIsLoading(true);
      const { start, end } = getPeriodDates();

      // Récupérer les transactions cash et les créances/dettes
      const [cashData, receivablesData, debtsData] = await Promise.all([
        cashApi.getAll({
          start_date: start.toISOString(),
          end_date: end.toISOString(),
        }),
        receivablesApi.getAll(),
        debtsApi.getAll(),
      ]);

      const allTransactions: Transaction[] = [];

      // Ajouter les transactions cash
      if (Array.isArray(cashData)) {
        cashData.forEach((entry: any) => {
          const entryDate = new Date(entry.created_at);
          if (entryDate >= start && entryDate <= end) {
            allTransactions.push({
              ...entry,
              isCredit: false,
            });
          }
        });
      }

      // Ajouter les ventes à crédit (créances)
      if (Array.isArray(receivablesData)) {
        receivablesData.forEach((receivable: any) => {
          const createdDate = new Date(receivable.created_at);
          if (createdDate >= start && createdDate <= end) {
            allTransactions.push({
              id: `receivable_${receivable.id}`,
              type: 'IN',
              category: 'vente_credit',
              amount: receivable.amount,
              note: receivable.description || 'Vente à crédit',
              created_at: receivable.created_at,
              customer: receivable.customer,
              isCredit: true,
            });
          }
        });
      }

      // Ajouter les achats à crédit (dettes)
      if (Array.isArray(debtsData)) {
        debtsData.forEach((debt: any) => {
          const createdDate = new Date(debt.created_at);
          if (createdDate >= start && createdDate <= end) {
            allTransactions.push({
              id: `debt_${debt.id}`,
              type: 'OUT',
              category: 'achat_credit',
              amount: debt.amount,
              note: debt.description || 'Achat à crédit',
              created_at: debt.created_at,
              supplier: debt.supplier,
              isCredit: true,
            });
          }
        });
      }

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
  };

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
  }, [selectedPeriod]);

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [selectedPeriod])
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

  const handleTransactionClick = (transaction: Transaction) => {
    const customerName = transaction.customer
      ? transaction.customer.first_name
        ? `${transaction.customer.first_name} ${transaction.customer.name}`
        : transaction.customer.name
      : undefined;
    const supplierName = transaction.supplier
      ? transaction.supplier.first_name
        ? `${transaction.supplier.first_name} ${transaction.supplier.name}`
        : transaction.supplier.name
      : undefined;

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
            <Filter size={20} color={Colors.primary[900]} />
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
                const personName = transaction.customer
                  ? transaction.customer.first_name
                    ? `${transaction.customer.first_name} ${transaction.customer.name}`
                    : transaction.customer.name
                  : transaction.supplier
                    ? transaction.supplier.first_name
                      ? `${transaction.supplier.first_name} ${transaction.supplier.name}`
                      : transaction.supplier.name
                    : '';

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
    backgroundColor: Colors.primary[900],
    borderColor: Colors.primary[900],
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  periodButtonTextActive: {
    color: Colors.primary.foreground,
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
    backgroundColor: Colors.primary[900],
    borderColor: Colors.primary[900],
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
    color: Colors.primary.foreground,
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
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
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
    backgroundColor: Colors.primary[50],
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  activeFilterText: {
    fontSize: 13,
    color: Colors.primary[900],
    fontWeight: '500',
  },
  clearFilterText: {
    fontSize: 16,
    color: Colors.primary[900],
    fontWeight: '600',
    paddingLeft: Spacing.md,
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
    borderRadius: 18,
    padding: Spacing['2xl'],
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  categoryList: {
    gap: Spacing.sm,
  },
  categoryOption: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  categoryOptionActive: {
    backgroundColor: Colors.primary[900],
    borderColor: Colors.primary[900],
  },
  categoryOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    textAlign: 'center',
  },
  categoryOptionTextActive: {
    color: Colors.primary.foreground,
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
