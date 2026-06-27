import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { accountingApi } from '../lib/api';
import type { AccountingReport, AccountingLedgerAccount } from '../lib/api';

/** Formatte un montant entier en FCFA -> "12 345 F" (aucune division). */
function formatF(value: number): string {
  const amount = Math.round(value ?? 0);
  return `${new Intl.NumberFormat('fr-FR').format(amount)} F`;
}

/** "2026-06-12T…" -> "12 juin". */
function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
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

/** Ligne montant simple (libellé -> valeur). */
function AmountRow({
  label,
  value,
  strong = false,
  color,
}: {
  label: string;
  value: number;
  strong?: boolean;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className={`text-sm ${strong ? 'font-semibold text-primary-900' : 'text-slate-600'}`}>
        {label}
      </span>
      <span
        className={`text-sm whitespace-nowrap ${strong ? 'font-bold' : 'font-semibold'} ${
          color ?? 'text-primary-900'
        }`}
      >
        {formatF(value)}
      </span>
    </div>
  );
}

/** Ligne d'un compte du grand livre, dépliable pour voir les mouvements. */
function LedgerRow({ account }: { account: AccountingLedgerAccount }) {
  const [open, setOpen] = useState(false);
  const hasMovements = account.mouvements.length > 0;

  return (
    <div className="py-3">
      <button
        type="button"
        onClick={() => hasMovements && setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          {hasMovements && (
            <span className="text-xs text-slate-400">{open ? '▾' : '▸'}</span>
          )}
          <span className="truncate text-sm font-medium text-primary-900">
            <span className="text-slate-400">{account.account}</span> {account.name}
          </span>
        </span>
        <span className="flex items-center gap-4 whitespace-nowrap text-sm">
          <span className="text-success-600">{formatF(account.debit)}</span>
          <span className="text-danger-600">{formatF(account.credit)}</span>
          <span className="w-28 text-right font-semibold text-primary-900">
            {formatF(account.solde)}
          </span>
        </span>
      </button>

      {open && hasMovements && (
        <div className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="pb-2 pr-4 font-medium">Date</th>
                <th className="pb-2 pr-4 font-medium">Libellé</th>
                <th className="pb-2 pr-4 text-right font-medium">Débit</th>
                <th className="pb-2 text-right font-medium">Crédit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {account.mouvements.map((m, i) => (
                <tr key={`${m.date}-${i}`}>
                  <td className="py-1.5 pr-4 text-slate-500">{formatDateShort(m.date)}</td>
                  <td className="py-1.5 pr-4 text-slate-700">{m.libelle}</td>
                  <td className="py-1.5 pr-4 text-right text-success-600">
                    {m.debit ? formatF(m.debit) : '—'}
                  </td>
                  <td className="py-1.5 text-right text-danger-600">
                    {m.credit ? formatF(m.credit) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

  if (!canView) {
    return null;
  }

  const journal = report?.journal ?? [];
  const grandLivre = report?.grand_livre ?? [];
  const bilan = report?.bilan ?? null;
  const resultat = report?.resultat ?? null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* En-tête */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Comptabilité</h1>
          <p className="text-sm text-slate-500 mt-1">
            Journal, grand livre, bilan &amp; résultat (partie double)
          </p>
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
      ) : !report || !bilan || !resultat ? (
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
                <div className="space-y-5">
                  {journal.map((entry, idx) => {
                    const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0);
                    const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0);
                    return (
                      <div
                        key={`${entry.date}-${idx}`}
                        className="rounded-xl border border-slate-100 p-4"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-primary-900">{entry.libelle}</p>
                          <span className="text-xs text-slate-400">
                            {formatDateShort(entry.date)}
                          </span>
                        </div>
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                              <th className="pb-2 pr-4">Compte</th>
                              <th className="pb-2 pr-4 text-right">Débit</th>
                              <th className="pb-2 text-right">Crédit</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {entry.lines.map((line, i) => (
                              <tr key={`${line.account}-${i}`}>
                                <td className="py-2 pr-4 text-slate-700">
                                  <span className="text-slate-400">{line.account}</span> {line.name}
                                </td>
                                <td className="py-2 pr-4 text-right text-success-600">
                                  {line.debit ? formatF(line.debit) : '—'}
                                </td>
                                <td className="py-2 text-right text-danger-600">
                                  {line.credit ? formatF(line.credit) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-slate-200 text-xs font-semibold text-primary-900">
                              <td className="pt-2 pr-4 text-right">Total</td>
                              <td className="pt-2 pr-4 text-right">{formatF(totalDebit)}</td>
                              <td className="pt-2 text-right">{formatF(totalCredit)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* GRAND LIVRE */}
          {tab === 'ledger' && (
            <div className="card">
              <h2 className="text-lg font-bold text-primary-900 mb-4">Grand livre</h2>
              {grandLivre.length === 0 ? (
                <p className="text-center text-slate-400 py-10">Aucun compte mouvementé</p>
              ) : (
                <>
                  <div className="flex items-center justify-end gap-4 pb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    <span>Débit</span>
                    <span>Crédit</span>
                    <span className="w-28 text-right">Solde</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {grandLivre.map(acc => (
                      <LedgerRow key={acc.account} account={acc} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* BILAN */}
          {tab === 'balance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Actif */}
                <div className="card">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold text-primary-900">Actif</h2>
                    <span className="text-xl font-bold text-action-600">
                      {formatF(bilan.totalActif)}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {bilan.actif.map(row => (
                      <AmountRow
                        key={row.account}
                        label={`${row.account} ${row.name}`}
                        value={row.montant}
                      />
                    ))}
                  </div>
                </div>

                {/* Passif */}
                <div className="card">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold text-primary-900">Passif</h2>
                    <span className="text-xl font-bold text-warning-600">
                      {formatF(bilan.totalPassif)}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {bilan.passif.map(row => (
                      <AmountRow
                        key={row.account}
                        label={`${row.account} ${row.name}`}
                        value={row.montant}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {bilan.equilibre && (
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
                  {formatF(resultat.margeBrute)}
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                <div className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm text-slate-600">Chiffre d&apos;affaires</span>
                  <span className="text-sm font-semibold text-success-600">
                    +{formatF(resultat.ca)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm text-slate-600">Coût des marchandises vendues</span>
                  <span className="text-sm font-semibold text-danger-600">
                    −{formatF(resultat.cogs)}
                  </span>
                </div>
                {resultat.charges.map(charge => (
                  <div
                    key={charge.account}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <span className="text-sm text-slate-600">
                      {charge.account} {charge.name}
                    </span>
                    <span className="text-sm font-semibold text-danger-600">
                      −{formatF(charge.montant)}
                    </span>
                  </div>
                ))}
                {resultat.autresProduits > 0 && (
                  <div className="flex items-center justify-between gap-3 py-3">
                    <span className="text-sm text-slate-600">Autres produits</span>
                    <span className="text-sm font-semibold text-success-600">
                      +{formatF(resultat.autresProduits)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t-2 border-slate-200">
                <span className="text-base font-bold text-primary-900">Bénéfice net</span>
                <span
                  className={`text-3xl font-bold ${
                    resultat.beneficeNet >= 0 ? 'text-success-600' : 'text-danger-600'
                  }`}
                >
                  {formatF(resultat.beneficeNet)}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
