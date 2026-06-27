import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { normalizeCashCategory } from '@swalo/core';
import { formatMoney } from '../utils/money';
import { Colors, Spacing, Shadows } from '../constants/theme-v2';
import { ScreenHeader } from '../components/ui';
import { ArrowDown, ArrowUp } from '../components/icons/SimpleIcons';
import { useCurrentUser } from '../hooks/useCurrentUser';
import {
  getDailySalesReport,
  getCashFlowReport,
  getReceivablesReport,
  getDebtsReport,
  getTopProductsReport,
  type TopItem,
} from '../db/reports';

interface BusinessReportsScreenNavigation {
  goBack: () => void;
}

interface BusinessReportsScreenProps {
  navigation: BusinessReportsScreenNavigation;
}

type Period = 'today' | 'week' | 'month';

interface EncaissementRow {
  key: string;
  label: string;
  color: string;
  amount: number;
  percent: number;
}

interface ReportData {
  // KPIs (période)
  totalIn: number;
  totalOut: number;
  net: number;
  salesCount: number;
  // Ventes espèces vs crédit (période)
  cashSalesAmount: number;
  creditSalesAmount: number;
  cashSalesCount: number;
  creditSalesCount: number;
  cashSharePercent: number;
  creditAvgTicket: number;
  // Flux de caisse — 7 derniers jours
  weeklyFlow: Array<{ label: string; value: number; isToday: boolean }>;
  // Soldes
  receivablesBalance: number;
  debtsBalance: number;
  // Top produits
  topProducts: TopItem[];
  // Répartition des encaissements
  encaissements: EncaissementRow[];
}

const EMPTY_DATA: ReportData = {
  totalIn: 0,
  totalOut: 0,
  net: 0,
  salesCount: 0,
  cashSalesAmount: 0,
  creditSalesAmount: 0,
  cashSalesCount: 0,
  creditSalesCount: 0,
  cashSharePercent: 0,
  creditAvgTicket: 0,
  weeklyFlow: [],
  receivablesBalance: 0,
  debtsBalance: 0,
  topProducts: [],
  encaissements: [],
};

const WEEKDAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']; // getDay(): 0=dimanche..6=samedi

// Libellés conviviaux pour la répartition des encaissements (catégories IN)
const ENCAISSEMENT_LABELS: Record<string, string> = {
  ventes: 'Ventes comptoir',
  remboursement_client: 'Paiements créance',
  remboursement_fournisseur: 'Remb. fournisseur',
  divers: 'Divers',
};

// Couleur du point par catégorie d'encaissement
const ENCAISSEMENT_COLORS: Record<string, string> = {
  ventes: Colors.action,
  remboursement_client: Colors.success.main,
  remboursement_fournisseur: Colors.warning.main,
  divers: Colors.textColors.tertiary,
};

