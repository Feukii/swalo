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
import { getLocalShopIds } from '../db/reports';
import { getAccountingData, AccountingData } from '../db/accounting';

// ── Périodes ────────────────────────────────────────────────────────────────
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
      const day = (start.getDay() + 6) % 7;
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

// ── Onglets ─────────────────────────────────────────────────────────────────
type ViewTab = 'journal' | 'grand_livre' | 'bilan' | 'resultat';
const VIEW_TABS: { key: ViewTab; label: string }[] = [
  { key: 'journal', label: 'Journal' },
  { key: 'grand_livre', label: 'Grand livre' },
  { key: 'bilan', label: 'Bilan' },
  { key: 'resultat', label: 'Résultat' },
];

interface ComptabilityScreenProps {
  navigation: { goBack: () => void };
}

export default function ComptabilityScreen({ navigation }: ComptabilityScreenProps) {
  const { shopId, shop } = useCurrentUser();
  const [scope, setScope] = useState<'all' | string>('all');
  const [period, setPeriod] = useState<Period>('mois');
  const [tab, setTab] = useState<ViewTab>('bilan');
  const [scopeModal, setScopeModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AccountingData | null>(null);
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
        setData(null);
        return;
      }
      setData(await getAccountingData(ids, range.start, range.end));
    } finally {
      setLoading(false);
    }
  }, [scope, range.start, range.end, shopId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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

        {/* Onglets */}
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
        ) : !data ? (
          <Text style={styles.emptyText}>Aucune donnée comptable.</Text>
        ) : (
          <>
            {tab === 'bilan' && <BilanView data={data} />}
            {tab === 'resultat' && <ResultatView data={data} />}
            {tab === 'journal' && <JournalView data={data} />}
            {tab === 'grand_livre' && <GrandLivreView data={data} />}
          </>
        )}
      </ScrollView>

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

