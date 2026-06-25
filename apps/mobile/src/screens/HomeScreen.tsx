import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  DollarSign,
  Receipt,
  ShoppingCart,
  Wallet,
  Package,
  Ellipsis,
} from '../components/icons/SimpleIcons';
import { ListItem, TransactionDetailModal } from '../components/ui';
import { Logo } from '../components/ui/Logo';
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
  unknown: Colors.primary[300],
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
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const freshness = useSyncFreshness();
  const [scrolled, setScrolled] = useState(false);
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

      setRecentTransactions(todayTransactions.slice(0, 5));
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

  const shopName =
    enterprise?.name && shop?.name ? `${enterprise.name} · ${shop.name}` : shop?.name || 'Swalo';

  const quickActions: { label: string; route: string; icon: React.ReactNode }[] = [
    { label: 'Vente', route: 'Sale', icon: <ShoppingCart size={24} color={Colors.primary[700]} /> },
    { label: 'Caisse', route: 'Cash', icon: <Wallet size={24} color={Colors.primary[700]} /> },
    { label: 'Stock', route: 'Stock', icon: <Package size={24} color={Colors.primary[700]} /> },
    { label: 'Plus', route: 'More', icon: <Ellipsis size={24} color={Colors.primary[700]} /> },
  ];

  return (
    <View style={styles.container}>
      <StatusBar style={scrolled ? 'dark' : 'light'} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={e => {
          const next = e.nativeEvent.contentOffset.y > 120;
          if (next !== scrolled) setScrolled(next);
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.onMarine}
          />
        }
      >
        {/* HERO marine */}
        <View style={[styles.hero, { paddingTop: insets.top + Spacing.md }]}>
          <View style={styles.heroTop}>
            <View style={styles.heroBrand}>
              <Logo size={26} tone="light" />
              <Text style={styles.heroShop} numberOfLines={1}>
                {shopName}
              </Text>
            </View>
            <View style={styles.freshnessBadge}>
              <View
                style={[styles.freshnessDot, { backgroundColor: freshnessColors[freshness.level] }]}
              />
              <Text style={styles.freshnessText}>{freshness.label}</Text>
            </View>
          </View>

          <Text style={styles.balanceLabel}>Solde de caisse</Text>
          <Text style={styles.balanceAmount}>{formatMoney(stats.cashBalance)}</Text>

          <View style={styles.heroMeta}>
            <Text style={styles.heroMetaText}>{getTodayLabel()}</Text>
            <Text style={styles.heroMetaText}>
              {stats.transactionCount} transaction{stats.transactionCount > 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Carte de stats flottante */}
        <View style={styles.floatingCard}>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Ventes</Text>
            <Text style={[styles.statValue, { color: Colors.success.main }]}>
              {formatMoney(stats.totalSales)}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Achats</Text>
            <Text style={[styles.statValue, { color: Colors.danger.main }]}>
              {formatMoney(stats.totalPurchases)}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Entrées</Text>
            <Text style={[styles.statValue, { color: Colors.primary[900] }]}>
              {formatMoney(stats.totalEntries)}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Accès rapide */}
          <Text style={styles.sectionTitle}>Accès rapide</Text>
          <View style={styles.tilesGrid}>
            {quickActions.map(action => (
              <Pressable
                key={action.label}
                style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
                onPress={() => navigation.navigate(action.route as never)}
              >
                <View style={styles.tileIconBox}>{action.icon}</View>
                <Text style={styles.tileLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Détail Ventes */}
          <View style={styles.card}>
            <View style={styles.cardTopRow}>
              <Text style={styles.cardTitle}>Ventes du jour</Text>
              <Text style={[styles.cardTotal, { color: Colors.success.main }]}>
                {formatMoney(stats.totalSales)}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Cash</Text>
                <Text style={styles.breakdownValue}>{formatMoney(stats.salesCash)}</Text>
              </View>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Crédit</Text>
                <Text style={[styles.breakdownValue, { color: Colors.warning.main }]}>
                  {formatMoney(stats.salesCredit)}
                </Text>
              </View>
            </View>
          </View>

          {/* Détail Achats */}
          <View style={styles.card}>
            <View style={styles.cardTopRow}>
              <Text style={styles.cardTitle}>Achats du jour</Text>
              <Text style={[styles.cardTotal, { color: Colors.danger.main }]}>
                {formatMoney(stats.totalPurchases)}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Cash</Text>
                <Text style={styles.breakdownValue}>{formatMoney(stats.purchasesCash)}</Text>
              </View>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Crédit</Text>
                <Text style={[styles.breakdownValue, { color: Colors.warning.main }]}>
                  {formatMoney(stats.purchasesCredit)}
                </Text>
              </View>
            </View>
          </View>

          {/* Transactions récentes */}
          <Text style={styles.sectionTitle}>Transactions récentes</Text>
          <View style={styles.listCard}>
            {recentTransactions.length > 0 ? (
              recentTransactions.map(transaction => {
                const isEntry = transaction.type === 'IN';
                const isCredit = transaction.isCredit === true;
                const categoryLabel = getCategoryLabel(transaction.category);
                const title = isCredit ? `${categoryLabel} (Crédit)` : categoryLabel;

                return (
                  <ListItem
                    key={transaction.id}
                    icon={
                      isEntry ? (
                        <Receipt size={20} color={Colors.primary[700]} />
                      ) : (
                        <DollarSign size={20} color={Colors.primary[700]} />
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
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Aucune transaction aujourd'hui</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* En-tête blanc collant (apparaît au défilement) */}
      <View
        style={[styles.stickyHeader, { paddingTop: insets.top, opacity: scrolled ? 1 : 0 }]}
        pointerEvents="none"
      >
        <Logo size={26} tone="marine" showWordmark />
      </View>

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
    backgroundColor: Colors.primary[900],
  },
  scroll: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    zIndex: 10,
  },
  content: {
    paddingBottom: 96,
  },
  // HERO
  hero: {
    backgroundColor: Colors.primary[900],
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing['3xl'] + Spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  heroBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
  },
  heroShop: {
    color: Colors.primary[200],
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  freshnessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary[800],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  freshnessDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  freshnessText: {
    fontSize: 11,
    color: Colors.primary[100],
    fontWeight: '500',
  },
  balanceLabel: {
    fontSize: 14,
    color: Colors.primary[200],
  },
  balanceAmount: {
    fontSize: 38,
    fontWeight: '800',
    color: Colors.onMarine,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  heroMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
  },
  heroMetaText: {
    fontSize: 13,
    color: Colors.primary[200],
  },
  // FLOATING STATS CARD
  floatingCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginTop: -Spacing['2xl'],
    borderRadius: 18,
    paddingVertical: Spacing.lg,
    shadowColor: '#0B2A45',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textColors.tertiary,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  // BODY
  body: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    gap: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  // QUICK ACTION TILES
  tilesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -Spacing.xs,
  },
  tile: {
    width: '23%',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  tilePressed: {
    opacity: 0.6,
  },
  tileIconBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: Colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text,
  },
  // CARDS
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    gap: Spacing.md,
    shadowColor: '#0B2A45',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  cardTotal: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  breakdownRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  breakdownItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  breakdownLabel: {
    fontSize: 12,
    color: Colors.textColors.tertiary,
  },
  breakdownValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  // LIST
  listCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#0B2A45',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  emptyState: {
    padding: Spacing['2xl'],
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textColors.tertiary,
    fontSize: 14,
  },
});
