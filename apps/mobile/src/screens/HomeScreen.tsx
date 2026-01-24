import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  DollarSign,
  ShoppingCart,
  Receipt,
  TrendingUp,
  TrendingDown,
} from '../components/icons/SimpleIcons';
import { ScreenHeader, KPICard, ListItem, TransactionDetailModal } from '../components/ui';
import { Colors, Spacing } from '../constants/theme-v2';
import { formatMoney, formatMoneyWithSign } from '../utils/money';
import { getTodayLabel } from '../utils/date';
import { cashApi, receivablesApi, debtsApi } from '../lib/api';

// Labels des catégories
const getCategoryLabel = (category: string): string => {
  const labels: { [key: string]: string } = {
    ventes: 'Vente',
    vente: 'Vente',
    entree: 'Entrée',
    sortie: 'Sortie',
    remboursement_client: 'Remb. client',
    achats_marchandises: 'Achat marchandises',
    loyers: 'Loyer',
    reglement_fournisseur: 'Règlement fournisseur',
    depenses_courantes: 'Dépenses courantes',
    divers: 'Divers',
  };
  return labels[category] || category;
};

// Fonction pour formater l'heure
const formatTransactionTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

export default function HomeScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    // Solde et transactions
    cashBalance: 0,
    transactionCount: 0,
    // Entrées
    totalEntries: 0,
    totalSales: 0,
    salesCash: 0,
    salesCredit: 0,
    // Sorties
    totalExits: 0,
    totalPurchases: 0,
    purchasesCash: 0,
    purchasesCredit: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  // Transaction detail modal state
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const loadData = async () => {
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
        receivablesApi.getAll().catch(() => []),
        debtsApi.getAll().catch(() => []),
      ]);

      const todayTransactions: any[] = [];

      // Ajouter les transactions cash
      if (Array.isArray(transactionsData)) {
        transactionsData.forEach((entry: any) => {
          const entryDate = new Date(entry.created_at);
          if (entryDate >= startOfDay && entryDate <= endOfDay) {
            todayTransactions.push({
              ...entry,
              isCredit: false,
            });
          }
        });
      }

      // Ajouter les créances (ventes à crédit) du jour
      if (Array.isArray(receivablesData)) {
        receivablesData.forEach((receivable: any) => {
          const createdDate = new Date(receivable.created_at);
          if (createdDate >= startOfDay && createdDate <= endOfDay) {
            todayTransactions.push({
              id: receivable.id,
              type: 'IN',
              category: 'ventes',
              amount: receivable.amount,
              note: receivable.description,
              created_at: receivable.created_at,
              customer: receivable.customer,
              customer_id: receivable.customer_id,
              isCredit: true,
            });
          }
        });
      }

      // Ajouter les dettes (achats à crédit) du jour
      if (Array.isArray(debtsData)) {
        debtsData.forEach((debt: any) => {
          const createdDate = new Date(debt.created_at);
          if (createdDate >= startOfDay && createdDate <= endOfDay) {
            todayTransactions.push({
              id: debt.id,
              type: 'OUT',
              category: 'achats_marchandises',
              amount: debt.amount,
              note: debt.description,
              created_at: debt.created_at,
              supplier: debt.supplier,
              supplier_id: debt.supplier_id,
              isCredit: true,
            });
          }
        });
      }

      // Trier par date décroissante (plus récent en premier)
      todayTransactions.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Prendre les 4 dernières
      const recent = todayTransactions.slice(0, 4);

      setStats({
        cashBalance: statsData?.balance || 0,
        transactionCount:
          (statsData?.entriesCount || 0) +
          (statsData?.exitsCount || 0) +
          (statsData?.salesCreditCount || 0) +
          (statsData?.purchasesCreditCount || 0),
        // Entrées
        totalEntries: statsData?.todayEntries || 0,
        totalSales: statsData?.totalSales || 0,
        salesCash: statsData?.salesCash || 0,
        salesCredit: statsData?.salesCredit || 0,
        // Sorties
        totalExits: statsData?.todayExits || 0,
        totalPurchases: statsData?.totalPurchases || 0,
        purchasesCash: statsData?.purchasesCash || 0,
        purchasesCredit: statsData?.purchasesCredit || 0,
      });

      setRecentTransactions(recent);
    } catch (error) {
      console.error('Error loading HomeScreen data:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Swalo" />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Date and Summary */}
        <View style={styles.dateRow}>
          <View>
            <Text style={styles.label}>Aujourd'hui</Text>
            <Text style={styles.dateText}>{getTodayLabel()}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.label}>Transactions</Text>
            <Text style={[styles.salesAmount, { color: Colors.primary[900] }]}>
              {stats.transactionCount}
            </Text>
          </View>
        </View>

        {/* Solde Caisse Header */}
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceLabel}>Solde de caisse</Text>
          <Text style={styles.balanceAmount}>{formatMoney(stats.cashBalance)}</Text>
        </View>

        {/* KPI Entrées */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardTitle}>Entrées</Text>
                <Text style={styles.cardSubtitle}>{formatMoney(stats.totalEntries)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.cardLabel}>Total Ventes</Text>
                <Text style={[styles.cardValue, { color: Colors.success.main }]}>
                  {formatMoney(stats.totalSales)}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Cash</Text>
              <Text style={[styles.breakdownValue, { color: Colors.success.main }]}>
                {formatMoney(stats.salesCash)}
              </Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Crédit</Text>
              <Text style={[styles.breakdownValue, { color: Colors.warning.main }]}>
                {formatMoney(stats.salesCredit)}
              </Text>
            </View>
          </View>
        </View>

        {/* KPI Sorties */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardTitle}>Sorties</Text>
                <Text style={styles.cardSubtitle}>{formatMoney(stats.totalExits)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.cardLabel}>Total Achats</Text>
                <Text style={[styles.cardValue, { color: Colors.danger.main }]}>
                  {formatMoney(stats.totalPurchases)}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Cash</Text>
              <Text style={[styles.breakdownValue, { color: Colors.danger.main }]}>
                {formatMoney(stats.purchasesCash)}
              </Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Crédit</Text>
              <Text style={[styles.breakdownValue, { color: Colors.warning.main }]}>
                {formatMoney(stats.purchasesCredit)}
              </Text>
            </View>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Transactions récentes</Text>
          </View>
          <View>
            {recentTransactions.length > 0 ? (
              recentTransactions.map(transaction => {
                const isEntry = transaction.type === 'IN';
                const isCredit = transaction.isCredit === true;
                const customerName = transaction.customer
                  ? transaction.customer.first_name
                    ? `${transaction.customer.first_name} ${transaction.customer.name}`
                    : transaction.customer.name
                  : '';
                const supplierName = transaction.supplier
                  ? transaction.supplier.first_name
                    ? `${transaction.supplier.first_name} ${transaction.supplier.name}`
                    : transaction.supplier.name
                  : '';
                const displayName = customerName || supplierName;

                // Construire le titre avec indication crédit
                const categoryLabel = getCategoryLabel(transaction.category);
                const title = isCredit ? `${categoryLabel} (Crédit)` : categoryLabel;

                return (
                  <ListItem
                    key={transaction.id}
                    icon={
                      isEntry ? (
                        <Receipt size={20} color={Colors.primary[900]} />
                      ) : (
                        <DollarSign size={20} color={Colors.primary[900]} />
                      )
                    }
                    title={title}
                    subtitle={`${formatTransactionTime(transaction.created_at)}${displayName ? ` - ${displayName}` : ''}`}
                    amount={
                      isEntry
                        ? `+${formatMoney(transaction.amount)}`
                        : `-${formatMoney(transaction.amount)}`
                    }
                    amountColor={isCredit ? 'warning' : isEntry ? 'success' : 'danger'}
                    onClick={() => {
                      setSelectedTransaction({
                        type: isEntry ? 'entry' : 'exit',
                        date: transaction.created_at,
                        amount: isEntry ? transaction.amount : -transaction.amount,
                        note: transaction.note,
                        isCredit: isCredit,
                        category: transaction.category,
                        customerName: customerName || undefined,
                        supplierName: supplierName || undefined,
                      });
                      setShowDetailModal(true);
                    }}
                  />
                );
              })
            ) : (
              <View style={{ padding: Spacing.lg }}>
                <Text style={{ color: Colors.muted.foreground, textAlign: 'center' }}>
                  Aucune transaction aujourd'hui
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

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
    paddingBottom: 80,
    gap: Spacing['2xl'],
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 13,
    color: Colors.muted.foreground,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  salesAmount: {
    fontSize: 18,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  balanceHeader: {
    backgroundColor: Colors.primary[900],
    padding: Spacing['2xl'],
    borderRadius: 18,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: Colors.primary.foreground,
    marginBottom: Spacing.xs,
    opacity: 0.9,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary.foreground,
    fontVariant: ['tabular-nums'],
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
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.muted.foreground,
  },
  cardSubtitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primary[900],
    marginTop: Spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  cardLabel: {
    fontSize: 12,
    color: Colors.muted.foreground,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  breakdownRow: {
    flexDirection: 'row',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  breakdownItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  breakdownLabel: {
    fontSize: 12,
    color: Colors.muted.foreground,
    marginBottom: Spacing.xs,
  },
  breakdownValue: {
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