export default function BusinessReportsScreen({ navigation }: BusinessReportsScreenProps) {
  const { shopId, user } = useCurrentUser();
  const userRole = user?.role || 'EMPLOYEE';

  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('today');
  const [data, setData] = useState<ReportData>(EMPTY_DATA);

  // Calcule la plage de dates pour la période sélectionnée.
  const getPeriodRange = useCallback((period: Period): { start: Date; end: Date } => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const start = new Date(now);
    switch (period) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start.setDate(now.getDate() - 6); // 7 jours glissants (aujourd'hui inclus)
        start.setHours(0, 0, 0, 0);
        break;
      case 'month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
    }
    return { start, end };
  }, []);

  const loadData = useCallback(async () => {
    if (!shopId) return;
    setIsLoading(true);
    try {
      const { start, end } = getPeriodRange(selectedPeriod);
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      // --- Flux de caisse de la période (KPIs) ---
      const cashFlow = await getCashFlowReport(shopId, startISO, endISO);

      // --- Agrégation des ventes jour par jour sur la période ---
      let salesCount = 0;
      let cashSalesAmount = 0;
      let creditSalesAmount = 0;
      const dayCursor = new Date(start);
      while (dayCursor <= end) {
        const dayReport = await getDailySalesReport(shopId, dayCursor.toISOString());
        salesCount += dayReport.salesCount;
        cashSalesAmount += dayReport.cashSales;
        creditSalesAmount += dayReport.creditSales;
        dayCursor.setDate(dayCursor.getDate() + 1);
      }

      // Répartition espèces vs crédit.
      // Les comptes par mode ne sont pas stockés séparément : on répartit le
      // nombre total de ventes au prorata des montants (approximation).
      const totalSalesAmount = cashSalesAmount + creditSalesAmount;
      const cashShare = totalSalesAmount > 0 ? cashSalesAmount / totalSalesAmount : 0;
      const cashSalesCount = Math.round(salesCount * cashShare);
      const creditSalesCount = Math.max(0, salesCount - cashSalesCount);
      const cashSharePercent = Math.round(cashShare * 100);
      const creditAvgTicket = creditSalesCount > 0 ? creditSalesAmount / creditSalesCount : 0;

      // --- Flux de caisse : 7 derniers jours (net par jour) ---
      const weeklyFlow: ReportData['weeklyFlow'] = [];
      const todayKey = new Date().toISOString().split('T')[0];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const dStart = new Date(d);
        const dEnd = new Date(d);
        dEnd.setHours(23, 59, 59, 999);
        const dayFlow = await getCashFlowReport(shopId, dStart.toISOString(), dEnd.toISOString());
        weeklyFlow.push({
          label: WEEKDAY_LETTERS[d.getDay()],
          value: dayFlow.net,
          isToday: d.toISOString().split('T')[0] === todayKey,
        });
      }

      // --- Soldes créances / dettes ---
      const [receivables, debts] = await Promise.all([
        getReceivablesReport(shopId),
        getDebtsReport(shopId),
      ]);

      // --- Top produits ---
      const topProducts = await getTopProductsReport(shopId, startISO, endISO, 5);

      // --- Répartition des encaissements (catégories IN) ---
      const inByCategory: Record<string, number> = {};
      cashFlow.byCategory
        .filter(c => c.type === 'IN')
        .forEach(c => {
          const norm = normalizeCashCategory(c.category) ?? 'divers';
          inByCategory[norm] = (inByCategory[norm] ?? 0) + c.amount;
        });
      const encaissements: EncaissementRow[] = Object.entries(inByCategory)
        .map(([key, amount]) => ({
          key,
          label: ENCAISSEMENT_LABELS[key] || 'Autres',
          color: ENCAISSEMENT_COLORS[key] || Colors.textColors.tertiary,
          amount,
          percent: cashFlow.totalIn > 0 ? Math.round((amount / cashFlow.totalIn) * 100) : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      setData({
        totalIn: cashFlow.totalIn,
        totalOut: cashFlow.totalOut,
        net: cashFlow.net,
        salesCount,
        cashSalesAmount,
        creditSalesAmount,
        cashSalesCount,
        creditSalesCount,
        cashSharePercent,
        creditAvgTicket,
        weeklyFlow,
        receivablesBalance: receivables.totalBalance,
        debtsBalance: debts.totalBalance,
        topProducts,
        encaissements,
      });
    } catch (error) {
      console.error('Erreur chargement rapports:', error);
      setData(EMPTY_DATA);
    } finally {
      setIsLoading(false);
    }
  }, [shopId, selectedPeriod, getPeriodRange]);

  useEffect(() => {
    if (userRole !== 'EMPLOYEE' && shopId) {
      loadData();
    }
  }, [userRole, shopId, loadData]);

  if (userRole === 'EMPLOYEE') {
    return null;
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Rapports"
          subtitle="Analyse de l'activité"
          showBack
          onBack={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.action} />
          <Text style={styles.loadingText}>Chargement des données...</Text>
        </View>
      </View>
    );
  }

  // Échelle du graphe : max des nets positifs (les nets négatifs s'affichent au minimum)
  const maxFlow = Math.max(1, ...data.weeklyFlow.map(b => b.value));
  // Échelle du split espèces/crédit
  const totalSplit = data.cashSalesAmount + data.creditSalesAmount;
  const cashFraction = totalSplit > 0 ? data.cashSalesAmount / totalSplit : 0;
  const creditFraction = totalSplit > 0 ? data.creditSalesAmount / totalSplit : 0;
  // Échelle des top produits
  const maxTopValue = Math.max(1, ...data.topProducts.map(p => p.value));

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Rapports"
        subtitle="Analyse de l'activité"
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Contrôle segmenté de période */}
        <View style={styles.segment}>
          {(['today', 'week', 'month'] as Period[]).map(period => {
            const isActive = selectedPeriod === period;
            return (
              <TouchableOpacity
                key={period}
                style={[styles.segmentItem, isActive && styles.segmentItemActive]}
                onPress={() => setSelectedPeriod(period)}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                  {period === 'today' ? 'Jour' : period === 'week' ? 'Semaine' : 'Mois'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Grille KPI 2×2 */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Encaissements</Text>
            <Text style={[styles.kpiValue, { color: Colors.success.main }]}>
              {formatMoney(data.totalIn)}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Décaissements</Text>
            <Text style={[styles.kpiValue, { color: Colors.danger.main }]}>
              {formatMoney(data.totalOut)}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Solde net</Text>
            <Text
              style={[styles.kpiValue, { color: data.net >= 0 ? Colors.text : Colors.danger.main }]}
            >
              {formatMoney(data.net)}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Ventes</Text>
            <Text style={[styles.kpiValue, { color: Colors.action }]}>{data.salesCount}</Text>
          </View>
        </View>

        {/* Flux de caisse — graphe 7 derniers jours */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Flux de caisse</Text>
            <Text style={styles.cardSubtitleInline}>7 derniers jours</Text>
          </View>
          <View style={styles.chartRow}>
            {data.weeklyFlow.map((bar, index) => {
              const ratio = Math.max(0, bar.value) / maxFlow;
              const barHeight = Math.max(4, ratio * CHART_HEIGHT);
              return (
                <View key={index} style={styles.chartCol}>
                  <View style={styles.chartBarTrack}>
                    <View
                      style={[
                        styles.chartBar,
                        {
                          height: barHeight,
                          backgroundColor: bar.isToday ? Colors.action : Colors.primary[200],
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.chartLabel, bar.isToday && styles.chartLabelActive]}>
                    {bar.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Ventes : espèces vs crédit */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ventes : espèces vs crédit</Text>
          <View style={styles.splitBar}>
            <View
              style={[
                styles.splitSegment,
                styles.splitLeft,
                { flex: cashFraction, backgroundColor: Colors.success.main },
              ]}
            />
            <View
              style={[
                styles.splitSegment,
                styles.splitRight,
                { flex: creditFraction, backgroundColor: Colors.warning.main },
              ]}
            />
            {totalSplit === 0 && <View style={[styles.splitSegment, styles.splitEmpty]} />}
          </View>
          <View style={styles.splitLegendRow}>
            <View style={styles.splitLegendItem}>
              <View style={styles.splitLegendHead}>
                <View style={[styles.legendDot, { backgroundColor: Colors.success.main }]} />
                <Text style={styles.splitLegendTitle}>Espèces · {data.cashSalesCount}</Text>
              </View>
              <Text style={styles.splitLegendSub}>{data.cashSharePercent}% des ventes</Text>
            </View>
            <View style={[styles.splitLegendItem, styles.splitLegendItemRight]}>
              <View style={styles.splitLegendHead}>
                <View style={[styles.legendDot, { backgroundColor: Colors.warning.main }]} />
                <Text style={styles.splitLegendTitle}>Crédit · {data.creditSalesCount}</Text>
              </View>
              <Text style={styles.splitLegendSub}>
                ticket moy. {formatMoney(data.creditAvgTicket)}
              </Text>
            </View>
          </View>
        </View>

        {/* Créances clients */}
        <View style={[styles.card, styles.compactCard]}>
          <View style={[styles.compactIcon, { backgroundColor: Colors.success.background }]}>
            <ArrowDown size={20} color={Colors.success.main} />
          </View>
          <View style={styles.compactTextBlock}>
            <Text style={styles.compactTitle}>Créances clients</Text>
            <Text style={styles.compactSubtitle}>Ce qu&apos;on vous doit</Text>
          </View>
          <Text style={[styles.compactAmount, { color: Colors.success.main }]}>
            {formatMoney(data.receivablesBalance)}
          </Text>
        </View>

        {/* Dettes fournisseurs */}
        <View style={[styles.card, styles.compactCard]}>
          <View style={[styles.compactIcon, { backgroundColor: Colors.danger.background }]}>
            <ArrowUp size={20} color={Colors.danger.main} />
          </View>
          <View style={styles.compactTextBlock}>
            <Text style={styles.compactTitle}>Dettes fournisseurs</Text>
            <Text style={styles.compactSubtitle}>Ce que vous devez</Text>
          </View>
          <Text style={[styles.compactAmount, { color: Colors.danger.main }]}>
            {formatMoney(data.debtsBalance)}
          </Text>
        </View>

        {/* Top produits */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top produits</Text>
          {data.topProducts.length === 0 ? (
            <Text style={styles.emptyText}>Aucune vente sur cette période</Text>
          ) : (
            data.topProducts.map((product, index) => (
              <View
                key={product.id || index}
                style={[styles.topRow, index === 0 && styles.topRowFirst]}
              >
                <View style={styles.topRowHeader}>
                  <Text style={styles.topName} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text style={styles.topAmount}>{formatMoney(product.value)}</Text>
                </View>
                <View style={styles.topBarTrack}>
                  <View
                    style={[
                      styles.topBarFill,
                      { width: `${(product.value / maxTopValue) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.topCount}>{product.count} vendus</Text>
              </View>
            ))
          )}
        </View>

        {/* Répartition des encaissements */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Répartition des encaissements</Text>
          {data.encaissements.length === 0 ? (
            <Text style={styles.emptyText}>Aucun encaissement sur cette période</Text>
          ) : (
            data.encaissements.map(row => (
              <View key={row.key} style={styles.repartRow}>
                <View style={[styles.legendDot, { backgroundColor: row.color }]} />
                <Text style={styles.repartLabel} numberOfLines={1}>
                  {row.label}
                </Text>
                <Text style={styles.repartAmount}>{formatMoney(row.amount)}</Text>
                <Text style={[styles.repartPercent, { color: row.color }]}>{row.percent}%</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const CHART_HEIGHT = 110;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['2xl'],
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 16,
    color: Colors.muted.foreground,
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing['3xl'],
  },
  // SEGMENTED CONTROL
  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 4,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentItemActive: {
    backgroundColor: Colors.primary[900],
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textColors.secondary,
  },
  segmentTextActive: {
    color: Colors.onMarine,
  },
  // KPI GRID
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  kpiCard: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  kpiLabel: {
    fontSize: 13,
    color: Colors.textColors.tertiary,
    fontWeight: '500',
    marginBottom: Spacing.sm,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  // CARD
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    ...Shadows.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  cardSubtitleInline: {
    fontSize: 12,
    color: Colors.textColors.tertiary,
  },
  // CHART
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: CHART_HEIGHT + 24,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarTrack: {
    height: CHART_HEIGHT,
    justifyContent: 'flex-end',
    width: '100%',
    alignItems: 'center',
  },
  chartBar: {
    width: '58%',
    borderRadius: 8,
  },
  chartLabel: {
    fontSize: 12,
    color: Colors.textColors.tertiary,
    marginTop: Spacing.sm,
    fontWeight: '500',
  },
  chartLabelActive: {
    color: Colors.action,
    fontWeight: '700',
  },
  // SPLIT BAR
  splitBar: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: Colors.muted.main,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  splitSegment: {
    height: '100%',
  },
  splitLeft: {
    borderTopLeftRadius: 7,
    borderBottomLeftRadius: 7,
  },
  splitRight: {
    borderTopRightRadius: 7,
    borderBottomRightRadius: 7,
  },
  splitEmpty: {
    flex: 1,
    backgroundColor: Colors.muted.main,
  },
  splitLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  splitLegendItem: {
    flex: 1,
  },
  splitLegendItemRight: {
    alignItems: 'flex-end',
  },
  splitLegendHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  splitLegendTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  splitLegendSub: {
    fontSize: 12,
    color: Colors.textColors.tertiary,
    marginTop: 2,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  // COMPACT CARD
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  compactIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTextBlock: {
    flex: 1,
  },
  compactTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  compactSubtitle: {
    fontSize: 12,
    color: Colors.textColors.tertiary,
    marginTop: 2,
  },
  compactAmount: {
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  // TOP PRODUITS
  topRow: {
    paddingTop: Spacing.md,
  },
  topRowFirst: {
    paddingTop: Spacing.sm,
  },
  topRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  topName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginRight: Spacing.md,
  },
  topAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  topBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.muted.main,
    overflow: 'hidden',
  },
  topBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.action,
  },
  topCount: {
    fontSize: 12,
    color: Colors.textColors.tertiary,
    marginTop: Spacing.xs,
  },
  // REPARTITION
  repartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  repartLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  repartAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  repartPercent: {
    fontSize: 13,
    fontWeight: '700',
    width: 44,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textColors.tertiary,
    paddingVertical: Spacing.md,
  },
});
