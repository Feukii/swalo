import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { DollarSign, Receipt } from '../components/icons/SimpleIcons';
import { ScreenHeader, ListItem, TransactionDetailModal } from '../components/ui';
import { Colors, Spacing } from '../constants/theme-v2';
import { formatMoney } from '../utils/money';
import { getTodayLabel } from '../utils/date';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useSyncFreshness, FreshnessLevel } from '../hooks/useOfflineReports';
import { syncEngine } from '../db/sync';
import { authApi } from '../lib/api';
import { cashEntryRepo, clientReceivableRepo, supplierDebtRepo } from '../db/repositories';

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

const freshnessColors: Record<FreshnessLevel, string> = {
  fresh: Colors.success.main,
  stale: Colors.warning.main,
  old: Colors.danger.main,
  unknown: Colors.muted.foreground,
};

// Transaction agrégée du jour (entrées caisse + créances/dettes à crédit)
interface RecentTransaction {
  id: string;
  type: 'IN' | 'OUT';
  category: string;
  amount: number;
  note: string | null;
  created_at: string;
  isCredit: boolean;
}

// Transaction sélectionnée pour le modal de détail
interface SelectedTransaction {
  type: 'entry' | 'exit';
  date: string;
  amount: number;
  note?: string;
  isCredit: boolean;
  category: string;
}

export default function HomeScreen() {
  const { shopId, shop, enterprise } = useCurrentUser();
  const freshness = useSyncFreshness();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    cashBalance: 0,
    transactionCount: 0,
    totalEntries: 0,
    totalSales: 0,
    salesCash: 0,
    salesCredit: 0,
    totalExits: 0,
    totalPurchases: 0,
    purchasesCash: 0,
    purchasesCredit: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);

  const [selectedTransaction, setSelectedTransaction] = useState<SelectedTransaction | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const loadData = useCallback(async () => {
    if (!shopId) return;
    try {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const startISO = startOfDay.toISOString();

      // Fetch today's cash entries from local SQLite
      const todayCashEntries = await cashEntryRepo.getToday(shopId);

      // Fetch today's receivables and debts from local SQLite
      const allReceivables = await clientReceivableRepo.getAll(shopId);
      const todayReceivables = allReceivables.filter(r => r.created_at >= startISO);

      const allDebts = await supplierDebtRepo.getAll(shopId);
      const todayDebts = allDebts.filter(d => d.created_at >= startISO);

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

      // Build recent transactions
      const todayTransactions: RecentTransaction[] = [];

      todayCashEntries.forEach(entry => {
        const entryType: 'IN' | 'OUT' = entry.type === 'IN' ? 'IN' : 'OUT';
        todayTransactions.push({
          id: entry.id,
          type: entryType,
          category: entry.category || (entryType === 'IN' ? 'entree' : 'sortie'),
          amount: entry.amount,
          note: entry.note,
          created_at: entry.created_at,
          isCredit: false,
        });
      });

      todayReceivables.forEach(r => {
        if (r.amount > 0) {
          todayTransactions.push({
            id: r.id,
            type: 'IN',
            category: 'ventes',
            amount: r.amount,
            note: r.description,
            created_at: r.created_at,
            isCredit: true,
          });
        }
      });

      todayDebts.forEach(d => {
        if (d.amount > 0) {
          todayTransactions.push({
            id: d.id,
            type: 'OUT',
            category: 'achats_marchandises',
            amount: d.amount,
            note: d.description,
            created_at: d.created_at,
            isCredit: true,
          });
        }
      });

      todayTransactions.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setStats({
        cashBalance: totalIn - totalOut,
        transactionCount: todayCashEntries.length + todayReceivables.length + todayDebts.length,
        totalEntries: totalIn,
        totalSales: salesCash + salesCredit,
        salesCash,
        salesCredit,
        totalExits: totalOut,
        totalPurchases: purchasesCash + purchasesCredit,
        purchasesCash,
        purchasesCredit,
      });

      setRecentTransactions(todayTransactions.slice(0, 4));
    } catch (error) {
      console.error('Error loading HomeScreen data:', error);
    }
  }, [shopId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Rafraichir les donnees utilisateur/licence depuis le serveur au focus
  const refreshUserData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;

      const meData = (await authApi.getMe()) as {
        enabled_modules?: string[];
        license_tier?: string;
      };
      if (meData.enabled_modules) {
        await AsyncStorage.setItem('enabled_modules', JSON.stringify(meData.enabled_modules));
      }
      if (meData.license_tier) {
        await AsyncStorage.setItem('license_tier', meData.license_tier);
      }
    } catch {
      // Silently fail - offline or server unavailable
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
      refreshUserData();
      // Déclencher une sync en arrière-plan pour garder les données à jour
      syncEngine.fullSync().catch(() => undefined);
    }, [loadData, refreshUserData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title={
          enterprise?.name && shop?.name
            ? `${enterprise.name} - ${shop.name}`
            : shop?.name || 'Swalo'
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Sync Freshness Badge */}
        <View style={styles.freshnessBadge}>
          <View
            style={[styles.freshnessDot, { backgroundColor: freshnessColors[freshness.level] }]}
          />
          <Text style={styles.freshnessText}>{freshness.label}</Text>
        </View>

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

                const categoryLabel = getCategoryLabel(transaction.category);
                const title = isCredit ? `${categoryLabel} (Credit)` : categoryLabel;

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
                    subtitle={formatTransactionTime(transaction.created_at)}
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
                        note: transaction.note ?? undefined,
                        isCredit: isCredit,
                        category: transaction.category,
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
  freshnessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
  },
  freshnessDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  freshnessText: {
    fontSize: 11,
    color: Colors.muted.foreground,
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
