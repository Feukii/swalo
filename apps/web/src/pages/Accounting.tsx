import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { accountingApi } from '../lib/api';
import type { AccountingReport } from '../lib/api';

/** Formatte un montant en centimes -> "12 345 F". */
function formatF(cents: number): string {
  const amount = Math.round((cents ?? 0) / 100);
  return `${new Intl.NumberFormat('fr-FR').format(amount)} F`;
}

type Period = 'day' | 'week' | 'month' | 'year';
type Tab = 'journal' | 'ledger' | 'balance' | 'income';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'day', label: 'Jour' },
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
  { id: 'year', label: 'Année' },
];

const TABS: { id: Tab; label: string }[] = [
  { id: 'journal', label: 'Journal' },
  { id: 'ledger', label: 'Grand livre' },
  { id: 'balance', label: 'Bilan' },
  { id: 'income', label: 'Résultat' },
];

/** Calcule la fenêtre [start_date, end_date] (ISO) pour la période choisie. */
function computeRange(period: Period): { start_date: string; end_date: string } {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);

  switch (period) {
    case 'day':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      start.setHours(0, 0, 0, 0);
      break;
  }

  return { start_date: start.toISOString(), end_date: end.toISOString() };
}

/** Ligne de bilan avec mini barre de progression. */
function BalanceRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.max(Math.min((value / total) * 100, 100), 2) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-slate-600">{label}</span>
        <span className="text-sm font-semibold text-primary-900">{formatF(value)}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Accounting() {
  const navigate = useNavigate();
  const { can, isPermissive } = usePermissions();
  const canView = isPermissive || can('reports', 'view');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AccountingReport | null>(null);
  const [period, setPeriod] = useState<Period>('month');
  const [tab, setTab] = useState<Tab>('journal');

  const loadReport = useCallback(async (p: Period) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await accountingApi.getReport(computeRange(p));
      setReport(data);
    } catch {
      setError('Impossible de charger la comptabilité. Veuillez réessayer.');
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) {
      navigate('/');
      return;
    }
    loadReport(period);
  }, [canView, navigate, loadReport, period]);

  const ledgerAccounts = useMemo(() => {
    if (!report) return [];
    const bs = report.balance_sheet;
    const is = report.income_statement;
    return [
      { label: 'Caisse', amount: bs.cash },
      { label: 'Stock marchandises', amount: bs.stock_value },
      { label: 'Créances clients', amount: bs.receivables },
      { label: 'Dettes fournisseurs', amount: bs.debts },
      { label: 'Ventes', amount: is.revenue },
      {
        label: 'Charges & achats',
        amount: is.cogs + is.rent_charges + is.salaries + is.transport_misc,
      },
    ];
  }, [report]);

  if (!canView) {
    return null;
  }

  const bs = report?.balance_sheet ?? null;
  const is = report?.income_statement ?? null;
  const journal = report?.journal ?? [];
  const balanced = bs ? bs.total_actif === bs.total_passif : false;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* En-tête */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Comptabilité</h1>
          <p className="text-sm text-slate-500 mt-1">Journal, grand livre &amp; bilan</p>
        </div>

        {/* Contrôle segmenté période */}
        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 self-start">
          {PERIODS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                period === p.id
                  ? 'bg-primary-900 text-white shadow-card'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Onglets */}
      <div className="inline-flex items-center gap-1 rounded-xl bg-white shadow-card p-1">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-primary-900 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-16">
          <div className="inline-block w-12 h-12 spinner" />
        </div>
      ) : error ? (
        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-danger-50 flex items-center justify-center">
            <span className="text-3xl">⚠️</span>
          </div>
          <p className="text-slate-600 mb-4">{error}</p>
          <button type="button" className="btn-primary" onClick={() => loadReport(period)}>
            Réessayer
          </button>
        </div>
      ) : !report || !bs || !is ? (
        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
            <span className="text-3xl">🧮</span>
          </div>
          <p className="text-slate-500">Aucune donnée comptable à afficher</p>
        </div>
      ) : (
        <>
          {/* JOURNAL */}
          {tab === 'journal' && (
            <div className="card">
              <h2 className="text-lg font-bold text-primary-900 mb-4">Journal</h2>
              {journal.length === 0 ? (
                <p className="text-center text-slate-400 py-10">Aucune écriture sur la période</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {journal.map(entry => (
                    <div key={entry.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-primary-900 truncate">
                          {entry.label}
                        </p>
                        <p className="text-xs text-slate-400 truncate">{entry.reference}</p>
                      </div>
                      <span
                        className={`text-sm font-semibold whitespace-nowrap ${
                          entry.amount >= 0 ? 'text-success-600' : 'text-danger-600'
                        }`}
                      >
                        {entry.amount >= 0 ? '+' : '−'}
                        {formatF(Math.abs(entry.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* GRAND LIVRE */}
          {tab === 'ledger' && (
            <div className="card">
              <h2 className="text-lg font-bold text-primary-900 mb-4">Grand livre</h2>
              <div className="divide-y divide-slate-100">
                {ledgerAccounts.map(acc => (
                  <div key={acc.label} className="flex items-center justify-between gap-3 py-3">
                    <span className="text-sm font-medium text-primary-900">{acc.label}</span>
                    <span className="text-sm font-semibold text-primary-900 whitespace-nowrap">
                      {formatF(acc.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BILAN */}
          {tab === 'balance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Actif */}
                <div className="card">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-primary-900">Actif</h2>
                    <span className="text-xl font-bold text-action-600">
                      {formatF(bs.total_actif)}
                    </span>
                  </div>
                  <div className="space-y-4">
                    <BalanceRow
                      label="Stock marchandises"
                      value={bs.stock_value}
                      total={bs.total_actif}
                      color="bg-action-500"
                    />
                    <BalanceRow
                      label="Créances clients"
                      value={bs.receivables}
                      total={bs.total_actif}
                      color="bg-action-500"
                    />
                    <BalanceRow
                      label="Caisse"
                      value={bs.cash}
                      total={bs.total_actif}
                      color="bg-action-500"
                    />
                  </div>
                </div>

                {/* Passif */}
                <div className="card">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-primary-900">Passif</h2>
                    <span className="text-xl font-bold text-warning-600">
                      {formatF(bs.total_passif)}
                    </span>
                  </div>
                  <div className="space-y-4">
                    <BalanceRow
                      label="Dettes fournisseurs"
                      value={bs.debts}
                      total={bs.total_passif}
                      color="bg-warning-500"
                    />
                    <BalanceRow
                      label="Capital & résultat"
                      value={bs.equity}
                      total={bs.total_passif}
                      color="bg-warning-500"
                    />
                  </div>
                </div>
              </div>

              {balanced && (
                <div className="flex items-center gap-2 rounded-xl bg-success-50 px-4 py-3 text-sm font-semibold text-success-700">
                  <span className="text-base">✅</span>
                  Bilan équilibré · Actif = Passif
                </div>
              )}
            </div>
          )}

          {/* RÉSULTAT */}
          {tab === 'income' && (
            <div className="card max-w-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <span className="text-base font-semibold text-primary-900">Marge brute</span>
                <span className="text-2xl font-bold text-action-600">
                  {formatF(is.gross_margin)}
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                <div className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm text-slate-600">Chiffre d&apos;affaires</span>
                  <span className="text-sm font-semibold text-success-600">
                    +{formatF(is.revenue)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm text-slate-600">Coût des marchandises vendues</span>
                  <span className="text-sm font-semibold text-danger-600">
                    −{formatF(is.cogs)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm text-slate-600">Loyers &amp; charges</span>
                  <span className="text-sm font-semibold text-danger-600">
                    −{formatF(is.rent_charges)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm text-slate-600">Salaires</span>
                  <span className="text-sm font-semibold text-danger-600">
                    −{formatF(is.salaries)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm text-slate-600">Transport &amp; divers</span>
                  <span className="text-sm font-semibold text-danger-600">
                    −{formatF(is.transport_misc)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t-2 border-slate-200">
                <span className="text-base font-bold text-primary-900">Bénéfice net</span>
                <span
                  className={`text-3xl font-bold ${
                    is.net_profit >= 0 ? 'text-success-600' : 'text-danger-600'
                  }`}
                >
                  {formatF(is.net_profit)}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
