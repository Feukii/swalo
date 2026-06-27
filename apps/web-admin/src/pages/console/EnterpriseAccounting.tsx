import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { adminApi, type AdminShopAccounting } from '../../lib/api';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Full FCFA: 69600 -> "69 600 F". */
function formatFcfa(value: number): string {
  return `${Math.round(value).toLocaleString('fr-FR').replace(/[\u00A0\u202F]/g, ' ')} F`;
}

/** Signed FCFA for journal/résultat rows: -1200 -> "−1 200 F". */
function formatFcfaSigned(value: number): string {
  if (value < 0) return `−${formatFcfa(-value)}`;
  return formatFcfa(value);
}

/** "2026-06-12T…" -> "12 juin". */
function formatDateShort(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EnterpriseAccounting() {
  const { shopId } = useParams<{ enterpriseId: string; shopId: string }>();

  const [data, setData] = useState<AdminShopAccounting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await adminApi.getShopAccounting(shopId);
        if (!cancelled) setData(result);
      } catch {
        if (!cancelled) setError('Impossible de charger la comptabilité de cette boutique.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [shopId]);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <PageHeading />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-2xl shadow-card animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-72 bg-white rounded-2xl shadow-card animate-pulse" />
          <div className="h-72 bg-white rounded-2xl shadow-card animate-pulse" />
        </div>
        <div className="h-64 bg-white rounded-2xl shadow-card animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-5">
        <PageHeading />
        <div className="bg-white rounded-2xl shadow-card p-10 text-center">
          <p className="text-danger-700 font-medium">
            {error ?? 'Aucune donnée comptable disponible.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-action-500 text-white rounded-lg hover:bg-action-600 transition-colors text-sm"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const { balance_sheet: bilan, income_statement: resultat, journal } = data;
  const isBalanced = bilan.total_actif === bilan.total_passif;

  return (
    <div className="space-y-5">
      <PageHeading />

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Actif total" value={formatFcfa(bilan.total_actif)} />
        <KpiCard label="Passif total" value={formatFcfa(bilan.total_passif)} />
        <KpiCard
          label="Bénéfice net"
          value={formatFcfaSigned(resultat.net_profit)}
          accent={resultat.net_profit >= 0 ? 'success' : 'danger'}
        />
      </div>

      {/* Bilan + Compte de résultat */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bilan */}
        <div className="bg-white rounded-2xl shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-primary-900">Bilan</h2>
            {isBalanced && (
              <span className="inline-flex rounded-full bg-success-100 px-2.5 py-0.5 text-xs font-medium text-success-800">
                Bilan équilibré
              </span>
            )}
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
            Actif
          </p>
          <div className="divide-y divide-slate-100">
            <AmountRow label="Stock marchandises" value={formatFcfa(bilan.stock_value)} />
            <AmountRow label="Créances clients" value={formatFcfa(bilan.receivables)} />
            <AmountRow label="Caisse" value={formatFcfa(bilan.cash)} />
            <AmountRow label="Total actif" value={formatFcfa(bilan.total_actif)} strong />
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1 mt-5">
            Passif
          </p>
          <div className="divide-y divide-slate-100">
            <AmountRow label="Dettes fournisseurs" value={formatFcfa(bilan.debts)} />
            <AmountRow label="Capital & résultat" value={formatFcfa(bilan.equity)} />
            <AmountRow label="Total passif" value={formatFcfa(bilan.total_passif)} strong />
          </div>
        </div>

        {/* Compte de résultat */}
        <div className="bg-white rounded-2xl shadow-card p-6">
          <h2 className="text-base font-semibold text-primary-900 mb-4">Compte de résultat</h2>
          <div className="divide-y divide-slate-100">
            <AmountRow label="Chiffre d'affaires" value={formatFcfa(resultat.revenue)} />
            <AmountRow
              label="Coût des marchandises vendues"
              value={formatFcfaSigned(-resultat.cogs)}
              negative
            />
            <AmountRow label="Marge brute" value={formatFcfa(resultat.gross_margin)} strong />
            <AmountRow
              label="Loyers & charges"
              value={formatFcfaSigned(-resultat.rent_charges)}
              negative
            />
            <AmountRow
              label="Salaires"
              value={formatFcfaSigned(-resultat.salaries)}
              negative
            />
            <AmountRow
              label="Transport & divers"
              value={formatFcfaSigned(-resultat.transport_misc)}
              negative
            />
            <AmountRow
              label="Bénéfice net"
              value={formatFcfaSigned(resultat.net_profit)}
              strong
              accent={resultat.net_profit >= 0 ? 'success' : 'danger'}
            />
          </div>
        </div>
      </div>

      {/* Journal */}
      <div className="bg-white rounded-2xl shadow-card p-6">
        <h2 className="text-base font-semibold text-primary-900 mb-4">Journal</h2>
        {journal.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Aucune écriture au journal.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Libellé</th>
                  <th className="pb-3 pr-4">Référence</th>
                  <th className="pb-3 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {journal.map(entry => (
                  <tr key={entry.id} className="text-sm">
                    <td className="py-3 pr-4 text-slate-500">{formatDateShort(entry.created_at)}</td>
                    <td className="py-3 pr-4 font-medium text-primary-900">{entry.label}</td>
                    <td className="py-3 pr-4 text-slate-500">{entry.reference || '—'}</td>
                    <td
                      className={`py-3 text-right font-semibold ${
                        entry.amount < 0 ? 'text-danger-600' : 'text-primary-900'
                      }`}
                    >
                      {formatFcfaSigned(entry.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presentational pieces
// ---------------------------------------------------------------------------

function PageHeading() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-primary-900">Comptabilité</h1>
      <p className="text-sm text-slate-500 mt-0.5">
        Bilan &amp; compte de résultat · <span className="text-slate-400">Vue lecture seule</span>
      </p>
    </div>
  );
}

function KpiCard({
  value,
  label,
  accent = 'default',
}: {
  value: string;
  label: string;
  accent?: 'default' | 'success' | 'danger';
}) {
  const valueClass =
    accent === 'success'
      ? 'text-success-600'
      : accent === 'danger'
        ? 'text-danger-600'
        : 'text-primary-900';
  return (
    <div className="bg-white rounded-2xl shadow-card px-5 py-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-2xl font-bold leading-tight mt-1 ${valueClass}`}>{value}</p>
    </div>
  );
}

function AmountRow({
  label,
  value,
  strong = false,
  negative = false,
  accent = 'default',
}: {
  label: string;
  value: string;
  strong?: boolean;
  negative?: boolean;
  accent?: 'default' | 'success' | 'danger';
}) {
  const valueClass =
    accent === 'success'
      ? 'text-success-600'
      : accent === 'danger'
        ? 'text-danger-600'
        : negative
          ? 'text-danger-600'
          : 'text-primary-900';
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <span className={strong ? 'font-semibold text-primary-900' : 'text-slate-600'}>{label}</span>
      <span className={`${strong ? 'font-bold' : 'font-medium'} ${valueClass}`}>{value}</span>
    </div>
  );
}
