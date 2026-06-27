import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenHeader } from '../components/ui';
import {
  Building,
  ChevronDown,
  Calendar,
  CheckCircle,
  Check,
} from '../components/icons/SimpleIcons';
import { Colors, Spacing, BorderRadius, Shadows } from '../constants/theme-v2';
import { formatMoney } from '../utils/money';
import { useCurrentUser } from '../hooks/useCurrentUser';
import {
  getBalanceSheet,
  getIncomeStatement,
  getJournalEntries,
  getLocalShopIds,
  BalanceSheetReport,
  IncomeStatementReport,
  JournalEntry,
} from '../db/reports';

// ============================================================
// Périodes
// ============================================================

type Period = 'jour' | 'semaine' | 'mois' | 'annee';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'jour', label: 'Jour' },
  { key: 'semaine', label: 'Semaine' },
  { key: 'mois', label: 'Mois' },
  { key: 'annee', label: 'Année' },
];

const MONTHS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

function getRange(period: Period): { start: string; end: string; label: string } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);

  switch (period) {
    case 'jour':
      start.setHours(0, 0, 0, 0);
      return { start: start.toISOString(), end: end.toISOString(), label: "Aujourd'hui" };
    case 'semaine': {
      // Début de semaine (lundi)
      const day = (start.getDay() + 6) % 7; // 0 = lundi
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      return { start: start.toISOString(), end: end.toISOString(), label: 'Cette semaine' };
    }
    case 'mois':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return {
        start: start.toISOString(),
        end: end.toISOString(),
        label: `${MONTHS_FR[now.getMonth()].replace(/^./, c => c.toUpperCase())} ${now.getFullYear()}`,
      };
    case 'annee':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      return {
        start: start.toISOString(),
        end: end.toISOString(),
        label: `Année ${now.getFullYear()}`,
      };
  }
}

// ============================================================
// Onglets de vue
// ============================================================

type ViewTab = 'journal' | 'grand_livre' | 'bilan' | 'resultat';

const VIEW_TABS: { key: ViewTab; label: string }[] = [
  { key: 'journal', label: 'Journal' },
  { key: 'grand_livre', label: 'Grand livre' },
  { key: 'bilan', label: 'Bilan' },
  { key: 'resultat', label: 'Résultat' },
];

// ============================================================
// Agrégation multi-boutiques
// ============================================================

const EMPTY_SHEET: BalanceSheetReport = {
  stockValue: 0,
  receivables: 0,
  cash: 0,
  totalActif: 0,
  debts: 0,
  equity: 0,
  totalPassif: 0,
};

const EMPTY_INCOME: IncomeStatementReport = {
  revenue: 0,
  cogs: 0,
  grossMargin: 0,
  rentCharges: 0,
  salaries: 0,
  transportMisc: 0,
  netProfit: 0,
};

function sumSheets(sheets: BalanceSheetReport[]): BalanceSheetReport {
  return sheets.reduce(
    (acc, s) => ({
      stockValue: acc.stockValue + s.stockValue,
      receivables: acc.receivables + s.receivables,
      cash: acc.cash + s.cash,
      totalActif: acc.totalActif + s.totalActif,
      debts: acc.debts + s.debts,
      equity: acc.equity + s.equity,
      totalPassif: acc.totalPassif + s.totalPassif,
    }),
    EMPTY_SHEET
  );
}

function sumIncomes(incomes: IncomeStatementReport[]): IncomeStatementReport {
  return incomes.reduce(
    (acc, i) => ({
      revenue: acc.revenue + i.revenue,
      cogs: acc.cogs + i.cogs,
      grossMargin: acc.grossMargin + i.grossMargin,
      rentCharges: acc.rentCharges + i.rentCharges,
      salaries: acc.salaries + i.salaries,
      transportMisc: acc.transportMisc + i.transportMisc,
      netProfit: acc.netProfit + i.netProfit,
    }),
    EMPTY_INCOME
  );
}

// ============================================================
// Sous-composants
// ============================================================

interface BalanceRowProps {
  label: string;
  amount: number;
  ratio: number;
  color: string;
}