// ── Bilan ─────────────────────────────────────────────────────────────────
function BilanView({ data }: { data: AccountingData }) {
  const b = data.bilan;
  return (
    <>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Actif</Text>
          <Text style={[styles.cardTotal, { color: Colors.action }]}>
            {formatMoney(b.totalActif)}
          </Text>
        </View>
        {b.actif.map(l => (
          <View key={l.account} style={styles.kvRow}>
            <Text style={styles.kvLabel}>{l.name}</Text>
            <Text style={styles.kvAmount}>{formatMoney(l.montant)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Passif</Text>
          <Text style={[styles.cardTotal, { color: Colors.warning.main }]}>
            {formatMoney(b.totalPassif)}
          </Text>
        </View>
        {b.passif.map(l => (
          <View key={l.account} style={styles.kvRow}>
            <Text style={styles.kvLabel}>{l.name}</Text>
            <Text style={[styles.kvAmount, l.montant < 0 && { color: Colors.danger.main }]}>
              {formatMoney(l.montant)}
            </Text>
          </View>
        ))}
      </View>
      {b.equilibre && (
        <View style={styles.balancedBanner}>
          <CheckCircle size={18} color={Colors.success.main} />
          <Text style={styles.balancedText}>Bilan équilibré · Actif = Passif</Text>
        </View>
      )}
    </>
  );
}

// ── Résultat ──────────────────────────────────────────────────────────────
function ResultatView({ data }: { data: AccountingData }) {
  const r = data.resultat;
  return (
    <View style={styles.card}>
      <View style={[styles.resultRow, styles.resultRowTop]}>
        <Text style={styles.resultLabelStrong}>Marge brute</Text>
        <Text style={[styles.resultAmountStrong, { color: Colors.action }]}>
          {formatMoney(r.margeBrute)}
        </Text>
      </View>
      <ResultLine label="Chiffre d'affaires" amount={r.ca} positive />
      <ResultLine label="Coût des marchandises vendues" amount={-r.cogs} />
      {r.charges.map(c => (
        <ResultLine key={c.account} label={c.name} amount={-c.montant} />
      ))}
      {r.autresProduits > 0 && (
        <ResultLine label="Autres produits" amount={r.autresProduits} positive />
      )}
      <View style={styles.resultDivider} />
      <View style={styles.resultRow}>
        <Text style={styles.netLabel}>Bénéfice net</Text>
        <Text
          style={[
            styles.netAmount,
            { color: r.beneficeNet >= 0 ? Colors.success.main : Colors.danger.main },
          ]}
        >
          {formatMoney(r.beneficeNet)}
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
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text
        style={[styles.resultAmount, { color: isPos ? Colors.success.main : Colors.danger.main }]}
      >
        {`${amount < 0 ? '−' : ''}${formatMoney(amount)}`}
      </Text>
    </View>
  );
}

// ── Journal (écritures) ─────────────────────────────────────────────────────
function JournalView({ data }: { data: AccountingData }) {
  if (data.journal.length === 0) {
    return <Text style={styles.emptyText}>Aucune écriture sur la période.</Text>;
  }
  return (
    <View style={{ gap: Spacing.md }}>
      {data.journal.map((e, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.journalLibelle}>{e.libelle}</Text>
          {e.lines.map((l, j) => (
            <View key={j} style={styles.ecritureRow}>
              <Text style={styles.ecritureAccount} numberOfLines={1}>
                {l.account} · {l.name}
              </Text>
              <Text style={styles.ecritureDebit}>{l.debit ? formatMoney(l.debit) : ''}</Text>
              <Text style={styles.ecritureCredit}>{l.credit ? formatMoney(l.credit) : ''}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ── Grand livre ─────────────────────────────────────────────────────────────
function GrandLivreView({ data }: { data: AccountingData }) {
  if (data.grandLivre.length === 0) {
    return <Text style={styles.emptyText}>Aucun mouvement sur la période.</Text>;
  }
  return (
    <View style={styles.card}>
      <View style={styles.glHeaderRow}>
        <Text style={[styles.glHead, { flex: 1 }]}>COMPTE</Text>
        <Text style={styles.glHeadNum}>DÉBIT</Text>
        <Text style={styles.glHeadNum}>CRÉDIT</Text>
        <Text style={styles.glHeadNum}>SOLDE</Text>
      </View>
      {data.grandLivre.map((acc, i) => (
        <View
          key={acc.account}
          style={[styles.glRow, i < data.grandLivre.length - 1 && styles.glDivider]}
        >
          <Text style={[styles.glLabel, { flex: 1 }]} numberOfLines={1}>
            {acc.account} · {acc.name}
          </Text>
          <Text style={styles.glNum}>{acc.debit ? formatMoney(acc.debit) : '—'}</Text>
          <Text style={styles.glNum}>{acc.credit ? formatMoney(acc.credit) : '—'}</Text>
          <Text style={[styles.glNum, styles.glSolde]}>{formatMoney(acc.solde)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: 100 },
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
  periodRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  periodChip: { paddingHorizontal: Spacing.lg, paddingVertical: 8, borderRadius: 999 },
  periodChipActive: { backgroundColor: Colors.action },
  periodChipText: { fontSize: 14, fontWeight: '600', color: Colors.textColors.tertiary },
  periodChipTextActive: { color: '#FFFFFF' },
  periodLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Spacing.md },
  periodLabel: { fontSize: 13, color: Colors.textColors.disabled },
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
    marginBottom: Spacing.sm,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  cardTotal: { fontSize: 17, fontWeight: '700' },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  kvLabel: {
    fontSize: 14.5,
    color: Colors.textColors.secondary,
    flex: 1,
    paddingRight: Spacing.md,
  },
  kvAmount: { fontSize: 14.5, fontWeight: '700', color: Colors.text },
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
  journalLibelle: { fontSize: 14.5, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  ecritureRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  ecritureAccount: { flex: 1, fontSize: 13, color: Colors.textColors.secondary, paddingRight: 6 },
  ecritureDebit: {
    width: 90,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.action,
    textAlign: 'right',
  },
  ecritureCredit: {
    width: 90,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.warning.main,
    textAlign: 'right',
  },
  glHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  glHead: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.textColors.tertiary,
    letterSpacing: 0.5,
  },
  glHeadNum: {
    width: 76,
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.textColors.tertiary,
    textAlign: 'right',
    letterSpacing: 0.5,
  },
  glRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  glDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  glLabel: { fontSize: 13, color: Colors.textColors.secondary, paddingRight: 6 },
  glNum: { width: 76, fontSize: 12.5, color: Colors.textColors.secondary, textAlign: 'right' },
  glSolde: { fontWeight: '700', color: Colors.text },
  emptyText: {
    textAlign: 'center',
    color: Colors.textColors.tertiary,
    marginTop: Spacing['3xl'],
    fontSize: 14,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
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
