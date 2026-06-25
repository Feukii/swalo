import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  ShoppingCart,
  Wallet,
  Package,
  Users,
  TrendingDown,
  TrendingUp,
} from '../components/icons/SimpleIcons';
import { ScreenHeader, TransactionDetailModal } from '../components/ui';
import { Colors, Spacing, Shadows } from '../constants/theme-v2';
import { formatMoney } from '../utils/money';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCurrentUser } from '../hooks/useCurrentUser';
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

// Date courte du jour (ex: "Vendredi 26 juin")
const getTodayShort = (): string => {
  const today = new Date();
  const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(today);
  const rest = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(today);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${rest}`;
};

// Sépare le montant (ex: "3 500 F") en valeur + suffixe "F" pour styliser le F en sky
const splitMoney = (amount: number): { value: string; unit: string } => {
  const formatted = formatMoney(amount);
  const idx = formatted.lastIndexOf(' F');
  if (idx === -1) {
    return { value: formatted, unit: '' };
  }
  return { value: formatted.slice(0, idx), unit: 'F' };
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

interface QuickAction {
  label: string;
  route: string;
  icon: React.ReactNode;
  iconBg: string;
}

export default function HomeScreen() {
  const { shopId, shop, enterprise } = useCurrentUser();
  const navigation = useNavigation();
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

  const headerTitle = shop?.name || 'Swalo';
  const headerSubtitle = enterprise?.name || undefined;

  const netDay = stats.totalSales - stats.totalPurchases;
  const balance = splitMoney(stats.cashBalance);

  const quickActions: QuickAction[] = [
    {
      label: 'Vente',
      route: 'Sale',
      icon: <ShoppingCart size={22} color={Colors.action} />,
      iconBg: Colors.info.background,
    },
    {
      label: 'Caisse',
      route: 'Cash',
      icon: <Wallet size={22} color={Colors.primary[900]} />,
      iconBg: Colors.primary[50],
    },
    {
      label: 'Stock',
      route: 'Stock',
      icon: <Package size={22} color={Colors.success.main} />,
      iconBg: Colors.success.background,
    },
    {
      label: 'Clients',
      route: 'Customers',
      icon: <Users size={22} color={Colors.warning.main} />,
      iconBg: Colors.warning.background,
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScreenHeader title={headerTitle} subtitle={headerSubtitle} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary[900]}
          />
        }
      >
        {/* HERO MARINE — Solde de caisse */}
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <Text style={styles.heroLabel}>Solde de caisse</Text>
            <Text style={styles.heroDate}>{getTodayShort()}</Text>
          </View>

          <Text style={styles.heroAmount}>
            {balance.value}
            {balance.unit ? <Text style={styles.heroAmountUnit}> {balance.unit}</Text> : null}
          </Text>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCol}>
              <Text style={styles.heroStatLabel}>Ventes</Text>
              <Text style={[styles.heroStatValue, styles.heroStatPositive]}>
                +{formatMoney(stats.totalSales)}
              </Text>
            </View>
            <View style={styles.heroStatCol}>
              <Text style={styles.heroStatLabel}>Achats</Text>
              <Text style={styles.heroStatValue}>{formatMoney(stats.totalPurchases)}</Text>
            </View>
            <View style={styles.heroStatCol}>
              <Text style={styles.heroStatLabel}>Net du jour</Text>
              <Text style={[styles.heroStatValue, styles.heroStatPositive]}>
                {netDay >= 0 ? '+' : '-'}
                {formatMoney(netDay)}
              </Text>
            </View>
          </View>
        </View>

        {/* TUILES D'ACCÈS RAPIDE */}
        <View style={styles.tilesRow}>
          {quickActions.map(action => (
            <Pressable
              key={action.label}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
              onPress={() => navigation.navigate(action.route as never)}
            >
              <View style={[styles.tileIcon, { backgroundColor: action.iconBg }]}>
                {action.icon}
              </View>
              <Text style={styles.tileLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* VENTES DU JOUR */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Ventes du jour</Text>
            <Text style={[styles.sectionAmount, styles.textSuccess]}>
              {formatMoney(stats.totalSales)}
            </Text>
          </View>
          <View style={styles.salesRow}>
            <View style={styles.salesCard}>
              <Text style={styles.salesCardLabel}>Cash</Text>
              <Text style={styles.salesCardValue}>{formatMoney(stats.salesCash)}</Text>
            </View>
            <View style={styles.salesCard}>
              <Text style={styles.salesCardLabel}>Crédit</Text>
              <Text style={[styles.salesCardValue, styles.textWarning]}>
                {formatMoney(stats.salesCredit)}
              </Text>
            </View>
          </View>
        </View>

        {/* TRANSACTIONS RÉCENTES */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Transactions récentes</Text>
            <Pressable onPress={() => navigation.navigate('Cash' as never)}>
              <Text style={styles.linkSeeAll}>Tout voir</Text>
            </Pressable>
          </View>

          <View style={styles.listCard}>
            {recentTransactions.length > 0 ? (
              recentTransactions.map((transaction, index) => {
                const isEntry = transaction.type === 'IN';
                const isCredit = transaction.isCredit === true;
                const categoryLabel = getCategoryLabel(transaction.category);
                const title = isCredit ? `${categoryLabel} (Crédit)` : categoryLabel;
                const subtitle = `${formatTransactionTime(transaction.created_at)} · ${
                  isCredit ? 'Crédit' : 'Cash'
                }`;
                const amountColor = isCredit
                  ? Colors.warning.main
                  : isEntry
                    ? Colors.success.main
                    : Colors.danger.main;

                return (
                  <Pressable
                    key={transaction.id}
                    style={({ pressed }) => [
                      styles.txRow,
                      index < recentTransactions.length - 1 && styles.txRowBordered,
                      pressed && styles.txRowPressed,
                    ]}
                    onPress={() => {
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
                  >
                    <View
                      style={[
                        styles.txIcon,
                        {
                          backgroundColor: isEntry
                            ? Colors.success.background
                            : Colors.danger.background,
                        },
                      ]}
                    >
                      {isEntry ? (
                        <TrendingDown size={18} color={Colors.success.main} />
                      ) : (
                        <TrendingUp size={18} color={Colors.danger.main} />
                      )}
                    </View>
                    <View style={styles.txBody}>
                      <Text style={styles.txTitle} numberOfLines={1}>
                        {title}
                      </Text>
                      <Text style={styles.txSubtitle} numberOfLines={1}>
                        {subtitle}
                      </Text>
                    </View>
                    <Text style={[styles.txAmount, { color: amountColor }]}>
                      {isEntry ? '+' : '-'}
                      {formatMoney(transaction.amount)}
                    </Text>
                  </Pressable>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Aucune transaction aujourd&apos;hui</Text>
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
    paddingBottom: 96,
    gap: Spacing.xl,
  },
  // HERO MARINE
  hero: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.primary[900],
    borderRadius: 20,
    padding: Spacing.xl,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.action,
  },
  heroDate: {
    fontSize: 12,
    fontWeight: '500',
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
  heroStatsRow: {
    flexDirection: 'row',
    marginTop: Spacing.xl,
  },
  heroStatCol: {
    flex: 1,
    gap: 4,
  },
  heroStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  heroStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.onMarine,
    fontVariant: ['tabular-nums'],
  },
  heroStatPositive: {
    color: Colors.success.main,
  },
  // TUILES
  tilesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  tile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  tilePressed: {
    opacity: 0.7,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.text,
  },
  // SECTIONS
  section: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionAmount: {
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  linkSeeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.action,
  },
  textSuccess: {
    color: Colors.success.main,
  },
  textWarning: {
    color: Colors.warning.main,
  },
  // VENTES DU JOUR
  salesRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  salesCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    gap: 4,
    ...Shadows.sm,
  },
  salesCardLabel: {
    fontSize: 13,
    color: Colors.textColors.tertiary,
    fontWeight: '500',
  },
  salesCardValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  // LISTE TRANSACTIONS
  listCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    ...Shadows.sm,
  },
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
  txRowPressed: {
    backgroundColor: Colors.surfaceAlt,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
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
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
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
