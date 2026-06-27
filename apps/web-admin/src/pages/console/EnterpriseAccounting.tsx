import { Fragment, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { adminApi, type AdminShopAccounting } from '../../lib/api';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** FCFA entier (aucune division) : 69600 -> "69 600 F". */
function formatFcfa(value: number): string {
  return `${Math.round(value).toLocaleString('fr-FR').replace(/[\u00A0\u202F]/g, ' ')} F`;
}

/** FCFA signÃ© pour les lignes du rÃ©sultat : -1200 -> "âˆ’1 200 F". */
function formatFcfaSigned(value: number): string {
  if (value < 0) return `âˆ’${formatFcfa(-value)}`;
  return formatFcfa(value);
}

/** "2026-06-12Tâ€¦" -> "12 juin". */
function formatDateShort(iso: string | null): string {
  if (!iso) return 'â€”';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'â€”';
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
        if (!cancelled) setError('Impossible de charger la comptabilitÃ© de cette boutique.');
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
            {error ?? 'Aucune donnÃ©e comptable disponible.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-action-500 text-white rounded-lg hover:bg-action-600 transition-colors text-sm"
          >
            RÃ©essayer
          </button>
        </div>
      </div>
    );
  }

  const { bilan, resultat, journal, grand_livre: grandLivre } = data;

  return (
    <div className="space-y-5">
      <PageHeading />

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Actif total" value={formatFcfa(bilan.totalActif)} />
        <KpiCard label="Passif total" value={formatFcfa(bilan.totalPassif)} />
        <KpiCard
          label="BÃ©nÃ©fice net"
          value={formatFcfaSigned(resultat.beneficeNet)}
          accent={resultat.beneficeNet >= 0 ? 'success' : 'danger'}
        />
      </div>

      {/* Bilan + Compte de rÃ©sultat */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bilan */}
        <div className="bg-white rounded-2xl shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-primary-900">Bilan</h2>
            {bilan.equilibre && (
              <span className="inline-flex rounded-full bg-success-100 px-2.5 py-0.5 text-xs font-medium text-success-800">
                Bilan Ã©quilibrÃ©
              </span>
            )}
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
            Actif
          </p>
          <div className="divide-y divide-slate-100">
            {bilan.actif.map(row => (
              <AmountRow
                key={row.account}
                label={`${row.account} ${row.name}`}
                value={formatFcfa(row.montant)}
              />
            ))}
            <AmountRow label="Total actif" value={formatFcfa(bilan.totalActif)} strong />
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1 mt-5">
            Passif
          </p>
          <div className="divide-y divide-slate-100">
            {bilan.passif.map(row => (
              <AmountRow
                key={row.account}
                label={`${row.account} ${row.name}`}
                value={formatFcfa(row.montant)}
              />
            ))}
            <AmountRow label="Total passif" value={formatFcfa(bilan.totalPassif)} strong />
          </div>
        </div>

        {/* Compte de rÃ©sultat */}
        <div className="bg-white rounded-2xl shadow-card p-6">
          <h2 className="text-base font-semibold text-primary-900 mb-4">Compte de rÃ©sultat</h2>
          <div className="divide-y divide-slate-100">
            <AmountRow label="Chiffre d'affaires" value={formatFcfa(resultat.ca)} />
            <AmountRow
              label="CoÃ»t des marchandises vendues"
              value={formatFcfaSigned(-resultat.cogs)}
              negative
            />
            <AmountRow label="Marge brute" value={formatFcfa(resultat.margeBrute)} strong />
            {resultat.charges.map(charge => (
              <AmountRow
                key={charge.account}
                label={`${charge.account} ${charge.name}`}
                value={formatFcfaSigned(-charge.montant)}
                negative
              />
            ))}
            {resultat.autresProduits > 0 && (
              <AmountRow
                label="Autres produits"
                value={formatFcfaSigned(resultat.autresProduits)}
                accent="success"
              />
            )}
            <AmountRow
              label="BÃ©nÃ©fice net"
              value={formatFcfaSigned(resultat.beneficeNet)}
              strong
              accent={resultat.beneficeNet >= 0 ? 'success' : 'danger'}
            />
          </div>
        </div>
      </div>

      {/* Journal */}
      <div className="bg-white rounded-2xl shadow-card p-6">
        <h2 className="text-base font-semibold text-primary-900 mb-4">Journal</h2>
        {journal.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Aucune Ã©criture au journal.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">LibellÃ© / Compte</th>
                  <th className="pb-3 pr-4 text-right">DÃ©bit</th>
                  <th className="pb-3 text-right">CrÃ©dit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {journal.map((entry, idx) => (
                  <Fragment key={`${entry.date}-${idx}`}>
                    <tr className="text-sm">
                      <td className="pt-3 pr-4 text-slate-500">{formatDateShort(entry.date)}</td>
                      <td className="pt-3 pr-4 font-medium text-primary-900" colSpan={3}>
                        {entry.libelle}
                      </td>
                    </tr>
                    {entry.lines.map((line, i) => (
                      <tr key={`${entry.date}-${idx}-${i}`} className="text-sm">
                        <td className="py-1.5 pr-4" />
                        <td className="py-1.5 pr-4 text-slate-600">
                          <span className="text-slate-400">{line.account}</span> {line.name}
                        </td>
                        <td className="py-1.5 pr-4 text-right text-primary-900">
                          {line.debit ? formatFcfa(line.debit) : 'â€”'}
                        </td>
                        <td className="py-1.5 text-right text-primary-900">
                          {line.credit ? formatFcfa(line.credit) : 'â€”'}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Grand livre */}
      <div className="bg-white rounded-2xl shadow-card p-6">
        <h2 className="text-base font-semibold text-primary-900 mb-4">Grand livre</h2>
        {grandLivre.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Aucun compte mouvementÃ©.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-4">Compte</th>
                  <th className="pb-3 pr-4 text-right">DÃ©bit</th>
                  <th className="pb-3 pr-4 text-right">CrÃ©dit</th>
                  <th className="pb-3 text-right">Solde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grandLivre.map(acc => (
                  <tr key={acc.account} className="text-sm">
                    <td className="py-3 pr-4 font-medium text-primary-900">
                      <span className="text-slate-400">{acc.account}</span> {acc.name}
                    </td>
                    <td className="py-3 pr-4 text-right text-slate-600">{formatFcfa(acc.debit)}</td>
                    <td className="py-3 pr-4 text-right text-slate-600">{formatFcfa(acc.credit)}</td>
                    <td className="py-3 text-right font-semibold text-primary-900">
                      {formatFcfa(acc.solde)}
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
      <h1 className="text-2xl font-bold text-primary-900">ComptabilitÃ©</h1>
      <p className="text-sm text-slate-500 mt-0.5">
        Partie double Â· bilan, rÃ©sultat, journal &amp; grand livre Â·{' '}
        <span className="text-slate-400">Vue lecture seule</span>
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