function BalanceRow({ label, amount, ratio, color }: BalanceRowProps) {
  return (
    <View style={styles.balanceRow}>
      <View style={styles.balanceRowHeader}>
        <Text style={styles.balanceRowLabel}>{label}</Text>
        <Text style={styles.balanceRowAmount}>{formatMoney(amount)}</Text>
      </View>
      <View style={styles.balanceTrack}>
        <View
          style={[
            styles.balanceFill,
            { width: `${Math.max(2, Math.min(100, ratio * 100))}%`, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

// ============================================================
// Écran
// ============================================================

interface ComptabilityScreenProps {
  navigation: { goBack: () => void };
}

export default function ComptabilityScreen({ navigation }: ComptabilityScreenProps) {
  const { shopId, shop } = useCurrentUser();

  const [scope, setScope] = useState<'all' | string>('all');
  const [period, setPeriod] = useState<Period>('jour');
  const [tab, setTab] = useState<ViewTab>('bilan');
  const [scopeModal, setScopeModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<BalanceSheetReport>(EMPTY_SHEET);
  const [income, setIncome] = useState<IncomeStatementReport>(EMPTY_INCOME);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [shopIds, setShopIds] = useState<string[]>([]);

  const range = useMemo(() => getRange(period), [period]);

  const scopeLabel = useMemo(() => {
    if (scope === 'all') return 'Toutes les boutiques';
    if (scope === shopId && shop?.name) return shop.name;
    return 'Boutique sélectionnée';
  }, [scope, shopId, shop]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const local = await getLocalShopIds();
      const allIds = local.length > 0 ? local : shopId ? [shopId] : [];
      setShopIds(allIds);

      const ids = scope === 'all' ? allIds : [scope];
      if (ids.length === 0) {
        setSheet(EMPTY_SHEET);
        setIncome(EMPTY_INCOME);
        setJournal([]);
        return;
      }

      const [sheets, incomes, journals] = await Promise.all([
        Promise.all(ids.map(id => getBalanceSheet(id))),
        Promise.all(ids.map(id => getIncomeStatement(id, range.start, range.end))),
        Promise.all(ids.map(id => getJournalEntries(id, range.start, range.end))),
      ]);

      setSheet(sumSheets(sheets));
      setIncome(sumIncomes(incomes));
      setJournal(
        journals
          .flat()
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .slice(0, 100)
      );
    } finally {
      setLoading(false);
    }
  }, [scope, range.start, range.end, shopId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const balanced = Math.abs(sheet.totalActif - sheet.totalPassif) < 1;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Comptabilité"
        subtitle="Journal, grand livre & bilan"
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Périmètre */}
        <Pressable style={styles.scopeCard} onPress={() => setScopeModal(true)}>
          <View style={styles.scopeIcon}>
            <Building size={20} color={Colors.textColors.tertiary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.scopeLabel}>PÉRIMÈTRE</Text>
            <Text style={styles.scopeValue} numberOfLines={1}>
              {scopeLabel}
            </Text>
          </View>
          <ChevronDown size={20} color={Colors.textColors.tertiary} />
        </Pressable>

        {/* Période */}
        <View style={styles.periodRow}>
          {PERIODS.map(p => {
            const active = period === p.key;
            return (
              <Pressable
                key={p.key}
                onPress={() => setPeriod(p.key)}
                style={[styles.periodChip, active && styles.periodChipActive]}
              >
                <Text style={[styles.periodChipText, active && styles.periodChipTextActive]}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.periodLabelRow}>
          <Calendar size={14} color={Colors.textColors.disabled} />
          <Text style={styles.periodLabel}>Période : {range.label}</Text>
        </View>

        {/* Onglets de vue */}
        <View style={styles.tabRow}>
          {VIEW_TABS.map(t => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.action} style={{ marginTop: Spacing['3xl'] }} />
        ) : (
          <>
            {tab === 'bilan' && <BilanView sheet={sheet} balanced={balanced} />}
            {tab === 'resultat' && <ResultatView income={income} />}
            {tab === 'journal' && <JournalView entries={journal} />}
            {tab === 'grand_livre' && <GrandLivreView sheet={sheet} income={income} />}
          </>
        )}
      </ScrollView>

      {/* Sélecteur de périmètre */}
      <Modal
        visible={scopeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setScopeModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setScopeModal(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Périmètre</Text>
            <ScopeOption
              label="Toutes les boutiques"
              selected={scope === 'all'}
              onPress={() => {
                setScope('all');
                setScopeModal(false);
              }}
            />
            {shopIds.map(id => (
              <ScopeOption
                key={id}
                label={id === shopId && shop?.name ? shop.name : `Boutique ${id.slice(0, 6)}`}
                selected={scope === id}
                onPress={() => {
                  setScope(id);
                  setScopeModal(false);
                }}
              />
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function ScopeOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.scopeOption} onPress={onPress}>
      <Text style={[styles.scopeOptionText, selected && styles.scopeOptionTextActive]}>
        {label}
      </Text>
      {selected && <Check size={20} color={Colors.action} />}
    </Pressable>
  );
}

// ============================================================
// Vue Bilan
// ============================================================

function BilanView({ sheet, balanced }: { sheet: BalanceSheetReport; balanced: boolean }) {
  const actifMax = Math.max(sheet.stockValue, sheet.receivables, sheet.cash, 1);
  const passifMax = Math.max(sheet.debts, Math.abs(sheet.equity), 1);

  return (
    <>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Actif</Text>
          <Text style={[styles.cardTotal, { color: Colors.action }]}>
            {formatMoney(sheet.totalActif)}
          </Text>
        </View>
        <BalanceRow
          label="Stock marchandises"
          amount={sheet.stockValue}
          ratio={sheet.stockValue / actifMax}
          color={Colors.action}
        />
        <BalanceRow
          label="Créances clients"
          amount={sheet.receivables}
          ratio={sheet.receivables / actifMax}
          color={Colors.action}
        />
        <BalanceRow
          label="Caisse"
          amount={sheet.cash}
          ratio={sheet.cash / actifMax}
          color={Colors.action}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Passif</Text>
          <Text style={[styles.cardTotal, { color: Colors.warning.main }]}>
            {formatMoney(sheet.totalPassif)}
          </Text>
        </View>
        <BalanceRow
          label="Dettes fournisseurs"
          amount={sheet.debts}
          ratio={sheet.debts / passifMax}
          color={Colors.warning.main}
        />
        <BalanceRow
          label="Capital & résultat"
          amount={sheet.equity}
          ratio={Math.abs(sheet.equity) / passifMax}
          color={Colors.warning.main}
        />
      </View>

      {balanced && (
        <View style={styles.balancedBanner}>
          <CheckCircle size={18} color={Colors.success.main} />
          <Text style={styles.balancedText}>Bilan équilibré · Actif = Passif</Text>
        </View>
      )}
    </>
  );
}

// ============================================================
// Vue Résultat
// ============================================================

function ResultatView({ income }: { income: IncomeStatementReport }) {
  return (
    <View style={styles.card}>
      <View style={[styles.resultRow, styles.resultRowTop]}>
        <Text style={styles.resultLabelStrong}>Marge brute</Text>
        <Text style={[styles.resultAmountStrong, { color: Colors.action }]}>
          {formatMoney(income.grossMargin)}
        </Text>
      </View>

      <ResultLine label="Chiffre d'affaires" amount={income.revenue} positive />
      <ResultLine label="Coût des marchandises vendues" amount={-income.cogs} />
      <ResultLine label="Loyers & charges" amount={-income.rentCharges} />
      <ResultLine label="Salaires" amount={-income.salaries} />
      <ResultLine label="Transport & divers" amount={-income.transportMisc} />

      <View style={styles.resultDivider} />
      <View style={styles.resultRow}>
        <Text style={styles.netLabel}>Bénéfice net</Text>
        <Text
          style={[
            styles.netAmount,
            { color: income.netProfit >= 0 ? Colors.success.main : Colors.danger.main },
          ]}
        >
          {formatMoney(income.netProfit)}
        </Text>
      </View>
    </View>
  );
}

function ResultLine({
  label,
  amount,
  positive,
}: {
  label: string;
  amount: number;
  positive?: boolean;
}) {
  const isPos = positive || amount > 0;
  const display = `${amount < 0 ? '−' : ''}${formatMoney(amount)}`;
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text
        style={[styles.resultAmount, { color: isPos ? Colors.success.main : Colors.danger.main }]}
      >
        {display}
      </Text>
    </View>
  );
}

// ============================================================
// Vue Journal
// ============================================================

function JournalView({ entries }: { entries: JournalEntry[] }) {
  if (entries.length === 0) {
    return <Text style={styles.emptyText}>Aucune écriture sur la période.</Text>;
  }
  return (
    <View style={styles.card}>
      {entries.map((e, i) => (
        <View
          key={e.id}
          style={[styles.journalRow, i < entries.length - 1 && styles.journalDivider]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.journalLabel} numberOfLines={1}>
              {e.label}
            </Text>
            <Text style={styles.journalRef}>{e.reference}</Text>
          </View>
          <Text
            style={[
              styles.journalAmount,
              { color: e.amount >= 0 ? Colors.success.main : Colors.danger.main },
            ]}
          >
            {`${e.amount < 0 ? '−' : '+'}${formatMoney(e.amount)}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ============================================================
// Vue Grand livre
// ============================================================

function GrandLivreView({
  sheet,
  income,
}: {
  sheet: BalanceSheetReport;
  income: IncomeStatementReport;
}) {
  const accounts: { label: string; amount: number; color: string }[] = [
    { label: 'Caisse', amount: sheet.cash, color: Colors.action },
    { label: 'Stock marchandises', amount: sheet.stockValue, color: Colors.action },
    { label: 'Créances clients', amount: sheet.receivables, color: Colors.action },
    { label: 'Dettes fournisseurs', amount: sheet.debts, color: Colors.warning.main },
    { label: "Ventes (chiffre d'affaires)", amount: income.revenue, color: Colors.success.main },
    {
      label: 'Charges & achats',
      amount: income.cogs + income.rentCharges + income.salaries + income.transportMisc,
      color: Colors.danger.main,
    },
  ];
  return (
    <View style={styles.card}>
      {accounts.map((a, i) => (
        <View
          key={a.label}
          style={[styles.journalRow, i < accounts.length - 1 && styles.journalDivider]}
        >
          <Text style={styles.ledgerLabel}>{a.label}</Text>
          <Text style={[styles.ledgerAmount, { color: a.color }]}>{formatMoney(a.amount)}</Text>
        </View>
      ))}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: 100 },

  // Périmètre
  scopeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  scopeIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scopeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textColors.tertiary,
    letterSpacing: 0.8,
  },
  scopeValue: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: 1 },

  // Période
  periodRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  periodChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    borderRadius: 999,
  },
  periodChipActive: { backgroundColor: Colors.action },
  periodChipText: { fontSize: 14, fontWeight: '600', color: Colors.textColors.tertiary },
  periodChipTextActive: { color: '#FFFFFF' },
  periodLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Spacing.md },
  periodLabel: { fontSize: 13, color: Colors.textColors.disabled },

  // Onglets
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: 4,
    marginTop: Spacing.lg,
    ...Shadows.sm,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: BorderRadius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.primary[900] },
  tabText: { fontSize: 13.5, fontWeight: '600', color: Colors.textColors.tertiary },
  tabTextActive: { color: '#FFFFFF' },

  // Cartes
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  cardTotal: { fontSize: 17, fontWeight: '700' },

  // Lignes de bilan
  balanceRow: { marginTop: Spacing.md },
  balanceRowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  balanceRowLabel: { fontSize: 14.5, color: Colors.textColors.secondary },
  balanceRowAmount: { fontSize: 14.5, fontWeight: '700', color: Colors.text },
  balanceTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
  balanceFill: { height: 6, borderRadius: 3 },

  balancedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.success.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  balancedText: { fontSize: 14, fontWeight: '600', color: Colors.success.text },

  // Résultat
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  resultRowTop: { paddingTop: 0, paddingBottom: Spacing.md },
  resultLabelStrong: { fontSize: 16, fontWeight: '700', color: Colors.text },
  resultAmountStrong: { fontSize: 18, fontWeight: '800' },
  resultLabel: {
    fontSize: 14.5,
    color: Colors.textColors.secondary,
    flex: 1,
    paddingRight: Spacing.md,
  },
  resultAmount: { fontSize: 14.5, fontWeight: '600' },
  resultDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  netLabel: { fontSize: 16, fontWeight: '700', color: Colors.text },
  netAmount: { fontSize: 20, fontWeight: '800' },

  // Journal
  journalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  journalDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  journalLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  journalRef: { fontSize: 12.5, color: Colors.textColors.tertiary, marginTop: 2 },
  journalAmount: { fontSize: 15, fontWeight: '700' },
  ledgerLabel: { fontSize: 15, color: Colors.textColors.secondary },
  ledgerAmount: { fontSize: 15, fontWeight: '700' },

  emptyText: {
    textAlign: 'center',
    color: Colors.textColors.tertiary,
    marginTop: Spacing['3xl'],
    fontSize: 14,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.sheet,
    borderTopRightRadius: BorderRadius.sheet,
    padding: Spacing.xl,
    paddingBottom: Spacing['3xl'],
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  scopeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  scopeOptionText: { fontSize: 16, color: Colors.textColors.secondary },
  scopeOptionTextActive: { color: Colors.action, fontWeight: '700' },
});
